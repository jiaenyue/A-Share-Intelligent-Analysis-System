
import React, { useState } from 'react';
import { ALL_STOCKS, DEFAULT_STOCK } from '../utils/constants';
import { StockSymbol } from '../types/stock';
import { useStockData } from '../hooks/useStockData';
import { useGeminiAnalysis } from '../hooks/useGeminiAnalysis';
import { useLanguage } from '../contexts/LanguageContext';
import Header from './Header';
import KLineChart from './KLineChart';
import TechnicalIndicators from './TechnicalIndicators';
import MetricsPanel from './MetricsPanel';
import AlertPanel from './AlertPanel';
import DuPontAnalysis from './DuPontAnalysis';
import StrategyReport from './StrategyReport';
import ChatWidget from './ChatWidget';

const Dashboard: React.FC = () => {
  const [currentStock, setCurrentStock] = useState<StockSymbol>(DEFAULT_STOCK);
  const { data: stockData, loading: dataLoading, error: stockError } = useStockData(currentStock.code, currentStock.name);
  const { analysis, analyzing } = useGeminiAnalysis(stockData);
  const { t, language } = useLanguage();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark pb-8">
      <Header 
        currentStock={currentStock} 
        onStockChange={setCurrentStock}
        availableStocks={ALL_STOCKS}
      />

      <main className="container mx-auto px-4 mt-6">
        {stockError ? (
           <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center my-10">
               <div className="text-red-500 text-xl font-bold mb-2">{language === 'zh' ? '数据加载失败' : 'Data Load Failed'}</div>
               <p className="text-gray-600 dark:text-gray-300">{stockError}</p>
               <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
               >
                  {language === 'zh' ? '重试' : 'Retry'}
               </button>
           </div>
        ) : (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[800px]">
            
            {/* Main Chart Section - Top Left on Desktop */}
            <div className="lg:col-span-8 lg:row-span-2 flex flex-col gap-6">
                <div className="flex-1 min-h-[400px]">
                {dataLoading || !stockData ? (
                    <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm animate-pulse flex items-center justify-center">
                        <span className="text-gray-400">{t('loadingData')}</span>
                    </div>
                ) : (
                    <KLineChart data={stockData.candles} />
                )}
                </div>
                
                <div className="h-[250px]">
                {dataLoading || !stockData ? (
                    <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm animate-pulse"></div>
                ) : (
                    <TechnicalIndicators data={stockData.candles} />
                )}
                </div>
            </div>

            {/* Right Panel - Analysis & Metrics */}
            <div className="lg:col-span-4 lg:row-span-2 flex flex-col gap-6">
                <div className="flex-none">
                    <AlertPanel analysis={analysis} />
                </div>
                <div className="flex-1 min-h-[300px]">
                    <MetricsPanel analysis={analysis} loading={analyzing || !analysis} />
                </div>
                <div className="h-[200px]">
                    {/* Pass stockData for real financials */}
                    <DuPontAnalysis analysis={analysis} stockData={stockData} />
                </div>
            </div>

            </div>

            {/* Bottom Section - Full Width Strategy Report */}
            <div className="mt-6">
                <StrategyReport analysis={analysis} loading={analyzing} />
            </div>
            </>
        )}
      </main>
      
      {/* Floating Chat Advisor */}
      <ChatWidget currentStock={stockData} />
    </div>
  );
};

export default Dashboard;