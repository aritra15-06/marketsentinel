import os
import json
import pandas as pd
from datetime import datetime, timedelta
from curl_cffi import requests
from io import StringIO
import yfinance as yf
from database import get_db_connection

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def safe_int(val, default=0):
    if pd.isna(val):
        return default
    s = str(val).strip()
    if s == "" or s == "-" or s == "." or s == "null":
        return default
    try:
        return int(float(s))
    except ValueError:
        return default

def safe_float(val, default=0.0):
    if pd.isna(val):
        return default
    s = str(val).strip()
    if s == "" or s == "-" or s == "." or s == "null":
        return default
    try:
        return float(s)
    except ValueError:
        return default

def fetch_daily_market_data(date_str: str):
    """
    Downloads daily Bhavcopy and Price Bands (circuits) for the given date (YYYY-MM-DD),
    merges them, and stores the results in the SQLite database.
    """
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise ValueError("Invalid date format. Expected YYYY-MM-DD.")
        
    date_formatted_dmy = dt.strftime("%d%m%Y") # DDMMYYYY
    
    # 1. URLs
    bhavcopy_url = f"https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{date_formatted_dmy}.csv"
    pricebands_url = f"https://nsearchives.nseindia.com/content/equities/sec_list_{date_formatted_dmy}.csv"
    
    # 2. Download Bhavcopy
    print(f"Downloading Bhavcopy from {bhavcopy_url} ...")
    r_bhav = requests.get(bhavcopy_url, headers=HEADERS, impersonate="chrome120")
    if r_bhav.status_code != 200:
        raise Exception(f"Bhavcopy not available for date {date_str} (Status: {r_bhav.status_code}). Note: Markets are closed on weekends/holidays.")
        
    # 3. Download Price Bands
    print(f"Downloading Price Bands from {pricebands_url} ...")
    r_bands = requests.get(pricebands_url, headers=HEADERS, impersonate="chrome120")
    if r_bands.status_code != 200:
        print(f"Warning: Price bands list not available for {date_str} (Status: {r_bands.status_code}). Proceeding with default 'No Band' values.")
        has_bands = False
    else:
        has_bands = True
        
    # 4. Parse Bhavcopy
    bhav_df = pd.read_csv(StringIO(r_bhav.text))
    bhav_df.columns = bhav_df.columns.str.strip()
    bhav_df['SYMBOL'] = bhav_df['SYMBOL'].str.strip()
    bhav_df['SERIES'] = bhav_df['SERIES'].str.strip()
    
    # 5. Parse Price Bands and Merge
    if has_bands:
        bands_df = pd.read_csv(StringIO(r_bands.text))
        bands_df.columns = bands_df.columns.str.strip()
        bands_df['Symbol'] = bands_df['Symbol'].str.strip()
        bands_df['Series'] = bands_df['Series'].str.strip()
        bands_df['Band'] = bands_df['Band'].str.strip()
        
        merged_df = pd.merge(
            bhav_df, 
            bands_df[['Symbol', 'Series', 'Band']], 
            left_on=['SYMBOL', 'SERIES'], 
            right_on=['Symbol', 'Series'], 
            how='left'
        )
        # Clean up columns and fill NaNs
        merged_df['price_band'] = merged_df['Band'].fillna("No Band")
        # Remove extra merge key columns
        if 'Symbol' in merged_df.columns:
            merged_df = merged_df.drop(columns=['Symbol'])
        if 'Series' in merged_df.columns:
            merged_df = merged_df.drop(columns=['Series'])
    else:
        merged_df = bhav_df.copy()
        merged_df['price_band'] = "No Band"
        
    # 6. Save to SQLite database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Remove existing daily stock entries for this date to support overwrites
    cursor.execute("DELETE FROM daily_stocks WHERE date = ?", (date_str,))
    
    # Write merged rows
    count = 0
    for _, row in merged_df.iterrows():
        # Handle possible NaN or non-numeric values in fields
        prev_close = safe_float(row.get('PREV_CLOSE', 0))
        open_p = safe_float(row.get('OPEN_PRICE', 0))
        high_p = safe_float(row.get('HIGH_PRICE', 0))
        low_p = safe_float(row.get('LOW_PRICE', 0))
        last_p = safe_float(row.get('LAST_PRICE', 0))
        close_p = safe_float(row.get('CLOSE_PRICE', 0))
        avg_p = safe_float(row.get('AVG_PRICE', 0))
        vol = safe_int(row.get('TTL_TRD_QNTY', 0))
        turnover = safe_float(row.get('TURNOVER_LACS', 0))
        trades = safe_int(row.get('NO_OF_TRADES', 0))
        deliv_qty = safe_int(row.get('DELIV_QTY', 0))
        deliv_pct = safe_float(row.get('DELIV_PER', 0))
        
        cursor.execute("""
            INSERT OR REPLACE INTO daily_stocks (
                date, symbol, series, prev_close, open_price, high_price, low_price, 
                last_price, close_price, avg_price, volume, turnover, trades, 
                deliverable_qty, deliverable_pct, price_band
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            date_str,
            str(row['SYMBOL']),
            str(row['SERIES']),
            prev_close,
            open_p,
            high_p,
            low_p,
            last_p,
            close_p,
            avg_p,
            vol,
            turnover,
            trades,
            deliv_qty,
            deliv_pct,
            str(row['price_band'])
        ))
        count += 1
        
    # Mark the date as successfully fetched
    cursor.execute("""
        INSERT OR REPLACE INTO daily_bhavcopy_dates (date, fetched_at)
        VALUES (?, ?)
    """, (date_str, datetime.now().isoformat()))
    
    conn.commit()
    conn.close()
    
    print(f"Successfully loaded {count} stocks for date {date_str} in database.")
    return count


def fetch_stock_details_from_yf(symbol: str):
    """
    Downloads detailed info (166 fields) from yfinance, caches it, and returns the dict.
    """
    # Append Yahoo Finance suffix
    symbol_yf = symbol if symbol.endswith(".NS") else f"{symbol}.NS"
    print(f"Fetching yfinance info for {symbol_yf}...")
    
    ticker = yf.Ticker(symbol_yf)
    info = ticker.info
    if not info or 'symbol' not in info:
        # Retry without .NS or return empty if invalid
        print(f"Warning: Failed to fetch with .NS suffix. Attempting raw symbol {symbol}...")
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
    if not info:
        raise Exception(f"No yfinance data returned for stock {symbol}")
        
    # Cache in database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO stock_details_cache (symbol, updated_at, info_json)
        VALUES (?, ?, ?)
    """, (symbol, datetime.now().isoformat(), json.dumps(info)))
    
    # Save key fields in symbols_master registry for scanning queries
    company_name = info.get('longName') or info.get('shortName') or symbol
    sector = info.get('sector', 'Other')
    industry = info.get('industry', 'Other')
    avg_vol = info.get('averageVolume', 0)
    
    cursor.execute("""
        INSERT OR REPLACE INTO symbols_master (symbol, company_name, sector, industry, avg_volume)
        VALUES (?, ?, ?, ?, ?)
    """, (symbol, company_name, sector, industry, avg_vol))
    
    conn.commit()
    conn.close()
    
    return info


