
import { useState, useEffect, useRef } from 'react';
import { AnalysisResult } from '../types/analysis';
import { StockData } from '../types/stock';
import { analyzeStockWithGemini } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

export const useGeminiAnalysis = (stockData: StockData | null) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { language } = useLanguage();
  
  // Keep track of the currently displayed/analyzing stock code
  // This helps us detect switches immediately and prevent race conditions
  const lastCodeRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Safety check: If no data, clear everything
    if (!stockData || !stockData.candles || stockData.candles.length === 0) {
      setAnalysis(null);
      setAnalyzing(false);
      return;
    }

    // 2. IMMEDIATE RESET: If stock code changed, clear old analysis instantly
    // This prevents showing "Stock A" report while viewing "Stock B" chart
    if (stockData.code !== lastCodeRef.current) {
        setAnalysis(null); 
        setAnalyzing(true);
        lastCodeRef.current = stockData.code;
    }

    const runAnalysis = async () => {
      // Double check current code to prevent race conditions from debounced calls
      const currentCode = stockData.code;
      
      setAnalyzing(true);
      try {
        const result = await analyzeStockWithGemini(stockData, language);
        
        // Only update state if the result matches the stock currently being viewed
        if (currentCode === lastCodeRef.current) {
            setAnalysis(result);
        }
      } catch (error) {
        console.error("Analysis hook error", error);
      } finally {
        // Only turn off loading if we haven't switched stocks again in the meantime
        if (currentCode === lastCodeRef.current) {
            setAnalyzing(false);
        }
      }
    };

    // Debounce analysis to avoid spamming API when user types fast or switches quickly
    const timeout = setTimeout(runAnalysis, 500);

    return () => {
      clearTimeout(timeout);
    };

  }, [stockData?.code, stockData?.candles.length, language]);

  return { analysis, analyzing };
};
