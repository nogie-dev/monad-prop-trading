import { useState } from 'react';
import { parseUnits } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContracts } from '../hooks/useContracts';
import { ADDRESSES } from '../config/addresses';
import { USDC_DECIMALS } from '../config/constants';

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
    console.log('[Deposit] clicked — propChallenge:', !!propChallenge, 'usdc:', !!usdc, 'address:', address);
    if (!propChallenge || !usdc || !address) {
      console.warn('[Deposit] early return — contract(s) not ready');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const fee = await propChallenge.challengeFee();

      // Step 1: Approve USDC
      setStep('approving');
      const allowance = await usdc.allowance(address, ADDRESSES.propChallenge);
      if (allowance < fee) {
        const approveTx = await usdc.approve(ADDRESSES.propChallenge, fee);
        await approveTx.wait();
      }

      // Step 2: Deposit fee
      setStep('depositing');
      const depositTx = await propChallenge.depositFee(fee);
      await depositTx.wait();

      onSuccess();
    } catch (err: unknown) {
      console.error('[ChallengeDeposit] error:', err);
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
      <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-4 text-center">
        <p className="text-green-400 font-medium">Challenge Active - Start Trading!</p>
      </div>
    );
  }

  if (challengeStatus === 2) {
    return (
      <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-4 text-center">
        <p className="text-purple-400 font-medium">Challenge Passed - PA Activated!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-2">Start Challenge</h2>
      <p className="text-gray-400 text-sm mb-4">
        Deposit 100 USDC to begin your paper trading evaluation.
        Reach 11,000 virtual USDC (10% profit) to pass.
      </p>

      {/* 임시 디버그 */}
      <div className="text-xs text-gray-500 mb-3 font-mono space-y-0.5">
        <div>signer: <span className={signer ? 'text-green-400' : 'text-red-400'}>{signer ? 'OK' : 'NULL'}</span></div>
        <div>propChallenge: <span className={propChallenge ? 'text-green-400' : 'text-red-400'}>{propChallenge ? 'OK' : 'NULL'}</span></div>
        <div>usdc: <span className={usdc ? 'text-green-400' : 'text-red-400'}>{usdc ? 'OK' : 'NULL'}</span></div>
        <div>address: <span className={address ? 'text-green-400' : 'text-red-400'}>{address ? address.slice(0,10)+'...' : 'NULL'}</span></div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleDeposit}
        disabled={loading || !address || !propChallenge || !usdc}
        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
      >
        {step === 'approving' ? 'Approving USDC...'
          : step === 'depositing' ? 'Depositing Fee...'
          : 'Deposit 100 USDC & Start Challenge'}
      </button>
    </div>
  );
}
