import { useState, useEffect, useCallback } from 'react';
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useTradingAccount } from '../hooks/useContracts';
import { ADDRESSES, MONAD_CHAIN } from '../config/addresses';
import { ERC20ABI } from '../abi/ERC20';
import { TestRouterABI } from '../abi/TestRouter';

interface Props {
  paAddress: string;
  disabled?: boolean;
  onSwap: () => void;
}

type PairKey = 'USDC_WETH' | 'WETH_USDC' | 'USDC_WBTC' | 'WBTC_USDC';

interface PairConfig {
  label: string;
  tokenIn: string;
  tokenOut: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  tokenInDecimals: number;
  tokenOutDecimals: number;
}

function buildPairs(): Record<PairKey, PairConfig> {
  return {
    USDC_WETH: { label: 'USDC → WETH', tokenIn: ADDRESSES.usdc, tokenOut: ADDRESSES.weth, tokenInSymbol: 'USDC', tokenOutSymbol: 'WETH', tokenInDecimals: 6, tokenOutDecimals: 18 },
    WETH_USDC: { label: 'WETH → USDC', tokenIn: ADDRESSES.weth, tokenOut: ADDRESSES.usdc, tokenInSymbol: 'WETH', tokenOutSymbol: 'USDC', tokenInDecimals: 18, tokenOutDecimals: 6 },
    USDC_WBTC: { label: 'USDC → WBTC', tokenIn: ADDRESSES.usdc, tokenOut: ADDRESSES.wbtc, tokenInSymbol: 'USDC', tokenOutSymbol: 'WBTC', tokenInDecimals: 6, tokenOutDecimals: 8 },
    WBTC_USDC: { label: 'WBTC → USDC', tokenIn: ADDRESSES.wbtc, tokenOut: ADDRESSES.usdc, tokenInSymbol: 'WBTC', tokenOutSymbol: 'USDC', tokenInDecimals: 8, tokenOutDecimals: 6 },
  };
}

function formatTokenAmount(raw: bigint, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals === 8 ? 6 : decimals === 18 ? 6 : 2,
  });
}

