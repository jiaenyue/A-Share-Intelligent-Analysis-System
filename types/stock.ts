
export interface StockData {
  code: string;
  name: string;
  candles: Candle[];
  lastUpdate: string;
  financials?: FinancialSnapshot;
}

export interface FinancialSnapshot {
  peTTM: number | null; // Price to Earnings (Trailing Twelve Months)
  pb: number | null;    // Price to Book
  dividendYield: number | null; // Percentage
  marketCap: number | null; // Total Market Capitalization
  circulatingCap: number | null;
  turnoverRate: number | null; // Daily turnover
  totalShares: number | null;
  // Deep Financials (Baostock/F10 Style)
  roe?: number | null;        // Return on Equity
  netMargin?: number | null;  // Net Profit Margin
  grossMargin?: number | null;// Gross Margin
  debtRatio?: number | null;  // Debt to Asset Ratio
  assetTurnover?: number | null; // Asset Turnover Ratio
  equityMultiplier?: number | null; // Equity Multiplier
  reportDate?: string | null; // Date of the financial report
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  turnover?: number;
  pctChg?: number;
  // Technical Indicators
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  dif?: number;
  dea?: number;
  macd?: number;
  k?: number;
  d?: number;
  j?: number;
  rsi?: number;
  upper?: number;
  mid?: number;
  lower?: number;
}

export interface StockSymbol {
  code: string;
  name: string;
  pinyin?: string; // Added for search support
}

export interface TimeFrame {
  label: string;
  value: 'd' | 'w' | 'm';
}
