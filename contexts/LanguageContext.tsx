import React, { createContext, useState, useContext, ReactNode } from 'react';

type Language = 'en' | 'zh';

const translations = {
  en: {
    appTitle: "A-Share Analysis",
    subTitle: "Institutional Grade • Gemini 3 Pro",
    priceAction: "Price Action (Day)",
    aiInsights: "AI Insights & Metrics",
    aiScore: "AI Score",
    confidence: "Confidence",
    technical: "Technical",
    trend: "Trend",
    support: "Support",
    fundamental: "Fundamental",
    health: "Health",
    valuation: "Valuation",
    geminiStrategy: "Gemini Strategy Analysis",
    outlook: "Outlook",
    highlights: "Key Highlights",
    generating: "Generating comprehensive strategy report with Gemini 3 Pro...",
    selectStock: "Select a stock to generate analysis.",
    loadingData: "Loading Market Data...",
    riskAnalysis: "Risk Analysis",
    risk: "Risk",
    noRisk: "No significant risks detected.",
    dupontAnalysis: "DuPont Analysis (ROE)",
    netMargin: "Net Margin",
    assetTO: "Asset TO",
    equityMult: "Equity Mult",
    roe: "ROE",
    open: "Open",
    close: "Close",
    high: "High",
    low: "Low",
    vol: "Vol",
    bullish: "Bullish",
    bearish: "Bearish",
    neutral: "Neutral",
    strong: "Strong",
    stable: "Stable",
    weak: "Weak",
    undervalued: "Undervalued",
    fair: "Fair",
    overvalued: "Overvalued",
    lowRisk: "Low",
    mediumRisk: "Medium",
    highRisk: "High",
    criticalRisk: "Critical",
    unknown: "Unknown",
    searchPlaceholder: "Search Stock..."
  },
  zh: {
    appTitle: "A股智能分析系统",
    subTitle: "机构级 • Gemini 3 Pro",
    priceAction: "价格走势 (日线)",
    aiInsights: "AI 洞察与指标",
    aiScore: "AI 评分",
    confidence: "置信度",
    technical: "技术面",
    trend: "趋势",
    support: "支撑位",
    fundamental: "基本面",
    health: "财务健康",
    valuation: "估值",
    geminiStrategy: "Gemini 策略分析",
    outlook: "展望",
    highlights: "关键亮点",
    generating: "正在生成 Gemini 3 Pro 综合策略报告...",
    selectStock: "请选择股票以生成分析。",
    loadingData: "正在加载行情数据...",
    riskAnalysis: "风险分析",
    risk: "风险",
    noRisk: "未检测到重大风险。",
    dupontAnalysis: "杜邦分析 (ROE)",
    netMargin: "净利率",
    assetTO: "周转率",
    equityMult: "权益乘数",
    roe: "ROE",
    open: "开盘",
    close: "收盘",
    high: "最高",
    low: "最低",
    vol: "量",
    bullish: "看涨",
    bearish: "看跌",
    neutral: "中性",
    strong: "强劲",
    stable: "稳健",
    weak: "疲软",
    undervalued: "低估",
    fair: "合理",
    overvalued: "高估",
    lowRisk: "低",
    mediumRisk: "中",
    highRisk: "高",
    criticalRisk: "严重",
    unknown: "未知",
    searchPlaceholder: "搜索股票..."
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
  colors: { up: string; down: string };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || key;
  };

  // Dynamic colors based on language culture
  // ZH: Red = Rise (Up), Green = Fall (Down)
  // EN: Green = Rise (Up), Red = Fall (Down)
  const colors = language === 'zh' 
    ? { up: '#ef4444', down: '#22c55e' } 
    : { up: '#22c55e', down: '#ef4444' };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, colors }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
