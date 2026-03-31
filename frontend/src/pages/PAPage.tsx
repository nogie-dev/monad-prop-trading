import { useState, useEffect, useCallback } from 'react';
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useContracts, useTradingAccount } from '../hooks/useContracts';
import { usePrices } from '../hooks/usePrices';
import { ADDRESSES, MONAD_CHAIN } from '../config/addresses';
import { ERC20ABI } from '../abi/ERC20';
import { PAStatus } from '../components/PAStatus';
import { PASwap } from '../components/PASwap';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function PAPage() {
  const { address, isCorrectChain, provider } = useWallet();
  const { accountFactory } = useContracts();
  const { prices } = usePrices();

  const [paAddress, setPaAddress] = useState<string | null>(null);
  const [initialCapital, setInitialCapital] = useState(0n);
  const [usdcBalance, setUsdcBalance] = useState(0n);
  const [refreshBalancesFlag, setRefreshBalancesFlag] = useState(0);
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState<string | null>(null);
  const [paOwner, setPaOwner] = useState<string | null>(null);
  const [isLiquidated, setIsLiquidated] = useState(false);
  const [liquidating, setLiquidating] = useState(false);
  const [liquidateError, setLiquidateError] = useState<string | null>(null);
  const [liquidateSuccess, setLiquidateSuccess] = useState<string | null>(null);

  const paContract = useTradingAccount(paAddress);

  const fetchPAAddress = useCallback(async () => {
    if (!accountFactory || !address) return;
    setLoading(true);
    try {
      const addr = await accountFactory.getAccount(address) as string;
      setPaAddress(!addr || addr === ZERO_ADDRESS ? null : addr);
    } catch (err) {
      console.error('[PAPage] Failed to fetch PA address:', err);
      setPaAddress(null);
    } finally {
      setLoading(false);
    }
  }, [accountFactory, address]);

  const fetchPADetails = useCallback(async () => {
    if (!paContract || !paAddress) return;
    try {
      const [capital, usdcAddr, ownerAddr, liquidated] = await Promise.all([
        paContract.initialCapital() as Promise<bigint>,
        paContract.usdc() as Promise<string>,
        paContract.owner() as Promise<string>,
        paContract.isLiquidated() as Promise<boolean>,
      ]);
      setInitialCapital(capital);
      setPaOwner(ownerAddr);
      setIsLiquidated(liquidated);

      const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
      const usdcToken = new Contract(usdcAddr, ERC20ABI, rpcProvider);
      const bal = await usdcToken.balanceOf(paAddress) as bigint;
      setUsdcBalance(bal);
    } catch (err) {
      console.error('[PAPage] Failed to fetch PA details:', err);
    }
  }, [paContract, paAddress, provider]);

  useEffect(() => { void fetchPAAddress(); }, [fetchPAAddress]);
  useEffect(() => { if (paAddress) void fetchPADetails(); }, [paAddress, fetchPADetails]);

  const handleSettle = async () => {
    if (!paContract) return;
    setSettling(true);
    setSettleError(null);
    setSettleSuccess(null);
    try {
      const tx = await paContract.settle();
      await tx.wait();
      setSettleSuccess('Settlement complete. Funds distributed to trader and treasury.');
      void fetchPADetails();
    } catch (err: unknown) {
      const typedErr = err as { reason?: string; shortMessage?: string; message?: string };
      setSettleError(typedErr.reason ?? typedErr.shortMessage ?? typedErr.message ?? 'Settlement failed');
    } finally {
      setSettling(false);
    }
  };

  const handleLiquidate = async () => {
    if (!paContract || !ADDRESSES.dexRouter) return;
    setLiquidating(true);
    setLiquidateError(null);
    setLiquidateSuccess(null);
    try {
      const tx = await paContract.liquidate(ADDRESSES.dexRouter);
      await tx.wait();
      setLiquidateSuccess('Liquidation complete. All funds returned to treasury.');
      void fetchPADetails();
      setRefreshBalancesFlag((x) => x + 1);
    } catch (err: unknown) {
      const typedErr = err as { reason?: string; shortMessage?: string; message?: string };
      setLiquidateError(typedErr.reason ?? typedErr.shortMessage ?? typedErr.message ?? 'Liquidation failed');
    } finally {
      setLiquidating(false);
    }
  };

  const isAdmin = !!address && !!paOwner && address.toLowerCase() === paOwner.toLowerCase();
  const isDrawdownWarning = initialCapital > 0n && usdcBalance < (initialCapital * 90n) / 100n;
  const canSettle = initialCapital > 0n && usdcBalance > initialCapital;

  if (!address) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-hi mb-2">PA Dashboard</h2>
          <p className="text-mid text-sm">Connect your wallet to access your Performance Account.</p>
        </div>
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-base font-semibold text-loss mb-2">Wrong Network</h2>
          <p className="text-mid text-sm">Please switch to Monad Testnet.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-mid text-sm">Loading PA data...</p>
      </div>
    );
  }

  if (!paAddress) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-hi">PA Dashboard</h2>
          <p className="text-mid text-sm mt-1">Live trading with platform-funded Performance Account.</p>
        </div>
        <div className="bg-surface border border-line rounded-sm p-10 text-center">
          <p className="text-hi text-base font-medium mb-2">No PA Assigned Yet</p>
          <p className="text-mid text-sm">
            Complete the paper trading challenge first. Once you pass, a Performance Account
            will be deployed and funded for you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-hi">PA Dashboard</h2>
        <p className="text-mid text-sm mt-1">Live trading via your platform-funded Performance Account.</p>
      </div>

      {/* Liquidated banner */}
      {isLiquidated && (
        <div className="mb-4 border border-loss bg-loss/5 rounded-sm p-4 flex items-center gap-3">
          <div>
            <p className="text-loss font-semibold text-sm">Account Liquidated</p>
            <p className="text-mid text-xs mt-0.5">
              This PA was liquidated due to excessive drawdown. All funds returned to treasury. Trading disabled.
            </p>
          </div>
        </div>
      )}

      {/* Drawdown warning */}
      {!isLiquidated && isDrawdownWarning && (
        <div className="mb-4 border border-loss/50 bg-loss/5 rounded-sm p-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-loss text-sm">
              Drawdown Warning: Portfolio value is more than 10% below initial capital.
              The platform may force-liquidate this account.
            </p>
            {isAdmin && (
              <button
                onClick={() => { void handleLiquidate(); }}
                disabled={liquidating}
                className="flex-shrink-0 px-4 py-2 bg-loss text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm text-sm font-medium transition-colors duration-150"
              >
                {liquidating ? 'Liquidating...' : 'Force Liquidate'}
              </button>
            )}
          </div>
          {liquidateError && (
            <div className="mt-2 border border-loss/30 bg-loss/5 rounded-sm p-2">
              <p className="text-loss text-xs break-words">{liquidateError}</p>
            </div>
          )}
          {liquidateSuccess && (
            <div className="mt-2 border border-profit/30 bg-profit/5 rounded-sm p-2">
              <p className="text-profit text-xs">{liquidateSuccess}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <PAStatus
          paAddress={paAddress}
          initialCapital={initialCapital}
          prices={prices}
          refreshFlag={refreshBalancesFlag}
        />
        <PASwap
          paAddress={paAddress}
          disabled={isLiquidated}
          onSwap={() => {
            void fetchPADetails();
            setRefreshBalancesFlag((x) => x + 1);
          }}
        />
      </div>

      {/* Settle */}
      <div className="bg-surface border border-line rounded-sm p-6 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-mid mb-1">Settle Account</p>
            <p className="text-xs text-mid">
              Distribute profits: 20% to you, 80% to treasury.
              {!canSettle && initialCapital > 0n && (
                <span className="text-loss ml-1">
                  Requires balance above initial capital of $
                  {(Number(initialCapital) / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => { void handleSettle(); }}
            disabled={!canSettle || settling || isLiquidated}
            className="px-5 py-2 bg-profit text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm text-sm font-medium transition-colors duration-150"
          >
            {settling ? 'Settling...' : 'Settle'}
          </button>
        </div>
        {settleError && (
          <div className="mt-3 border border-loss/30 bg-loss/5 rounded-sm p-3">
            <p className="text-loss text-sm break-words">{settleError}</p>
          </div>
        )}
        {settleSuccess && (
          <div className="mt-3 border border-profit/30 bg-profit/5 rounded-sm p-3">
            <p className="text-profit text-sm">{settleSuccess}</p>
          </div>
        )}
      </div>

      <AttackDemo paAddress={paAddress} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttackDemo
// ---------------------------------------------------------------------------

const TRANSFER_SELECTOR_IFACE = new Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

interface AttackDemoProps { paAddress: string; }

function AttackDemo({ paAddress }: AttackDemoProps) {
  const { address } = useWallet();
  const paContract = useTradingAccount(paAddress);

  const [usdcResult, setUsdcResult] = useState<string | null>(null);
  const [wethResult, setWethResult] = useState<string | null>(null);
  const [loadingUsdc, setLoadingUsdc] = useState(false);
  const [loadingWeth, setLoadingWeth] = useState(false);

  const attemptTransfer = async (
    tokenAddr: string,
    tokenSymbol: string,
    setResult: (r: string) => void,
    setLoading: (v: boolean) => void
  ) => {
    if (!paContract || !address) return;
    setLoading(true);
    setResult('');
    try {
      const data = TRANSFER_SELECTOR_IFACE.encodeFunctionData('transfer', [address, 1n]);
      await paContract.execute(tokenAddr, data);
      setResult(`UNEXPECTED SUCCESS — security check failed for ${tokenSymbol} transfer`);
    } catch (err: unknown) {
      const typedErr = err as { reason?: string; shortMessage?: string; message?: string };
      const revertMsg = typedErr.reason ?? typedErr.shortMessage ?? typedErr.message ?? 'Reverted (unknown reason)';
      setResult(`Reverted as expected: ${revertMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-line rounded-sm p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-mid mb-1">Security Demo</p>
        <p className="text-xs text-mid">
          Verify that TradingAccount rejects forbidden operations. Each call should revert with SelectorNotAllowed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AttackButton
          label="Transfer USDC to self"
          description="Encodes transfer(address,uint256) on USDC. Expected: SelectorNotAllowed."
          loading={loadingUsdc}
          result={usdcResult}
          onClick={() => { void attemptTransfer(ADDRESSES.usdc, 'USDC', setUsdcResult, setLoadingUsdc); }}
        />
        <AttackButton
          label="Transfer WETH to self"
          description="Encodes transfer(address,uint256) on WETH. Expected: SelectorNotAllowed."
          loading={loadingWeth}
          result={wethResult}
          onClick={() => { void attemptTransfer(ADDRESSES.weth, 'WETH', setWethResult, setLoadingWeth); }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttackButton
// ---------------------------------------------------------------------------

interface AttackButtonProps {
  label: string;
  description: string;
  loading: boolean;
  result: string | null;
  onClick: () => void;
}

function AttackButton({ label, description, loading, result, onClick }: AttackButtonProps) {
  const isRevertExpected = result?.startsWith('Reverted');
  const isUnexpectedSuccess = result?.startsWith('UNEXPECTED');

  return (
    <div className="bg-base border border-line rounded-sm p-4">
      <p className="text-sm font-medium text-hi mb-1">{label}</p>
      <p className="text-xs text-mid mb-3">{description}</p>
      <button
        onClick={onClick}
        disabled={loading}
        className="w-full py-2 rounded-sm text-sm font-medium transition-colors duration-150 border border-line text-mid hover:border-loss hover:text-loss disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Attempting...' : 'Attempt Attack'}
      </button>
      {result && (
        <div className={`mt-2 p-2 rounded-sm text-xs break-words border ${
          isUnexpectedSuccess
            ? 'border-loss/50 bg-loss/10 text-loss'
            : isRevertExpected
            ? 'border-profit/30 bg-profit/5 text-profit'
            : 'border-line text-mid'
        }`}>
          {result}
        </div>
      )}
    </div>
  );
}
