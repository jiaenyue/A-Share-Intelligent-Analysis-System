
import { StockData, Candle, FinancialSnapshot } from '../types/stock';
import { processIndicators } from '../utils/indicators';
import { db, STORES } from '../utils/db';

// Declare global callback for JSONP
declare global {
  interface Window {
    [key: string]: any;
  }
}

// --- CONFIGURATION ---
const CACHE_TTL_MS = 60 * 1000 * 30; // 30 Minutes Cache for Market Data
const REQUEST_TIMEOUT = 12000; 
const CACHE_VERSION = 'v3'; 

// --- HELPERS ---

const getEastMoneySecId = (code: string): string => {
  const c = code.replace('sh.', '').replace('sz.', '');
  // Shanghai: 6xxxx (Main), 688xxx (STAR), 000xxx (Index)
  if (c.startsWith('6') || c.startsWith('000') || c.startsWith('5')) return `1.${c}`;
  // Shenzhen: 00xxxx, 30xxxx, 399xxx (Index)
  return `0.${c}`; 
};

const getTencentSymbol = (code: string): string => {
    // Tencent format: sh600519
    const clean = code.replace('sh.', '').replace('sz.', '');
    if (code.includes('sh.') || code.startsWith('6') || code.startsWith('5')) return `sh${clean}`;
    return `sz${clean}`;
};

// --- MOCK DATA GENERATOR (Fallback) ---
const generateMockData = (code: string, name: string): StockData => {
    const candles: Candle[] = [];
    const now = new Date();
    // Seed random generator with code to ensure consistent charts for same stock
    let seed = code.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const rnd = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    let price = 100.0 + (rnd() * 50); // Start price between 100-150

    // Generate 120 candles
    for (let i = 120; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        // Skip weekends simple check
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        const dateStr = date.toISOString().split('T')[0];
        const volatility = price * 0.04; // 4% volatility
        const change = (rnd() - 0.5) * volatility;
        const close = Math.max(0.1, price + change);
        const open = price;
        const high = Math.max(open, close) + rnd() * volatility * 0.5;
        const low = Math.min(open, close) - rnd() * volatility * 0.5;
        const volume = Math.floor(100000 + rnd() * 500000);
        const pctChg = ((close - open) / open) * 100;

        candles.push({
            date: dateStr,
            open: parseFloat(open.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            volume,
            amount: volume * close,
            pctChg: parseFloat(pctChg.toFixed(2))
        });
        price = close;
    }

    const processed = processIndicators(candles);
    
    return {
        code,
        name,
        candles: processed,
        lastUpdate: new Date().toISOString(),
        financials: {
            peTTM: parseFloat((15 + rnd() * 20).toFixed(2)),
            pb: parseFloat((1.5 + rnd() * 5).toFixed(2)),
            dividendYield: parseFloat((1 + rnd() * 3).toFixed(2)), // Added mock dividendYield
            marketCap: 50000000000,
            circulatingCap: 50000000000,
            turnoverRate: parseFloat((0.5 + rnd() * 3).toFixed(2)), // Added mock turnoverRate
            totalShares: 2000000000, // Added mock totalShares
            roe: parseFloat((8 + rnd() * 12).toFixed(2)),
            netMargin: parseFloat((10 + rnd() * 15).toFixed(2)),
            debtRatio: parseFloat((30 + rnd() * 30).toFixed(2)),
            grossMargin: parseFloat((40 + rnd() * 20).toFixed(2)),
            assetTurnover: parseFloat((0.5 + rnd() * 0.5).toFixed(2)),
            equityMultiplier: parseFloat((1.5 + rnd()).toFixed(2)),
            reportDate: '2024-06-30 (Mock)'
        }
    };
};

// --- CACHE LAYER (IndexedDB) ---
const getCachedData = async (code: string): Promise<StockData | null> => {
    const key = `stock_${CACHE_VERSION}_${code}`;
    const data = await db.get<StockData>(STORES.MARKET, key);
    if (data) {
        return data;
    }
    return null;
};

const setCachedData = async (code: string, data: StockData) => {
    const key = `stock_${CACHE_VERSION}_${code}`;
    await db.set(STORES.MARKET, key, data, CACHE_TTL_MS);
};

// --- JSONP IMPLEMENTATION ---

const jsonpFetch = (url: string, callbackName: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        let timeoutId: any;

        const cleanup = () => {
            if ((window as any)[callbackName]) {
                try { delete (window as any)[callbackName]; } catch(e) {(window as any)[callbackName] = undefined;}
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
        script.referrerPolicy = 'no-referrer'; 
        
        script.onerror = (e) => {
            clearTimeout(timeoutId);
            cleanup();
            reject(new Error(`JSONP Error loading ${url}`));
        };

        document.body.appendChild(script);

        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`JSONP Timeout: ${url}`));
        }, REQUEST_TIMEOUT); 
    });
};

// --- SOURCE 1: EASTMONEY (Detailed Data) ---

