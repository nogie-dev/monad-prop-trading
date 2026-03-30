import { useState, useEffect, useCallback } from 'react';
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useTradingAccount } from '../hooks/useContracts';
import { ADDRESSES, MONAD_CHAIN } from '../config/addresses';
import { ERC20ABI } from '../abi/ERC20';
import { TestRouterABI } from '../abi/TestRouter';

interface Props {
  paAddress: string;
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
    USDC_WETH: {
      label: 'USDC -> WETH',
      tokenIn: ADDRESSES.usdc,
      tokenOut: ADDRESSES.weth,
      tokenInSymbol: 'USDC',
      tokenOutSymbol: 'WETH',
      tokenInDecimals: 6,
      tokenOutDecimals: 18,
    },
    WETH_USDC: {
      label: 'WETH -> USDC',
      tokenIn: ADDRESSES.weth,
      tokenOut: ADDRESSES.usdc,
      tokenInSymbol: 'WETH',
      tokenOutSymbol: 'USDC',
      tokenInDecimals: 18,
      tokenOutDecimals: 6,
    },
    USDC_WBTC: {
      label: 'USDC -> WBTC',
      tokenIn: ADDRESSES.usdc,
      tokenOut: ADDRESSES.wbtc,
      tokenInSymbol: 'USDC',
      tokenOutSymbol: 'WBTC',
      tokenInDecimals: 6,
      tokenOutDecimals: 8,
    },
    WBTC_USDC: {
      label: 'WBTC -> USDC',
      tokenIn: ADDRESSES.wbtc,
      tokenOut: ADDRESSES.usdc,
      tokenInSymbol: 'WBTC',
      tokenOutSymbol: 'USDC',
      tokenInDecimals: 8,
      tokenOutDecimals: 6,
    },
  };
}

function formatTokenAmount(raw: bigint, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals === 8 ? 6 : decimals === 18 ? 6 : 2,
  });
}

export function PASwap({ paAddress, onSwap }: Props) {
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

  // Fetch PA balance for the tokenIn of the selected pair
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

  // Preview output
  const fetchPreview = useCallback(async (inputStr: string) => {
    if (!inputStr || parseFloat(inputStr) <= 0 || !ADDRESSES.dexRouter) {
      setPreviewOut(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
      const router = new Contract(ADDRESSES.dexRouter, TestRouterABI, rpcProvider);
      const amountInBig = BigInt(
        Math.round(parseFloat(inputStr) * 10 ** pair.tokenInDecimals)
      );
      const out = await router.getAmountOut(
        pair.tokenIn,
        pair.tokenOut,
        amountInBig
      ) as bigint;
      setPreviewOut(out);
    } catch (err) {
      console.error('[PASwap] getAmountOut failed:', err);
      setPreviewOut(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [pair, provider]);

  // Debounce preview
  useEffect(() => {
    const id = setTimeout(() => {
      void fetchPreview(amountIn);
    }, 3000); // 3 seconds
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
    if (!ADDRESSES.dexRouter) {
      setError('DEX router address not configured.');
      return;
    }

    setSwapping(true);
    setError(null);
    setSuccess(null);

    try {
      const amountInBig = BigInt(
        Math.round(parseFloat(amountIn) * 10 ** pair.tokenInDecimals)
      );

      // Fetch live quote for minAmountOut (0.5% slippage)
      const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
      const router = new Contract(ADDRESSES.dexRouter, TestRouterABI, rpcProvider);
      const expectedOut = await router.getAmountOut(
        pair.tokenIn,
        pair.tokenOut,
        amountInBig
      ) as bigint;
      const minAmountOut = (expectedOut * 995n) / 1000n;

      // Encode calldata for swapExactIn
      const iface = new Interface(TestRouterABI);
      const data = iface.encodeFunctionData('swapExactIn', [
        pair.tokenIn,
        pair.tokenOut,
        amountInBig,
        minAmountOut,
        paAddress,
      ]);

      const tx = await paContract.execute(ADDRESSES.dexRouter, data);
      await tx.wait();

      setSuccess(
        `Swapped ${amountIn} ${pair.tokenInSymbol} -> ~${formatTokenAmount(expectedOut, pair.tokenOutDecimals)} ${pair.tokenOutSymbol}`
      );
      setAmountIn('');
      setPreviewOut(null);
      await fetchBalance();
      onSwap();
    } catch (err: unknown) {
      const typedErr = err as { reason?: string; shortMessage?: string; message?: string };
      const msg =
        typedErr.reason ??
        typedErr.shortMessage ??
        typedErr.message ??
        'Transaction failed';
      setError(msg);
    } finally {
      setSwapping(false);
    }
  };

  const canSwap =
    !!paContract &&
    !!amountIn &&
    parseFloat(amountIn) > 0 &&
    !!ADDRESSES.dexRouter &&
    !swapping;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Execute Trade</h2>

      {/* Pair selector */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 mb-2 block">Token Pair</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(pairs) as PairKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedPair(key)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                selectedPair === key
                  ? 'bg-purple-700 text-white border border-purple-500'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-transparent'
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
          <label className="text-xs text-gray-500">
            Amount ({pair.tokenInSymbol})
          </label>
          <button
            onClick={handleMax}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
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
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {/* Preview */}
      <div className="mb-4 p-3 bg-gray-900/60 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Expected Output</span>
          <span className="text-xs text-gray-500">0.5% slippage</span>
        </div>
        <div className="mt-1">
          {previewLoading ? (
            <span className="text-sm text-gray-400">Calculating...</span>
          ) : previewOut !== null ? (
            <span className="font-mono text-white text-sm">
              ~{formatTokenAmount(previewOut, pair.tokenOutDecimals)} {pair.tokenOutSymbol}
            </span>
          ) : (
            <span className="text-sm text-gray-500">Enter amount to preview</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-700/50 rounded-lg p-3">
          <p className="text-red-400 text-sm break-words">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-900/20 border border-green-700/50 rounded-lg p-3">
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      <button
        onClick={() => void handleSwap()}
        disabled={!canSwap}
        className="w-full py-3 rounded-lg font-medium transition-colors bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white"
      >
        {swapping ? 'Executing...' : `Swap ${pair.tokenInSymbol} for ${pair.tokenOutSymbol}`}
      </button>
    </div>
  );
}
