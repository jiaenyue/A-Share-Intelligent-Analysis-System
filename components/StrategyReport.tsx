
import React from 'react';
import { AnalysisResult } from '../types/analysis';
import { useLanguage } from '../contexts/LanguageContext';

interface StrategyReportProps {
  analysis: AnalysisResult | null;
  loading: boolean;
}

const StrategyReport: React.FC<StrategyReportProps> = ({ analysis, loading }) => {
  const { t, language } = useLanguage();

  const normalizeConfidence = (score: number) => {
    const val = Number(score);
    // If score is > 1 (e.g. 80), it's already percentage. 
    // If <= 1 (e.g. 0.8), it's decimal.
    // Cap at 100 to prevent 8000% error.
    let pct = val > 1 ? val : val * 100;
    if (pct > 100) pct = 100;
    return pct.toFixed(0);
  };

  const translateEnum = (val: string, type: 'trend' | 'status' | 'rec') => {
      if (language === 'en') return val.replace('_', ' ');
      
      const map: Record<string, string> = {
          'Bullish': '看涨', 'Bearish': '看跌', 'Neutral': '中性',
          'Undervalued': '低估', 'Fair': '合理', 'Overvalued': '高估',
          'STRONG_BUY': '强力买入', 'BUY': '买入', 'HOLD': '持有', 'SELL': '卖出', 'STRONG_SELL': '强力卖出'
      };
      return map[val] || val;
  };

  // 1. LOADING STATE
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary-light border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium animate-pulse">{t('generating')}</p>
            <div className="w-full max-w-lg space-y-2">
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-full"></div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-5/6"></div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-4/6"></div>
            </div>
        </div>
      </div>
    );
  }

  // 2. EMPTY STATE
  if (!analysis) {
     return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-500">
            {t('selectStock')}
        </div>
     );
  }

  const { strategy, technical, fundamental, valuation } = analysis;

  // 3. ERROR STATE (Sentinel value -1)
  if (strategy.confidenceScore === -1) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900 overflow-hidden">
             <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                    {language === 'zh' ? '分析生成失败' : 'Analysis Generation Failed'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6">
                    {strategy.summary}
                </p>
                <div className="text-sm text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-4 py-2 rounded">
                    {language === 'zh' ? '请检查 API Key 配置或网络连接。' : 'Please check your API Key configuration or network connection.'}
                </div>
             </div>
        </div>
      );
  }

  // 4. NORMAL REPORT
  const getRecColor = (rec: string) => {
    switch(rec) {
        case 'STRONG_BUY': return 'bg-green-600 text-white';
        case 'BUY': return 'bg-emerald-500 text-white';
        case 'SELL': return 'bg-red-500 text-white';
        case 'STRONG_SELL': return 'bg-red-700 text-white';
        default: return 'bg-yellow-500 text-white';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header Section */}
      <div className="border-b border-gray-100 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('geminiStrategy')}</h2>
                </div>
                <p className="text-sm text-gray-500">{strategy.summary}</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-semibold">{t('confidence')}</p>
                    <p className="text-xl font-bold text-primary-light">{normalizeConfidence(strategy.confidenceScore)}%</p>
                </div>
                <div className={`px-4 py-2 rounded-lg font-bold text-sm tracking-wide shadow-sm ${getRecColor(strategy.recommendation)}`}>
                    {translateEnum(strategy.recommendation, 'rec')}
                </div>
            </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Column 1: Strategy & Thesis */}
         <div className="space-y-6">
            <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                    {language === 'zh' ? '投资逻辑' : 'Investment Thesis'}
                </h3>
                <ul className="space-y-2">
                    {strategy.investmentThesis.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                            <span className="text-green-500 font-bold mt-0.5">✓</span>
                            <span>{item}</span>
                        </li>
                    ))}
                    {strategy.investmentThesis.length === 0 && <li className="text-sm text-gray-400 italic">{language === 'zh' ? '暂无详细逻辑' : 'No thesis available'}</li>}
                </ul>
            </div>
            
            <div>
                 <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                    {language === 'zh' ? '催化剂' : 'Catalysts'}
                 </h3>
                 <ul className="space-y-2">
                    {strategy.catalysts.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                            <span className="text-blue-500 font-bold mt-0.5">⚡</span>
                            <span>{item}</span>
                        </li>
                    ))}
                    {strategy.catalysts.length === 0 && <li className="text-sm text-gray-400 italic">{language === 'zh' ? '暂无催化剂' : 'None identified'}</li>}
                 </ul>
            </div>
         </div>

         {/* Column 2: Deep Dives */}
         <div className="space-y-6 lg:col-span-2">
            <div className="grid md:grid-cols-2 gap-6">
                 {/* Technical Deep Dive */}
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-primary-light mb-2 text-sm flex justify-between">
                        <span>{language === 'zh' ? '技术面复盘' : 'Technical Deep Dive'}</span>
                        <span className="text-gray-400 text-xs">{language === 'zh' ? '评分' : 'Score'}: {technical.score}</span>
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{technical.summary}</p>
                    <div className="text-xs space-y-1 text-gray-500">
                        <div className="flex justify-between"><span>{t('trend')}:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{translateEnum(technical.trend, 'trend')}</span></div>
                        <div className="flex justify-between"><span>{t('support')}:</span> <span className="font-mono">{technical.support.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>{language === 'zh' ? '阻力位' : 'Resistance'}:</span> <span className="font-mono">{technical.resistance.toFixed(2)}</span></div>
                    </div>
                 </div>

                 {/* Fundamental & DuPont */}
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-500 mb-2 text-sm flex justify-between">
                        <span>{language === 'zh' ? '基本面 & 杜邦' : 'Fundamental & DuPont'}</span>
                        <span className="text-gray-400 text-xs">{language === 'zh' ? '评分' : 'Score'}: {fundamental.score}</span>
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{fundamental.dupontAnalysis || fundamental.roeAssessment}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {fundamental.highlights.slice(0, 3).map((h, i) => (
                            <span key={i} className="text-[10px] px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300">{h}</span>
                        ))}
                    </div>
                 </div>
                 
                 {/* Valuation */}
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg md:col-span-2">
                    <h4 className="font-semibold text-blue-500 mb-2 text-sm flex justify-between">
                        <span>{language === 'zh' ? '估值逻辑' : 'Valuation Logic'}</span>
                        <span className="text-gray-400 text-xs">{language === 'zh' ? '评分' : 'Score'}: {valuation.score}</span>
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className={`font-bold mr-2 ${valuation.status === 'Undervalued' ? 'text-green-500' : valuation.status === 'Overvalued' ? 'text-red-500' : 'text-yellow-500'}`}>
                            [{translateEnum(valuation.status, 'status')}]
                        </span>
                        {valuation.rationale}
                    </p>
                    <div className="mt-2 text-xs text-gray-500 flex gap-4">
                         <span>{language === 'zh' ? '合理估值' : 'Fair Value Est'}: <span className="font-mono font-bold">{valuation.fairValue.toFixed(2)}</span></span>
                    </div>
                 </div>
            </div>
         </div>
      </div>
      
      {/* Footer Risks */}
      <div className="bg-red-50 dark:bg-red-900/10 px-6 py-3 border-t border-red-100 dark:border-red-900/30">
          <div className="flex items-start gap-2">
             <span className="text-red-500 font-bold text-xs uppercase mt-0.5">{language === 'zh' ? '风险提示' : 'Key Risks'}:</span>
             <p className="text-xs text-red-800 dark:text-red-300 flex-1">
                {strategy.riskFactors.join(' • ')}
             </p>
          </div>
      </div>
    </div>
  );
};

export default StrategyReport;
