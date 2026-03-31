import { useState } from 'react';
import { useContracts } from '../hooks/useContracts';
import { usePrices, priceToUint256 } from '../hooks/usePrices';
import { ADDRESSES } from '../config/addresses';

interface Props {
  onTrade: () => void;
}

type Token = 'weth' | 'wbtc';

export function TradingPanel({ onTrade }: Props) {
  const { propChallenge } = useContracts();
  const { prices, loading: pricesLoading } = usePrices();

  const [token, setToken] = useState<Token>('weth');
  const [isLong, setIsLong] = useState(true);
  const [size, setSize] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPrice = token === 'weth' ? prices.eth : prices.btc;
  const tokenAddress = token === 'weth' ? ADDRESSES.weth : ADDRESSES.wbtc;

  const handleOpenPosition = async () => {
    if (!propChallenge || !size || !currentPrice) return;
    setLoading(true);
    setError(null);

    try {
      const sizeUint = BigInt(Math.round(parseFloat(size) * 1e6));
      const priceUint = priceToUint256(currentPrice);
      const tx = await propChallenge.openPosition(tokenAddress, isLong, sizeUint, priceUint);
      await tx.wait();
      setSize('');
      onTrade();
    } catch (err: unknown) {
      const msg = (err as { reason?: string }).reason || (err as Error).message || 'Failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-line rounded-sm p-6">
      <p className="text-xs uppercase tracking-widest text-mid mb-4">Open Position</p>

      {/* Token selector */}
      <div className="flex gap-2 mb-4">
        {(['weth', 'wbtc'] as Token[]).map((t) => {
          const label = t === 'weth' ? 'ETH' : 'BTC';
          const price = t === 'weth' ? prices.eth : prices.btc;
          const active = token === t;
          return (
            <button
              key={t}
              onClick={() => setToken(t)}
              className={`flex-1 py-2 rounded-sm text-sm font-medium transition-colors duration-150 border ${
                active
                  ? 'border-accent2 text-accent2 bg-accent2/5'
                  : 'border-line text-mid hover:border-accent2/40 hover:text-hi'
              }`}
            >
              {label}{' '}
              <span className="font-mono tabular-nums text-xs">
                {pricesLoading ? '...' : `$${price.toLocaleString()}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Long / Short */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setIsLong(true)}
          className={`flex-1 py-2 rounded-sm text-sm font-medium transition-colors duration-150 border ${
            isLong
              ? 'border-profit bg-profit text-black'
              : 'border-line text-mid hover:border-profit/50 hover:text-hi'
          }`}
        >
          Long
        </button>
        <button
          onClick={() => setIsLong(false)}
          className={`flex-1 py-2 rounded-sm text-sm font-medium transition-colors duration-150 border ${
            !isLong
              ? 'border-loss bg-loss text-black'
              : 'border-line text-mid hover:border-loss/50 hover:text-hi'
          }`}
        >
          Short
        </button>
      </div>

      {/* Size input */}
      <div className="mb-4">
        <label className="text-xs text-mid mb-1.5 block">Size (USDC)</label>
        <input
          type="number"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="1000"
          min="0"
          className="w-full bg-[#0f1319] border border-line rounded-sm px-4 py-2.5 text-hi font-mono tabular-nums placeholder:text-mid focus:ring-1 focus:ring-accent focus:outline-none transition-colors duration-150"
        />
      </div>

      {error && (
        <div className="border border-loss/30 bg-loss/5 rounded-sm p-3 mb-4">
          <p className="text-loss text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleOpenPosition}
        disabled={loading || !size || !currentPrice}
        className={`w-full py-2.5 rounded-sm font-medium text-sm transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
          isLong
            ? 'bg-profit text-black hover:brightness-110'
            : 'bg-loss text-black hover:brightness-110'
        }`}
      >
        {loading ? 'Opening...' : `Open ${isLong ? 'Long' : 'Short'} ${token === 'weth' ? 'ETH' : 'BTC'}`}
      </button>
    </div>
  );
}
