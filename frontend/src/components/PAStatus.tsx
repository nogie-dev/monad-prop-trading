import { useState, useEffect, useCallback } from 'react';
import { Contract, JsonRpcProvider } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { ADDRESSES, MONAD_CHAIN } from '../config/addresses';
import { ERC20ABI } from '../abi/ERC20';

interface Props {
  paAddress: string;
  initialCapital: bigint;
  prices: { eth: number; btc: number };
}

interface Balances {
  usdc: bigint;
  weth: bigint;
  wbtc: bigint;
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsdc(raw: bigint): string {
  return (Number(raw) / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWeth(raw: bigint): string {
  return (Number(raw) / 1e18).toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatWbtc(raw: bigint): string {
  return (Number(raw) / 1e8).toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

export function PAStatus({ paAddress, initialCapital, prices }: Props) {
  const { provider } = useWallet();
  const [balances, setBalances] = useState<Balances>({ usdc: 0n, weth: 0n, wbtc: 0n });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchBalances = useCallback(async () => {
    const rpcProvider =
      provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);

    try {
      const usdcContract = new Contract(ADDRESSES.usdc, ERC20ABI, rpcProvider);
      const wethContract = new Contract(ADDRESSES.weth, ERC20ABI, rpcProvider);
      const wbtcContract = new Contract(ADDRESSES.wbtc, ERC20ABI, rpcProvider);

      const [usdcBal, wethBal, wbtcBal] = await Promise.all([
        usdcContract.balanceOf(paAddress) as Promise<bigint>,
        wethContract.balanceOf(paAddress) as Promise<bigint>,
        wbtcContract.balanceOf(paAddress) as Promise<bigint>,
      ]);

      setBalances({ usdc: usdcBal, weth: wethBal, wbtc: wbtcBal });
    } catch (err) {
      console.error('[PAStatus] Failed to fetch balances:', err);
    } finally {
      setLoading(false);
    }
  }, [paAddress, provider]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const usdcValue = Number(balances.usdc) / 1e6;
  const wethValue = (Number(balances.weth) / 1e18) * prices.eth;
  const wbtcValue = (Number(balances.wbtc) / 1e8) * prices.btc;
  const totalValue = usdcValue + wethValue + wbtcValue;
  const initialValue = Number(initialCapital) / 1e6;
  const pnl = totalValue - initialValue;
  const pnlPercent = initialValue > 0 ? (pnl / initialValue) * 100 : 0;
  const isProfitable = pnl > 0;

  const handleCopy = () => {
    void navigator.clipboard.writeText(paAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-white">PA Portfolio</h2>
        {loading && (
          <span className="text-xs text-gray-500">Loading...</span>
        )}
      </div>

      {/* PA Address */}
      <div className="mb-5 p-3 bg-gray-900/60 rounded-lg flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">PA Address</p>
          <p className="font-mono text-sm text-purple-300">{shortenAddress(paAddress)}</p>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Balances grid */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-gray-900/40 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">USDC</p>
          <p className="font-mono text-white text-sm">${formatUsdc(balances.usdc)}</p>
        </div>
        <div className="bg-gray-900/40 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">WETH</p>
          <p className="font-mono text-white text-sm">{formatWeth(balances.weth)}</p>
          <p className="font-mono text-gray-400 text-xs mt-0.5">
            ${wethValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gray-900/40 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">WBTC</p>
          <p className="font-mono text-white text-sm">{formatWbtc(balances.wbtc)}</p>
          <p className="font-mono text-gray-400 text-xs mt-0.5">
            ${wbtcValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Portfolio summary */}
      <div className="border-t border-gray-700 pt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Portfolio Value</p>
          <p className="font-mono text-white text-base">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">P&amp;L vs Initial Capital</p>
          <p className={`font-mono text-base ${isProfitable ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {isProfitable ? '+' : ''}
            ${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}
            <span className="text-sm">({isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
