from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from datetime import datetime, timedelta
from database import get_db_connection
from scraper import (
    fetch_daily_market_data, 
    fetch_stock_details_from_yf, 
    fetch_stock_intraday_from_yf
)

app = FastAPI(title="NSE Stock Memory Scraper API")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/fetch-date")
def trigger_fetch_date(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    """
    Triggers fetching of the Bhavcopy and Price Bands for a given date.
    """
    try:
        # Validate date format
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    try:
        count = fetch_daily_market_data(date)
        return {"status": "success", "message": f"Successfully loaded {count} stocks for {date}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/available-dates")
def get_available_dates():
    """
    Returns a sorted list of dates available in the memory database.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT date, fetched_at FROM daily_bhavcopy_dates ORDER BY date DESC")
    rows = cursor.fetchall()
    conn.close()
    
    return [{"date": row["date"], "fetched_at": row["fetched_at"]} for row in rows]


@app.get("/api/stocks-for-date")
def get_stocks_for_date(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    search: str = Query("", description="Fuzzy search on Symbol"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("symbol", description="Sort by column name"),
    sort_order: str = Query("asc", description="Sort order: asc or desc")
):
    """
    Retrieves the daily stocks data for the specified date.
    Supports search, dynamic sorting, and pagination.
    """
    # Whitelist sort columns to prevent SQL injection
    sort_whitelist = {
        "symbol": "symbol",
        "series": "series",
        "prev_close": "prev_close",
        "open": "open_price",
        "high": "high_price",
        "low": "low_price",
        "close": "close_price",
        "volume": "volume",
        "turnover": "turnover",
        "trades": "trades",
        "price_band": "price_band"
    }
    
    db_sort_col = sort_whitelist.get(sort_by.lower(), "symbol")
    db_sort_order = "ASC" if sort_order.lower() == "asc" else "DESC"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. First, check if there is data for this date
    cursor.execute("SELECT COUNT(*) as cnt FROM daily_stocks WHERE date = ?", (date,))
    total_in_db = cursor.fetchone()["cnt"]
    if total_in_db == 0:
        conn.close()
        return {
            "data": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "message": f"No data found in memory for date {date}. Please trigger a fetch first."
        }
        
    # 2. Build Query
    query_base = "FROM daily_stocks WHERE date = ?"
    params = [date]
    
    if search:
        query_base += " AND (symbol LIKE ? OR series LIKE ?)"
        params.extend([f"%{search.upper()}%", f"%{search.upper()}%"])
        
    # 3. Get Total filtered count
    cursor.execute(f"SELECT COUNT(*) as cnt {query_base}", params)
    total_filtered = cursor.fetchone()["cnt"]
    
    # 4. Fetch Paginated Rows
    offset = (page - 1) * limit
    params.extend([limit, offset])
    
    query = f"""
        SELECT symbol, series, prev_close, open_price, high_price, low_price, 
               last_price, close_price, avg_price, volume, turnover, trades, 
               deliverable_qty, deliverable_pct, price_band
        {query_base}
        ORDER BY {db_sort_col} {db_sort_order}
        LIMIT ? OFFSET ?
    """
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    data = []
    for r in rows:
        data.append({
            "symbol": r["symbol"],
            "series": r["series"],
            "prev_close": r["prev_close"],
            "open": r["open_price"],
            "high": r["high_price"],
            "low": r["low_price"],
            "last": r["last_price"],
            "close": r["close_price"],
            "avg_price": r["avg_price"],
            "volume": r["volume"],
            "turnover": r["turnover"],
            "trades": r["trades"],
            "deliverable_qty": r["deliverable_qty"],
            "deliverable_pct": r["deliverable_pct"],
            "price_band": r["price_band"]
        })
        
    return {
        "data": data,
        "total": total_filtered,
        "page": page,
        "limit": limit
    }


@app.get("/api/stock-details/{symbol}")
def get_stock_details(symbol: str):
    """
    Fetches detailed info for a stock. Loads from cache if fresh (within 12 hours),
    otherwise queries yfinance and updates the cache.
    """
    symbol_upper = symbol.upper()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT updated_at, info_json FROM stock_details_cache WHERE symbol = ?", (symbol_upper,))
    row = cursor.fetchone()
    
    if row:
        updated_at = datetime.fromisoformat(row["updated_at"])
        # Check if cache is older than 12 hours
        if datetime.now() - updated_at < timedelta(hours=12):
            conn.close()
            print(f"Returning cached details for {symbol_upper}")
            return json.loads(row["info_json"])
            
    conn.close()
    
    # Not found or stale, fetch from yfinance
    try:
        info = fetch_stock_details_from_yf(symbol_upper)
        return info
    except Exception as e:
        # If fetch fails, return cached if exists, else error
        if row:
            print(f"Fetch failed: {e}. Returning stale cache for {symbol_upper}")
            return json.loads(row["info_json"])
        raise HTTPException(status_code=504, detail=f"Failed to fetch stock details: {str(e)}")


@app.get("/api/stock-intraday/{symbol}")
def get_stock_intraday(
    symbol: str, 
    date: str = Query(..., description="Date in YYYY-MM-DD format")
):
    """
    Retrieves intraday 15-minute price intervals for the stock on that date.
    Loads from cache, or downloads from yfinance and caches if not present.
    """
    symbol_upper = symbol.upper()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT intervals_json FROM stock_intraday_cache 
        WHERE symbol = ? AND date = ? AND interval = '15m'
    """, (symbol_upper, date))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        print(f"Returning cached intraday for {symbol_upper} on {date}")
        return json.loads(row["intervals_json"])
        
    # Not found, download from yfinance
    try:
        intervals = fetch_stock_intraday_from_yf(symbol_upper, date)
        return intervals
    except Exception as e:
        raise HTTPException(status_code=504, detail=f"Failed to fetch intraday data: {str(e)}")

