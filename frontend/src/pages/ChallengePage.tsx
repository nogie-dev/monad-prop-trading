import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useContracts } from '../hooks/useContracts';
import { usePrices } from '../hooks/usePrices';
import { ChallengeDeposit } from '../components/ChallengeDeposit';
import { TradingPanel } from '../components/TradingPanel';
import { PositionList } from '../components/PositionList';
import { EvalStatus } from '../components/EvalStatus';

export function ChallengePage() {
  const { address, isCorrectChain } = useWallet();
  const { propChallenge } = useContracts();
  const { prices } = usePrices();

  const [challengeStatus, setChallengeStatus] = useState(0);
  const [evalAccount, setEvalAccount] = useState<{
    virtualBalance: bigint;
    initialBalance: bigint;
    realizedPnL: bigint;
    paActivated: boolean;
    openPositionCount: number;
  } | null>(null);
  const [positions, setPositions] = useState<Array<{
    token: string;
    isLong: boolean;
    size: bigint;
    entryPrice: bigint;
    timestamp: bigint;
    isOpen: boolean;
  }>>([]);
  const [profitTarget, setProfitTarget] = useState(0n);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!propChallenge || !address) return;
    setLoading(true);
    try {
      const [status, account, pos, target] = await Promise.all([
        propChallenge.challengeStatus(address),
        propChallenge.getEvalAccount(address),
        propChallenge.getPositions(address),
        propChallenge.profitTarget(),
      ]);
      setChallengeStatus(Number(status));
      setEvalAccount({
        virtualBalance: account.virtualBalance,
        initialBalance: account.initialBalance,
        realizedPnL: account.realizedPnL,
        paActivated: account.paActivated,
        openPositionCount: Number(account.openPositionCount),
      });
      setPositions(pos.map((p: { token: string; isLong: boolean; size: bigint; entryPrice: bigint; timestamp: bigint; isOpen: boolean }) => ({
        token: p.token,
        isLong: p.isLong,
        size: p.size,
        entryPrice: p.entryPrice,
        timestamp: p.timestamp,
        isOpen: p.isOpen,
      })));
      setProfitTarget(target);
    } catch (err) {
      console.error('Failed to fetch challenge data:', err);
    } finally {
      setLoading(false);
    }
  }, [propChallenge, address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!address) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Paper Trading Challenge</h2>
          <p className="text-gray-400">Connect your wallet to get started</p>
        </div>
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-yellow-400 mb-2">Wrong Network</h2>
          <p className="text-gray-400">Please switch to Monad Testnet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Paper Trading Challenge</h2>
        <p className="text-gray-400 text-sm mt-1">
          Trade with virtual funds. Hit 10% profit to unlock your Performance Account.
        </p>
      </div>

      {/* Status */}
      <div className="mb-6">
        <EvalStatus
          evalAccount={evalAccount}
          profitTarget={profitTarget}
          challengeStatus={challengeStatus}
          positions={positions}
          prices={prices}
        />
      </div>

      {/* Deposit or Trading */}
      {challengeStatus !== 1 ? (
        <ChallengeDeposit challengeStatus={challengeStatus} onSuccess={fetchData} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <TradingPanel onTrade={fetchData} />
          </div>
          <div className="lg:col-span-2">
            <PositionList positions={positions} onClose={fetchData} />
          </div>
        </div>
      )}
    </div>
  );
}
