import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Helper to make text requests bypassing CORS in Native, or using a CORS proxy in Web Browser
const makeRequestText = async (url) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({ 
        url,
        dataType: 'text'
      });
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
    return await res.text();
  }
};

// Simple, robust CSV string parser
const parseCSV = (text) => {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  // Parse headers, trim spaces and uppercase them
  const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
  
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = line.split(',');
    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = fields[j] !== undefined ? fields[j].trim() : '';
    }
    results.push(record);
  }
  return results;
};

// Numeric cleaner
const parseNum = (val, isInt = false) => {
  if (!val || val === '-' || val === 'N/A') return 0;
  const num = isInt ? parseInt(val, 10) : parseFloat(val);
  return isNaN(num) ? 0 : num;
};

export const scrapeDate = async (dateStr) => {
  // dateStr is 'YYYY-MM-DD', convert to 'DDMMYYYY'
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${dateStr}`);
  }
  const [year, month, day] = parts;
  const formattedDate = `${day}${month}${year}`;

  const bhavcopyUrl = `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${formattedDate}.csv`;
  const priceBandsUrl = `https://nsearchives.nseindia.com/content/equities/sec_list_${formattedDate}.csv`;

  console.log(`Scraping NSE Bhavcopy: ${bhavcopyUrl}`);
  console.log(`Scraping NSE Price Bands: ${priceBandsUrl}`);

  let bhavcopyText, priceBandsText;
  try {
    bhavcopyText = await makeRequestText(bhavcopyUrl);
  } catch (e) {
    throw new Error(`Failed to download Bhavcopy for ${dateStr}. Markets are closed on weekends/holidays, or check your internet connection.`);
  }

  try {
    priceBandsText = await makeRequestText(priceBandsUrl);
  } catch (e) {
    console.warn("Failed to download price bands list. Defaulting all bands to 'No Band'.");
    priceBandsText = "";
  }

  // Parse files
  const bhavcopyRows = parseCSV(bhavcopyText);
  const priceBandRows = parseCSV(priceBandsText);

  // Map price bands by Symbol
  const bandsMap = {};
  priceBandRows.forEach(row => {
    // Headers in sec_list: SYMBOL, SECURITY NAME, SERIES, PRICE BAND
    const sym = row['SYMBOL'];
    const band = row['PRICE BAND'] || row['PRICE_BAND'] || row['BAND'];
    if (sym) {
      bandsMap[sym.toUpperCase()] = band || 'No Band';
    }
  });

  // Merge and build clean objects
  const merged = [];
  bhavcopyRows.forEach(row => {
    const sym = row['SYMBOL'];
    if (!sym) return;

    const series = row['SERIES'] || 'EQ';
    const prevClose = parseNum(row['PREV_CLOSE']);
    const open = parseNum(row['OPEN_PRICE']);
    const high = parseNum(row['HIGH_PRICE']);
    const low = parseNum(row['LOW_PRICE']);
    const close = parseNum(row['CLOSE_PRICE']);
    const volume = parseNum(row['TTL_TRD_QTYS'], true);
    const trades = parseNum(row['NO_OF_TRADES'], true);
    const deliverableQty = parseNum(row['DELIV_QTY'], true);
    const deliverablePct = parseNum(row['DELIV_PCT']);

    const band = bandsMap[sym.toUpperCase()] || 'No Band';

    merged.push({
      symbol: sym,
      series,
      prev_close: prevClose,
      open,
      high,
      low,
      close,
      volume,
      trades,
      deliverable_qty: deliverableQty,
      deliverable_pct: deliverablePct,
      price_band: band
    });
  });

  if (merged.length === 0) {
    throw new Error("No trade records found in the parsed Bhavcopy CSV.");
  }

  return merged;
};

// Bootstrapper to pre-fetch sector descriptors for top stocks locally
const TOP_SYMBOLS = [
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "ITC", "HINDUNILVR", 
  "LT", "BAJFINANCE", "HCLTECH", "MARUTI", "SUNPHARMA", "AXISBANK", "ONGC", 
  "NTPC", "TITAN", "COALINDIA", "TATASTEEL", "BHARTIARTL", "ADANIENT", "POWERGRID"
];

export const bootstrapSectors = async (getStockDetails, saveStockDetails) => {
  console.log("Bootstrapping sector metadata locally...");
  for (const sym of TOP_SYMBOLS) {
    try {
      const cached = await getStockDetails(sym);
      if (!cached) {
        const info = await fetchStockDetailsYF(sym);
        await saveStockDetails(sym, info);
        await new Promise(r => setTimeout(r, 200)); // be friendly to network
      }
    } catch (e) {
      console.warn(`Error bootstrapping details for ${sym}:`, e);
    }
  }
};

// Inline helper to import and fetch details directly
import { fetchStockDetailsYF } from './yf';
