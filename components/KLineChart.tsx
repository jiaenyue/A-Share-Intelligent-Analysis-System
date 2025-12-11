
import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Candle } from '../types/stock';
import { useLanguage } from '../contexts/LanguageContext';

interface KLineChartProps {
  data: Candle[];
}

type OverlayType = 'MA' | 'BOLL' | 'NONE';

const KLineChart: React.FC<KLineChartProps> = ({ data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const { t, colors, language } = useLanguage();
  
  // Default to MA view
  const [overlayType, setOverlayType] = useState<OverlayType>('MA');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize ECharts
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartContainerRef.current);
    }

    const chart = chartInstanceRef.current;
    
    // Assign to group for synchronization
    chart.group = 'stockGroup';
    echarts.connect('stockGroup');
    
    // Check dark mode
    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = 'transparent'; 
    const textColor = isDark ? '#9ca3af' : '#4b5563';
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    const splitLineColor = isDark ? '#374151' : '#f3f4f6';

    // Format Data for ECharts
    const categoryData = data.map(item => item.date);
    const values = data.map(item => [item.open, item.close, item.low, item.high]);
    const volumes = data.map((item, index) => [index, item.volume, item.close > item.open ? 1 : -1]);

    // Pre-calculate indicator arrays for performance
    const ma5 = data.map(item => item.ma5 ?? '-');
    const ma20 = data.map(item => item.ma20 ?? '-');
    const ma50 = data.map(item => item.ma50 ?? '-');
    
    const bollUpper = data.map(item => item.upper ?? '-');
    const bollMid = data.map(item => item.mid ?? '-');
    const bollLower = data.map(item => item.lower ?? '-');

    // Calculate Zoom Range (Last 3 months ~ 66 trading days)
    const zoomStartValue = Math.max(0, data.length - 66);
    const zoomEndValue = Math.max(0, data.length - 1);

    const option: echarts.EChartsOption = {
      animation: false,
      backgroundColor: bgColor,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: isDark ? 'rgba(31, 33, 33, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#f3f4f6' : '#1f2937',
          fontSize: 12
        },
        formatter: (params: any) => {
           let res = `<div style="font-weight:bold; margin-bottom: 4px;">${params[0].axisValue}</div>`;
           params.forEach((param: any) => {
               if (param.seriesName === 'K-Line') {
                   const d = param.data; // [open, close, low, high]
                   // Determine color based on Close vs Open and current language logic
                   const isUp = d[2] > d[1];
                   const color = isUp ? colors.up : colors.down;
                   
                   res += `
                   <div style="display:flex; justify-content:space-between; gap:12px; font-family:monospace;">
                       <span>${t('open')}:</span><span style="color:${color}">${d[1].toFixed(2)}</span>
                       <span>${t('close')}:</span><span style="color:${color}">${d[2].toFixed(2)}</span>
                   </div>
                   <div style="display:flex; justify-content:space-between; gap:12px; font-family:monospace;">
                       <span>${t('low')}:</span><span>${d[3].toFixed(2)}</span>
                       <span>${t('high')}:</span><span>${d[4].toFixed(2)}</span>
                   </div>
                   <hr style="margin:4px 0; border:0; border-top:1px solid #eee;"/>
                   `;
               } else if (param.seriesName === 'Volume') {
                   res += `<div style="display:flex; justify-content:space-between;"><span>${t('vol')}:</span><span>${(param.data[1]/10000).toFixed(1)}w</span></div>`;
               } else {
                   const val = typeof param.value === 'number' ? param.value.toFixed(2) : param.value;
                   res += `<div style="display:flex; justify-content:space-between;"><span>${param.seriesName}:</span><span style="color:${param.color}">${val}</span></div>`;
               }
           });
           return res;
        }
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { backgroundColor: '#777' }
      },
      grid: [
        { left: '50px', right: '16px', top: '30px', height: '65%' },
        { left: '50px', right: '16px', top: '78%', height: '15%' }
      ],
      xAxis: [
        {
          type: 'category',
          data: categoryData,
          boundaryGap: false,
          axisLine: { onZero: false, lineStyle: { color: gridColor } },
          splitLine: { show: false },
          axisLabel: { color: textColor },
          min: 'dataMin',
          max: 'dataMax',
          axisPointer: { z: 100 }
        },
        {
          type: 'category',
          gridIndex: 1,
          data: categoryData,
          boundaryGap: false,
          axisLine: { onZero: false, lineStyle: { color: gridColor } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          min: 'dataMin',
          max: 'dataMax'
        }
      ],
      yAxis: [
        {
          scale: true,
          splitArea: { show: false },
          splitLine: { show: true, lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor }
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        { 
          type: 'inside', 
          xAxisIndex: [0, 1], 
          startValue: zoomStartValue, 
          endValue: zoomEndValue 
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          top: '94%',
          height: '4%',
          startValue: zoomStartValue, 
          endValue: zoomEndValue,
          borderColor: 'transparent',
          backgroundColor: isDark ? '#374151' : '#e5e7eb',
          fillerColor: isDark ? 'rgba(50, 184, 198, 0.2)' : 'rgba(32, 130, 148, 0.2)',
          handleStyle: { color: isDark ? '#32B8C6' : '#208294' }
        }
      ],
      series: [
        {
          name: 'K-Line',
          type: 'candlestick',
          data: values,
          itemStyle: {
            color: colors.up,
            color0: colors.down,
            borderColor: colors.up,
            borderColor0: colors.down
          }
        },
        // Volume Bar
        {
          name: 'Volume',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes,
          itemStyle: {
            color: (params: any) => {
                return params.value[2] === 1 ? colors.up : colors.down;
            }
          }
        }
      ]
    };

    // Dynamically Add Overlays
    if (overlayType === 'MA') {
        (option.series as any[]).push(
            {
                name: 'MA5',
                type: 'line',
                data: ma5,
                smooth: true,
                showSymbol: false,
                lineStyle: { opacity: 0.8, width: 1, color: '#fb923c' }
            },
            {
                name: 'MA20',
                type: 'line',
                data: ma20,
                smooth: true,
                showSymbol: false,
                lineStyle: { opacity: 0.8, width: 1, color: '#60a5fa' }
            },
            {
                name: 'MA50',
                type: 'line',
                data: ma50,
                smooth: true,
                showSymbol: false,
                lineStyle: { opacity: 0.8, width: 1, color: '#c084fc' }
            }
        );
    } else if (overlayType === 'BOLL') {
        (option.series as any[]).push(
            {
                name: 'BOLL Upper',
                type: 'line',
                data: bollUpper,
                smooth: true,
                showSymbol: false,
                lineStyle: { opacity: 0.8, width: 1, type: 'dashed', color: '#8b5cf6' } // Violet
            },
            {
                name: 'BOLL Mid',
                type: 'line',
                data: bollMid,
                smooth: true,
                showSymbol: false,
                lineStyle: { opacity: 0.8, width: 1, color: '#60a5fa' } // Blue (same as MA20 usually)
            },
            {
                name: 'BOLL Lower',
                type: 'line',
                data: bollLower,
                smooth: true,
                showSymbol: false,
                lineStyle: { opacity: 0.8, width: 1, type: 'dashed', color: '#8b5cf6' } // Violet
            }
        );
    }

    // Handle Empty/Loading State Visuals
    if (data.length === 0) {
        option.title = {
            text: t('loadingData'),
            left: 'center',
            top: 'center',
            textStyle: { color: textColor }
        };
    }

    chart.setOption(option, true); // true = not merge, allows removing series when toggling

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [data, language, colors, t, overlayType]);

  return (
    <div className="h-full w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
       <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
        <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('priceAction')}</h3>
            
            {/* Overlay Toggles */}
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
                <button 
                    onClick={() => setOverlayType('MA')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        overlayType === 'MA' 
                        ? 'bg-white dark:bg-gray-600 text-primary-light dark:text-primary-dark shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                    }`}
                >
                    MA
                </button>
                <button 
                    onClick={() => setOverlayType('BOLL')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        overlayType === 'BOLL' 
                        ? 'bg-white dark:bg-gray-600 text-primary-light dark:text-primary-dark shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                    }`}
                >
                    BOLL
                </button>
                <button 
                    onClick={() => setOverlayType('NONE')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        overlayType === 'NONE' 
                        ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                    }`}
                >
                    Hide
                </button>
            </div>
        </div>

        {/* Legend Display (Dynamic based on overlay) */}
        <div className="flex gap-3 text-xs hidden sm:flex">
          {overlayType === 'MA' && (
              <>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> MA5</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> MA20</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400"></span> MA50</div>
              </>
          )}
          {overlayType === 'BOLL' && (
              <>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500"></span> BOLL</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> MID</div>
              </>
          )}
        </div>
      </div>
      <div className="flex-1 w-full relative">
         <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};

export default KLineChart;
