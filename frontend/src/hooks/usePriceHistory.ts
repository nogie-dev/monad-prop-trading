import { useState, useEffect, useCallback, useRef } from 'react';

export interface HistoryPoint {
  time: number; // seconds epoch
  eth: number;
  btc: number;
}

const HISTORY_API = `${import.meta.env.VITE_OFFCHAIN_API ?? 'http://localhost:9999'}/history`;

async function fetchHistory(): Promise<HistoryPoint[]> {
  const res = await fetch(HISTORY_API, { headers: { 'ngrok-skip-browser-warning': 'true' } });
  if (!res.ok) throw new Error(`History API error: ${res.status}`);
  return res.json() as Promise<HistoryPoint[]>;
}

export function usePriceHistory(intervalMs = 15_000) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const refetch = useCallback(async () => {
    try {
      const data = await fetchHistory();
      setHistory((prev) => {
        // If new data is fully replacing, just set; else append diff
        if (!prev.length || !lastTimestampRef.current) {
          lastTimestampRef.current = data.length ? data[data.length - 1].time : null;
          return data;
        }
        const lastSeen = lastTimestampRef.current;
        const toAppend = data.filter((d) => d.time > lastSeen);
        if (toAppend.length) {
          lastTimestampRef.current = toAppend[toAppend.length - 1].time;
          return [...prev, ...toAppend].slice(-500);
        }
        return prev;
      });
      if (data.length) {
        lastTimestampRef.current = data[data.length - 1].time;
      }
      setError(null);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      console.error('[usePriceHistory] fetch failed:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    const id = setInterval(() => { void refetch(); }, intervalMs);
    return () => clearInterval(id);
  }, [refetch, intervalMs]);

  return { history, loading, error, refetch };
}
