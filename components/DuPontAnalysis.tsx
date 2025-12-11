
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { AnalysisResult } from '../types/analysis';
import { StockData, FinancialSnapshot } from '../types/stock';
import { useLanguage } from '../contexts/LanguageContext';

interface DuPontProps {
    analysis: AnalysisResult | null;
    stockData?: StockData | null; // Added stockData to access real financials
}

const DuPontAnalysis: React.FC<DuPontProps> = ({ analysis, stockData }) => {
  const { t } = useLanguage();

  if (!analysis) return null;

  // Use Real Data if available
  const f: Partial<FinancialSnapshot> = stockData?.financials || {};
  
  // 1. ROE (The Anchor)
  const roe = f.roe ?? 0;

  // 2. Equity Multiplier (Calc or derive from DebtRatio)
  let eqMult = f.equityMultiplier;
  if (!eqMult || eqMult <= 0) {
      const debtRatioVal = (typeof f.debtRatio === 'number') ? f.debtRatio / 100 : 0.5;
      // Safety cap to avoid infinite
      const safeRatio = Math.min(debtRatioVal, 0.95);
      eqMult = 1 / (1 - safeRatio);
  }

  // 3. Asset Turnover
  let assetTO = f.assetTurnover;
  
  // 4. Net Margin
  let netMargin = f.netMargin;

  // FALLBACK LOGIC:
  // If we have ROE and Equity Multiplier, but missing Turnover or Margin, we can infer a "Synthetic" value for visualization
  // ROE = Margin * Turnover * EquityMultiplier
  // Margin * Turnover = ROE / EquityMultiplier
  
  if (roe > 0 && eqMult > 0) {
      const r_e = roe / eqMult; // This equals Margin * Turnover * 100 (since ROE and Margin are %)

      if (!assetTO && !netMargin) {
          // Both missing: Assume standard Turnover of 0.8 to derive Margin
          assetTO = 0.8;
          netMargin = r_e / assetTO;
      } else if (!assetTO && netMargin) {
          // Missing Turnover
          assetTO = r_e / netMargin;
      } else if (assetTO && !netMargin) {
          // Missing Margin
          netMargin = r_e / assetTO;
      }
  }

  // Final Defaults if calculation failed
  assetTO = assetTO ?? 0;
  netMargin = netMargin ?? 0;

  const data = [
    { name: t('netMargin'), value: parseFloat(netMargin.toFixed(2)), color: '#3b82f6', suffix: '%' },
    { name: t('assetTO'), value: parseFloat(assetTO.toFixed(2)), color: '#8b5cf6', suffix: 'x' },
    { name: t('equityMult'), value: parseFloat(eqMult.toFixed(2)), color: '#ec4899', suffix: 'x' },
    { name: t('roe'), value: parseFloat(roe.toFixed(2)), color: '#ef4444', suffix: '%' },
  ];

  return (
    <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
       <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('dupontAnalysis')}</h3>
        <span className="text-xs text-gray-400">
            {f.reportDate ? `Report: ${f.reportDate}` : ''}
        </span>
      </div>
      <div className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{fontSize: 10}} width={60} axisLine={false} tickLine={false} />
                <Tooltip 
                    cursor={{fill: 'transparent'}} 
                    contentStyle={{fontSize: '12px'}}
                    formatter={(value: number, name: string, props: any) => {
                        const suffix = props.payload.suffix || '';
                        return [value + suffix, ''];
                    }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DuPontAnalysis;
