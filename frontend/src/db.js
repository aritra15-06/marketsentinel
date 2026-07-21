const DB_NAME = 'MarketSentinelDB';
const DB_VERSION = 1;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store dates list
      if (!db.objectStoreNames.contains('dates')) {
        db.createObjectStore('dates', { keyPath: 'date' });
      }

      // Store stocks bulk daily data (key is the date string, value is the stocks array)
      if (!db.objectStoreNames.contains('stocks')) {
        db.createObjectStore('stocks', { keyPath: 'date' });
      }

      // Store stock detailed profile cache
      if (!db.objectStoreNames.contains('details')) {
        db.createObjectStore('details', { keyPath: 'symbol' });
      }

      // Store intraday intervals cache
      if (!db.objectStoreNames.contains('intraday')) {
        db.createObjectStore('intraday', { keyPath: 'id' });
      }
    };
  });
};

// Available Dates functions
export const getAvailableDates = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dates', 'readonly');
    const store = tx.objectStore('dates');
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort dates descending
      const dates = request.result || [];
      dates.sort((a, b) => b.date.localeCompare(a.date));
      resolve(dates);
    };

    request.onerror = () => reject(request.error);
  });
};

export const saveDateRecord = async (date) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dates', 'readwrite');
    const store = tx.objectStore('dates');
    const request = store.put({
      date,
      fetched_at: new Date().toISOString()
    });

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// Daily Stocks functions
export const saveDailyStocks = async (date, stocks) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stocks', 'readwrite');
    const store = tx.objectStore('stocks');
    const request = store.put({ date, data: stocks });

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

export const getDailyStocksRaw = async (date) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stocks', 'readonly');
    const store = tx.objectStore('stocks');
    const request = store.get(date);

    request.onsuccess = () => {
      resolve(request.result ? request.result.data : []);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getDailyStocks = async (date, search = '', page = 1, limit = 50, sortBy = 'symbol', sortOrder = 'asc') => {
  const rawStocks = await getDailyStocksRaw(date);
  
  // 1. Filter
  let filtered = rawStocks;
  if (search.trim()) {
    const term = search.toLowerCase().trim();
    filtered = rawStocks.filter(s => 
      s.symbol.toLowerCase().includes(term) || 
      (s.company_name && s.company_name.toLowerCase().includes(term))
    );
  }

  // 2. Sort
  filtered.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    // Clean string comparison or numeric comparison
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      valA = valA === undefined || valA === null ? 0 : valA;
      valB = valB === undefined || valB === null ? 0 : valB;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
  });

  // 3. Paginate
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  return {
    data: paginated,
    total: filtered.length
  };
};

// Stock Details cache functions
export const getStockDetails = async (symbol) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('details', 'readonly');
    const store = tx.objectStore('details');
    const request = store.get(symbol.toUpperCase());

    request.onsuccess = () => {
      const record = request.result;
      if (record) {
        // Check if cached details are fresh (within 12 hours)
        const ageMs = new Date() - new Date(record.updated_at);
        if (ageMs < 12 * 60 * 60 * 1000) {
          resolve(record.info);
          return;
        }
      }
      resolve(null); // Cache stale or not found
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveStockDetails = async (symbol, info) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('details', 'readwrite');
    const store = tx.objectStore('details');
    const request = store.put({
      symbol: symbol.toUpperCase(),
      updated_at: new Date().toISOString(),
      info
    });

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// Intraday cache functions
export const getIntraday = async (symbol, date) => {
  const db = await initDB();
  const id = `${symbol.toUpperCase()}_${date}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('intraday', 'readonly');
    const store = tx.objectStore('intraday');
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result ? request.result.intervals : null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveIntraday = async (symbol, date, intervals) => {
  const db = await initDB();
  const id = `${symbol.toUpperCase()}_${date}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('intraday', 'readwrite');
    const store = tx.objectStore('intraday');
    const request = store.put({
      id,
      symbol: symbol.toUpperCase(),
      date,
      intervals
    });

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};
