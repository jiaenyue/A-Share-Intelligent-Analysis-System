
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types/analysis";
import { StockData, FinancialSnapshot } from "../types/stock";
import { db, STORES } from '../utils/db';

// --- CACHE CONFIGURATION ---
const CACHE_KEY_PREFIX = 'gemini_analysis_v5_'; 
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours Cache for Analysis

const getCacheKey = (code: string, language: string) => {
    const today = new Date().toISOString().split('T')[0]; 
    return `${CACHE_KEY_PREFIX}${code}_${language}_${today}`;
};

// Use IndexedDB instead of LocalStorage
const getCachedAnalysis = async (code: string, language: string): Promise<AnalysisResult | null> => {
    const key = getCacheKey(code, language);
    const data = await db.get<AnalysisResult>(STORES.ANALYSIS, key);
    if (data) {
        console.log(`[Gemini Cache DB] Hit for ${code}`);
        return data;
    }
    return null;
};

const saveCachedAnalysis = async (code: string, language: string, data: AnalysisResult) => {
    const key = getCacheKey(code, language);
    await db.set(STORES.ANALYSIS, key, data, CACHE_TTL_MS);
};


// --- SYSTEM INSTRUCTIONS ---

const SYSTEM_INSTRUCTION_EN = `You are a Chief Investment Officer at a top-tier asset management firm, specializing in Chinese A-Shares.
Your task is to generate an INSTITUTIONAL-GRADE EQUITY RESEARCH REPORT based on REAL MARKET DATA provided.
Do not hallucinate data. If data is missing, state it clearly.
Be opinionated, specific, and data-driven.

FOLLOW THIS 5-STAGE ANALYSIS PIPELINE:

1. TECHNICAL DEEP DIVE (35% Weight)
   - Trend: Assess MA Alignment (Price > MA5 > MA20 > MA50 > MA200).
   - Momentum: Analyze MACD/RSI/KDJ confluence.
   - Volatility: Bollinger Band Squeeze/Breakout detection.
   - Output: Score (0-100), Trend Signal, and Key Support/Resistance.

2. FUNDAMENTAL SNAPSHOT (40% Weight)
   - Valuation: Analyze PE (TTM) and PB ratios relative to general market standards.
   - Performance: Analyze ROE (Return on Equity) if provided or derived from PB/PE.
   - Note: Use the provided "Derived Financials" data for this section.

3. VALUATION PRECISION (25% Weight)
   - Relative Valuation: Compare PE/PB against historical avg and industry peers.
   - Intrinsic Value: Estimate Fair Value.

4. RISK & CATALYSTS
   - Risks: Regulatory, Macro, or Idiosyncratic.
   - Catalysts: Earnings surprises, Policy shifts, Sector rotation.

5. STRATEGIC SYNTHESIS
   - Generate a clear Investment Thesis (Why buy/sell now?).
   - Assign a Conviction Level (Confidence).

OUTPUT FORMAT:
Strictly JSON.
Enums (e.g., STRONG_BUY, Bullish) must be in ENGLISH.
Narrative fields (summary, thesis, risks) must be in the requested language (English).`;

const SYSTEM_INSTRUCTION_ZH = `你是一位顶级资产管理公司的首席投资官，专精于中国 A 股市场。
你的任务是基于提供的**真实市场数据**生成一份**机构级证券研究报告**。
**严禁编造数据**。如果数据缺失，请明确说明。
必须观点鲜明、具体、基于数据。

请严格遵循以下 5 阶段分析流程：

1. 技术面深度复盘 (权重 35%)
   - 趋势：基于均线多头/空头排列 (MA5/20/50/200) 定性。
   - 动量：MACD、RSI、KDJ 的共振分析。
   - 波动：布林带开口/收口及突破形态。
   - 输出：评分 (0-100)、趋势信号、关键支撑/压力位。

2. 基本面快照 (权重 40%)
   - 估值分析：基于真实的 PE (TTM) 和 PB 数据进行评估。
   - 业绩分析：基于提供的 **ROE (净资产收益率)**（如未提供则基于 PB/PE 推算）进行解读。

3. 估值精准测算 (权重 25%)
   - 相对估值：PE/PB 与 A 股平均水平对比。
   - 内在价值：基于当前估值水平估算合理价值区间。

4. 风险与催化剂
   - 风险：监管、宏观或个股特有风险。
   - 催化剂：业绩超预期、政策转向、板块轮动。

5. 策略综合
   - 形成清晰的投资逻辑 (Investment Thesis)。
   - 给出确信度 (Confidence)。

输出格式：
严格 JSON 格式。
枚举值 (如 STRONG_BUY, Bullish) 必须保留 **英文** 以便代码处理。
所有叙述性字段 (summary, thesis, risks, highlights) 必须使用 **简体中文**。`;

