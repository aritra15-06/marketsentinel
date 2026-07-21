import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Loader2 } from 'lucide-react';
import { getApiBase } from '../utils';

export default function StockTable({ date, onSelectStock }) {
  const [stocks, setStocks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("symbol");
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(false);
  const limit = 50;

  useEffect(() => {
    // Reset page to 1 when date or search query changes
    setPage(1);
  }, [date, search]);

  useEffect(() => {
    const fetchStocks = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${getApiBase()}/api/stocks-for-date?date=${date}&search=${search}&page=${page}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`
        );
        const json = await res.json();
        setStocks(json.data || []);
        setTotal(json.total || 0);
      } catch (err) {
        console.error("Error fetching stocks for date:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
  }, [date, page, search, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Helper to calculate upper and lower circuits
  const renderCircuitLimits = (row) => {
    const band = row.price_band;
    const prevClose = row.prev_close;
    
    if (band && band !== "No Band") {
      try {
        const pct = parseFloat(band) / 100.0;
        const lowerLimit = prevClose * (1 - pct);
        const upperLimit = prevClose * (1 + pct);
        return (
          <div className="circuit-info-box">
            <span className="band-badge numeric">{band}% Band</span>
            <span className="circuit-bounds">
              L: {lowerLimit.toFixed(2)} | U: {upperLimit.toFixed(2)}
            </span>
          </div>
        );
      } catch (e) {
        return <span className="band-badge no-band">{band}</span>;
      }
    }
    
    return (
      <div className="circuit-info-box">
        <span className="band-badge no-band">No Band (F&O)</span>
        <span className="circuit-bounds">Dynamic limits</span>
      </div>
    );
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="glass-card">
      <div className="table-header-row">
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search stock symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Showing <strong>{stocks.length}</strong> of <strong>{total}</strong> stocks traded
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay">
          <Loader2 className="animate-spin text-cyan" size={40} style={{ color: 'var(--primary-color)' }} />
          <span>Querying stock memory database...</span>
        </div>
      ) : stocks.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          No stocks found matching the criteria. Make sure daily data is fetched.
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="stock-data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("symbol")}>Symbol <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                  <th onClick={() => handleSort("series")}>Series</th>
                  <th onClick={() => handleSort("open")}>Open <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                  <th onClick={() => handleSort("high")}>High <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                  <th onClick={() => handleSort("low")}>Low <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                  <th onClick={() => handleSort("close")}>Close <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                  <th>Change</th>
                  <th onClick={() => handleSort("volume")}>Volume <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                  <th onClick={() => handleSort("turnover")}>Turnover (Lacs)</th>
                  <th onClick={() => handleSort("price_band")}>Price Band / Circuit <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((row) => {
                  const change = row.close - row.prev_close;
                  const pctChange = row.prev_close > 0 ? (change / row.prev_close) * 100 : 0;
                  const isUp = change >= 0;
                  
                  return (
                    <tr key={`${row.symbol}-${row.series}`}>
                      <td>
                        <span 
                          className="stock-symbol-cell"
                          onClick={() => onSelectStock(row.symbol)}
                        >
                          {row.symbol}
                        </span>
                      </td>
                      <td>
                        <span className="badge-series">{row.series}</span>
                      </td>
                      <td>{row.open.toFixed(2)}</td>
                      <td>{row.high.toFixed(2)}</td>
                      <td>{row.low.toFixed(2)}</td>
                      <td style={{ fontWeight: 600 }}>{row.close.toFixed(2)}</td>
                      <td>
                        <span className={isUp ? 'price-change-up' : 'price-change-down'}>
                          {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{pctChange.toFixed(2)}%)
                        </span>
                      </td>
                      <td>{row.volume.toLocaleString('en-IN')}</td>
                      <td>{row.turnover.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td>{renderCircuitLimits(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination-container">
              <span className="pagination-info">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <div className="pagination-buttons">
                <button
                  className="btn-secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>
                <button
                  className="btn-secondary"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
