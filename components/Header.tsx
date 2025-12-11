
import React, { useState, useRef, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import { StockSymbol } from '../types/stock';
import { useLanguage } from '../contexts/LanguageContext';

interface HeaderProps {
  currentStock: StockSymbol;
  onStockChange: (stock: StockSymbol) => void;
  availableStocks: StockSymbol[];
}

const Header: React.FC<HeaderProps> = ({ currentStock, onStockChange, availableStocks }) => {
  const { language, setLanguage, t } = useLanguage();
  
  // Search state
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [filteredStocks, setFilteredStocks] = useState<StockSymbol[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Initialize query with current stock name on mount/change
  useEffect(() => {
    setQuery(currentStock.name);
  }, [currentStock.name]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        // Reset query to current stock name if user clicked away without selecting
        setQuery(currentStock.name);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [currentStock.name]);

  // Filter logic
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    
    if (!val) {
      // Limit default view to top 20 popular ones to avoid massive DOM
      setFilteredStocks(availableStocks.slice(0, 20));
      return;
    }

    const lowerVal = val.toLowerCase();
    const filtered = availableStocks.filter(stock => 
      stock.code.toLowerCase().includes(lowerVal) ||
      stock.name.toLowerCase().includes(lowerVal) ||
      (stock.pinyin && stock.pinyin.toLowerCase().includes(lowerVal))
    );
    // Limit to top 50 matches for performance
    setFilteredStocks(filtered.slice(0, 50));
  };

  const handleFocus = () => {
    setIsFocused(true);
    // On focus, if query matches current name, select all or show all (optional UX)
    // Here we just re-filter based on current query or show all if empty
    if (query === currentStock.name) {
        setQuery(''); // Clear on focus to allow fresh typing
        setFilteredStocks(availableStocks.slice(0, 20));
    } else {
        // Trigger filter immediately
        const lowerVal = query.toLowerCase();
        const filtered = availableStocks.filter(stock => 
            stock.code.toLowerCase().includes(lowerVal) ||
            stock.name.toLowerCase().includes(lowerVal) ||
            (stock.pinyin && stock.pinyin.toLowerCase().includes(lowerVal))
        );
        setFilteredStocks(filtered.slice(0, 50));
    }
  };

  const selectStock = (stock: StockSymbol) => {
    onStockChange(stock);
    setQuery(stock.name);
    setIsFocused(false);
  };

  return (
    <header className="flex flex-col sm:flex-row justify-between items-center p-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 z-50 sticky top-0">
      <div className="flex items-center gap-3 mb-3 sm:mb-0">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-light to-accent-light rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md">
          A
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-light dark:text-text-dark leading-tight">
            {t('appTitle')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('subTitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
        
        {/* Search / Autocomplete Component */}
        <div className="relative w-full sm:w-64" ref={searchContainerRef}>
          <div className="relative">
             <input
                type="text"
                value={query}
                onChange={handleSearchChange}
                onFocus={handleFocus}
                placeholder={t('searchPlaceholder')}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-2 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light transition-colors text-sm font-medium"
             />
             <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
          </div>

          {/* Suggestions Dropdown */}
          {isFocused && (
            <div className="absolute mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 max-h-64 overflow-y-auto z-50">
                {filteredStocks.length > 0 ? (
                    <ul>
                        {filteredStocks.map(stock => (
                            <li 
                                key={stock.code}
                                onClick={() => selectStock(stock)}
                                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center group border-b border-gray-50 dark:border-gray-700 last:border-0"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-primary-light dark:group-hover:text-primary-dark">{stock.name}</span>
                                    <span className="text-xs text-gray-400">{stock.code}</span>
                                </div>
                                {stock.pinyin && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 rounded uppercase">
                                        {stock.pinyin}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center dark:text-gray-400">
                        No stocks found
                    </div>
                )}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 shrink-0">
            <button
                onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-bold text-gray-700 dark:text-gray-300 w-10 h-10 flex items-center justify-center"
            >
                {language === 'en' ? 'Zh' : 'En'}
            </button>
            <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;
