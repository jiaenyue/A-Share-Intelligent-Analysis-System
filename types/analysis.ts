
export interface AnalysisResult {
  stockCode: string;
  timestamp: string;
  technical: TechnicalAnalysisResult;
  fundamental: FundamentalAnalysisResult;
  valuation: ValuationAnalysisResult;
  strategy: StrategyAnalysis; // Renamed & Expanded from aiPrediction
  risk: RiskAnalysis;
}

export interface TechnicalAnalysisResult {
  score: number;
  trend: 'Bullish' | 'Bearish' | 'Neutral';
  signals: string[];
  support: number;
  resistance: number;
  summary: string; // Brief technical summary
}

export interface FundamentalAnalysisResult {
  score: number;
  roeAssessment: string;
  financialHealth: 'Strong' | 'Stable' | 'Weak';
  highlights: string[];
  dupontAnalysis: string; // Narrative explanation
}

export interface ValuationAnalysisResult {
  score: number;
  status: 'Undervalued' | 'Fair' | 'Overvalued';
  fairValue: number;
  rationale: string;
}

export interface StrategyAnalysis {
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidenceScore: number;
  outlook: string; // Short & Mid term outlook
  summary: string; // Executive summary
  investmentThesis: string[]; // 3-4 key bullet points
  riskFactors: string[]; // 2-3 key risks
  catalysts: string[]; // Potential stock movers
}

export interface RiskAnalysis {
  score: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  warnings: string[];
}

export interface Metrics {
  pe: number;
  pb: number;
  roe: number;
  netMargin: number;
  assetTurnover: number;
  equityMultiplier: number;
  revenueGrowth: number;
  profitGrowth: number;
  debtRatio: number;
}
