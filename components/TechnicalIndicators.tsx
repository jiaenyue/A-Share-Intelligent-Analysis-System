
import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Candle } from '../types/stock';
import { useLanguage } from '../contexts/LanguageContext';

interface TechnicalIndicatorsProps {
  data: Candle[];
}

const TechnicalIndicators: React.FC<TechnicalIndicatorsProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'MACD' | 'RSI' | 'KDJ'>('MACD');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const { colors, language } = useLanguage();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartContainerRef.current);
    }

    const chart = chartInstanceRef.current;
    
    // Assign to group for synchronization
    chart.group = 'stockGroup';
    echarts.connect('stockGroup');

    const isDark = document.documentElement.classList.contains('dark');
    
    // Common styles
    const bgColor = 'transparent';
    const textColor = isDark ? '#9ca3af' : '#4b5563';
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    const splitLineColor = isDark ? '#374151' : '#f3f4f6';

    const dates = data.map(item => item.date);

    // Calculate Zoom Range (Last 3 months ~ 66 trading days)
    const zoomStartValue = Math.max(0, data.length - 66);
    const zoomEndValue = Math.max(0, data.length - 1);

    let option: echarts.EChartsOption = {
      backgroundColor: bgColor,
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: isDark ? 'rgba(31, 33, 33, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: { color: isDark ? '#f3f4f6' : '#1f2937', fontSize: 12 },
        formatter: (params: any) => {
            let res = `<div style="font-weight:bold; margin-bottom: 4px;">${params[0].axisValue}</div>`;
            params.forEach((param: any) => {
                const val = param.value !== undefined ? (typeof param.value === 'number' ? param.value.toFixed(2) : param.value) : '-';
                res += `<div style="display:flex; justify-content:space-between; gap:12px;">
                          <span>${param.marker} ${param.seriesName}:</span>
                          <span style="font-weight:bold; color:${param.color}">${val}</span>
                        </div>`;
            });
            return res;
        }
      },
      grid: {
        left: '50px',
        right: '16px',
        top: '10px',
        bottom: '20px'
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { show: false }, // Hide dates to save space, rely on main chart or tooltip
        axisTick: { show: false },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor, fontSize: 10 }
      },
      dataZoom: [
         { 
           type: 'inside', 
           startValue: zoomStartValue, 
           endValue: zoomEndValue 
         } 
      ]
    };

    // Specific Series Configuration
    if (activeTab === 'MACD') {
      option.series = [
        {
          name: 'MACD',
          type: 'bar',
          data: data.map(item => item.macd),
          itemStyle: {
            color: (params: any) => (params.value > 0 ? colors.up : colors.down)
          }
        },
        {
          name: 'DIF',
          type: 'line',
          data: data.map(item => item.dif),
          symbol: 'none',
          lineStyle: { width: 1, color: '#fb923c' } // Orange
        },
        {
          name: 'DEA',
          type: 'line',
          data: data.map(item => item.dea),
          symbol: 'none',
          lineStyle: { width: 1, color: '#60a5fa' } // Blue
        }
      ];
    } else if (activeTab === 'RSI') {
      const rsiYAxis: echarts.YAXisComponentOption = {
        type: 'value',
        scale: false,
        splitLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor, fontSize: 10 },
        min: 0,
        max: 100,
        splitNumber: 3
      };
      option.yAxis = rsiYAxis;

      option.series = [
        {
          name: 'RSI(14)',
          type: 'line',
          data: data.map(item => item.rsi),
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#8884d8' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(136, 132, 216, 0.5)' },
              { offset: 1, color: 'rgba(136, 132, 216, 0.05)' }
            ])
          },
          markLine: {
            symbol: 'none',
            label: { show: false },
            lineStyle: { type: 'dashed', width: 1 },
            data: [
                { yAxis: 70, lineStyle: { color: colors.up } }, // Overbought
                { yAxis: 30, lineStyle: { color: colors.down } } // Oversold
            ]
          }
        }
      ];
    } else if (activeTab === 'KDJ') {
        const kdjYAxis: echarts.YAXisComponentOption = {
          type: 'value',
          scale: false,
          splitLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor, fontSize: 10 },
          min: 0,
          max: 100
        };
        option.yAxis = kdjYAxis;

        option.series = [
            {
                name: 'K',
                type: 'line',
                data: data.map(item => item.k),
                symbol: 'none',
                lineStyle: { width: 1, color: '#fb923c' }
            },
            {
                name: 'D',
                type: 'line',
                data: data.map(item => item.d),
                symbol: 'none',
                lineStyle: { width: 1, color: '#60a5fa' }
            },
            {
                name: 'J',
                type: 'line',
                data: data.map(item => item.j),
                symbol: 'none',
                lineStyle: { width: 1, color: '#c084fc' }
            }
        ];
    }

    chart.setOption(option, true); // true = not merge, completely reset

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [data, activeTab, colors, language]);

  return (
    <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        {(['MACD', 'RSI', 'KDJ'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab
                ? 'text-primary-light border-b-2 border-primary-light dark:text-primary-dark dark:border-primary-dark'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 w-full relative">
         <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};

export default TechnicalIndicators;
