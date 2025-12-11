
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types/analysis";
import { StockData } from "../types/stock";

// --- CACHE CONFIGURATION ---
const CACHE_KEY_PREFIX = 'gemini_analysis_v2_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

const getCacheKey = (code: string, language: string) => {
    // Cache by stock code, language and date (daily analysis)
    const today = new Date().toISOString().split('T')[0]; 
    return `${CACHE_KEY_PREFIX}${code}_${language}_${today}`;
};

const getCachedAnalysis = async (code: string, language: string): Promise<AnalysisResult | null> => {
    const key = getCacheKey(code, language);

    // 1. Try Shared Backend Cache (Priority)
    try {
        const response = await fetch(`http://localhost:8000/api/cache/get?key=${key}`, {
             method: 'GET',
             mode: 'cors'
        });
        if (response.ok) {
            const json = await response.json();
            if (json.value) {
                const record = JSON.parse(json.value);
                if (Date.now() - record.timestamp < CACHE_TTL_MS) {
                     console.log(`[Gemini] Loaded SHARED cache for ${code} [${language}]`);
                     return record.data;
                }
            }
        }
    } catch (e) {
        // Backend offline or unreachable, ignore
    }

    // 2. Try LocalStorage (Fallback)
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const record = JSON.parse(item);
        if (Date.now() - record.timestamp > CACHE_TTL_MS) {
            localStorage.removeItem(key);
            return null;
        }
        console.log(`[Gemini] Loaded LOCAL cache for ${code} [${language}]`);
        return record.data;
    } catch (e) {
        return null;
    }
};

const saveCachedAnalysis = async (code: string, language: string, data: AnalysisResult) => {
    const key = getCacheKey(code, language);
    const record = {
        timestamp: Date.now(),
        data: data
    };
    const jsonStr = JSON.stringify(record);

    // 1. Save to LocalStorage
    try {
        localStorage.setItem(key, jsonStr);
    } catch (e) {
        console.warn("Failed to save Gemini local cache", e);
    }

    // 2. Save to Shared Backend Cache
    try {
        await fetch('http://localhost:8000/api/cache/set', {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key, value: jsonStr })
        });
    } catch (e) {
        // Backend offline, ignore
    }
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
   - Valuation: Analyze PE (TTM) and PB ratios relative to general market standards (e.g., A-share avg PE ~15-20).
   - Market Status: Market Cap size and Dividend Yield.
   - Note: Detailed financial statements are unavailable in this context, focus on the provided valuation metrics.