def bootstrap_top_stocks():
    """
    Pre-caches sector/industry metadata for top Indian stocks to populate scan reports immediately.
    """
    top_symbols = [
        "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "ITC", "HINDUNILVR", 
        "LT", "BAJFINANCE", "HCLTECH", "MARUTI", "SUNPHARMA", "AXISBANK", "ONGC", 
        "NTPC", "TITAN", "COALINDIA", "TATASTEEL", "BHARTIARTL", "ADANIENT", "POWERGRID"
    ]
    print("Bootstrapping sector metadata for top stocks...")
    success_count = 0
    for sym in top_symbols:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT symbol FROM symbols_master WHERE symbol = ?", (sym,))
            exists = cursor.fetchone()
            conn.close()
            
            if not exists:
                fetch_stock_details_from_yf(sym)
                success_count += 1
                import time
                time.sleep(1) # Be friendly to Yahoo Finance servers
        except Exception as e:
            print(f"Error bootstrapping {sym}: {e}")
    print(f"Bootstrapper finished. Successfully cached {success_count} top stock profiles.")


def fetch_stock_intraday_from_yf(symbol: str, date_str: str, interval: str = "15m"):
    """
    Downloads historical intraday data for a given symbol and date window from yfinance,
    caches it, and returns the interval list.
    """
    symbol_yf = symbol if symbol.endswith(".NS") else f"{symbol}.NS"
    print(f"Fetching intraday ({interval}) for {symbol_yf} on {date_str}...")
    
    # Calculate start and end date (end is exclusive)
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    next_day_dt = dt + timedelta(days=1)
    end_date_str = next_day_dt.strftime("%Y-%m-%d")
    
    # Download interval data
    df = yf.download(symbol_yf, start=date_str, end=end_date_str, interval=interval)
    
    intervals = []
    if not df.empty:
        # Check MultiIndex columns (which yfinance sometimes returns for download)
        # Flatten columns if MultiIndex
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [col[0] for col in df.columns]
            
        for index, row in df.iterrows():
            # Get timestamp as string (converting datetime index)
            timestamp_str = index.strftime("%Y-%m-%d %H:%M:%S")
            intervals.append({
                "timestamp": timestamp_str,
                "open": float(row.get('Open', 0)),
                "high": float(row.get('High', 0)),
                "low": float(row.get('Low', 0)),
                "close": float(row.get('Close', 0)),
                "volume": int(row.get('Volume', 0))
            })
            
    # Cache in database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO stock_intraday_cache (symbol, date, interval, intervals_json)
        VALUES (?, ?, ?, ?)
    """, (symbol, date_str, interval, json.dumps(intervals)))
    conn.commit()
    conn.close()
    
    return intervals

if __name__ == "__main__":
    # Test scraping for a recent day
    import sys
    test_date = "2026-07-20"
    if len(sys.argv) > 1:
        test_date = sys.argv[1]
    
    print(f"Testing scraper for date {test_date}...")
    try:
        count = fetch_daily_market_data(test_date)
        print("Success! Merged and stored", count, "stocks.")
        
        # Test details
        details = fetch_stock_details_from_yf("RELIANCE")
        print("Detailed keys count:", len(details.keys()))
        
        # Test intraday
        intraday = fetch_stock_intraday_from_yf("RELIANCE", test_date)
        print("Intraday records count:", len(intraday))
    except Exception as e:
        print("Error during test:", str(e))
