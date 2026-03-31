import { useState, useEffect, useCallback } from 'react';
import { Contract, JsonRpcProvider } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContracts } from '../hooks/useContracts';
import { ADDRESSES, MONAD_CHAIN } from '../config/addresses';
import { USDCFaucetABI } from '../abi/USDCFaucet';

const VIRTUAL_AMOUNT = 1_000n * 1_000_000n; // 1,000 USDC (6 decimals)

interface ActionState {
  loading: boolean;
  result: string | null;
  error: string | null;
}

const defaultState = (): ActionState => ({ loading: false, result: null, error: null });

function formatCooldown(seconds: number): string {
  if (seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function DebugPage() {
  const { address, signer, provider } = useWallet();
  const { propChallenge } = useContracts();

  const [faucetState, setFaucetState] = useState<ActionState>(defaultState());
  const [increaseState, setIncreaseState] = useState<ActionState>(defaultState());
  const [decreaseState, setDecreaseState] = useState<ActionState>(defaultState());
  const [cooldown, setCooldown] = useState<number>(0);

  const fetchCooldown = useCallback(async () => {
    if (!address || !ADDRESSES.faucet) return;
    try {
      const rpc = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
      const faucet = new Contract(ADDRESSES.faucet, USDCFaucetABI, rpc);
      const remaining = await faucet.cooldownRemaining(address) as bigint;
      setCooldown(Number(remaining));
    } catch {
      setCooldown(0);
    }
  }, [address, provider]);

  useEffect(() => {
    void fetchCooldown();
  }, [fetchCooldown]);

  // tick cooldown down every second
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const run = async (setState: (s: ActionState) => void, fn: () => Promise<string>) => {
    setState({ loading: true, result: null, error: null });
    try {
      const result = await fn();
      setState({ loading: false, result, error: null });
    } catch (err: unknown) {
      const typedErr = err as { reason?: string; shortMessage?: string; message?: string };
      const msg = typedErr.reason ?? typedErr.shortMessage ?? typedErr.message ?? 'Unknown error';
      setState({ loading: false, result: null, error: msg });
    }
  };

  const handleDrip = () =>
    run(setFaucetState, async () => {
      if (!address || !signer) throw new Error('Wallet not connected');
      if (!ADDRESSES.faucet) throw new Error('Faucet address not configured');
      const faucet = new Contract(ADDRESSES.faucet, USDCFaucetABI, signer);
      const tx = await faucet.drip();
      await tx.wait();
      await fetchCooldown();
      return `Received 100 tUSDC → ${address.slice(0, 6)}...${address.slice(-4)}`;
    });

  const handleIncrease = () =>
    run(setIncreaseState, async () => {
      if (!propChallenge || !address) throw new Error('Contract or wallet not ready');
      const tx = await propChallenge.increaseVirtualBalance(address, VIRTUAL_AMOUNT);
      await tx.wait();
      return `+$1,000 virtual balance applied to ${address.slice(0, 6)}...${address.slice(-4)}`;
    });

  const handleDecrease = () =>
    run(setDecreaseState, async () => {
      if (!propChallenge || !address) throw new Error('Contract or wallet not ready');
      const tx = await propChallenge.decreaseVirtualBalance(address, VIRTUAL_AMOUNT);
      await tx.wait();
      return `−$1,000 virtual balance applied to ${address.slice(0, 6)}...${address.slice(-4)}`;
    });

  const faucetReady = cooldown === 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-hi">Debug</h2>
        <p className="text-mid text-sm mt-1">
          Development utilities for testing without going through the full flow.
        </p>
      </div>

      {!address ? (
        <div className="border border-line rounded-sm p-4 text-mid text-sm">
          Connect your wallet to use debug tools.
        </div>
      ) : (
        <div className="space-y-4">

          {/* Faucet */}
          <DebugCard
            title="tUSDC Faucet"
            description="Claim 100 tUSDC from the on-chain faucet. 1-hour cooldown per address."
            buttonLabel={
              faucetReady
                ? 'Claim 100 tUSDC'
                : `Cooldown: ${formatCooldown(cooldown)}`
            }
            state={faucetState}
            onClick={handleDrip}
            disabled={!faucetReady}
          />

          {/* Increase virtual balance */}
          <DebugCard
            title="Increase Virtual Balance"
            description="Call increaseVirtualBalance(+$1,000) on PropChallenge. Account must have an active challenge."
            buttonLabel="+$1,000 Virtual Balance"
            state={increaseState}
            onClick={handleIncrease}
            variant="profit"
          />

          {/* Decrease virtual balance */}
          <DebugCard
            title="Decrease Virtual Balance"
            description="Call decreaseVirtualBalance(−$1,000) on PropChallenge. Account must have sufficient virtual balance."
            buttonLabel="−$1,000 Virtual Balance"
            state={decreaseState}
            onClick={handleDecrease}
            variant="loss"
          />

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DebugCard
// ---------------------------------------------------------------------------

interface DebugCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  state: ActionState;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'profit' | 'loss';
}

function DebugCard({ title, description, buttonLabel, state, onClick, disabled = false, variant = 'default' }: DebugCardProps) {
  const btnClass = {
    default: 'bg-accent text-black hover:brightness-110',
    profit: 'bg-profit text-black hover:brightness-110',
    loss: 'bg-loss text-black hover:brightness-110',
  }[variant];

  return (
    <div className="bg-surface border border-line rounded-sm p-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-hi mb-1">{title}</p>
          <p className="text-xs text-mid">{description}</p>
        </div>
        <button
          onClick={onClick}
          disabled={state.loading || disabled}
          className={`flex-shrink-0 px-4 py-2 rounded-sm text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${btnClass}`}
        >
          {state.loading ? 'Pending...' : buttonLabel}
        </button>
      </div>

      {state.result && (
        <div className="mt-3 border border-profit/30 bg-profit/5 rounded-sm p-2">
          <p className="text-profit text-xs font-mono">{state.result}</p>
        </div>
      )}
      {state.error && (
        <div className="mt-3 border border-loss/30 bg-loss/5 rounded-sm p-2">
          <p className="text-loss text-xs break-words">{state.error}</p>
        </div>
      )}
    </div>
  );
}
