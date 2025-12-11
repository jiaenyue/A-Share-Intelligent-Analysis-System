
import { StockSymbol } from '../types/stock';
import { RAW_STOCK_CSV } from './stockList';

export const TIMEFRAMES = [
  { label: 'Daily', value: 'd' },
  { label: 'Weekly', value: 'w' },
  { label: 'Monthly', value: 'm' },
] as const;

export const DEFAULT_STOCK: StockSymbol = { code: 'sh.600519', name: '贵州茅台', pinyin: 'GZMT' };

// Define popular stocks for quick access/display at the top
export const POPULAR_STOCKS: StockSymbol[] = [
  { code: 'sh.600519', name: '贵州茅台', pinyin: 'GZMT' },
  { code: 'sz.000858', name: '五粮液', pinyin: 'WLY' },
  { code: 'sz.300750', name: '宁德时代', pinyin: 'NDSD' },
  { code: 'sz.002594', name: '比亚迪', pinyin: 'BYD' },
  { code: 'sh.601318', name: '中国平安', pinyin: 'ZGPA' },
  { code: 'sh.600036', name: '招商银行', pinyin: 'ZSYH' },
  { code: 'sz.300059', name: '东方财富', pinyin: 'DFCF' },
  { code: 'sz.300476', name: '胜宏科技', pinyin: 'SHKJ' },
  { code: 'sz.300274', name: '阳光电源', pinyin: 'YGDY' },
  { code: 'sh.688111', name: '金山办公', pinyin: 'JSBG' },
  { code: 'sh.601360', name: '三六零', pinyin: 'SL0' },
  { code: 'sh.603099', name: '长白山', pinyin: 'CBS' },
  { code: 'sz.002780', name: '三夫户外', pinyin: 'SFHW' }
];

// Efficiently parse the massive CSV string
const parseStockList = (): StockSymbol[] => {
  try {
    const stocks: StockSymbol[] = [];
    const entries = RAW_STOCK_CSV.split('|');
    
    // Create a Set of existing codes to prevent duplicates from POPULAR_STOCKS
    const existingCodes = new Set(POPULAR_STOCKS.map(s => s.code));
    
    // Add Popular stocks first
    stocks.push(...POPULAR_STOCKS);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i].trim();
      if (!entry) continue;

      const parts = entry.split(',');
      if (parts.length >= 2) {
        const code = parts[0].trim();
        // If not already added via popular list
        if (!existingCodes.has(code)) {
            stocks.push({
              code: code,
              name: parts[1].trim(),
              pinyin: parts[2]?.trim() || ''
            });
        }
      }
    }
    return stocks;
  } catch (e) {
    console.error("Failed to parse stock list", e);
    return POPULAR_STOCKS;
  }
};

export const ALL_STOCKS = parseStockList();

export const API_THROTTLE_MS = 1000;
export const CACHE_TTL_HOURS = 24;