export const analyzeStockWithGemini = async (stock: StockData, language: 'en' | 'zh'): Promise<AnalysisResult> => {
  // Safety check
  if (!stock.candles || stock.candles.length === 0) {
    return getFallbackAnalysis(stock, language, "No candle data available.");
  }

  // 1. Check Local Cache (DB Service Layer)
  const cached = await getCachedAnalysis(stock.code, language);
  if (cached) {
      return cached;
  }

  const last = stock.candles[stock.candles.length - 1];
  const f: Partial<FinancialSnapshot> = stock.financials || {};
  
  // 2. Construct High-Fidelity Technical Context
  const technicalContext = `
    Stock: ${stock.name} (${stock.code})
    Date: ${last.date}
    Price: ${last.close} (Chg: ${last.pctChg?.toFixed(2)}%)
    
    [Moving Averages]
    MA5: ${last.ma5?.toFixed(2)} | MA20: ${last.ma20?.toFixed(2)} | MA50: ${last.ma50?.toFixed(2)}
    
    [Oscillators]
    RSI(14): ${last.rsi?.toFixed(2)}
    MACD: Dif=${last.dif?.toFixed(3)} | Dea=${last.dea?.toFixed(3)} | Hist=${last.macd?.toFixed(3)}
    KDJ: K=${last.k?.toFixed(1)} | D=${last.d?.toFixed(1)} | J=${last.j?.toFixed(1)}
    
    [Volatility]
    Bollinger: Upper=${last.upper?.toFixed(2)} | Lower=${last.lower?.toFixed(2)}
    
    [Volume]
    Vol: ${last.volume}
  `;

  // 3. Real Financial Context
  const formatVal = (v: number | null | undefined, suffix = '') => v ? v.toFixed(2) + suffix : 'N/A';
  const formatCap = (v: number | null | undefined) => v ? (v / 100000000).toFixed(2) + ' Billion CNY' : 'N/A';

  const financialContext = `
    [Valuation Metrics]
    PE Ratio (TTM): ${formatVal(f.peTTM)}
    PB Ratio (LF): ${formatVal(f.pb)}
    Dividend Yield: ${formatVal(f.dividendYield, '%')}
    
    [Derived Financials]
    ROE (Est. via PB/PE): ${formatVal(f.roe, '%')}
    Market Cap: ${formatCap(f.marketCap)}
    Circulating Cap: ${formatCap(f.circulatingCap)}
  `;

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("Missing API_KEY in environment");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Prompt Construction
    const prompt = language === 'zh'
      ? `分析目标：${stock.name} (${stock.code})。\n请基于以下**真实数据**生成一份深度策略研报：\n${technicalContext}\n${financialContext}`
      : `Target: ${stock.name} (${stock.code}).\nGenerate a deep strategic equity research report based on **REAL DATA**:\n${technicalContext}\n${financialContext}`;

    console.log("[Gemini] Requesting analysis for", stock.code);

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: language === 'zh' ? SYSTEM_INSTRUCTION_ZH : SYSTEM_INSTRUCTION_EN,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strategy: {
              type: Type.OBJECT,
              properties: {
                recommendation: { type: Type.STRING, enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'] },
                confidenceScore: { type: Type.NUMBER },
                summary: { type: Type.STRING },
                outlook: { type: Type.STRING },
                investmentThesis: { type: Type.ARRAY, items: { type: Type.STRING } },
                riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
                catalysts: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            technical: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                trend: { type: Type.STRING, enum: ['Bullish', 'Bearish', 'Neutral'] },
                summary: { type: Type.STRING },
                signals: { type: Type.ARRAY, items: { type: Type.STRING } },
                support: { type: Type.NUMBER },
                resistance: { type: Type.NUMBER }
              }
            },
            fundamental: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                roeAssessment: { type: Type.STRING },
                dupontAnalysis: { type: Type.STRING },
                financialHealth: { type: Type.STRING, enum: ['Strong', 'Stable', 'Weak'] },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            valuation: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                status: { type: Type.STRING, enum: ['Undervalued', 'Fair', 'Overvalued'] },
                fairValue: { type: Type.NUMBER },
                rationale: { type: Type.STRING }
              }
            },
            risk: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                level: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
                warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        throw new Error("Failed to parse Gemini JSON response");
    }

    if (!result.strategy) throw new Error("Invalid structure");

    const analysisData: AnalysisResult = {
      stockCode: stock.code,
      timestamp: new Date().toISOString(),
      strategy: {
         recommendation: result.strategy.recommendation || 'HOLD',
         confidenceScore: result.strategy.confidenceScore ?? 0.5,
         summary: result.strategy.summary || "",
         outlook: result.strategy.outlook || "",
         investmentThesis: result.strategy.investmentThesis || [],
         riskFactors: result.strategy.riskFactors || [],
         catalysts: result.strategy.catalysts || []
      },
      technical: {
         score: result.technical?.score ?? 50,
         trend: result.technical?.trend || 'Neutral',
         summary: result.technical?.summary || '',
         signals: result.technical?.signals || [],
         support: result.technical?.support ?? (last.close * 0.9),
         resistance: result.technical?.resistance ?? (last.close * 1.1)
      },
      fundamental: {
         score: result.fundamental?.score ?? 50,
         roeAssessment: result.fundamental?.roeAssessment || '',
         dupontAnalysis: result.fundamental?.dupontAnalysis || '',
         financialHealth: result.fundamental?.financialHealth || 'Stable',
         highlights: result.fundamental?.highlights || []
      },
      valuation: {
         score: result.valuation?.score ?? 50,
         status: result.valuation?.status || 'Fair',
         fairValue: result.valuation?.fairValue ?? last.close,
         rationale: result.valuation?.rationale || ''
      },
      risk: {
         score: result.risk?.score ?? 50,
         level: result.risk?.level || 'Medium',
         warnings: result.risk?.warnings || []
      }
    };

    // Save async
    await saveCachedAnalysis(stock.code, language, analysisData);
    return analysisData;

  } catch (error: any) {
    console.warn("Gemini Analysis Failed:", error);
    let errorMsg = language === 'zh' ? "AI 服务暂时不可用" : "AI Service Temporarily Unavailable";
    
    if (error.message?.includes("API_KEY")) {
        errorMsg = language === 'zh' ? "未配置 API Key" : "Missing API Configuration";
    }
    return getFallbackAnalysis(stock, language, errorMsg);
  }
};

const getFallbackAnalysis = (stock: StockData, language: 'en' | 'zh', errorMessage: string): AnalysisResult => {
    return {
        stockCode: stock.code,
        timestamp: new Date().toISOString(),
        strategy: {
            recommendation: 'HOLD',
            confidenceScore: -1,
            summary: errorMessage,
            outlook: "Error",
            investmentThesis: [],
            riskFactors: [],
            catalysts: []
        },
        technical: { score: 0, trend: 'Neutral', summary: '', signals: [], support: 0, resistance: 0 },
        fundamental: { score: 0, roeAssessment: '', dupontAnalysis: '', financialHealth: 'Stable', highlights: [] },
        valuation: { score: 0, status: 'Fair', fairValue: 0, rationale: '' },
        risk: { score: 0, level: 'Low', warnings: [] }
    };
};
