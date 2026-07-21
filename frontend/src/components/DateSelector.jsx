import React, { useState } from 'react';
import { Calendar, Download, AlertCircle, RefreshCw, X } from 'lucide-react';

export default function DateSelector({
  availableDates,
  selectedDate,
  onSelectDate,
  onFetchDate,
  fetching,
  sidebarOpen,
  setSidebarOpen
}) {
  // Default to today's date in local YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [inputDate, setInputDate] = useState(getTodayString());
  const [errorMsg, setErrorMsg] = useState("");

  const handleFetchClick = async () => {
    setErrorMsg("");
    if (!inputDate) {
      setErrorMsg("Please select a date.");
      return;
    }
    
    // Check if weekend (Saturday=6, Sunday=0)
    const dateObj = new Date(inputDate);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setErrorMsg("Note: Markets are closed on weekends.");
    }
    
    try {
      await onFetchDate(inputDate);
      if (setSidebarOpen) setSidebarOpen(false); // Close sidebar on mobile after fetch triggers
    } catch (err) {
      setErrorMsg(err.message || "Failed to fetch data.");
    }
  };

  // Helper to format date display e.g. "20 Jul 2026"
  const formatDateDisplay = (dateStr) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--primary-color)', boxShadow: '0 0 8px var(--primary-glow)' }} />
          <span className="logo-text">MarketSentinel</span>
        </div>
        <button 
          className="sidebar-close-btn" 
          onClick={() => setSidebarOpen(false)}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>
      
      <div className="fetch-section">
        <h3>Fetch Daily Market</h3>
        <div className="fetch-controls">
          <input
            type="date"
            className="date-input"
            value={inputDate}
            onChange={(e) => setInputDate(e.target.value)}
            disabled={fetching}
          />
          <button
            className="btn-primary"
            onClick={handleFetchClick}
            disabled={fetching}
          >
            {fetching ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Fetching...
              </>
            ) : (
              <>
                <Download size={16} />
                Fetch Daily Data
              </>
            )}
          </button>
          {errorMsg && (
            <div style={{ color: 'var(--down-color)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="dates-list-section">
        <h3>Memory Section</h3>
        {availableDates.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
            No dates saved. Select a date above to load market data.
          </div>
        ) : (
          <div className="dates-list">
            {availableDates.map((item) => (
              <div
                key={item.date}
                className={`date-item ${selectedDate === item.date ? 'active' : ''}`}
                onClick={() => { onSelectDate(item.date); if (setSidebarOpen) setSidebarOpen(false); }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span className="date-item-text">{formatDateDisplay(item.date)}</span>
                  <span className="date-item-meta">{item.date}</span>
                </div>
                <Calendar size={14} style={{ color: selectedDate === item.date ? 'var(--primary-color)' : 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
