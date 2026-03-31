import { useState } from 'react';
import { useContracts } from '../hooks/useContracts';
import { usePrices, priceToUint256 } from '../hooks/usePrices';
import { ADDRESSES } from '../config/addresses';

interface Position {
  token: string;
  isLong: boolean;
  size: bigint;
  entryPrice: bigint;
  timestamp: bigint;
  isOpen: boolean;
}

interface Props {
  positions: Position[];
  onClose: () => void;
}

export function PositionList({ positions, onClose }: Props) {
  const { propChallenge } = useContracts();
  const { prices } = usePrices();
  const [closingIdx, setClosingIdx] = useState<number | null>(null);

  const getTokenSymbol = (addr: string) => {
    const lower = addr.toLowerCase();
    if (lower === ADDRESSES.weth.toLowerCase()) return 'ETH';
    if (lower === ADDRESSES.wbtc.toLowerCase()) return 'BTC';
    return addr.slice(0, 8);
  };

  const getCurrentPrice = (addr: string) => {
    const lower = addr.toLowerCase();
    if (lower === ADDRESSES.weth.toLowerCase()) return prices.eth;
    if (lower === ADDRESSES.wbtc.toLowerCase()) return prices.btc;
    return 0;
  };

  const calcCurrentValue = (pos: Position) => {
    const curPrice = getCurrentPrice(pos.token);
    if (!curPrice || pos.entryPrice === 0n) return Number(pos.size) / 1e6;
    const sizeNum = Number(pos.size) / 1e6;
    const entryPriceNum = Number(pos.entryPrice) / 1e18;
    if (pos.isLong) return sizeNum * curPrice / entryPriceNum;
    return Math.max(0, 2 * sizeNum - sizeNum * curPrice / entryPriceNum);
  };

  const calcPnl = (pos: Position) => calcCurrentValue(pos) - Number(pos.size) / 1e6;

  const calcTokenAmount = (pos: Position) => {
    const entryPriceNum = Number(pos.entryPrice) / 1e18;
    if (!entryPriceNum) return 0;
    return (Number(pos.size) / 1e6) / entryPriceNum;
  };

  const handleClose = async (index: number) => {
    if (!propChallenge) return;
    const pos = positions[index];
    const curPrice = getCurrentPrice(pos.token);
    if (!curPrice) return;
    setClosingIdx(index);
    try {
      const tx = await propChallenge.closePosition(index, priceToUint256(curPrice));
      await tx.wait();
      onClose();
    } catch (err) {
      console.error('Close position failed:', err);
    } finally {
      setClosingIdx(null);
    }
  };

  const openPositions = positions.map((p, i) => ({ ...p, index: i })).filter((p) => p.isOpen);
  const closedPositions = positions.map((p, i) => ({ ...p, index: i })).filter((p) => !p.isOpen);

  return (
    <div className="bg-surface border border-line rounded-sm p-6">
      <p className="text-xs uppercase tracking-widest text-mid mb-4">
        Positions <span className="text-hi">({openPositions.length} open)</span>
      </p>

      {openPositions.length === 0 && (
        <p className="text-mid text-sm">No open positions</p>
      )}

      <div className="space-y-2">
        {openPositions.map((pos) => {
          const pnl = calcPnl(pos);
          const currentValue = calcCurrentValue(pos);
          const entrySize = Number(pos.size) / 1e6;
          const entryPriceNum = Number(pos.entryPrice) / 1e18;
          const tokenAmount = calcTokenAmount(pos);
          const symbol = getTokenSymbol(pos.token);
          const curPrice = getCurrentPrice(pos.token);
          const pnlPct = entrySize > 0 ? (pnl / entrySize) * 100 : 0;

          return (
            <div key={pos.index} className="bg-base border border-line rounded-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-sm border ${
                    pos.isLong
                      ? 'border-profit/50 bg-profit/10 text-profit'
                      : 'border-loss/50 bg-loss/10 text-loss'
                  }`}>
                    {pos.isLong ? 'LONG' : 'SHORT'}
                  </span>
                  <span className="text-hi font-semibold text-sm">{symbol}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`font-mono tabular-nums text-sm font-medium ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDC
                    </span>
                    <span className={`text-xs ml-1.5 font-mono tabular-nums ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                    </span>
                  </div>
                  <button
                    onClick={() => handleClose(pos.index)}
                    disabled={closingIdx === pos.index}
                    className="px-3 py-1.5 text-xs border border-line text-mid hover:border-loss hover:text-loss rounded-sm transition-colors duration-150 disabled:opacity-40"
                  >
                    {closingIdx === pos.index ? 'Closing...' : 'Close'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs border-t border-line pt-2.5 mt-1">
                <div>
                  <span className="block text-mid mb-0.5">Qty</span>
                  <span className="text-hi font-mono tabular-nums">
                    {tokenAmount < 0.001 ? tokenAmount.toFixed(6) : tokenAmount.toFixed(4)} {symbol}
                  </span>
                </div>
                <div>
                  <span className="block text-mid mb-0.5">Entry</span>
                  <span className="text-hi font-mono tabular-nums">
                    ${entryPriceNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="block text-mid mb-0.5">Current Value</span>
                  <span className="text-hi font-mono tabular-nums">
                    ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {curPrice > 0 && (
                      <span className="text-mid ml-1">@ ${curPrice.toLocaleString()}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {closedPositions.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-mid mb-2">Closed</p>
          <div className="space-y-1.5">
            {closedPositions.map((pos) => {
              const entryPriceNum = Number(pos.entryPrice) / 1e18;
              const tokenAmount = calcTokenAmount(pos);
              const entrySize = Number(pos.size) / 1e6;
              const symbol = getTokenSymbol(pos.token);
              return (
                <div key={pos.index} className="bg-base border border-line/50 rounded-sm p-3 flex items-center justify-between opacity-50">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs border px-2 py-0.5 rounded-sm ${
                      pos.isLong ? 'border-profit/30 text-profit' : 'border-loss/30 text-loss'
                    }`}>
                      {pos.isLong ? 'LONG' : 'SHORT'}
                    </span>
                    <span className="text-mid text-xs">{symbol}</span>
                    <span className="text-mid text-xs font-mono tabular-nums">
                      {tokenAmount.toFixed(4)} {symbol} @ ${entryPriceNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-mid text-xs font-mono tabular-nums">(${entrySize.toLocaleString()})</span>
                  </div>
                  <span className="text-mid text-xs">Closed</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
