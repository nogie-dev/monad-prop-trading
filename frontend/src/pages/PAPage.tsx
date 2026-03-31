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
  const [refreshBalancesFlag, setRefreshBalancesFlag] = useState(0); // triggers PAStatus refresh
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState<string | null>(null);
  const [paOwner, setPaOwner] = useState<string | null>(null);
  const [liquidating, setLiquidating] = useState(false);
  const [liquidateError, setLiquidateError] = useState<string | null>(null);
  const [liquidateSuccess, setLiquidateSuccess] = useState<string | null>(null);

  const paContract = useTradingAccount(paAddress);

  const fetchPAAddress = useCallback(async () => {
    if (!accountFactory || !address) return;
    setLoading(true);
    try {
      const addr = await accountFactory.getAccount(address) as string;
      if (!addr || addr === ZERO_ADDRESS) {
        setPaAddress(null);
      } else {
        setPaAddress(addr);
      }
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
      const [capital, usdcAddr, ownerAddr] = await Promise.all([
        paContract.initialCapital() as Promise<bigint>,
        paContract.usdc() as Promise<string>,
        paContract.owner() as Promise<string>,
      ]);
      setInitialCapital(capital);
      setPaOwner(ownerAddr);

      const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
      const usdcToken = new Contract(usdcAddr, ERC20ABI, rpcProvider);
      const bal = await usdcToken.balanceOf(paAddress) as bigint;
      setUsdcBalance(bal);
    } catch (err) {
      console.error('[PAPage] Failed to fetch PA details:', err);
    }
  }, [paContract, paAddress, provider]);

  useEffect(() => {
    void fetchPAAddress();
  }, [fetchPAAddress]);

  useEffect(() => {
    if (paAddress) {
      void fetchPADetails();
    }
  }, [paAddress, fetchPADetails]);

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
      const msg =
        typedErr.reason ??
        typedErr.shortMessage ??
        typedErr.message ??
        'Settlement failed';
      setSettleError(msg);
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
      const msg = typedErr.reason ?? typedErr.shortMessage ?? typedErr.message ?? 'Liquidation failed';
      setLiquidateError(msg);
    } finally {
      setLiquidating(false);
    }
  };

  const isAdmin = !!address && !!paOwner && address.toLowerCase() === paOwner.toLowerCase();

  const isDrawdownWarning =
    initialCapital > 0n && usdcBalance < (initialCapital * 90n) / 100n;

  const canSettle = initialCapital > 0n && usdcBalance > initialCapital;

  if (!address) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">PA Dashboard</h2>
          <p className="text-gray-400">Connect your wallet to access your Performance Account.</p>
        </div>
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-yellow-400 mb-2">Wrong Network</h2>
          <p className="text-gray-400">Please switch to Monad Testnet.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Loading PA data...</p>
      </div>
    );
  }

  if (!paAddress) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">PA Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">
            Live trading with platform-funded Performance Account.
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-10 text-center">
          <p className="text-white text-lg font-semibold mb-2">No PA Assigned Yet</p>
          <p className="text-gray-400 text-sm">
            Complete the paper trading challenge first. Once you pass, a Performance Account
            will be deployed and funded for you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">PA Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">
          Live trading via your platform-funded Performance Account.
        </p>
      </div>

      {isDrawdownWarning && (
        <div className="mb-4 bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-red-400 text-sm font-medium">
              Drawdown Warning: Portfolio value is more than 10% below initial capital.
              The platform may force-liquidate your account.
            </p>
            {isAdmin && (
              <button
                onClick={() => { void handleLiquidate(); }}
                disabled={liquidating}
                className="flex-shrink-0 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {liquidating ? 'Liquidating...' : 'Force Liquidate'}
              </button>
            )}
          </div>
          {liquidateError && (
            <div className="mt-2 bg-red-900/30 rounded p-2">
              <p className="text-red-300 text-xs break-words">{liquidateError}</p>
            </div>
          )}
          {liquidateSuccess && (
            <div className="mt-2 bg-green-900/20 rounded p-2">
              <p className="text-green-400 text-xs">{liquidateSuccess}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PAStatus
          paAddress={paAddress}
          initialCapital={initialCapital}
          prices={prices}
          refreshFlag={refreshBalancesFlag}
        />
        <PASwap
          paAddress={paAddress}
          onSwap={() => {
            void fetchPADetails(); // refresh USDC + initialCapital
            setRefreshBalancesFlag((x) => x + 1); // trigger PAStatus to refetch all balances
          }}
        />
      </div>

      {/* Settle section */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Settle Account</h3>
            <p className="text-xs text-gray-400">
              Settle when profitable to distribute funds: 20% to you, 80% to treasury.
              {!canSettle && initialCapital > 0n && (
                <span className="text-yellow-400 ml-1">
                  Requires USDC balance above initial capital of $
                  {(Number(initialCapital) / 1e6).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => { void handleSettle(); }}
            disabled={!canSettle || settling}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {settling ? 'Settling...' : 'Settle'}
          </button>
        </div>

        {settleError && (
          <div className="mt-3 bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <p className="text-red-400 text-sm break-words">{settleError}</p>
          </div>
        )}
        {settleSuccess && (
          <div className="mt-3 bg-green-900/20 border border-green-700/50 rounded-lg p-3">
            <p className="text-green-400 text-sm">{settleSuccess}</p>
          </div>
        )}
      </div>

      {/* Attack demo */}
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

interface AttackDemoProps {
  paAddress: string;
}

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
      const revertMsg =
        typedErr.reason ??
        typedErr.shortMessage ??
        typedErr.message ??
        'Reverted (unknown reason)';
      setResult(`Reverted as expected: ${revertMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 border border-yellow-700/40 rounded-xl p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-yellow-400 mb-1">Attack Demo</h3>
        <p className="text-xs text-gray-400">
          These calls intentionally attempt forbidden operations to verify TradingAccount security.
          Each should revert with SelectorNotAllowed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AttackButton
          label="Transfer USDC to self"
          description="Encodes transfer(address,uint256) on USDC. Should revert: SelectorNotAllowed."
          loading={loadingUsdc}
          result={usdcResult}
          onClick={() => {
            void attemptTransfer(ADDRESSES.usdc, 'USDC', setUsdcResult, setLoadingUsdc);
          }}
        />
        <AttackButton
          label="Transfer WETH to self"
          description="Encodes transfer(address,uint256) on WETH. Should revert: SelectorNotAllowed."
          loading={loadingWeth}
          result={wethResult}
          onClick={() => {
            void attemptTransfer(ADDRESSES.weth, 'WETH', setWethResult, setLoadingWeth);
          }}
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
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <p className="text-sm font-medium text-white mb-1">{label}</p>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      <button
        onClick={onClick}
        disabled={loading}
        className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 disabled:text-gray-500 text-white"
      >
        {loading ? 'Attempting...' : 'Attempt Attack'}
      </button>
      {result && (
        <div
          className={`mt-2 p-2 rounded text-xs break-words ${
            isUnexpectedSuccess
              ? 'bg-red-900/30 border border-red-600/50 text-red-300'
              : isRevertExpected
              ? 'bg-green-900/20 border border-green-700/40 text-green-400'
              : 'bg-gray-800 border border-gray-600 text-gray-400'
          }`}
        >
          {result}
        </div>
      )}
    </div>
  );
}
