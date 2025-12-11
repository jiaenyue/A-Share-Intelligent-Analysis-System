
import { StockData, Candle, FinancialSnapshot } from '../types/stock';
import { processIndicators } from '../utils/indicators';

// Declare global callback for JSONP
declare global {
  interface Window {
    [key: string]: any;
  }
}

/**
 * Determine EastMoney Market ID
 * 1 = Shanghai (6xxxxx)
 * 0 = Shenzhen (0xxxxx, 3xxxxx), Beijing (4xxxxx, 8xxxxx)
 */
const getEastMoneySecId = (code: string): string => {
  const c = code.replace('sh.', '').replace('sz.', '');
  if (c.startsWith('6')) return `1.${c}`;
  return `0.${c}`; 
};

/**
 * Determine Tencent Symbol
 * sh.600519 -> sh600519
 */
const getTencentSymbol = (code: string): string => {
    // If it already has dot, remove it. If it doesn't have prefix, add it.
    if (code.includes('.')) return code.replace('.', '');
    
    // Heuristic if prefix is missing
    if (code.startsWith('6')) return `sh${code}`;
    return `sz${code}`;
};

// Generic JSONP Fetcher
const jsonpFetch = (url: string, callbackName: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        let timeoutId: any;

        const cleanup = () => {
            if ((window as any)[callbackName]) {
                delete (window as any)[callbackName];
            }
            const script = document.getElementById(callbackName);
            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };

        (window as any)[callbackName] = (json: any) => {
            clearTimeout(timeoutId);
            cleanup();
            resolve(json);
        };

        const script = document.createElement('script');
        script.id = callbackName;
        script.src = url;
        script.async = true;
        // CRITICAL FIX: Prevent referrer blocking (Script Error)
        script.referrerPolicy = 'no-referrer'; 
        
        script.onerror = () => {
            clearTimeout(timeoutId);
            cleanup();
            // Resolve with null to allow failover
            console.warn(`JSONP blocked for ${url}`);
            resolve(null);
        };

        document.body.appendChild(script);

        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`Request timed out for ${url}`));
        }, 5000); 
    });
};

// --- STRATEGY 1: NODEJS BACKEND PROXY ---
const fetchKLinesBackendProxy = async (code: string): Promise<{ candles: Candle[], financials: FinancialSnapshot | null }> => {
    try {
        // Skip proxy if we are on HTTPS but backend is HTTP localhost (Mixed Content)
        // This prevents "Script error" or "NetworkError" in secure previews
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && !window.location.hostname.includes('localhost')) {
            throw new Error("Skipping local backend in HTTPS environment");
        }

        // Assume backend is running on localhost:8000
        const response = await fetch(`http://localhost:8000/api/kline?code=${code}`, {
            method: 'GET',
            mode: 'cors' 
        });
        
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        const json = await response.json();
        
        if (!json.data || json.data.length === 0) throw new Error("Backend empty data");

        const candles: Candle[] = json.data.map((item: any) => ({
            date: item.date,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume,
            amount: item.amount,
            pctChg: item.pctChg,
            peTTM: item.peTTM, 
            pbMRQ: item.pbMRQ
        }));

        // Try to get explicit financials from backend first, fallback to last candle
        let financials: FinancialSnapshot | null = null;
        
        if (json.financials) {
             financials = {
                peTTM: json.financials.peTTM,
                pb: json.financials.pbMRQ, // Map pbMRQ to pb
                dividendYield: null,
                marketCap: json.financials.marketCap,
                circulatingCap: null,
                turnoverRate: null,
                totalShares: null
             };
        } else {
            const last = json.data[json.data.length - 1];
            financials = {
                peTTM: last.peTTM || null,
                pb: last.pbMRQ || null,
                dividendYield: null, 
                marketCap: null,
                circulatingCap: null,
                turnoverRate: null,
                totalShares: null
            };
        }

        return { candles, financials };

    } catch (e) {
        throw e; // Propagate to trigger fallback
    }
};

// --- STRATEGY 2: TENCENT JSONP ---
const fetchKLinesTencent = async (symbol: string, callbackPrefix: string): Promise<Candle[]> => {
    const cb = `cb_qq_k_${callbackPrefix}`;
    // Using web.ifzq.gtimg.cn (Standard K-Line API) - HTTPS
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,320,qfq&cb=${cb}`;
    const json = await jsonpFetch(url, cb);
    
    if (json && json.data && json.data[symbol] && json.data[symbol].day) {
        return json.data[symbol].day.map((item: string[]) => {
            const close = parseFloat(item[2]);
            const open = parseFloat(item[1]);
            const pctChg = ((close - open) / open) * 100;
            return {
                date: item[0],
                open: open,
                close: close,
                high: parseFloat(item[3]),
                low: parseFloat(item[4]),
                volume: parseFloat(item[5]),
                amount: 0, 
                pctChg: pctChg
            };
        });
    }
    throw new Error("Tencent data empty");
};

// --- STRATEGY 3: EASTMONEY JSONP (Multiple Mirrors) ---
const fetchKLinesEastMoney = async (secid: string, callbackPrefix: string): Promise<Candle[]> => {
    const cb = `cb_em_k_${callbackPrefix}`;
    
    // Mirror 1: push2his (Historical) - HTTPS
    const urlHis = `https://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f61&klt=101&fqt=1&secid=${secid}&beg=0&end=20500101&lmt=320&cb=${cb}`;
    
    // Mirror 2: push2 (Realtime/Recent) - HTTPS
    const urlRt = `https://push2.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f61&klt=101&fqt=1&secid=${secid}&beg=0&end=20500101&lmt=320&cb=${cb}`;

    try {
        const res = await tryFetchEastMoney(urlHis, cb);
        if (res) return res;
        throw new Error("Mirror 1 empty");
    } catch (e) {
        console.warn("EastMoney Mirror 1 failed, trying Mirror 2...");
        const res2 = await tryFetchEastMoney(urlRt, cb);
        if (res2) return res2;
        throw new Error("EastMoney data empty");
    }
};

