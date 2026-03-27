import { useState, useEffect, useCallback } from 'react';

interface Prices {
  eth: number;
  btc: number;
}

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd';

export function usePrices(intervalMs = 15_000) {
  const [prices, setPrices] = useState<Prices>({ eth: 0, btc: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPrices({
        eth: data.ethereum?.usd ?? 0,
        btc: data.bitcoin?.usd ?? 0,
      });
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message);
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