const fetchFinancialProfile = async (cleanCode: string, cbPrefix: string): Promise<Partial<FinancialSnapshot>> => {
    const cb = `cb_em_fin_${cbPrefix}`;
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_KEY_INDICATOR&columns=ALL&filter=(SECURITY_CODE%3D%22${cleanCode}%22)&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE&source=WEB&client=WEB&callback=${cb}`;
    
    try {
        const res = await jsonpFetch(url, cb);
        if (res && res.result && res.result.data && res.result.data.length > 0) {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            const validReport = res.result.data.find((d: any) => {
                 const rd = d.REPORT_DATE ? d.REPORT_DATE.split(' ')[0] : '2099-01-01';
                 return rd <= todayStr && (d.TOTAL_OPERATE_INCOME || d.PARENT_NET_PROFIT);
            });

            if (validReport) {
                const d = validReport;
                const totalRevenue = d.TOTAL_OPERATE_INCOME ? parseFloat(d.TOTAL_OPERATE_INCOME) : 0;
                const netProfit = d.PARENT_NET_PROFIT ? parseFloat(d.PARENT_NET_PROFIT) : 0;
                const totalAssets = d.TOTAL_ASSETS ? parseFloat(d.TOTAL_ASSETS) : 0;
                const totalLiabilities = d.TOTAL_LIABILITIES ? parseFloat(d.TOTAL_LIABILITIES) : 0;
                
                let netMargin = null;
                if (totalRevenue > 0) {
                    netMargin = (netProfit / totalRevenue) * 100;
                } else if (d.NET_PROFIT_MARGIN) {
                    netMargin = parseFloat(d.NET_PROFIT_MARGIN);
                }

                let assetTurnover = null;
                if (totalAssets > 0) {
                    assetTurnover = totalRevenue / totalAssets;
                }

                let debtRatio = null;
                if (totalAssets > 0) {
                    debtRatio = (totalLiabilities / totalAssets) * 100;
                } else if (d.DEBT_ASSET_RATIO) {
                    debtRatio = parseFloat(d.DEBT_ASSET_RATIO);
                }

                let equityMultiplier = null;
                const totalEquity = totalAssets - totalLiabilities;
                if (totalEquity > 0) {
                    equityMultiplier = totalAssets / totalEquity;
                }

                let roe = d.ROE_WEIGHTED ? parseFloat(d.ROE_WEIGHTED) : null;
                if (!roe && totalEquity > 0) {
                    roe = (netProfit / totalEquity) * 100;
                }

                return {
                    roe: roe,
                    netMargin: netMargin,
                    grossMargin: d.GROSS_PROFIT_MARGIN ? parseFloat(d.GROSS_PROFIT_MARGIN) : null,
                    debtRatio: debtRatio,
                    assetTurnover: assetTurnover,
                    equityMultiplier: equityMultiplier,
                    reportDate: d.REPORT_DATE ? d.REPORT_DATE.split(' ')[0] : null
                };
            }
        }
    } catch (e) {
        console.warn("[Market] Failed to fetch deep financials (Non-critical)", e);
    }
    return {};
};

const fetchEastMoneyData = async (code: string, secid: string, cbPrefix: string): Promise<{ candles: Candle[], financials: Partial<FinancialSnapshot> }> => {
    const cleanCode = code.replace('sh.', '').replace('sz.', '');
    const cb = `cb_em_${cbPrefix}`;
    
    // API 1: K-Line
    const klineUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f59,f61&klt=101&fqt=1&secid=${secid}&beg=0&end=20500101&lmt=300&cb=${cb}`;
    
    // API 2: Snapshot
    const snapCb = `cb_em_snap_${cbPrefix}`;
    const snapshotUrl = `https://push2.eastmoney.com/api/qt/stock/get?invt=2&fltt=2&fields=f43,f57,f58,f162,f167,f116,f117,f173&secid=${secid}&cb=${snapCb}`;

    const pKline = jsonpFetch(klineUrl, cb);
    const pSnap = jsonpFetch(snapshotUrl, snapCb).catch(e => null);
    const pDeep = fetchFinancialProfile(cleanCode, cbPrefix); 

    let klineRes;
    try {
        klineRes = await pKline;
    } catch (e) {
        throw new Error("EastMoney K-Line fetch failed");
    }

    const [snapRes, deepFin] = await Promise.all([pSnap, pDeep]);

    if (!klineRes || !klineRes.data || !klineRes.data.klines) {
        throw new Error("EastMoney K-Line empty data");
    }

    const candles: Candle[] = klineRes.data.klines.map((item: string) => {
        const parts = item.split(',');
        return {
            date: parts[0],
            open: parseFloat(parts[1]),
            close: parseFloat(parts[2]),
            high: parseFloat(parts[3]),
            low: parseFloat(parts[4]),
            volume: parseFloat(parts[5]),
            amount: parseFloat(parts[6]),
            pctChg: parseFloat(parts[8])
        };
    });

    const f: Partial<FinancialSnapshot> = { ...deepFin }; 
    
    if (snapRes && snapRes.data) {
        const d = snapRes.data;
        f.peTTM = d.f162 !== '-' ? parseFloat(d.f162) : null;
        f.pb = d.f167 !== '-' ? parseFloat(d.f167) : null;
        f.marketCap = d.f116 !== '-' ? parseFloat(d.f116) : null;
        f.circulatingCap = d.f117 !== '-' ? parseFloat(d.f117) : null;
        
        if (!f.roe && d.f173 !== '-' && d.f173) {
            f.roe = parseFloat(d.f173);
        }
    }

    return { candles, financials: f };
};