@app.get("/api/scanners/accumulation")
def get_accumulation_stocks(date: str = Query(..., description="Date YYYY-MM-DD")):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT s.symbol, s.series, s.prev_close, s.close_price, s.volume, s.deliverable_qty, s.deliverable_pct, s.price_band, m.company_name, m.sector
        FROM daily_stocks s
        LEFT JOIN symbols_master m ON s.symbol = m.symbol
        WHERE s.date = ? AND s.volume > 50000 AND s.deliverable_pct > 35
        ORDER BY s.deliverable_pct DESC
        LIMIT 50
    """
    
    cursor.execute(query, (date,))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "symbol": r["symbol"],
            "series": r["series"],
            "prev_close": r["prev_close"],
            "close": r["close_price"],
            "volume": r["volume"],
            "deliverable_qty": r["deliverable_qty"],
            "deliverable_pct": r["deliverable_pct"],
            "price_band": r["price_band"],
            "company_name": r["company_name"] or "N/A",
            "sector": r["sector"] or "Other"
        })
    return result


@app.get("/api/scanners/surveillance")
def get_surveillance_data(date: str = Query(..., description="Date YYYY-MM-DD")):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Near Upper Circuit (within 1.5% limit)
    # limit formula: close >= prev_close * (1 + band/100) * 0.985
    upper_query = """
        SELECT s.symbol, s.series, s.prev_close, s.close_price, s.volume, s.price_band, m.company_name
        FROM daily_stocks s
        LEFT JOIN symbols_master m ON s.symbol = m.symbol
        WHERE s.date = ? AND s.price_band != 'No Band' AND s.price_band != ''
          AND s.close_price >= (s.prev_close * (1 + CAST(s.price_band AS REAL) / 100) * 0.985)
        ORDER BY (s.close_price / (s.prev_close * (1 + CAST(s.price_band AS REAL) / 100))) DESC
        LIMIT 30
    """
    cursor.execute(upper_query, (date,))
    upper_rows = cursor.fetchall()
    
    # 2. Near Lower Circuit (within 1.5% limit)
    lower_query = """
        SELECT s.symbol, s.series, s.prev_close, s.close_price, s.volume, s.price_band, m.company_name
        FROM daily_stocks s
        LEFT JOIN symbols_master m ON s.symbol = m.symbol
        WHERE s.date = ? AND s.price_band != 'No Band' AND s.price_band != ''
          AND s.close_price <= (s.prev_close * (1 - CAST(s.price_band AS REAL) / 100) * 1.015)
        ORDER BY (s.close_price / (s.prev_close * (1 - CAST(s.price_band AS REAL) / 100))) ASC
        LIMIT 30
    """
    cursor.execute(lower_query, (date,))
    lower_rows = cursor.fetchall()
    
    # 3. Volume Breakouts (volume > 2x average volume)
    breakout_query = """
        SELECT s.symbol, s.series, s.prev_close, s.close_price, s.volume, m.avg_volume, m.company_name
        FROM daily_stocks s
        INNER JOIN symbols_master m ON s.symbol = m.symbol
        WHERE s.date = ? AND m.avg_volume > 10000 AND s.volume > (m.avg_volume * 2)
        ORDER BY (CAST(s.volume AS REAL) / m.avg_volume) DESC
        LIMIT 30
    """
    cursor.execute(breakout_query, (date,))
    breakout_rows = cursor.fetchall()
    
    conn.close()
    
    near_upper = []
    for r in upper_rows:
        near_upper.append({
            "symbol": r["symbol"],
            "series": r["series"],
            "prev_close": r["prev_close"],
            "close": r["close_price"],
            "volume": r["volume"],
            "price_band": r["price_band"],
            "company_name": r["company_name"] or "N/A"
        })
        
    near_lower = []
    for r in lower_rows:
        near_lower.append({
            "symbol": r["symbol"],
            "series": r["series"],
            "prev_close": r["prev_close"],
            "close": r["close_price"],
            "volume": r["volume"],
            "price_band": r["price_band"],
            "company_name": r["company_name"] or "N/A"
        })
        
    breakouts = []
    for r in breakout_rows:
        ratio = r["volume"] / r["avg_volume"] if r["avg_volume"] > 0 else 0
        breakouts.append({
            "symbol": r["symbol"],
            "series": r["series"],
            "prev_close": r["prev_close"],
            "close": r["close_price"],
            "volume": r["volume"],
            "avg_volume": r["avg_volume"],
            "ratio": ratio,
            "company_name": r["company_name"] or "N/A"
        })
        
    return {
        "near_upper_circuit": near_upper,
        "near_lower_circuit": near_lower,
        "volume_breakouts": breakouts
    }


@app.get("/api/scanners/sectors")
def get_sector_performances(date: str = Query(..., description="Date YYYY-MM-DD")):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            m.sector,
            COUNT(*) as total_stocks,
            AVG(CASE WHEN s.prev_close > 0 THEN ((s.close_price - s.prev_close) / s.prev_close) * 100 ELSE 0 END) as avg_return,
            SUM(CASE WHEN s.close_price > s.prev_close THEN 1 ELSE 0 END) as advances,
            SUM(CASE WHEN s.close_price < s.prev_close THEN 1 ELSE 0 END) as declines,
            SUM(s.volume) as total_volume
        FROM daily_stocks s
        INNER JOIN symbols_master m ON s.symbol = m.symbol
        WHERE s.date = ? AND m.sector IS NOT NULL AND m.sector != 'Other' AND m.sector != ''
        GROUP BY m.sector
        ORDER BY avg_return DESC
    """
    cursor.execute(query, (date,))
    rows = cursor.fetchall()
    
    # Also fetch all symbols grouped by sector to filter on clicking
    symbols_query = """
        SELECT s.symbol, m.sector
        FROM daily_stocks s
        INNER JOIN symbols_master m ON s.symbol = m.symbol
        WHERE s.date = ? AND m.sector IS NOT NULL AND m.sector != 'Other' AND m.sector != ''
    """
    cursor.execute(symbols_query, (date,))
    sym_rows = cursor.fetchall()
    conn.close()
    
    sector_symbols = {}
    for r in sym_rows:
        sec = r["sector"]
        if sec not in sector_symbols:
            sector_symbols[sec] = []
        sector_symbols[sec].append(r["symbol"])
        
    result = []
    for r in rows:
        sec = r["sector"]
        result.append({
            "sector": sec,
            "total_stocks": r["total_stocks"],
            "avg_return": r["avg_return"],
            "advances": r["advances"],
            "declines": r["declines"],
            "total_volume": r["total_volume"],
            "symbols": sector_symbols.get(sec, [])
        })
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
