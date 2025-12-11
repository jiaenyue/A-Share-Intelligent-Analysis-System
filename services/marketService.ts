
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
const CACHE_TTL_MS = 60 * 1000 * 30; // 30 Minutes Cache for Market Data (Increased from 5min due to robust DB)
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

// --- CACHE LAYER (IndexedDB) ---
const getCachedData = async (code: string): Promise<StockData | null> => {
    const key = `stock_${CACHE_VERSION}_${code}`;
    const data = await db.get<StockData>(STORES.MARKET, key);
    if (data) {
        console.log(`[Cache DB] Hit for ${code}`);
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
            // Clean up global callback
            if ((window as any)[callbackName]) {
                try { delete (window as any)[callbackName]; } catch(e) {(window as any)[callbackName] = undefined;}
            }
            // Clean up script tag
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
        // script.crossOrigin = "anonymous"; // Sometimes helps with error details, but can cause CORS block on JSONP
        script.referrerPolicy = 'no-referrer'; 
        
        script.onerror = (e) => {
            clearTimeout(timeoutId);
            cleanup();
            // JSONP often triggers script error even if successful if MIME type is wrong, 
            // but usually valid JSONP has correct MIME. 
            // We reject here.
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

// Helper to fetch deep financials (Net Margin, Debt Ratio, etc.)
const fetchFinancialProfile = async (cleanCode: string, cbPrefix: string): Promise<Partial<FinancialSnapshot>> => {
    const cb = `cb_em_fin_${cbPrefix}`;
    // Fetch top 8 records to ensure we skip all future forecasts (sometimes there are 3-4 forecast years)
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_KEY_INDICATOR&columns=ALL&filter=(SECURITY_CODE%3D%22${cleanCode}%22)&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE&source=WEB&client=WEB&callback=${cb}`;
    
    try {
        // We catch strictly here so this never fails the main request
        const res = await jsonpFetch(url, cb);
        if (res && res.result && res.result.data && res.result.data.length > 0) {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // Find first report that is NOT in the future AND has some valid data
            const validReport = res.result.data.find((d: any) => {
                 const rd = d.REPORT_DATE ? d.REPORT_DATE.split(' ')[0] : '2099-01-01';
                 // Basic validation: Date must be past/today AND Total Income must be present
                 return rd <= todayStr && (d.TOTAL_OPERATE_INCOME || d.PARENT_NET_PROFIT);
            });

            if (validReport) {
                const d = validReport;
                
                // Extract Raw Values
                const totalRevenue = d.TOTAL_OPERATE_INCOME ? parseFloat(d.TOTAL_OPERATE_INCOME) : 0;
                const netProfit = d.PARENT_NET_PROFIT ? parseFloat(d.PARENT_NET_PROFIT) : 0;
                const totalAssets = d.TOTAL_ASSETS ? parseFloat(d.TOTAL_ASSETS) : 0;
                const totalLiabilities = d.TOTAL_LIABILITIES ? parseFloat(d.TOTAL_LIABILITIES) : 0;
                
                // 1. Net Margin (Net Profit / Revenue) * 100
                let netMargin = null;
                if (totalRevenue > 0) {
                    netMargin = (netProfit / totalRevenue) * 100;
                } else if (d.NET_PROFIT_MARGIN) {
                    netMargin = parseFloat(d.NET_PROFIT_MARGIN);
                }

                // 2. Asset Turnover (Revenue / Total Assets)
                let assetTurnover = null;
                if (totalAssets > 0) {
                    assetTurnover = totalRevenue / totalAssets;
                }

                // 3. Debt Ratio (Liabilities / Assets) * 100
                let debtRatio = null;
                if (totalAssets > 0) {
                    debtRatio = (totalLiabilities / totalAssets) * 100;
                } else if (d.DEBT_ASSET_RATIO) {
                    debtRatio = parseFloat(d.DEBT_ASSET_RATIO);
                }

                // 4. Equity Multiplier (Total Assets / Total Equity)
                let equityMultiplier = null;
                const totalEquity = totalAssets - totalLiabilities;
                if (totalEquity > 0) {
                    equityMultiplier = totalAssets / totalEquity;
                }

                // 5. ROE
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
    
    // API 1: K-Line (Daily, 300 points)
    const klineUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f59,f61&klt=101&fqt=1&secid=${secid}&beg=0&end=20500101&lmt=300&cb=${cb}`;
    
    // API 2: Real-time Snapshot (Valuation)
    const snapCb = `cb_em_snap_${cbPrefix}`;
    const snapshotUrl = `https://push2.eastmoney.com/api/qt/stock/get?invt=2&fltt=2&fields=f43,f57,f58,f162,f167,f116,f117,f173&secid=${secid}&cb=${snapCb}`;

    // Parallel fetch: K-Line (CRITICAL), Snapshot (IMPORTANT), Deep Fin (OPTIONAL)
    const pKline = jsonpFetch(klineUrl, cb);
    const pSnap = jsonpFetch(snapshotUrl, snapCb).catch(e => null);
    const pDeep = fetchFinancialProfile(cleanCode, cbPrefix); // fetchFinancialProfile handles its own errors

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

    // Merge deep financials
    const f: Partial<FinancialSnapshot> = { ...deepFin }; 
    
    if (snapRes && snapRes.data) {
        const d = snapRes.data;
        f.peTTM = d.f162 !== '-' ? parseFloat(d.f162) : null;
        f.pb = d.f167 !== '-' ? parseFloat(d.f167) : null;
        f.marketCap = d.f116 !== '-' ? parseFloat(d.f116) : null;
        f.circulatingCap = d.f117 !== '-' ? parseFloat(d.f117) : null;
        
        // Prioritize Realtime ROE (f173) if Deep Fin ROE is missing or we suspect Deep Fin might be stale/older.
        // However, f173 is often TTM or LQ, while Deep Fin ROE is weighted.
        // If Deep Fin exists, use it. If not, fallback to Realtime.
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
    
    // Tencent usually robust
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
    // 1. Check DB Cache (Mitigate Traffic Limits & Improve Speed)
    // Note: IndexedDB is async, unlike sessionStorage
    const cached = await getCachedData(code);
    if (cached) {
        return cached;
    }

    const ts = new Date().getTime();
    // Unique prefix for callbacks to prevent collision
    const cleanCode = code.replace(/[^a-zA-Z0-9]/g, ''); 
    const cbPrefix = `${cleanCode}_${ts}`;

    const emSecId = getEastMoneySecId(code);
    const tencentSymbol = getTencentSymbol(code);

    let candles: Candle[] = [];
    let financials: Partial<FinancialSnapshot> = {};

    // 2. Try Primary Source (EastMoney)
    let success = false;
    let emError = '';

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

    // 3. Failover to Backup Source (Tencent) if EastMoney failed
    if (!success) {
        try {
            const res = await fetchTencentData(tencentSymbol, cbPrefix);
            candles = res.candles;
            financials = res.financials;
            success = true;
        } catch (e2: any) {
            console.error("[Proxy] All sources failed.");
            throw new Error(`Market data unavailable. EM Error: ${emError}. TC Error: ${e2.message}`);
        }
    }

    // 4. Client-side Data Enrichment
    const processedCandles = processIndicators(candles);

    // Derived Financials fallback
    if (!financials.roe && financials.peTTM && financials.pb && financials.peTTM > 0) {
        // ROE ≈ PB / PE
        financials.roe = (financials.pb / financials.peTTM) * 100;
    }
    
    // Default Debt Ratio only if strictly necessary
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

    // 5. Save to DB Cache
    await setCachedData(code, result);

    return result;
};
