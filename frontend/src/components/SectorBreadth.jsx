import React, { useState, useEffect } from 'react';
import { Layers, Activity, Loader2, ArrowUpRight, ArrowDownRight, Users } from 'lucide-react';
import { getDailyStocksRaw, getStockDetails } from '../db';

export default function SectorBreadth({ date, onSelectStock }) {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSector, setActiveSector] = useState(null); // name of expanded sector
  const [sectorStocksData, setSectorStocksData] = useState([]);
  const [stocksLoading, setStocksLoading] = useState(false);

  useEffect(() => {
    const fetchSectors = async () => {
      setLoading(true);
      setActiveSector(null);
      try {
        const raw = await getDailyStocksRaw(date);
        const sectorMap = {};
        
        for (const s of raw) {
          const cached = await getStockDetails(s.symbol);
          if (cached && cached.sector && cached.sector !== 'Other' && cached.sector !== '') {
            const sec = cached.sector;
            if (!sectorMap[sec]) {
              sectorMap[sec] = {
                sector: sec,
                total_stocks: 0,
                total_return: 0,
                advances: 0,
                declines: 0,
                total_volume: 0,
                symbols: []
              };
            }
            
            const secObj = sectorMap[sec];
            secObj.total_stocks += 1;
            const ret = s.prev_close > 0 ? ((s.close - s.prev_close) / s.prev_close) * 100 : 0;
            secObj.total_return += ret;
            if (s.close > s.prev_close) secObj.advances += 1;
            else if (s.close < s.prev_close) secObj.declines += 1;
            secObj.total_volume += s.volume;
            secObj.symbols.push(s.symbol);
          }
        }

        const sectorsList = Object.values(sectorMap).map(secData => ({
          sector: secData.sector,
          total_stocks: secData.total_stocks,
          avg_return: secData.total_stocks > 0 ? (secData.total_return / secData.total_stocks) : 0,
          advances: secData.advances,
          declines: secData.declines,
          total_volume: secData.total_volume,
          symbols: secData.symbols
        }));

        sectorsList.sort((a, b) => b.avg_return - a.avg_return);
        setSectors(sectorsList);
      } catch (e) {
        console.error("Error calculating sector breadth locally:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSectors();
  }, [date]);

  // Load daily prices for stocks in the active sector
  useEffect(() => {
    if (!activeSector) return;
    
    const selectedSectorObj = sectors.find(s => s.sector === activeSector);
    if (!selectedSectorObj || !selectedSectorObj.symbols || selectedSectorObj.symbols.length === 0) {
      setSectorStocksData([]);
      return;
    }

    const fetchSectorStocks = async () => {
      setStocksLoading(true);
      try {
        const raw = await getDailyStocksRaw(date);
        const filtered = raw.filter(item => 
          selectedSectorObj.symbols.includes(item.symbol)
        );
        setSectorStocksData(filtered);
      } catch (e) {
        console.error("Error loading sector constituents locally:", e);
      } finally {
        setStocksLoading(false);
      }
    };

    fetchSectorStocks();
  }, [activeSector, sectors, date]);

  const formatVolume = (val) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
    return val.toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary-color)', marginBottom: '12px' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Calculating sector returns and advance/decline breadth...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card" style={{ margin: 0 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
          <strong>Sector Breadth & Capital Rotations:</strong> Analyzes daily stock performance grouped by company sectors. High avg returns and high advance/decline ratios indicate industry-wide tailwinds. Click a sector card to drill down and inspect its constituent stocks.
        </p>

        {sectors.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            No sector breadth data found. Run the bootstrapper or visit stock profile tabs to populate sector registries.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {sectors.map((s) => {
              const isUp = s.avg_return >= 0;
              const isExpanded = activeSector === s.sector;
              
              return (
                <div 
                  key={s.sector} 
                  className="glass-card"
                  style={{ 
                    margin: 0, 
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(0,229,255,0.03)' : 'var(--card-bg)',
                    borderColor: isExpanded ? 'var(--primary-color)' : 'var(--border-color)',
                    boxShadow: isExpanded ? '0 0 12px rgba(0,229,255,0.1)' : 'none'
                  }}
                  onClick={() => setActiveSector(isExpanded ? null : s.sector)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{s.sector}</h3>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: isUp ? 'var(--up-color)' : 'var(--down-color)' }}>
                      {isUp ? '+' : ''}{s.avg_return.toFixed(2)}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Breadth (A / D):</span>
                      <span style={{ fontWeight: 500 }}>
                        <span style={{ color: 'var(--up-color)' }}>{s.advances}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / </span>
                        <span style={{ color: 'var(--down-color)' }}>{s.declines}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Traded Volume:</span>
                      <span style={{ color: '#fff', fontWeight: 500 }}>{formatVolume(s.total_volume)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tracked Stocks:</span>
                      <span>{s.total_stocks}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeSector && (
        <div className="glass-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Layers size={16} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ margin: 0 }}>Constituents inside {activeSector}</h3>
          </div>

          {stocksLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
              <Loader2 className="animate-spin" size={20} style={{ color: 'var(--primary-color)' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading sector constituents...</span>
            </div>
          ) : sectorStocksData.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '10px 0' }}>
              No active trades recorded in this sector on {date}.
            </div>
          ) : (
            <div className="table-container">
              <table className="stock-data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Series</th>
                    <th>Open</th>
                    <th>High</th>
                    <th>Low</th>
                    <th>Close</th>
                    <th>Change</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorStocksData.map((row) => {
                    const change = row.close - row.prev_close;
                    const pctChange = row.prev_close > 0 ? (change / row.prev_close) * 100 : 0;
                    const isUp = change >= 0;
                    
                    return (
                      <tr key={row.symbol}>
                        <td>
                          <span className="stock-symbol-cell" onClick={() => onSelectStock(row.symbol)}>
                            {row.symbol}
                          </span>
                        </td>
                        <td><span className="badge-series">{row.series}</span></td>
                        <td>₹{row.open.toFixed(2)}</td>
                        <td>₹{row.high.toFixed(2)}</td>
                        <td>₹{row.low.toFixed(2)}</td>
                        <td style={{ fontWeight: 600 }}>₹{row.close.toFixed(2)}</td>
                        <td>
                          <span className={isUp ? 'price-change-up' : 'price-change-down'}>
                            {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{pctChange.toFixed(2)}%)
                          </span>
                        </td>
                        <td>{row.volume.toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
