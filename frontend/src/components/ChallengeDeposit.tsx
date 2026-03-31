import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useContracts } from '../hooks/useContracts';
import { ADDRESSES } from '../config/addresses';

interface Props {
  challengeStatus: number;
  onSuccess: () => void;
}

export function ChallengeDeposit({ challengeStatus, onSuccess }: Props) {
  const { address, signer } = useWallet();
  const { propChallenge, usdc } = useContracts();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'approving' | 'depositing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!propChallenge || !usdc || !address) return;
    setLoading(true);
    setError(null);

    try {
      const fee = await propChallenge.challengeFee();

      setStep('approving');
      const allowance = await usdc.allowance(address, ADDRESSES.propChallenge);
      if (allowance < fee) {
        const approveTx = await usdc.approve(ADDRESSES.propChallenge, fee);
        await approveTx.wait();
      }

      setStep('depositing');
      const depositTx = await propChallenge.depositFee(fee);
      await depositTx.wait();

      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { reason?: string; shortMessage?: string; message?: string }).reason
        || (err as { shortMessage?: string }).shortMessage
        || (err as Error).message
        || 'Transaction failed';
      setError(msg);
    } finally {
      setLoading(false);
      setStep('idle');
    }
  };

  if (challengeStatus === 1) {
    return (
      <div className="border border-profit/30 bg-profit/5 rounded-sm p-4 text-center">
        <p className="text-profit font-medium text-sm">Challenge Active — Start Trading</p>
      </div>
    );
  }

  if (challengeStatus === 2) {
    return (
      <div className="border border-accent/30 bg-accent/5 rounded-sm p-4 text-center">
        <p className="text-accent font-medium text-sm">Challenge Passed — PA Activated</p>
      </div>
    );
  }

  const ready = !!signer && !!propChallenge && !!usdc && !!address;

  return (
    <div className="bg-surface border border-line rounded-sm p-6">
      <h2 className="text-base font-semibold text-hi mb-1">Start Challenge</h2>
      <p className="text-mid text-sm mb-5">
        Deposit 100 USDC to begin your paper trading evaluation.
        Reach 11,000 virtual USDC (10% profit) to pass.
      </p>

      {error && (
        <div className="border border-loss/30 bg-loss/5 rounded-sm p-3 mb-4">
          <p className="text-loss text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleDeposit}
        disabled={loading || !ready}
        className="w-full py-2.5 bg-accent text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm font-medium text-sm transition-colors duration-150"
      >
        {step === 'approving' ? 'Approving USDC...'
          : step === 'depositing' ? 'Depositing Fee...'
          : 'Deposit 100 USDC & Start Challenge'}
      </button>
    </div>
  );
}
