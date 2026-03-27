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

  // 포지션 현재 평가금액 (USDC)
  const calcCurrentValue = (pos: Position) => {
    const curPrice = getCurrentPrice(pos.token);
    if (!curPrice || pos.entryPrice === 0n) return Number(pos.size) / 1e6;
    const sizeNum = Number(pos.size) / 1e6;
    const entryPriceNum = Number(pos.entryPrice) / 1e18;
    if (pos.isLong) {
      return sizeNum * curPrice / entryPriceNum;
    } else {
      return Math.max(0, 2 * sizeNum - sizeNum * curPrice / entryPriceNum);
    }
  };

  const calcPnl = (pos: Position) => {
    return calcCurrentValue(pos) - Number(pos.size) / 1e6;
  };

  // 진입 시점 코인 수량 = 투자금(USDC) / 진입가
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
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">
        Positions ({openPositions.length} open)
      </h2>

      {openPositions.length === 0 && (
        <p className="text-gray-500 text-sm">No open positions</p>
      )}

      <div className="space-y-3">
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
            <div key={pos.index} className="bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    pos.isLong ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                  }`}>
                    {pos.isLong ? 'LONG' : 'SHORT'}
                  </span>
                  <span className="text-white font-semibold">{symbol}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`font-mono text-sm font-medium ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDC
                    </span>
                    <span className={`text-xs ml-1 ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                    </span>
                  </div>
                  <button
                    onClick={() => handleClose(pos.index)}
                    disabled={closingIdx === pos.index}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {closingIdx === pos.index ? 'Closing...' : 'Close'}
                  </button>
                </div>
              </div>

              {/* 진입 상세 */}
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-800">
                <div>
                  <span className="block text-gray-600">진입 수량</span>
                  <span className="text-gray-300 font-mono">
                    {tokenAmount < 0.001
                      ? tokenAmount.toFixed(6)
                      : tokenAmount.toFixed(4)} {symbol}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-600">진입가</span>
                  <span className="text-gray-300 font-mono">
                    ${entryPriceNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-600">현재 가치</span>
                  <span className="text-gray-300 font-mono">
                    ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {curPrice > 0 && (
                      <span className="text-gray-500 ml-1">
                        @ ${curPrice.toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {closedPositions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Closed Positions</h3>
          <div className="space-y-2">
            {closedPositions.map((pos) => {
              const entrySize = Number(pos.size) / 1e6;
              const entryPriceNum = Number(pos.entryPrice) / 1e18;
              const tokenAmount = calcTokenAmount(pos);
              const symbol = getTokenSymbol(pos.token);
              return (
                <div key={pos.index} className="bg-gray-900/30 rounded-lg p-3 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      pos.isLong ? 'bg-green-900/30 text-green-600' : 'bg-red-900/30 text-red-600'
                    }`}>
                      {pos.isLong ? 'LONG' : 'SHORT'}
                    </span>
                    <span className="text-gray-400">{symbol}</span>
                    <span className="text-gray-500 text-xs font-mono">
                      {tokenAmount.toFixed(4)} {symbol} @ ${entryPriceNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-gray-600 text-xs">(${entrySize.toLocaleString()})</span>
                  </div>
                  <span className="text-gray-500 text-sm">Closed</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
