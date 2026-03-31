import { ADDRESSES } from '../config/addresses';
import { useState } from 'react';
import { useContracts } from '../hooks/useContracts';
import { useWallet } from '../hooks/useWallet';

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
  onRefresh?: () => void;
  onPositionsRefresh?: () => void;
}

function calcPositionCurrentValue(pos: Position, prices: Prices): number {
  const curPrice =
    pos.token.toLowerCase() === ADDRESSES.weth.toLowerCase() ? prices.eth
    : pos.token.toLowerCase() === ADDRESSES.wbtc.toLowerCase() ? prices.btc
    : 0;
  if (!curPrice || pos.entryPrice === 0n) return Number(pos.size) / 1e6;
  const sizeNum = Number(pos.size) / 1e6;
  const entryPriceNum = Number(pos.entryPrice) / 1e18;
  if (pos.isLong) return sizeNum * curPrice / entryPriceNum;
  return Math.max(0, 2 * sizeNum - sizeNum * curPrice / entryPriceNum);
}

const STATUS_LABEL = ['None', 'Active', 'Passed', 'Failed'];
const STATUS_CLASS: Record<number, string> = {
  1: 'border-accent2/40 bg-accent2/10 text-accent2',
  2: 'border-profit/40 bg-profit/10 text-profit',
  3: 'border-loss/40 bg-loss/10 text-loss',
};

export function EvalStatus({ evalAccount, profitTarget, challengeStatus, positions, prices, onRefresh, onPositionsRefresh }: Props) {
  const { propChallenge } = useContracts();
  const { address } = useWallet();
  const [passing, setPassing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!evalAccount || challengeStatus === 0) return null;

  const cashBalance = Number(evalAccount.virtualBalance) / 1e6;
  const initial = Number(evalAccount.initialBalance) / 1e6;
  const target = Number(profitTarget) / 1e6;
  const openPositionValue = positions.filter((p) => p.isOpen).reduce((sum, p) => sum + calcPositionCurrentValue(p, prices), 0);
  const totalValue = cashBalance + openPositionValue;
  const pnl = totalValue - initial;
  const pnlPercent = initial > 0 ? (pnl / initial) * 100 : 0;
  const progress = initial > 0 && target > initial
    ? Math.min(((totalValue - initial) / (target - initial)) * 100, 100)
    : 0;
  const progressClamped = Math.max(0, progress);
  const openCount = positions.filter((p) => p.isOpen).length;
  const canPass = challengeStatus === 1 && totalValue >= target && !!propChallenge && !!address;
  const isPassed = challengeStatus === 2;
  const isFailed = challengeStatus === 3;

  const handlePass = async () => {
    if (!propChallenge || !address) return;
    setPassing(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await propChallenge.passChallenge(address);
      await tx.wait();
      setSuccess('Pass submitted. PA deployment in progress.');
      void Promise.all([onRefresh?.(), onPositionsRefresh?.()]);
    } catch (err: unknown) {
      const msg = (err as { reason?: string; shortMessage?: string; message?: string }).reason
        || (err as { shortMessage?: string }).shortMessage
        || (err as Error).message
        || 'Transaction failed';
      setError(msg);
    } finally {
      setPassing(false);
    }
  };

  return (
    <div className="bg-surface border border-line rounded-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-widest text-mid">Evaluation Status</p>
        <span className={`text-xs px-2 py-0.5 rounded-sm border font-medium ${STATUS_CLASS[challengeStatus] ?? 'border-line text-mid'}`}>
          {STATUS_LABEL[challengeStatus] ?? 'Unknown'}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Cash Balance', value: `$${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '' },
          { label: 'Portfolio Value', value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '' },
          { label: 'Unrealized P&L', value: `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`, color: pnl >= 0 ? 'text-profit' : 'text-loss' },
          { label: 'Open Positions', value: String(openCount), color: '' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-xs text-mid mb-1">{label}</p>
            <p className={`text-sm font-mono tabular-nums text-hi ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-mid mb-1.5">
          <span>Progress to Target</span>
          <span className="font-mono tabular-nums">
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${target.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-base border border-line rounded-none h-1.5">
          <div
            className={`h-1.5 transition-all duration-500 ${progressClamped >= 100 ? 'bg-profit' : 'bg-accent'}`}
            style={{ width: `${progressClamped}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mt-3 border border-loss/30 bg-loss/5 rounded-sm p-2">
          <p className="text-loss text-xs">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-3 border border-profit/30 bg-profit/5 rounded-sm p-2">
          <p className="text-profit text-xs">{success}</p>
        </div>
      )}

      {challengeStatus === 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-mid">Profit target reached? Request PA deployment.</p>
          <button
            onClick={handlePass}
            disabled={!canPass || passing}
            className="px-4 py-2 bg-profit text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm text-sm font-medium transition-colors duration-150"
          >
            {passing ? 'Submitting...' : 'Pass Challenge'}
          </button>
        </div>
      )}
      {isPassed && (
        <div className="mt-4 border border-profit/30 bg-profit/5 rounded-sm p-2">
          <p className="text-profit text-xs">Challenge passed. PA is active.</p>
        </div>
      )}
      {isFailed && (
        <div className="mt-4 border border-loss/30 bg-loss/5 rounded-sm p-2">
          <p className="text-loss text-xs">Challenge failed. Restart a new challenge to try again.</p>
        </div>
      )}
    </div>
  );
}
