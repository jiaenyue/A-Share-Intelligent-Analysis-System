import { useState, useEffect } from 'react';
import { StockData } from '../types/stock';
import { fetchStockData } from '../services/baostockService';

export const useStockData = (code: string, name: string) => {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // DIRECT FETCH - NO LOCALSTORAGE CACHING
        // LocalStorage is too small (5MB) for K-Line data and causes crashes.
        // We rely on browser HTTP cache or session state instead.
        const result = await fetchStockData(code, name);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      loadData();
    }
  }, [code, name]);

  return { data, loading, error };
};