// --- SOURCE 2: TENCENT (Reliable Fallback) ---

const fetchTencentData = async (symbol: string, cbPrefix: string): Promise<{ candles: Candle[], financials: Partial<FinancialSnapshot> }> => {
    const cb = `cb_qq_${cbPrefix}`;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,300,qfq&cb=${cb}`;
    
    const json = await jsonpFetch(url, cb);
    if (!json || !json.data || !json.data[symbol] || !json.data[symbol].day) {
        throw new Error("Tencent data empty");
    }

    const candles: Candle[] = json.data[symbol].day.map((item: string[]) => {
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

    const qt = json.data[symbol].qt ? json.data[symbol].qt[symbol] : [];
    const f: Partial<FinancialSnapshot> = {};
    
    if (qt && qt.length > 40) {
        f.peTTM = parseFloat(qt[39]) || null;
        f.pb = parseFloat(qt[46]) || null;
        f.marketCap = parseFloat(qt[45]) * 100000000 || null;
        f.circulatingCap = parseFloat(qt[44]) * 100000000 || null;
    }

    return { candles, financials: f };
};

// --- MAIN CONTROLLER ---

export const fetchStockData = async (code: string, name: string): Promise<StockData> => {
    // 1. Check DB Cache
    const cached = await getCachedData(code);
    if (cached) {
        return cached;
    }

    const ts = new Date().getTime();
    const cleanCode = code.replace(/[^a-zA-Z0-9]/g, ''); 
    const cbPrefix = `${cleanCode}_${ts}`;

    const emSecId = getEastMoneySecId(code);
    const tencentSymbol = getTencentSymbol(code);

    let candles: Candle[] = [];
    let financials: Partial<FinancialSnapshot> = {};

    let success = false;
    let emError = '';

    // 2. Try Primary Source (EastMoney)
    try {
        console.log(`[Proxy] Fetching ${code} from EastMoney...`);
        const res = await fetchEastMoneyData(code, emSecId, cbPrefix);
        candles = res.candles;
        financials = res.financials;
        success = true;
    } catch (e: any) {
        emError = e.message;
        console.warn(`[Proxy] EastMoney failed (${e.message}), switching to Tencent...`);
    }

    // 3. Failover to Backup Source (Tencent)
    if (!success) {
        try {
            console.log(`[Proxy] Fetching ${code} from Tencent...`);
            const res = await fetchTencentData(tencentSymbol, cbPrefix);
            candles = res.candles;
            financials = res.financials;
            success = true;
        } catch (e2: any) {
            console.warn(`[Proxy] Tencent failed (${e2.message}).`);
        }
    }

    // 4. MOCK DATA FALLBACK (Last Resort)
    // If all network requests failed, generate realistic mock data to keep app functional
    if (!success) {
        console.warn("[Proxy] All network sources failed. Generating Mock Data.");
        const mockData = generateMockData(code, name);
        // Cache the mock data so it stays consistent for the session
        await setCachedData(code, mockData);
        return mockData;
    }

    // 5. Client-side Data Enrichment
    const processedCandles = processIndicators(candles);

    if (!financials.roe && financials.peTTM && financials.pb && financials.peTTM > 0) {
        financials.roe = (financials.pb / financials.peTTM) * 100;
    }
    
    if (financials.debtRatio === null || financials.debtRatio === undefined) {
        financials.debtRatio = 50.0;
    }

    const result: StockData = {
        code,
        name,
        candles: processedCandles,
        lastUpdate: new Date().toISOString(),
        financials: {
            peTTM: financials.peTTM || null,
            pb: financials.pb || null,
            dividendYield: financials.dividendYield || null,
            marketCap: financials.marketCap || null,
            circulatingCap: financials.circulatingCap || null,
            turnoverRate: financials.turnoverRate || null,
            totalShares: null,
            roe: financials.roe || null,
            netMargin: financials.netMargin || null, 
            grossMargin: financials.grossMargin || null,
            debtRatio: financials.debtRatio || null,
            assetTurnover: financials.assetTurnover || null,
            equityMultiplier: financials.equityMultiplier || null,
            reportDate: financials.reportDate || new Date().toISOString().split('T')[0]
        }
    };

    await setCachedData(code, result);

    return result;
};
