
// A lightweight Promise-based wrapper for IndexedDB
// Handles large data storage that exceeds LocalStorage limits (5MB)

const DB_NAME = 'AShareAnalysisDB';
const DB_VERSION = 1;

export const STORES = {
  MARKET: 'market_data',     // For K-Line and Financials
  ANALYSIS: 'analysis_results' // For Gemini Reports
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.MARKET)) {
        db.createObjectStore(STORES.MARKET);
      }
      if (!db.objectStoreNames.contains(STORES.ANALYSIS)) {
        db.createObjectStore(STORES.ANALYSIS);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const db = {
  get: async <T>(storeName: string, key: string): Promise<T | null> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        
        req.onsuccess = () => {
           const record = req.result;
           if (!record) { 
             resolve(null); 
             return; 
           }
           
           // Check TTL (Time To Live)
           if (record.expiry && Date.now() > record.expiry) {
               // Expired: Lazy delete
               try {
                 const delTx = db.transaction(storeName, 'readwrite');
                 delTx.objectStore(storeName).delete(key);
               } catch (e) { console.warn("Lazy delete failed", e); }
               resolve(null);
           } else {
               resolve(record.data);
           }
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) { 
      console.warn(`[DB] Get Error (${storeName}):`, e);
      return null; 
    }
  },

  set: async (storeName: string, key: string, data: any, ttlMs: number = 0) => {
    try {
      const db = await openDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        const record = {
          data,
          expiry: ttlMs > 0 ? Date.now() + ttlMs : null,
          timestamp: Date.now()
        };

        const req = store.put(record, key);
        
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`[DB] Set Error (${storeName}):`, e);
    }
  },

  clear: async (storeName: string) => {
     try {
       const db = await openDB();
       const tx = db.transaction(storeName, 'readwrite');
       tx.objectStore(storeName).clear();
     } catch(e) { console.error(e); }
  }
};
