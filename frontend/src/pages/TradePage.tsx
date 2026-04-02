import { useMemo, useState, useEffect, useCallback } from 'react';
import { usePrices } from '../hooks/usePrices';
import { usePriceHistory } from '../hooks/usePriceHistory';
import { TradingChart } from '../components/TradingChart';
import { PASwap } from '../components/PASwap';
import { useWallet } from '../hooks/useWallet';
import { useContracts } from '../hooks/useContracts';
import { PositionSummary } from '../components/PositionSummary';
import { ADDRESSES, MONAD_CHAIN } from '../config/addresses';

type PairKey = 'eth' | 'btc';

const PAIRS: Record<PairKey, { label: string; tokenAddress: string }> = {
  eth: { label: 'ETH / USDC', tokenAddress: ADDRESSES.weth },
  btc: { label: 'BTC / USDC', tokenAddress: ADDRESSES.wbtc },
};

function shortenAddress(addr: string) {
  return addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '—';
}

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TradePage() {
  const [pair, setPair] = useState<PairKey>('eth');
  const { prices, loading: priceLoading } = usePrices();
  const { history, loading: historyLoading, error: historyError } = usePriceHistory();
  const { address, isCorrectChain } = useWallet();
  const { accountFactory } = useContracts();

  const [paAddress, setPaAddress] = useState<string | null>(null);
  const [loadingPA, setLoadingPA] = useState(false);
  const [paError, setPaError] = useState<string | null>(null);

  const fetchPAAddress = useCallback(async () => {
    if (!accountFactory || !address) return;
    setLoadingPA(true);
    try {
      const addr = await accountFactory.getAccount(address) as string;
      setPaAddress(addr && addr !== '0x0000000000000000000000000000000000000000' ? addr : null);
      setPaError(null);
    } catch (err) {
      setPaError((err as Error).message);
      setPaAddress(null);
    } finally {
      setLoadingPA(false);
    }
  }, [accountFactory, address]);

  useEffect(() => { void fetchPAAddress(); }, [fetchPAAddress]);

  const latestPrice = useMemo(() => (pair === 'eth' ? prices.eth : prices.btc), [pair, prices]);
  const updatedAt = prices.updatedAt ? new Date(prices.updatedAt * 1000).toLocaleTimeString() : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-hi">Trade</h2>
        <p className="text-mid text-sm mt-1">Live DEX pool prices · Performance Account execution</p>
      </div>

      {/* Pair tabs + live price */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex gap-2">
          {(Object.keys(PAIRS) as PairKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setPair(k)}
              className={`px-4 py-2 rounded-sm text-sm font-medium border transition-colors duration-150 ${
                pair === k
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-line text-mid hover:text-hi'
              }`}
            >
              {PAIRS[k].label}
            </button>
          ))}
        </div>

        {!priceLoading && latestPrice > 0 && (
          <span className="font-mono tabular-nums text-hi text-sm">
            {formatUsd(latestPrice)}
            {updatedAt && (
              <span className="text-mid text-xs ml-2">· {updatedAt}</span>
            )}
          </span>
        )}
        {priceLoading && (
          <span className="text-xs text-mid">Loading price...</span>
        )}
        {historyError && (
          <span className="text-xs text-loss">History unavailable</span>
        )}
      </div>

      {/* Chart + Trade panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 mb-4">
        {/* Chart */}
        <div className="bg-surface border border-line rounded-sm overflow-hidden">
          <TradingChart history={history} selectedPair={pair} />
          {historyLoading && !history.length && (
            <p className="px-4 pb-4 text-xs text-mid">Waiting for price history...</p>
          )}
        </div>

        {/* Trade panel */}
        {!address ? (
          <div className="bg-surface border border-line rounded-sm p-6 flex items-center justify-center">
            <p className="text-mid text-sm text-center">Connect your wallet to trade.</p>
          </div>
        ) : !isCorrectChain ? (
          <div className="bg-surface border border-line rounded-sm p-6 flex items-center justify-center">
            <p className="text-loss text-sm text-center">Switch to Monad Testnet.</p>
          </div>
        ) : loadingPA ? (
          <div className="bg-surface border border-line rounded-sm p-6 flex items-center justify-center">
            <p className="text-mid text-sm">Loading Performance Account...</p>
          </div>
        ) : paError ? (
          <div className="bg-surface border border-line rounded-sm p-6">
            <p className="text-loss text-sm break-words">Failed to load PA: {paError}</p>
          </div>
        ) : !paAddress ? (
          <div className="bg-surface border border-line rounded-sm p-6 flex items-center justify-center">
            <p className="text-mid text-sm text-center">
              No Performance Account assigned.<br />Complete the challenge first.
            </p>
          </div>
        ) : (
          <PASwap
            paAddress={paAddress}
            disabled={false}
            onSwap={() => { /* balance refresh hook goes here if needed */ }}
          />
        )}
      </div>

      {/* Pair info row */}
      <div className="bg-surface border border-line rounded-sm p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="block text-mid uppercase tracking-widest mb-1">Pair</span>
            <span className="text-hi font-medium">{PAIRS[pair].label}</span>
          </div>
          <div>
            <span className="block text-mid uppercase tracking-widest mb-1">Token CA</span>
            {PAIRS[pair].tokenAddress ? (
              <a
                href={`${MONAD_CHAIN.explorer}/address/${PAIRS[pair].tokenAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-hi font-mono hover:text-accent2 transition-colors duration-150"
              >
                {shortenAddress(PAIRS[pair].tokenAddress)}
              </a>
            ) : <span className="text-mid">—</span>}
          </div>
          <div>
            <span className="block text-mid uppercase tracking-widest mb-1">Pool (Router)</span>
            {ADDRESSES.dexRouter ? (
              <a
                href={`${MONAD_CHAIN.explorer}/address/${ADDRESSES.dexRouter}`}
                target="_blank"
                rel="noreferrer"
                className="text-hi font-mono hover:text-accent2 transition-colors duration-150"
              >
                {shortenAddress(ADDRESSES.dexRouter)}
              </a>
            ) : <span className="text-mid">—</span>}
          </div>
        </div>
      </div>

      {/* Positions — below pair info */}
      <PositionSummary paAddress={paAddress} />
    </div>
  );
}
