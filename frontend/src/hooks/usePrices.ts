import { useState, useEffect, useCallback } from 'react';

interface Prices {
  eth: number;
  btc: number;
  updatedAt?: number;
}

// monitoring.py price API (run locally or on server)
const PRICE_API = import.meta.env.VITE_PRICE_API || 'http://localhost:8000/prices';

async function fetchMonitorPrices(): Promise<Prices> {
  const res = await fetch(PRICE_API);
  if (!res.ok) throw new Error(`Price API error: ${res.status}`);
  return res.json() as Promise<Prices>;
}

export function usePrices(intervalMs = 15_000) {
  const [prices, setPrices] = useState<Prices>({ eth: 0, btc: 0, updatedAt: undefined });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const p = await fetchMonitorPrices();
      setPrices(p);
      setError(null);
      console.log('[usePrices] ETH:', p.eth, 'BTC:', p.btc, 'updatedAt:', p.updatedAt);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      console.error('[usePrices] fetch failed:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, intervalMs);
    return () => clearInterval(id);
  }, [fetchPrices, intervalMs]);

  return { prices, loading, error, refetch: fetchPrices };
}

export function priceToUint256(price: number): bigint {
  return BigInt(Math.round(price * 1e18));
}
