import React, { useState, useEffect } from 'react';
import { ChevronLeft, TrendingUp, HelpCircle, Activity, Menu, Settings, X } from 'lucide-react';
import DateSelector from './components/DateSelector';
import StockTable from './components/StockTable';
import StockChart from './components/StockChart';
import StockDetails from './components/StockDetails';
import AnalystScanners from './components/AnalystScanners';
import SectorBreadth from './components/SectorBreadth';
import { getApiBase, setApiBase } from './utils';
import './App.css';

function App() {
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('board'); // 'board', 'scanners', 'breadth'
  
  // Mobile drawer and settings states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState(getApiBase());

  // Splash screen state (displays MarketSentinel with bottom "AD" brand)
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch dates in memory database on mount
  const fetchAvailableDates = async (selectLatest = false) => {
    setDatesLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/available-dates`);
      if (res.ok) {
        const json = await res.json();
        setAvailableDates(json || []);
        
        // Auto-select latest fetched date if none is selected
        if (json && json.length > 0) {
          if (selectLatest || !selectedDate) {
            setSelectedDate(json[0].date);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching dates:", e);
    } finally {
      setDatesLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableDates();
  }, []);

  const handleFetchDate = async (dateStr) => {
    setFetching(true);
    try {
      const res = await fetch(`${getApiBase()}/api/fetch-date?date=${dateStr}`, {
        method: 'POST'
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || "Scraper engine returned an error.");
      }
      // Reload dates list and force select the newly fetched date
      setSelectedDate(dateStr);
      setSelectedStock(null);
      await fetchAvailableDates(true);
    } catch (e) {
      throw e;
    } finally {
      setFetching(false);
    }
  };

  const handleSelectDate = (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedStock(null);
  };

  // Helper to format date header
  const formatDateHeader = (dateStr) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const handleSaveSettings = () => {
    setApiBase(tempApiUrl);
    setShowSettings(false);
    window.location.reload();
  };

  return (
    <div className="app-container">
      {/* Splash Screen */}
      {showSplash && (
        <div className="splash-screen" style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(135deg, #090e17 0%, #151d30 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: '#fff'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            textAlign: 'center'
          }}>
            {/* Glowing Shield logo image */}
            <img src="logo.png" alt="MarketSentinel Logo" className="pulse" style={{
              width: '100px',
              height: '100px',
              borderRadius: '24px',
              border: '2px solid var(--primary-color)',
              boxShadow: '0 0 30px rgba(0, 229, 255, 0.3)',
              objectFit: 'cover',
              marginBottom: '10px'
            }} />
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '2.5px',
                color: 'var(--primary-color)',
                textTransform: 'uppercase',
                textShadow: '0 0 15px rgba(0, 229, 255, 0.2)'
              }}>MarketSentinel</h1>
              <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>NSE Stock Scraper & Memory Vault</p>
            </div>
          </div>
          <div style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '18px',
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.15)',
            letterSpacing: '3px'
          }}>
            AD
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '400px', padding: '24px', position: 'relative' }}>
            <button 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              onClick={() => setShowSettings(false)}
            >
              <X size={18} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: 'var(--primary-color)' }} />
              API Connection Settings
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
              Enter the IP address of your desktop backend server (e.g. <code>http://192.168.1.50:8000</code>) to connect from your Android device.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>FastAPI Endpoint URL</label>
              <input 
                type="text" 
                value={tempApiUrl} 
                onChange={(e) => setTempApiUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveSettings}>Save & Reload</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Date selector and memory records */}
      <DateSelector
        availableDates={availableDates}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        onFetchDate={handleFetchDate}
        fetching={fetching}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Mobile drawer overlay backdrop */}
      {sidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 99
          }}
        />
      )}

      {/* Main Content Pane */}
      <div className="main-content">
        <header className="top-nav" style={{ padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <button 
              className="btn-icon mobile-menu-btn" 
              onClick={() => setSidebarOpen(true)}
              style={{ marginRight: '12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <Menu size={20} />
            </button>
            <div className="active-date-display">
              <span className="active-date-text">
                {selectedDate ? formatDateHeader(selectedDate) : "Welcome to MarketSentinel"}
              </span>
            </div>
          </div>

          {selectedDate && !selectedStock && (
            <div className="details-tabs-header" style={{ border: 'none', margin: 0, height: '100%', display: 'flex', alignItems: 'center' }}>
              <button 
                className={`details-tab-btn ${activeMainTab === 'board' ? 'active' : ''}`}
                style={{ height: '100%', padding: '0 20px' }}
                onClick={() => setActiveMainTab('board')}
              >
                Market Board
              </button>
              <button 
                className={`details-tab-btn ${activeMainTab === 'scanners' ? 'active' : ''}`}
                style={{ height: '100%', padding: '0 20px' }}
                onClick={() => setActiveMainTab('scanners')}
              >
                Analyst Scanners
              </button>
              <button 
                className={`details-tab-btn ${activeMainTab === 'breadth' ? 'active' : ''}`}
                style={{ height: '100%', padding: '0 20px' }}
                onClick={() => setActiveMainTab('breadth')}
              >
                Sector Breadth
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-secondary)' }} className="api-online-status">
              <Activity size={16} style={{ color: 'var(--primary-color)' }} />
              <span>Scraper API Online</span>
            </div>
            <button 
              className="btn-icon"
              onClick={() => setShowSettings(true)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: '50%' }}
              title="API Connection Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="dashboard-body">
          {selectedStock ? (
            // Detailed Stock splits view
            <div>
              <div className="back-row">
                <button 
                  className="btn-secondary"
                  onClick={() => setSelectedStock(null)}
                >
                  <ChevronLeft size={16} />
                  Back to Stocks List
                </button>
              </div>

              <div className="details-grid">
                {/* Left side: Intraday charts */}
                <StockChart symbol={selectedStock} date={selectedDate} />

                {/* Right side: Detailed 166-fields metrics view */}
                <StockDetails symbol={selectedStock} />
              </div>
            </div>
          ) : selectedDate ? (
            // Route to correct sub-view based on tab
            activeMainTab === 'board' ? (
              <StockTable
                date={selectedDate}
                onSelectStock={(sym) => setSelectedStock(sym)}
              />
            ) : activeMainTab === 'scanners' ? (
              <AnalystScanners
                date={selectedDate}
                onSelectStock={(sym) => setSelectedStock(sym)}
              />
            ) : (
              <SectorBreadth
                date={selectedDate}
                onSelectStock={(sym) => setSelectedStock(sym)}
              />
            )
          ) : (
            // No Date Selected Welcome screen
            <div className="welcome-container">
              <div className="welcome-icon-wrapper">
                <TrendingUp size={48} />
              </div>
              <h2>NSE Stock Memory Vault</h2>
              <p>
                To get started, select a trading date in the calendar input on the left and click 
                <strong> "Fetch Daily Data"</strong>. This will pull the NSE market snapshot, 
                extract stock circuits, and store the details locally in the memory database.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
