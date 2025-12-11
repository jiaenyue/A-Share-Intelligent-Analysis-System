const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 8000;

// Middleware - Allow all origins for dev/hackathon context
app.use(cors({
  origin: true, 
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// In-Memory Cache
const MEMORY_CACHE = new Map();

// --- Helpers ---

// Convert "sh.600519" -> EastMoney "1.600519" and Tencent "sh600519"
const parseCode = (code) => {
  const clean = code.replace('sh.', '').replace('sz.', '');
  // EastMoney: 1=Shanghai (6xxx), 0=Shenzhen (0xxx, 3xxx)
  // Simple heuristic: starts with 6 is Shanghai
  const isSh = code.startsWith('sh') || clean.startsWith('6');
  const market = isSh ? '1' : '0';
  
  return {
    secid: `${market}.${clean}`,
    symbol: isSh ? `sh${clean}` : `sz${clean}`,
    original: code
  };
};

// --- Routes ---

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Node.js Stock Backend' });
});

// Cache Get
app.get('/api/cache/get', (req, res) => {
  const key = req.query.key;
  if (MEMORY_CACHE.has(key)) {
    return res.json({ key, value: MEMORY_CACHE.get(key) });
  }
  return res.json({ key, value: null });
});

// Cache Set
app.post('/api/cache/set', (req, res) => {
  const { key, value } = req.body;
  if (key && value) {
    MEMORY_CACHE.set(key, value);
    
    // Simple eviction policy: if too big, clear half
    if (MEMORY_CACHE.size > 1000) {
        const keysToDelete = Array.from(MEMORY_CACHE.keys()).slice(0, 500);
        keysToDelete.forEach(k => MEMORY_CACHE.delete(k));
    }
    
    return res.json({ status: 'success' });
  }
  res.status(400).json({ error: 'Missing key or value' });
});

// K-Line Data Proxy
app.get('/api/kline', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const { secid, symbol } = parseCode(code);
    
    // 1. Fetch K-Line from EastMoney (Adjusted) - Use HTTPS
    const klineUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f59&klt=101&fqt=1&end=20500101&lmt=550`;
    
    // 2. Fetch Snapshot from Tencent (Fast, contains PE/PB) - Use HTTPS
    const snapshotUrl = `https://qt.gtimg.cn/q=${symbol}`;

    const [klineRes, snapshotRes] = await Promise.all([
        axios.get(klineUrl),
        axios.get(snapshotUrl)
    ]);

    // Process Snapshot
    let financials = { peTTM: null, pbMRQ: null, marketCap: null };
    if (snapshotRes.data) {
        try {
            // v_sh600519="1~NAME~CODE~PRICE~...~39(PE)~...~46(PB)~45(Cap)"
            const parts = snapshotRes.data.split('~');
            if (parts.length > 40) {
                financials = {
                    peTTM: parseFloat(parts[39]) || null,
                    pbMRQ: parseFloat(parts[46]) || null,
                    marketCap: parseFloat(parts[45]) * 100000000 || null // Cap is usually in 100M units
                };
            }
        } catch (e) {
            console.warn("Snapshot parse error", e);
        }
    }

    // Process K-Lines
    let candles = [];
    if (klineRes.data && klineRes.data.data && klineRes.data.data.klines) {
        candles = klineRes.data.data.klines.map(line => {
            const [date, open, close, high, low, vol, amt, pct] = line.split(',');
            return {
                date,
                open: parseFloat(open),
                high: parseFloat(high),
                low: parseFloat(low),
                close: parseFloat(close),
                volume: parseFloat(vol),
                amount: parseFloat(amt),
                pctChg: parseFloat(pct),
                peTTM: financials.peTTM, 
                pbMRQ: financials.pbMRQ
            };
        });
    }

    res.json({
        code,
        data: candles,
        financials: financials
    });

  } catch (error) {
    console.error("Proxy Error:", error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});