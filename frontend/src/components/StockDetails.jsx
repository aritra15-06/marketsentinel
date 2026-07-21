import React, { useState, useEffect } from 'react';
import { Building2, TrendingUp, DollarSign, Gift, HeartHandshake, Loader2, Globe, Users, Briefcase } from 'lucide-react';
import { getStockDetails, saveStockDetails } from '../db';
import { fetchStockDetailsYF } from '../yf';

export default function StockDetails({ symbol }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        // Try loading from local IndexedDB cache
        let data = await getStockDetails(symbol);
        if (!data) {
          // Fetch directly from Yahoo Finance API
          data = await fetchStockDetailsYF(symbol);
          await saveStockDetails(symbol, data);
        }
        setDetails(data);
      } catch (err) {
        console.error("Error loading stock details locally/YF:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [symbol]);

  if (loading) {
    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)', marginBottom: '12px' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Loading detailed stock profile & financial statistics...</span>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
        Failed to load details for {symbol}.
      </div>
    );
  }

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return 'N/A';
    // Format large numbers in Indian formats (Lakhs/Crores)
    if (Math.abs(val) >= 10000000) {
      return `₹${(val / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    } else if (Math.abs(val) >= 100000) {
      return `₹${(val / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const formatPercent = (val) => {
    if (val === undefined || val === null) return 'N/A';
    return `${(val * 100).toFixed(2)}%`;
  };

  const renderProfileTab = () => (
    <div className="stock-profile-section">
      <h2>{details.longName || details.shortName || symbol}</h2>
      <div className="stock-profile-subtitle">
        {details.sectorDisp || details.sector} | {details.industryDisp || details.industry}
      </div>
      
      <div className="stock-meta-pill-container">
        <span className="meta-pill">
          <Globe size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          <a href={details.website} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
            {details.website ? details.website.replace('https://', '').replace('www.', '') : 'Website N/A'}
          </a>
        </span>
        <span className="meta-pill">
          <Users size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Employees: {details.fullTimeEmployees ? details.fullTimeEmployees.toLocaleString() : 'N/A'}
        </span>
        <span className="meta-pill">
          <Briefcase size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Exchange: {details.fullExchangeName || 'NSE'}
        </span>
      </div>

      <p className="long-summary">{details.longBusinessSummary}</p>

      {details.companyOfficers && details.companyOfficers.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Key Executives</h3>
          <div className="officers-list">
            {details.companyOfficers.slice(0, 5).map((officer, idx) => (
              <div key={idx} className="officer-item">
                <span className="officer-name">{officer.name}</span>
                <span className="officer-title">{officer.title} {officer.age ? `(Age ${officer.age})` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderValuationTab = () => (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-label">Current Price</span>
        <span className="metric-value">₹{(details.currentPrice || details.regularMarketPrice || 0).toFixed(2)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Market Capitalization</span>
        <span className="metric-value">{formatCurrency(details.marketCap)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Enterprise Value</span>
        <span className="metric-value">{formatCurrency(details.enterpriseValue)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Trailing P/E Ratio</span>
        <span className="metric-value">{details.trailingPE ? details.trailingPE.toFixed(2) : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Forward P/E Ratio</span>
        <span className="metric-value">{details.forwardPE ? details.forwardPE.toFixed(2) : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">PEG Ratio (5-Yr Expected)</span>
        <span className="metric-value">{details.pegRatio ? details.pegRatio.toFixed(2) : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Price to Book (P/B)</span>
        <span className="metric-value">{details.priceToBook ? details.priceToBook.toFixed(2) : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Price to Sales (P/S)</span>
        <span className="metric-value">{details.priceToSalesTrailing12Months ? details.priceToSalesTrailing12Months.toFixed(2) : 'N/A'}</span>
      </div>
    </div>
  );

  const renderFinancialsTab = () => (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-label">Total Revenue</span>
        <span className="metric-value">{formatCurrency(details.totalRevenue)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Net Income to Common</span>
        <span className="metric-value">{formatCurrency(details.netIncomeToCommon)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Revenue Growth</span>
        <span className="metric-value">{formatPercent(details.revenueGrowth)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Profit Margin</span>
        <span className="metric-value">{formatPercent(details.profitMargins)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Operating Margin</span>
        <span className="metric-value">{formatPercent(details.operatingMargins)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Gross Margin</span>
        <span className="metric-value">{formatPercent(details.grossMargins)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">EBITDA</span>
        <span className="metric-value">{formatCurrency(details.ebitda)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">EBITDA Margin</span>
        <span className="metric-value">{formatPercent(details.ebitdaMargins)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Total Cash</span>
        <span className="metric-value">{formatCurrency(details.totalCash)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Total Debt</span>
        <span className="metric-value">{formatCurrency(details.totalDebt)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Debt to Equity Ratio</span>
        <span className="metric-value">{details.debtToEquity ? `${details.debtToEquity.toFixed(2)}%` : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Book Value Per Share</span>
        <span className="metric-value">₹{details.bookValue ? details.bookValue.toFixed(2) : 'N/A'}</span>
      </div>
    </div>
  );

  const renderDividendsTab = () => (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-label">Dividend Rate (Annual)</span>
        <span className="metric-value">₹{details.dividendRate ? details.dividendRate.toFixed(2) : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Dividend Yield</span>
        <span className="metric-value">{details.dividendYield ? `${(details.dividendYield * 100).toFixed(2)}%` : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Payout Ratio</span>
        <span className="metric-value">{formatPercent(details.payoutRatio)}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">5-Year Average Yield</span>
        <span className="metric-value">{details.fiveYearAvgDividendYield ? `${details.fiveYearAvgDividendYield.toFixed(2)}%` : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Last Split Factor</span>
        <span className="metric-value">{details.lastSplitFactor || 'No Splits'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Last Split Date</span>
        <span className="metric-value">
          {details.lastSplitDate ? new Date(details.lastSplitDate * 1000).toLocaleDateString('en-IN') : 'N/A'}
        </span>
      </div>
    </div>
  );

  const renderRiskTab = () => (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-label">Target Mean Price</span>
        <span className="metric-value">{details.targetMeanPrice ? `₹${details.targetMeanPrice.toFixed(2)}` : 'N/A'}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Target Range</span>
        <span className="metric-value">
          {details.targetLowPrice && details.targetHighPrice 
            ? `₹${details.targetLowPrice.toFixed(0)} - ₹${details.targetHighPrice.toFixed(0)}` 
            : 'N/A'}
        </span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Analyst Recommendation</span>
        <span className="metric-value" style={{ textTransform: 'capitalize' }}>
          {details.recommendationKey ? details.recommendationKey.replace('_', ' ') : 'N/A'}
        </span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Analyst Count</span>
        <span className="metric-value">{details.numberOfAnalystOpinions || 'N/A'} opinions</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Audit Risk Factor</span>
        <span className="metric-value">{details.auditRisk || 'N/A'} / 10</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Board Risk Factor</span>
        <span className="metric-value">{details.boardRisk || 'N/A'} / 10</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Shareholder Rights Risk</span>
        <span className="metric-value">{details.shareHolderRightsRisk || 'N/A'} / 10</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Overall Risk Score</span>
        <span className="metric-value" style={{ color: details.overallRisk >= 7 ? 'var(--down-color)' : 'inherit' }}>
          {details.overallRisk || 'N/A'} / 10
        </span>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileTab();
      case 'valuation': return renderValuationTab();
      case 'financials': return renderFinancialsTab();
      case 'dividends': return renderDividendsTab();
      case 'risk': return renderRiskTab();
      default: return renderProfileTab();
    }
  };

  return (
    <div className="glass-card">
      <div className="details-tabs-header">
        <button 
          className={`details-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <Building2 size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Profile
        </button>
        <button 
          className={`details-tab-btn ${activeTab === 'valuation' ? 'active' : ''}`}
          onClick={() => setActiveTab('valuation')}
        >
          <TrendingUp size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Valuation
        </button>
        <button 
          className={`details-tab-btn ${activeTab === 'financials' ? 'active' : ''}`}
          onClick={() => setActiveTab('financials')}
        >
          <DollarSign size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Financials
        </button>
        <button 
          className={`details-tab-btn ${activeTab === 'dividends' ? 'active' : ''}`}
          onClick={() => setActiveTab('dividends')}
        >
          <Gift size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Dividends
        </button>
        <button 
          className={`details-tab-btn ${activeTab === 'risk' ? 'active' : ''}`}
          onClick={() => setActiveTab('risk')}
        >
          <HeartHandshake size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Consensus & Risk
        </button>
      </div>

      <div style={{ minHeight: '260px' }}>
        {renderContent()}
      </div>
    </div>
  );
}
