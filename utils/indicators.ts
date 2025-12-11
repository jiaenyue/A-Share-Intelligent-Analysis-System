import { Candle } from '../types/stock';

export const calculateMA = (data: Candle[], period: number): Candle[] => {
  return data.map((item, index, arr) => {
    if (index < period - 1) return { ...item, [`ma${period}`]: null };
    const slice = arr.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    return { ...item, [`ma${period}`]: sum / period };
  });
};

export const calculateMACD = (data: Candle[], short = 12, long = 26, mid = 9): Candle[] => {
  let emaShort = 0;
  let emaLong = 0;
  let dea = 0;

  return data.map((item, index) => {
    if (index === 0) {
      emaShort = item.close;
      emaLong = item.close;
      dea = 0;
      return { ...item, dif: 0, dea: 0, macd: 0 };
    }

    emaShort = (2 * item.close + (short - 1) * emaShort) / (short + 1);
    emaLong = (2 * item.close + (long - 1) * emaLong) / (long + 1);
    const dif = emaShort - emaLong;
    dea = (2 * dif + (mid - 1) * dea) / (mid + 1);
    const macd = (dif - dea) * 2;

    return { ...item, dif, dea, macd };
  });
};

export const calculateRSI = (data: Candle[], period = 14): Candle[] => {
  let gains = 0;
  let losses = 0;

  return data.map((item, index, arr) => {
    if (index === 0) return { ...item, rsi: 50 };

    const change = item.close - arr[index - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (index < period) {
      gains += gain;
      losses += loss;
      if (index === period - 1) {
        gains /= period;
        losses /= period;
      }
      return { ...item, rsi: 50 }; // Simplified initial
    } else {
      gains = (gains * (period - 1) + gain) / period;
      losses = (losses * (period - 1) + loss) / period;
      const rs = losses === 0 ? 100 : gains / losses;
      const rsi = 100 - (100 / (1 + rs));
      return { ...item, rsi };
    }
  });
};

export const calculateKDJ = (data: Candle[], n = 9, m1 = 3, m2 = 3): Candle[] => {
  let k = 50;
  let d = 50;

  return data.map((item, index, arr) => {
    if (index < n - 1) return { ...item, k: 50, d: 50, j: 50 };

    const slice = arr.slice(index - n + 1, index + 1);
    const lowN = Math.min(...slice.map(c => c.low));
    const highN = Math.max(...slice.map(c => c.high));
    
    const rsv = highN === lowN ? 50 : ((item.close - lowN) / (highN - lowN)) * 100;

    k = (1 * rsv + (m1 - 1) * k) / m1;
    d = (1 * k + (m2 - 1) * d) / m2;
    const j = 3 * k - 2 * d;

    return { ...item, k, d, j };
  });
};

export const calculateBollinger = (data: Candle[], period = 20, multiplier = 2): Candle[] => {
  return data.map((item, index, arr) => {
    if (index < period - 1) return { ...item, upper: null, mid: null, lower: null };

    const slice = arr.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    const mid = sum / period;
    
    const variance = slice.reduce((acc, curr) => acc + Math.pow(curr.close - mid, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      ...item,
      mid,
      upper: mid + (stdDev * multiplier),
      lower: mid - (stdDev * multiplier)
    };
  });
};

export const processIndicators = (candles: Candle[]): Candle[] => {
  let data = calculateMA(candles, 5);
  data = calculateMA(data, 10);
  data = calculateMA(data, 20);
  data = calculateMA(data, 50);
  data = calculateMA(data, 200);
  data = calculateMACD(data);
  data = calculateRSI(data);
  data = calculateKDJ(data);
  data = calculateBollinger(data);
  return data;
};