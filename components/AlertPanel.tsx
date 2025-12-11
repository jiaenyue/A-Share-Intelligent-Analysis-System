import React from 'react';
import { AnalysisResult } from '../types/analysis';
import { useLanguage } from '../contexts/LanguageContext';

interface AlertPanelProps {
  analysis: AnalysisResult | null;
}

const AlertPanel: React.FC<AlertPanelProps> = ({ analysis }) => {
  const { t } = useLanguage();

  if (!analysis) return null;

  const getRiskColor = (level: string = 'Low') => {
    switch (level) {
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'Critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const translateRisk = (level: string) => {
      switch(level) {
          case 'Low': return t('lowRisk');
          case 'Medium': return t('mediumRisk');
          case 'High': return t('highRisk');
          case 'Critical': return t('criticalRisk');
          default: return t('unknown');
      }
  }

  // Safe access to risk properties
  const riskLevel = analysis.risk?.level ?? 'Unknown';
  const warnings = analysis.risk?.warnings ?? [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {t('riskAnalysis')}
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRiskColor(riskLevel)}`}>
            {translateRisk(riskLevel)} {t('risk')}
        </span>
      </div>
      <div className="space-y-2">
        {warnings.length > 0 ? (
            warnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{warning}</span>
                </div>
            ))
        ) : (
            <p className="text-xs text-gray-500 italic">{t('noRisk')}</p>
        )}
      </div>
    </div>
  );
};

export default AlertPanel;
