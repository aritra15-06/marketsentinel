import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import { getIntraday, saveIntraday } from '../db';
import { fetchStockIntradayYF } from '../yf';

export default function StockChart({ symbol, date }) {
  const [intervals, setIntervals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [showSMA, setShowSMA] = useState(false);

  useEffect(() => {
    const fetchIntraday = async () => {
      setLoading(true);
      try {
        // Try loading from local IndexedDB cache
        let data = await getIntraday(symbol, date);
        if (!data) {
          // Fetch directly from Yahoo Finance API
          data = await fetchStockIntradayYF(symbol, date);
          await saveIntraday(symbol, date, data);
        }
        setIntervals(data || []);
      } catch (err) {
        console.error("Error loading intraday intervals locally/YF:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchIntraday();
  }, [symbol, date]);

  if (loading) {
    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)', marginBottom: '12px' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Retrieving 15-minute intraday intervals for {symbol}...</span>
      </div>
    );
  }

  // Calculate day metrics from intervals
  let dayHigh = 0;
  let dayLow = 0;
  let firstPrice = 0;
  let lastPrice = 0;
  let pctChange = 0;
  let isUp = true;

  // Enrich intervals with VWAP and SMA calculations
  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;
  const enrichedIntervals = intervals.map((item, idx) => {
    const typicalPrice = (item.high + item.low + item.close) / 3;
    cumulativeTypicalVolume += typicalPrice * item.volume;
    cumulativeVolume += item.volume;
    const vwapVal = cumulativeVolume > 0 ? (cumulativeTypicalVolume / cumulativeVolume) : item.close;

    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, idx - 8); k <= idx; k++) {
      sum += intervals[k].close;
      count++;
    }
    const smaVal = sum / count;

    return {
      ...item,
      vwap: vwapVal,
      sma: smaVal
    };
  });

  if (intervals.length > 0) {
    const prices = intervals.map(i => i.close);
    dayHigh = Math.max(...intervals.map(i => i.high));
    dayLow = Math.min(...intervals.map(i => i.low));
    firstPrice = intervals[0].open;
    lastPrice = intervals[intervals.length - 1].close;
    pctChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    isUp = lastPrice >= firstPrice;
  }

  // Format short timestamp for XAxis display e.g. "09:15"
  const formatXAxis = (tickItem) => {
    try {
      const parts = tickItem.split(' ');
      if (parts.length === 2) {
        // Return only HH:MM
        return parts[1].substring(0, 5);
      }
      return tickItem;
    } catch (e) {
      return tickItem;
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          fontSize: '13px'
        }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>{data.timestamp}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            <div>Open: <strong style={{ color: '#fff' }}>₹{data.open.toFixed(2)}</strong></div>
            <div>Close: <strong style={{ color: 'var(--primary-color)' }}>₹{data.close.toFixed(2)}</strong></div>
            <div>High: <strong style={{ color: 'var(--up-color)' }}>₹{data.high.toFixed(2)}</strong></div>
            <div>Low: <strong style={{ color: 'var(--down-color)' }}>₹{data.low.toFixed(2)}</strong></div>
            <div style={{ gridColumn: 'span 2' }}>
              Volume: <strong style={{ color: '#fff' }}>{data.volume.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card">
        <div className="chart-header">
          <div className="chart-title-group">
            <h2>{symbol} Intraday View</h2>
            <p>15-Minute price segments for {date}</p>
          </div>
          {intervals.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', marginRight: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showVWAP} onChange={(e) => setShowVWAP(e.target.checked)} />
                  <span style={{ color: '#ffeb3b', fontWeight: 500 }}>VWAP</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showSMA} onChange={(e) => setShowSMA(e.target.checked)} />
                  <span style={{ color: '#e040fb', fontWeight: 500 }}>9 SMA</span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '6px', background: isUp ? 'var(--up-glow)' : 'var(--down-glow)', border: `1px solid ${isUp ? 'var(--up-color)' : 'var(--down-color)'}33` }}>
                {isUp ? <TrendingUp size={16} style={{ color: 'var(--up-color)' }} /> : <TrendingDown size={16} style={{ color: 'var(--down-color)' }} />}
                <span style={{ fontSize: '14px', fontWeight: 600, color: isUp ? 'var(--up-color)' : 'var(--down-color)' }}>
                  {isUp ? '+' : ''}{pctChange.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {intervals.length === 0 ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No intraday interval data available. Ensure the selected date is a valid weekday trading window.
          </div>
        ) : (
          <>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={enrichedIntervals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isUp ? 'var(--up-color)' : 'var(--down-color)'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={isUp ? 'var(--up-color)' : 'var(--down-color)'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatXAxis} 
                    stroke="var(--text-muted)"
                    style={{ fontSize: '11px' }}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    stroke="var(--text-muted)"
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="close" 
                    stroke={isUp ? 'var(--up-color)' : 'var(--down-color)'} 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                  />
                  {showVWAP && (
                    <Line 
                      type="monotone" 
                      dataKey="vwap" 
                      stroke="#ffeb3b" 
                      strokeWidth={1.5} 
                      dot={false} 
                      name="VWAP" 
                    />
                  )}
                  {showSMA && (
                    <Line 
                      type="monotone" 
                      dataKey="sma" 
                      stroke="#e040fb" 
                      strokeWidth={1.5} 
                      dot={false} 
                      name="9 SMA" 
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-stats-grid">
              <div className="chart-stat-item">
                <span className="chart-stat-label">Segment Open</span>
                <span className="chart-stat-value">₹{firstPrice.toFixed(2)}</span>
              </div>
              <div className="chart-stat-item">
                <span className="chart-stat-label">Segment Close</span>
                <span className="chart-stat-value" style={{ color: 'var(--primary-color)' }}>₹{lastPrice.toFixed(2)}</span>
              </div>
              <div className="chart-stat-item">
                <span className="chart-stat-label">Day High (OHLC)</span>
                <span className="chart-stat-value" style={{ color: 'var(--up-color)' }}>₹{dayHigh.toFixed(2)}</span>
              </div>
              <div className="chart-stat-item">
                <span className="chart-stat-label">Day Low (OHLC)</span>
                <span className="chart-stat-value" style={{ color: 'var(--down-color)' }}>₹{dayLow.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {intervals.length > 0 && (
        <div className="glass-card intraday-table-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Clock size={16} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ margin: 0 }}>Intraday Timestamps List</h3>
          </div>
          <div className="intraday-table-wrapper">
            <table className="stock-data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Open</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Close</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {intervals.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{row.timestamp}</td>
                    <td>₹{row.open.toFixed(2)}</td>
                    <td style={{ color: 'var(--up-color)' }}>₹{row.high.toFixed(2)}</td>
                    <td style={{ color: 'var(--down-color)' }}>₹{row.low.toFixed(2)}</td>
                    <td style={{ fontWeight: 600 }}>₹{row.close.toFixed(2)}</td>
                    <td>{row.volume.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
