import React, { useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { LanguageProvider } from './contexts/LanguageContext';

const App: React.FC = () => {
  
  // Aggressive Cleanup: Clear old massive stock data from LocalStorage on mount
  // to prevent QuotaExceededErrors for other features (like Gemini cache).
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('stock_')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        console.log(`[Cleanup] Removing ${keysToRemove.length} old stock data entries to free quota.`);
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (e) {
      console.warn("Cleanup failed", e);
    }
  }, []);

  return (
    <LanguageProvider>
      <Dashboard />
    </LanguageProvider>
  );
};

export default App;