3. VALUATION PRECISION (25% Weight)
   - Relative Valuation: Compare PE/PB/PEG against historical avg and industry peers.
   - Intrinsic Value: Estimate Fair Value based on growth and margins.

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
   - 市场地位：结合市值规模和股息率进行分析。
   - 注意：当前上下文仅提供估值指标，不包含详细财报，请基于现有指标进行专业推断。

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

  // 1. Check Cache (Async)
  const cached = await getCachedAnalysis(stock.code, language);
  if (cached) {
      return cached;
  }

  const last = stock.candles[stock.candles.length - 1];
  const financials = stock.financials || { 
    peTTM: null, 
    pb: null, 
    marketCap: null, 
    dividendYield: null, 
    circulatingCap: null, 
    turnoverRate: null, 
    totalShares: null 
  };
  
  // 2. Construct High-Fidelity Technical Context
  const technicalContext = `
    Stock: ${stock.name} (${stock.code})
    Date: ${last.date}
    Price: ${last.close} (Chg: ${last.pctChg?.toFixed(2)}%)
    
    [Moving Averages]
    MA5: ${last.ma5?.toFixed(2)} | MA20: ${last.ma20?.toFixed(2)} | MA50: ${last.ma50?.toFixed(2)} | MA200: ${last.ma200?.toFixed(2)}
    
    [Oscillators]
    RSI(14): ${last.rsi?.toFixed(2)} (Neutral: 30-70)
    MACD: Dif=${last.dif?.toFixed(3)} | Dea=${last.dea?.toFixed(3)} | Hist=${last.macd?.toFixed(3)}
    KDJ: K=${last.k?.toFixed(1)} | D=${last.d?.toFixed(1)} | J=${last.j?.toFixed(1)}
    
    [Volatility]
    Bollinger: Upper=${last.upper?.toFixed(2)} | Lower=${last.lower?.toFixed(2)} | Width=${((last.upper! - last.lower!) / last.mid! * 100).toFixed(1)}%
    
    [Volume]
    Vol: ${last.volume} | Turnover: ${last.turnover?.toFixed(2)}%
  `;

  // 3. Real Financial Context (No Simulations)
  const formatVal = (v: number | null, suffix = '') => v ? v.toFixed(2) + suffix : 'N/A';
  const formatCap = (v: number | null) => v ? (v / 100000000).toFixed(2) + ' Billion CNY' : 'N/A';

  const financialContext = `
    [Real-Time Valuation Metrics]
    PE Ratio (TTM): ${formatVal(financials.peTTM)}
    PB Ratio (LF): ${formatVal(financials.pb)}
    Dividend Yield: ${formatVal(financials.dividendYield, '%')}
    
    [Market Metrics]
    Total Market Cap: ${formatCap(financials.marketCap)}
    Circulating Cap: ${formatCap(financials.circulatingCap)}
    Turnover Rate: ${formatVal(financials.turnoverRate, '%')}
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
      model: 'gemini-3-pro-preview', // Upgraded to Pro for logic
      contents: prompt,
      config: {
        systemInstruction: language === 'zh' ? SYSTEM_INSTRUCTION_ZH : SYSTEM_INSTRUCTION_EN,
        responseMimeType: "application/json",
        // Detailed Schema to force rich content
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
    
    console.log("[Gemini] Raw Response:", text.substring(0, 200) + "...");

    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        throw new Error("Failed to parse Gemini JSON response");
    }

    // --- RELAXED VALIDATION ---
    // Instead of throwing errors on partially missing fields, we try to use defaults.
    // Critical fields: recommendation, summary.
    
    if (!result.strategy) {
         throw new Error("Gemini returned invalid structure (missing strategy)");
    }

    const analysisData: AnalysisResult = {
      stockCode: stock.code,
      timestamp: new Date().toISOString(),
      strategy: {
         recommendation: result.strategy.recommendation || 'HOLD',
         confidenceScore: result.strategy.confidenceScore ?? 0.5,
         summary: result.strategy.summary || "Analysis completed but summary missing.",
         outlook: result.strategy.outlook || 'No outlook provided',
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

    // Save to Cache if valid
    saveCachedAnalysis(stock.code, language, analysisData);

    return analysisData;

  } catch (error: any) {
    console.warn("Gemini Analysis Failed:", error);
    // Determine user-friendly error message
    let errorMsg = language === 'zh' ? "AI 服务暂时不可用" : "AI Service Temporarily Unavailable";
    
    if (error.message?.includes("API_KEY")) {
        errorMsg = language === 'zh' ? "未配置 API Key" : "Missing API Configuration";
    } else if (error.message?.includes("fetch failed") || error.message?.includes("Network")) {
        errorMsg = language === 'zh' ? "网络连接失败，请检查网络设置" : "Network Error - Please check connection";
    } else if (error.status === 503) {
        errorMsg = language === 'zh' ? "服务过载 (503)，请稍后重试" : "Service Overloaded (503) - Try again later";
    } else if (error.status === 400 || error.message?.includes("incomplete") || error.message?.includes("invalid structure")) {
        errorMsg = language === 'zh' ? "AI 返回数据不完整，请重试" : "Incomplete AI Response - Please try again";
    }

    return getFallbackAnalysis(stock, language, errorMsg);
  }
};

const getFallbackAnalysis = (stock: StockData, language: 'en' | 'zh', errorMessage: string): AnalysisResult => {
    // Explicit Error State: Confidence = -1
    // This tells the UI to render an ERROR CARD instead of a normal report.
    
    return {
        stockCode: stock.code,
        timestamp: new Date().toISOString(),
        strategy: {
            recommendation: 'HOLD',
            confidenceScore: -1, // SENTINEL VALUE FOR ERROR UI
            summary: errorMessage, // Display the specific error
            outlook: "Error",
            investmentThesis: [],
            riskFactors: [],
            catalysts: []
        },
        technical: {
            score: 0,
            trend: 'Neutral',
            summary: '',
            signals: [],
            support: 0,
            resistance: 0
        },
        fundamental: {
            score: 0,
            roeAssessment: '',
            dupontAnalysis: '',
            financialHealth: 'Stable',
            highlights: []
        },
        valuation: {
            score: 0,
            status: 'Fair',
            fairValue: 0,
            rationale: ''
        },
        risk: {
            score: 0,
            level: 'Low',
            warnings: []
        }
    };
};
