import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { AnalysisResult } from '../types/analysis';
import { useLanguage } from '../contexts/LanguageContext';

interface DuPontProps {
    analysis: AnalysisResult | null;
}

const DuPontAnalysis: React.FC<DuPontProps> = ({ analysis }) => {
  const { t } = useLanguage();

  const data = [
    { name: t('netMargin'), value: 24.5, color: '#3b82f6' },
    { name: t('assetTO'), value: 0.8, color: '#8b5cf6' },
    { name: t('equityMult'), value: 1.6, color: '#ec4899' },
    { name: t('roe'), value: 31.4, color: '#ef4444' },
  ];

  if (!analysis) return null;

  return (
    <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
       <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('dupontAnalysis')}</h3>
      </div>
      <div className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{fontSize: 10}} width={60} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{fontSize: '12px'}} />
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
