import { ADDRESSES } from '../config/addresses';

interface Position {
  token: string;
  isLong: boolean;
  size: bigint;
  entryPrice: bigint;
  isOpen: boolean;
}

interface Prices {
  eth: number;
  btc: number;
}

interface EvalAccount {
  virtualBalance: bigint;
  initialBalance: bigint;
  realizedPnL: bigint;
  paActivated: boolean;
  openPositionCount: number;
}

interface Props {
  evalAccount: EvalAccount | null;
  profitTarget: bigint;
  challengeStatus: number;
  positions: Position[];
  prices: Prices;
}

function calcPositionCurrentValue(pos: Position, prices: Prices): number {
  const curPrice =
    pos.token.toLowerCase() === ADDRESSES.weth.toLowerCase() ? prices.eth
    : pos.token.toLowerCase() === ADDRESSES.wbtc.toLowerCase() ? prices.btc
    : 0;
  if (!curPrice || pos.entryPrice === 0n) return Number(pos.size) / 1e6;

  const sizeNum = Number(pos.size) / 1e6;
  const entryPriceNum = Number(pos.entryPrice) / 1e18;

  if (pos.isLong) {
    return sizeNum * curPrice / entryPriceNum;
  } else {
    return Math.max(0, 2 * sizeNum - sizeNum * curPrice / entryPriceNum);
  }
}

export function EvalStatus({ evalAccount, profitTarget, challengeStatus, positions, prices }: Props) {
  if (!evalAccount || challengeStatus === 0) return null;

  const cashBalance = Number(evalAccount.virtualBalance) / 1e6;
  const initial = Number(evalAccount.initialBalance) / 1e6;
  const target = Number(profitTarget) / 1e6;

  // 보유 포지션 현재 가치 합산
  const openPositionValue = positions
    .filter((p) => p.isOpen)
    .reduce((sum, p) => sum + calcPositionCurrentValue(p, prices), 0);

  const totalValue = cashBalance + openPositionValue;
  const pnl = totalValue - initial;
  const pnlPercent = initial > 0 ? (pnl / initial) * 100 : 0;
  const progress = initial > 0 && target > initial
    ? Math.min(((totalValue - initial) / (target - initial)) * 100, 100)
    : 0;
  const progressClamped = Math.max(0, progress);

  const openCount = positions.filter((p) => p.isOpen).length;

  const statusLabel = ['None', 'Active', 'Passed', 'Failed'][challengeStatus] ?? 'Unknown';
  const statusColor: Record<number, string> = {
    1: 'text-blue-400',
    2: 'text-green-400',
    3: 'text-red-400',
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Evaluation Status</h2>
        <span className={`text-sm font-medium ${statusColor[challengeStatus] ?? 'text-gray-400'}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Cash Balance</p>
          <p className="text-base font-mono text-white">${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Portfolio Value</p>
          <p className="text-base font-mono text-white">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Unrealized P&L</p>
          <p className={`text-base font-mono ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Open Positions</p>
          <p className="text-base font-mono text-white">{openCount}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress to Target</span>
          <span>${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${target.toLocaleString()}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              progressClamped >= 100 ? 'bg-green-500' : 'bg-purple-500'
            }`}
            style={{ width: `${progressClamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}
