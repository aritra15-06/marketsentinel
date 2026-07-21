import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Helper to make network requests bypassing CORS in Native, or using a proxy in Desktop browser
const makeRequest = async (url) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({ url });
      // CapacitorHttp returns raw data inside response.data
      if (typeof response.data === 'string') {
        return JSON.parse(response.data);
      }
      return response.data;
    } catch (e) {
      console.error("CapacitorHttp native request failed:", e);
      throw e;
    }
  } else {
    // Desktop Web browser fallback using a public CORS proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      throw new Error(`CORS proxy returned status: ${res.status}`);
    }
    return await res.json();
  }
};

// Helper to parse nested Yahoo Finance values safely
const val = (obj) => {
  if (obj === undefined || obj === null) return null;
  if (typeof obj === 'object') {
    return obj.raw !== undefined ? obj.raw : null;
  }
  return obj;
};

export const fetchStockDetailsYF = async (symbol) => {
  const symbolYF = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbolYF}?modules=assetProfile,financialData,defaultKeyStatistics,summaryDetail,recommendationTrend,earnings`;

  console.log(`Querying YF QuoteSummary directly: ${url}`);
  const data = await makeRequest(url);

  if (!data.quoteSummary || !data.quoteSummary.result || data.quoteSummary.result.length === 0) {
    throw new Error(`Invalid response returned from Yahoo Finance for ${symbol}`);
  }

  const result = data.quoteSummary.result[0];
  const profile = result.assetProfile || {};
  const fin = result.financialData || {};
  const stats = result.defaultKeyStatistics || {};
  const detail = result.summaryDetail || {};
  const earn = result.earnings || {};

  const flat = {
    symbol: symbol.toUpperCase(),
    longName: val(detail.longName) || val(stats.longName) || symbol,
    shortName: val(detail.shortName) || val(stats.shortName) || symbol,
    sector: profile.sector || 'Other',
    industry: profile.industry || 'Other',
    longBusinessSummary: profile.longBusinessSummary || 'No summary available.',
    website: profile.website || '',
    fullTimeEmployees: profile.fullTimeEmployees || 0,
    companyOfficers: (profile.companyOfficers || []).map(o => ({
      name: o.name,
      title: o.title,
      age: o.age
    })),
    
    // Financial margins
    profitMargins: val(stats.profitMargins) || 0,
    operatingMargins: val(stats.operatingMargins) || 0,
    grossMargins: val(stats.grossMargins) || 0,
    
    // Valuation Multiples
    trailingPE: val(detail.trailingPE) || null,
    forwardPE: val(stats.forwardPE) || null,
    priceToBook: val(stats.priceToBook) || null,
    enterpriseToRevenue: val(stats.enterpriseToRevenue) || null,
    enterpriseToEbitda: val(stats.enterpriseToEbitda) || null,
    
    // Dividends & Capital Actions
    dividendYield: val(detail.dividendYield) || 0,
    dividendRate: val(detail.dividendRate) || 0,
    fiveYearAvgDividendYield: val(detail.fiveYearAvgDividendYield) || 0,
    payoutRatio: val(detail.payoutRatio) || 0,
    lastSplitDate: stats.lastSplitDate ? new Date(stats.lastSplitDate * 1000).toISOString().split('T')[0] : null,
    lastSplitFactor: stats.lastSplitFactor || '',
    averageVolume: val(detail.averageVolume) || val(stats.averageVolume) || 0,
    
    // Analyst Ratings
    targetHighPrice: val(fin.targetHighPrice) || null,
    targetLowPrice: val(fin.targetLowPrice) || null,
    targetMeanPrice: val(fin.targetMeanPrice) || null,
    targetMedianPrice: val(fin.targetMedianPrice) || null,
    recommendationKey: fin.recommendationKey || 'N/A',
    numberOfAnalystOpinions: val(fin.numberOfAnalystOpinions) || 0,
    
    // Risk Scores
    overallRisk: profile.overallRisk || null,
    auditRisk: profile.auditRisk || null,
    boardRisk: profile.boardRisk || null,
    compensationRisk: profile.compensationRisk || null,
    shareHolderRightsRisk: profile.shareHolderRightsRisk || null
  };

  return flat;
};

export const fetchStockIntradayYF = async (symbol, dateStr) => {
  const symbolYF = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;
  
  // Calculate date windows (period1: start of day, period2: end of day)
  const dt = new Date(`${dateStr}T00:00:00Z`);
  const period1 = Math.floor(dt.getTime() / 1000);
  const period2 = period1 + 24 * 60 * 60 - 1;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbolYF}?interval=15m&period1=${period1}&period2=${period2}`;
  console.log(`Querying YF Chart directly: ${url}`);
  const data = await makeRequest(url);

  if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
    throw new Error(`Failed to fetch chart data from Yahoo Finance for ${symbol}`);
  }

  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const quote = result.indicators.quote[0] || {};
  
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const intervals = [];
  for (let i = 0; i < timestamps.length; i++) {
    // Filter out intervals that do not have a close price (non-trading times)
    if (closes[i] !== null && closes[i] !== undefined) {
      const time = new Date(timestamps[i] * 1000);
      // Format timestamp string in local IST (market timezone)
      const timestampStr = time.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
      intervals.push({
        timestamp: timestampStr,
        open: opens[i] || closes[i],
        high: highs[i] || closes[i],
        low: lows[i] || closes[i],
        close: closes[i],
        volume: volumes[i] || 0
      });
    }
  }

  return intervals;
};