export function PASwap({ paAddress, disabled = false, onSwap }: Props) {
  const { provider } = useWallet();
  const paContract = useTradingAccount(paAddress);

  const [selectedPair, setSelectedPair] = useState<PairKey>('USDC_WETH');
  const [amountIn, setAmountIn] = useState('');
  const [paBalance, setPaBalance] = useState(0n);
  const [previewOut, setPreviewOut] = useState<bigint | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pairs = buildPairs();
  const pair = pairs[selectedPair];

  const fetchBalance = useCallback(async () => {
    const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
    try {
      const tokenContract = new Contract(pair.tokenIn, ERC20ABI, rpcProvider);
      const bal = await tokenContract.balanceOf(paAddress) as bigint;
      setPaBalance(bal);
    } catch (err) {
      console.error('[PASwap] Failed to fetch balance:', err);
      setPaBalance(0n);
    }
  }, [paAddress, pair.tokenIn, provider]);

  useEffect(() => {
    void fetchBalance();
    setAmountIn('');
    setPreviewOut(null);
    setError(null);
    setSuccess(null);
  }, [fetchBalance, selectedPair]);

  const fetchPreview = useCallback(async (inputStr: string) => {
    if (!inputStr || parseFloat(inputStr) <= 0 || !ADDRESSES.dexRouter) {
      setPreviewOut(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
      const router = new Contract(ADDRESSES.dexRouter, TestRouterABI, rpcProvider);
      const amountInBig = BigInt(Math.round(parseFloat(inputStr) * 10 ** pair.tokenInDecimals));
      const out = await router.getAmountOut(pair.tokenIn, pair.tokenOut, amountInBig) as bigint;
      setPreviewOut(out);
    } catch (err) {
      console.error('[PASwap] getAmountOut failed:', err);
      setPreviewOut(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [pair, provider]);

  useEffect(() => {
    const id = setTimeout(() => { void fetchPreview(amountIn); }, 3000);
    return () => clearTimeout(id);
  }, [amountIn, fetchPreview]);

  const handleMax = () => {
    const maxStr = (Number(paBalance) / 10 ** pair.tokenInDecimals).toFixed(
      pair.tokenInDecimals === 8 ? 6 : pair.tokenInDecimals === 18 ? 6 : 2
    );
    setAmountIn(maxStr);
  };

  const handleSwap = async () => {
    if (!paContract || !amountIn || parseFloat(amountIn) <= 0) return;
    if (!ADDRESSES.dexRouter) { setError('DEX router address not configured.'); return; }

    setSwapping(true);
    setError(null);
    setSuccess(null);

    try {
      const amountInBig = BigInt(Math.round(parseFloat(amountIn) * 10 ** pair.tokenInDecimals));
      const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
      const router = new Contract(ADDRESSES.dexRouter, TestRouterABI, rpcProvider);
      const expectedOut = await router.getAmountOut(pair.tokenIn, pair.tokenOut, amountInBig) as bigint;
      const minAmountOut = (expectedOut * 985n) / 1000n;

      const iface = new Interface(TestRouterABI);
      const data = iface.encodeFunctionData('swapExactIn', [
        pair.tokenIn, pair.tokenOut, amountInBig, minAmountOut, paAddress,
      ]);

      const tx = await paContract.execute(ADDRESSES.dexRouter, data);
      await tx.wait();

      setSuccess(`Swapped ${amountIn} ${pair.tokenInSymbol} → ~${formatTokenAmount(expectedOut, pair.tokenOutDecimals)} ${pair.tokenOutSymbol}`);
      setAmountIn('');
      setPreviewOut(null);
      await fetchBalance();
      onSwap();
    } catch (err: unknown) {
      const typedErr = err as { reason?: string; shortMessage?: string; message?: string };
      setError(typedErr.reason ?? typedErr.shortMessage ?? typedErr.message ?? 'Transaction failed');
    } finally {
      setSwapping(false);
    }
  };

  const canSwap = !disabled && !!paContract && !!amountIn && parseFloat(amountIn) > 0 && !!ADDRESSES.dexRouter && !swapping;

  return (
    <div className="bg-surface border border-line rounded-sm p-6">
      <p className="text-xs uppercase tracking-widest text-mid mb-4">Execute Trade</p>

      {/* Pair selector */}
      <div className="mb-4">
        <p className="text-xs text-mid mb-2">Token Pair</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(pairs) as PairKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedPair(key)}
              className={`py-2 px-3 rounded-sm text-sm font-medium transition-colors duration-150 border ${
                selectedPair === key
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-line text-mid hover:border-accent2/50 hover:text-hi'
              }`}
            >
              {pairs[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-mid">Amount ({pair.tokenInSymbol})</p>
          <button
            onClick={handleMax}
            className="text-xs text-accent2 hover:brightness-110 transition-colors duration-150 font-mono tabular-nums"
          >
            MAX: {formatTokenAmount(paBalance, pair.tokenInDecimals)} {pair.tokenInSymbol}
          </button>
        </div>
        <input
          type="number"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          placeholder="0.00"
          min="0"
          className="w-full bg-[#0f1319] border border-line rounded-sm px-4 py-2.5 text-hi font-mono tabular-nums placeholder:text-mid focus:ring-1 focus:ring-accent focus:outline-none transition-colors duration-150"
        />
      </div>

      {/* Preview */}
      <div className="mb-4 p-3 bg-base border border-line rounded-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-mid">Expected Output</span>
          <span className="text-xs text-mid">1.5% slippage</span>
        </div>
        {previewLoading ? (
          <span className="text-sm text-mid">Calculating...</span>
        ) : previewOut !== null ? (
          <span className="font-mono tabular-nums text-hi text-sm">
            ~{formatTokenAmount(previewOut, pair.tokenOutDecimals)} {pair.tokenOutSymbol}
          </span>
        ) : (
          <span className="text-sm text-mid">Enter amount to preview</span>
        )}
      </div>

      {error && (
        <div className="mb-4 border border-loss/30 bg-loss/5 rounded-sm p-3">
          <p className="text-loss text-sm break-words">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 border border-profit/30 bg-profit/5 rounded-sm p-3">
          <p className="text-profit text-sm">{success}</p>
        </div>
      )}

      <button
        onClick={() => void handleSwap()}
        disabled={!canSwap}
        className="w-full py-2.5 rounded-sm font-medium text-sm transition-colors duration-150 bg-accent text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {swapping ? 'Executing...' : `Swap ${pair.tokenInSymbol} → ${pair.tokenOutSymbol}`}
      </button>
    </div>
  );
}
