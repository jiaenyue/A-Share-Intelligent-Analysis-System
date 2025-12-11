
import React from 'react';
import { AnalysisResult } from '../types/analysis';
import { useLanguage } from '../contexts/LanguageContext';

interface MetricsPanelProps {
  analysis: AnalysisResult | null;
  loading: boolean;
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ analysis, loading }) => {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
            <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded"></div>
            <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded"></div>
            <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  // Translation helpers for dynamic values
  const translateTrend = (trend: string) => {
    switch(trend) {
      case 'Bullish': return t('bullish');
      case 'Bearish': return t('bearish');
      case 'Neutral': return t('neutral');
      default: return trend;
    }
  };

  const translateHealth = (health: string) => {
    switch(health) {
        case 'Strong': return t('strong');
        case 'Stable': return t('stable');
        case 'Weak': return t('weak');
        default: return health;
    }
  }

  const translateValuation = (status: string) => {
      switch(status) {
          case 'Undervalued': return t('undervalued');
          case 'Fair': return t('fair');
          case 'Overvalued': return t('overvalued');
          default: return status;
      }
  }

  // Helper to fix the 8500% bug and handle errors
  const getNormalizedConfidence = (score: number | undefined) => {
    if (score === undefined || score === null) return '0%';
    if (score === -1) return 'N/A'; // Error state
    
    const val = Number(score);
    // If score > 1 (e.g. 85), it's percentage. If <= 1 (e.g. 0.85), it's decimal.
    let pct = val > 1 ? val : val * 100;
    // Cap at 100
    if (pct > 100) pct = 100;
    
    return `${pct.toFixed(0)}%`;
  };

  return (
    <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('aiInsights')}</h3>
      </div>
      <div className="p-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-xs text-blue-600 dark:text-blue-300 mb-1">{t('aiScore')}</p>
                {/* Calculate composite score from component scores */}
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                    {Math.round(((analysis.technical.score * 0.35) + (analysis.fundamental.score * 0.4) + (analysis.valuation.score * 0.25)))}
                </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                <p className="text-xs text-purple-600 dark:text-purple-300 mb-1">{t('confidence')}</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-200">
                    {getNormalizedConfidence(analysis.strategy?.confidenceScore)}
                </p>
            </div>
        </div>

        <div className="space-y-4">
            <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('technical')}</h4>
                <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{t('trend')}</span>
                    <span className={`font-medium ${analysis.technical?.trend === 'Bullish' ? 'text-red-500' : analysis.technical?.trend === 'Bearish' ? 'text-green-500' : 'text-gray-500'}`}>
                        {translateTrend(analysis.technical?.trend ?? 'Neutral')}
                    </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('support')}</span>
                    <span className="font-mono">{analysis.technical?.support?.toFixed(2) ?? '-'}</span>
                </div>
            </div>

             <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('fundamental')}</h4>
                 <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{t('health')}</span>
                    <span className="font-medium text-green-600">{translateHealth(analysis.fundamental?.financialHealth ?? '-')}</span>
                </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('valuation')}</span>
                    <span className="font-medium text-blue-600">{translateValuation(analysis.valuation?.status ?? '-')}</span>
                </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 italic leading-relaxed line-clamp-3">
                    "{analysis.strategy?.summary ?? 'No summary available'}"
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsPanel;
