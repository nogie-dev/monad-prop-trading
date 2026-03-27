import { useState } from 'react';
import { useContracts } from '../hooks/useContracts';
import { usePrices, priceToUint256 } from '../hooks/usePrices';
import { ADDRESSES } from '../config/addresses';
import { USDC_DECIMALS } from '../config/constants';

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
      const sizeUint = BigInt(Math.round(parseFloat(size) * 1e6)); // USDC 6 decimals
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
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Open Position</h2>

      {/* Token selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setToken('weth')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            token === 'weth'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          ETH {pricesLoading ? '...' : `$${prices.eth.toLocaleString()}`}
        </button>
        <button
          onClick={() => setToken('wbtc')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            token === 'wbtc'
              ? 'bg-orange-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          BTC {pricesLoading ? '...' : `$${prices.btc.toLocaleString()}`}
        </button>
      </div>

      {/* Long/Short */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setIsLong(true)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            isLong
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          Long
        </button>
        <button
          onClick={() => setIsLong(false)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            !isLong
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          Short
        </button>
      </div>

      {/* Size */}
      <div className="mb-4">
        <label className="text-sm text-gray-400 mb-1 block">Size (USDC)</label>
        <input
          type="number"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="1000"
          min="0"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleOpenPosition}
        disabled={loading || !size || !currentPrice}
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          isLong
            ? 'bg-green-600 hover:bg-green-500 disabled:bg-gray-700'
            : 'bg-red-600 hover:bg-red-500 disabled:bg-gray-700'
        } disabled:text-gray-500 text-white`}
      >
        {loading ? 'Opening...' : `Open ${isLong ? 'Long' : 'Short'} ${token === 'weth' ? 'ETH' : 'BTC'}`}
      </button>
    </div>
  );
}
