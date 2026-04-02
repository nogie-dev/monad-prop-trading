import { useEffect, useRef } from 'react';
import { createChart, ColorType, type ISeriesApi, type Time } from 'lightweight-charts';
import type { HistoryPoint } from '../hooks/usePriceHistory';

type PairKey = 'eth' | 'btc';

interface Props {
  history: HistoryPoint[];
  selectedPair: PairKey;
}

export function TradingChart({ history, selectedPair }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const ethSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const btcSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  // Build chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: '#0c0f13' },
        textColor: '#7e8794',
      },
      grid: {
        vertLines: { color: '#171c24' },
        horzLines: { color: '#171c24' },
      },
      rightPriceScale: { borderColor: '#171c24' },
      timeScale: { borderColor: '#171c24', secondsVisible: false, timeVisible: true },
      crosshair: { mode: 1 },
    });

    const ethSeries = chart.addAreaSeries({
      lineColor: '#19c2ff',
      topColor: 'rgba(25, 194, 255, 0.12)',
      bottomColor: 'transparent',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    const btcSeries = chart.addAreaSeries({
      lineColor: '#f7931a',
      topColor: 'rgba(247, 147, 26, 0.12)',
      bottomColor: 'transparent',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    chartRef.current = chart;
    ethSeriesRef.current = ethSeries;
    btcSeriesRef.current = btcSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      ethSeriesRef.current = null;
      btcSeriesRef.current = null;
    };
  }, []);

  // Update series data when history changes
  useEffect(() => {
    const ethData = history.filter((p) => p.eth > 0).map((p) => ({ time: p.time as Time, value: p.eth }));
    const btcData = history.filter((p) => p.btc > 0).map((p) => ({ time: p.time as Time, value: p.btc }));
    if (ethData.length) ethSeriesRef.current?.setData(ethData);
    if (btcData.length) btcSeriesRef.current?.setData(btcData);
    if (ethData.length || btcData.length) chartRef.current?.timeScale().fitContent();
  }, [history]);

  // Toggle visibility based on selected pair
  useEffect(() => {
    ethSeriesRef.current?.applyOptions({ visible: selectedPair === 'eth' });
    btcSeriesRef.current?.applyOptions({ visible: selectedPair === 'btc' });
  }, [selectedPair]);

  return <div ref={containerRef} className="w-full" />;
}
