import React, { useState, useEffect } from 'react';
import { ChevronLeft, TrendingUp, HelpCircle, Activity, Menu, Settings, X } from 'lucide-react';
import DateSelector from './components/DateSelector';
import StockTable from './components/StockTable';
import StockChart from './components/StockChart';
import StockDetails from './components/StockDetails';
import AnalystScanners from './components/AnalystScanners';
import SectorBreadth from './components/SectorBreadth';
import { getApiBase, setApiBase } from './utils';
import { getAvailableDates, saveDailyStocks, saveDateRecord, getStockDetails, saveStockDetails } from './db';
import { scrapeDate, bootstrapSectors } from './scraper';
import './App.css';

function App() {
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('board'); // 'board', 'scanners', 'breadth'
  
  // Mobile drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      const dates = await getAvailableDates();
      setAvailableDates(dates || []);
      
      // Auto-select latest fetched date if none is selected
      if (dates && dates.length > 0) {
        if (selectLatest || !selectedDate) {
          setSelectedDate(dates[0].date);
        }
      }
    } catch (e) {
      console.error("Error fetching dates locally:", e);
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
      // 1. Run local CSV scraper
      const mergedList = await scrapeDate(dateStr);
      
      // 2. Save data in phone's IndexedDB
      await saveDailyStocks(dateStr, mergedList);
      await saveDateRecord(dateStr);
      
      // 3. Force select the newly fetched date
      setSelectedDate(dateStr);
      setSelectedStock(null);

      // 4. Refresh dates list
      await fetchAvailableDates(true);
      
      // 5. Background bootstrap top stock sectors
      bootstrapSectors(getStockDetails, saveStockDetails);
      
    } catch (err) {
      console.error("Scrape error:", err);
      throw err;
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <Activity size={16} style={{ color: 'var(--primary-color)' }} />
              <span>Standalone App Mode</span>
            </div>
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