const tryFetchEastMoney = async (url: string, cb: string): Promise<Candle[] | null> => {
    const json = await jsonpFetch(url, cb);
    
    if (json && json.data && json.data.klines) {
        return json.data.klines.map((item: string) => {
            const parts = item.split(',');
            return {
                date: parts[0],
                open: parseFloat(parts[1]),
                close: parseFloat(parts[2]),
                high: parseFloat(parts[3]),
                low: parseFloat(parts[4]),
                volume: parseFloat(parts[5]),
                amount: parseFloat(parts[6]),
                pctChg: parseFloat(parts[7])
            };
        });
    }
    return null;
}

// --- FINANCIAL SNAPSHOT (Fallback Sources) ---
const fetchSnapshotTencent = (symbol: string): Promise<FinancialSnapshot> => {
    return new Promise((resolve) => {
        const varName = `v_${symbol}`;
        // Using qt.gtimg.cn (Snapshot API) - HTTPS
        const url = `https://qt.gtimg.cn/q=${symbol}`;
        const script = document.createElement('script');
        script.src = url;
        script.referrerPolicy = 'no-referrer'; // Critical for snapshot too
        script.onload = () => {
            try {
                const dataStr = (window as any)[varName];
                if (dataStr) {
                    const parts = dataStr.split('~');
                    if (parts.length > 40) {
                         resolve({
                            peTTM: parseFloat(parts[39]) || null,
                            pb: parseFloat(parts[46]) || null,
                            dividendYield: null,
                            marketCap: parseFloat(parts[45]) * 100000000 || null,
                            circulatingCap: parseFloat(parts[44]) * 100000000 || null,
                            turnoverRate: parseFloat(parts[38]) || null,
                            totalShares: null
                        });
                        return;
                    }
                }
            } catch (e) {
                console.warn("Tencent snapshot parse failed", e);
            }
            resolve({ peTTM: null, pb: null, dividendYield: null, marketCap: null, circulatingCap: null, turnoverRate: null, totalShares: null });
        };
        script.onerror = () => resolve({ peTTM: null, pb: null, dividendYield: null, marketCap: null, circulatingCap: null, turnoverRate: null, totalShares: null });
        document.body.appendChild(script);
        setTimeout(() => { if(script.parentNode) script.parentNode.removeChild(script); }, 3000);
    });
};


export const fetchStockData = async (code: string, name: string): Promise<StockData> => {
  const timestamp = new Date().getTime();
  const cleanCode = code.replace('sh.', '').replace('sz.', '');
  const emSecId = getEastMoneySecId(code);
  const tencentSymbol = getTencentSymbol(code);

  let candles: Candle[] = [];
  let financials: FinancialSnapshot = { peTTM: null, pb: null, dividendYield: null, marketCap: null, circulatingCap: null, turnoverRate: null, totalShares: null };

  // --- 1. TRY NODEJS BACKEND PROXY (Primary) ---
  try {
      const proxyResult = await Promise.race([
          fetchKLinesBackendProxy(code),
          // Short timeout to quickly failover if backend not running
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Proxy Connection Timeout")), 1500))
      ]);
      
      candles = proxyResult.candles;
      if (proxyResult.financials) {
          financials = { ...financials, ...proxyResult.financials };
      }
      console.log("SUCCESS: Loaded data from Node.js Backend");
  } catch (proxyError) {
      // Silently failover to JSONP
      
      // --- 2. FALLBACK TO JSONP SOURCES ---
      try {
          // Try Tencent FIRST (More stable)
          try {
             candles = await fetchKLinesTencent(tencentSymbol, `${cleanCode}_${timestamp}`);
          } catch (tencentError) {
             console.warn("Tencent JSONP failed, trying EastMoney...", tencentError);
             candles = await fetchKLinesEastMoney(emSecId, `${cleanCode}_${timestamp}`);
          }
          
          // Fetch Snapshot separately
          const snap = await fetchSnapshotTencent(tencentSymbol);
          financials = snap;

      } catch (liveError) {
          console.error("All live data sources failed.", liveError);
          // Return user-friendly error
          throw new Error("Unable to retrieve real market data. Please check network connection.");
      }
  }

  // Safety fallback
  if (!candles || candles.length === 0) {
      throw new Error("No market data available for this stock.");
  }

  // 3. Process Indicators (MACD, RSI, etc.)
  const processed = processIndicators(candles);

  return {
      code,
      name,
      candles: processed,
      lastUpdate: new Date().toISOString(),
      financials: financials
  };
};