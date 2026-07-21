import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingUp, BarChart3, Database, Loader2, ArrowUpRight, ArrowDownRight, Volume2 } from 'lucide-react';
import { getDailyStocksRaw, getStockDetails } from '../db';

export default function AnalystScanners({ date, onSelectStock }) {
  const [subTab, setSubTab] = useState('accumulation'); // 'accumulation' or 'surveillance'
  
  // Accumulation state
  const [accumStocks, setAccumStocks] = useState([]);
  const [accumLoading, setAccumLoading] = useState(false);
  
  // Surveillance state
  const [survData, setSurvData] = useState({ near_upper_circuit: [], near_lower_circuit: [], volume_breakouts: [] });
  const [survLoading, setSurvLoading] = useState(false);

  useEffect(() => {
    if (subTab === 'accumulation') {
      const fetchAccumulation = async () => {
        setAccumLoading(true);
        try {
          const raw = await getDailyStocksRaw(date);
          
          // Filter: volume > 50000 and deliverable_pct > 35
          // Match company names and sectors from cached details if available
          const processed = [];
          for (const s of raw) {
            if (s.volume > 50000 && s.deliverable_pct > 35) {
              const cached = await getStockDetails(s.symbol);
              processed.push({
                symbol: s.symbol,
                series: s.series,
                prev_close: s.prev_close,
                close: s.close,
                volume: s.volume,
                deliverable_qty: s.deliverable_qty,
                deliverable_pct: s.deliverable_pct,
                price_band: s.price_band,
                company_name: cached ? cached.longName : "N/A",
                sector: cached ? cached.sector : "Other"
              });
            }
          }

          // Sort deliverable_pct DESC
          processed.sort((a, b) => b.deliverable_pct - a.deliverable_pct);
          setAccumStocks(processed.slice(0, 50));
        } catch (e) {
          console.error("Error executing accumulation scan locally:", e);
        } finally {
          setAccumLoading(false);
        }
      };
      fetchAccumulation();
    } else {
      const fetchSurveillance = async () => {
        setSurvLoading(true);
        try {
          const raw = await getDailyStocksRaw(date);
          
          const upper = [];
          const lower = [];
          const breakouts = [];

          for (const s of raw) {
            const cached = await getStockDetails(s.symbol);
            const companyName = cached ? cached.longName : "N/A";

            // 1. Circuit limits check
            if (s.price_band && s.price_band !== 'No Band' && s.price_band !== '') {
              const band = parseFloat(s.price_band);
              if (!isNaN(band)) {
                const upperLimit = s.prev_close * (1 + band / 100);
                const lowerLimit = s.prev_close * (1 - band / 100);
                
                if (s.close >= upperLimit * 0.985) {
                  upper.push({
                     symbol: s.symbol,
                     series: s.series,
                     prev_close: s.prev_close,
                     close: s.close,
                     volume: s.volume,
                     price_band: s.price_band,
                     company_name: companyName
                  });
                }
                
                if (s.close <= lowerLimit * 1.015) {
                  lower.push({
                     symbol: s.symbol,
                     series: s.series,
                     prev_close: s.prev_close,
                     close: s.close,
                     volume: s.volume,
                     price_band: s.price_band,
                     company_name: companyName
                  });
                }
              }
            }

            // 2. Volume breakout check (utilizes averageVolume cached from YF)
            if (cached && cached.averageVolume > 10000 && s.volume > cached.averageVolume * 2) {
              const ratio = s.volume / cached.averageVolume;
              breakouts.push({
                symbol: s.symbol,
                series: s.series,
                prev_close: s.prev_close,
                close: s.close,
                volume: s.volume,
                avg_volume: cached.averageVolume,
                ratio: ratio,
                company_name: companyName
              });
            }
          }

          // Sort outputs
          upper.sort((a, b) => {
            const limitA = a.prev_close * (1 + parseFloat(a.price_band) / 100);
            const limitB = b.prev_close * (1 + parseFloat(b.price_band) / 100);
            return (b.close / limitB) - (a.close / limitA);
          });
          
          lower.sort((a, b) => {
            const limitA = a.prev_close * (1 - parseFloat(a.price_band) / 100);
            const limitB = b.prev_close * (1 - parseFloat(b.price_band) / 100);
            return (a.close / limitA) - (b.close / limitB);
          });
          
          breakouts.sort((a, b) => b.ratio - a.ratio);

          setSurvData({
            near_upper_circuit: upper.slice(0, 30),
            near_lower_circuit: lower.slice(0, 30),
            volume_breakouts: breakouts.slice(0, 30)
          });
        } catch (e) {
          console.error("Error executing surveillance scan locally:", e);
        } finally {
          setSurvLoading(false);
        }
      };
      fetchSurveillance();
    }
  }, [date, subTab]);

  const renderAccumulationTab = () => {
    if (accumLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary-color)', marginBottom: '12px' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Scanning delivery volume metrics...</span>
        </div>
      );
    }

    return (
      <div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
          <strong>Delivery & Accumulation Scanner:</strong> Finds stocks where deliverable percentage is extremely high (&gt;35%) and volume is significant (&gt;50,000 shares). This highlights equities experiencing high-conviction institutional accumulation.
        </p>

        <div className="table-container">
          <table className="stock-data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Company Name</th>
                <th>Sector</th>
                <th>Close Price</th>
                <th>Volume</th>
                <th>Deliverable Qty</th>
                <th>Delivery %</th>
              </tr>
            </thead>
            <tbody>
              {accumStocks.map((row) => (
                <tr key={row.symbol}>
                  <td>
                    <span className="stock-symbol-cell" onClick={() => onSelectStock(row.symbol)}>
                      {row.symbol}
                    </span>
                  </td>
                  <td>{row.company_name}</td>
                  <td><span className="badge-series">{row.sector}</span></td>
                  <td style={{ fontWeight: 600 }}>₹{row.close.toFixed(2)}</td>
                  <td>{row.volume.toLocaleString('en-IN')}</td>
                  <td>{row.deliverable_qty.toLocaleString('en-IN')}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${row.deliverable_pct}%`, height: '100%', background: 'var(--primary-color)', boxShadow: '0 0 6px var(--primary-glow)' }} />
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{row.deliverable_pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {accumStocks.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No accumulation alerts found for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSurveillanceTab = () => {
    if (survLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary-color)', marginBottom: '12px' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Scanning circuit boundaries and volume breakouts...</span>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '20px' }}>
        
        {/* 1. Near Upper Circuit */}
        <div className="glass-card" style={{ background: 'rgba(23, 29, 43, 0.3)', margin: 0, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--up-color)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <ArrowUpRight size={18} />
            <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Near Upper Circuit</h3>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {survData.near_upper_circuit.map((s) => {
              const limit = s.prev_close * (1 + parseFloat(s.price_band) / 100);
              const dist = ((limit - s.close) / limit) * 100;
              return (
                <div key={s.symbol} style={{ padding: '10px', background: 'rgba(0, 230, 118, 0.03)', border: '1px solid rgba(0, 230, 118, 0.15)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="stock-symbol-cell" onClick={() => onSelectStock(s.symbol)}>{s.symbol}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.company_name}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>₹{s.close.toFixed(2)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--up-color)' }}>{dist.toFixed(2)}% to Limit ({s.price_band}%)</span>
                  </div>
                </div>
              );
            })}
            {survData.near_upper_circuit.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No stocks near upper circuit limit.
              </div>
            )}
          </div>
        </div>

        {/* 2. Near Lower Circuit */}
        <div className="glass-card" style={{ background: 'rgba(23, 29, 43, 0.3)', margin: 0, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--down-color)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <ArrowDownRight size={18} />
            <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Near Lower Circuit</h3>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {survData.near_lower_circuit.map((s) => {
              const limit = s.prev_close * (1 - parseFloat(s.price_band) / 100);
              const dist = ((s.close - limit) / limit) * 100;
              return (
                <div key={s.symbol} style={{ padding: '10px', background: 'rgba(255, 23, 68, 0.03)', border: '1px solid rgba(255, 23, 68, 0.15)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="stock-symbol-cell" onClick={() => onSelectStock(s.symbol)}>{s.symbol}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.company_name}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>₹{s.close.toFixed(2)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--down-color)' }}>{dist.toFixed(2)}% to Limit ({s.price_band}%)</span>
                  </div>
                </div>
              );
            })}
            {survData.near_lower_circuit.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No stocks near lower circuit limit.
              </div>
            )}
          </div>
        </div>

        {/* 3. Volume Breakouts */}
        <div className="glass-card" style={{ background: 'rgba(23, 29, 43, 0.3)', margin: 0, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Volume2 size={18} />
            <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume Breakouts</h3>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {survData.volume_breakouts.map((s) => (
              <div key={s.symbol} style={{ padding: '10px', background: 'rgba(0, 229, 255, 0.03)', border: '1px solid rgba(0, 229, 255, 0.15)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="stock-symbol-cell" onClick={() => onSelectStock(s.symbol)}>{s.symbol}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.company_name}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{s.ratio.toFixed(1)}x Vol</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>V: {(s.volume/100000).toFixed(1)}L (Avg: {(s.avg_volume/100000).toFixed(1)}L)</span>
                </div>
              </div>
            ))}
            {survData.volume_breakouts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No volume breakouts found. Scrape popular symbols first to build baseline volumes.
              </div>
            )}
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="glass-card">
      <div className="details-tabs-header" style={{ marginBottom: '20px' }}>
        <button 
          className={`details-tab-btn ${subTab === 'accumulation' ? 'active' : ''}`}
          onClick={() => setSubTab('accumulation')}
        >
          <TrendingUp size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Delivery Accumulation
        </button>
        <button 
          className={`details-tab-btn ${subTab === 'surveillance' ? 'active' : ''}`}
          onClick={() => setSubTab('surveillance')}
        >
          <ShieldAlert size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Surveillance Monitor
        </button>
      </div>

      <div>
        {subTab === 'accumulation' ? renderAccumulationTab() : renderSurveillanceTab()}
      </div>
    </div>
  );
}
