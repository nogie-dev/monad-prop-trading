import { useState, useEffect, useCallback } from 'react';
import { Contract, JsonRpcProvider } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { ADDRESSES, MONAD_CHAIN } from '../config/addresses';
import { ERC20ABI } from '../abi/ERC20';
import { TestRouterABI } from '../abi/TestRouter';

interface Props {
  paAddress: string;
  initialCapital: bigint;
  prices: { eth: number; btc: number };
  refreshFlag?: number;
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

export function PAStatus({ paAddress, initialCapital, prices, refreshFlag = 0 }: Props) {
  const { provider } = useWallet();
  const [balances, setBalances] = useState<Balances>({ usdc: 0n, weth: 0n, wbtc: 0n });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [poolPrices, setPoolPrices] = useState<{ eth: number; btc: number } | null>(null);

  const fetchBalances = useCallback(async () => {
    const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
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

  const fetchPoolPrices = useCallback(async () => {
    if (!ADDRESSES.dexRouter) return;
    try {
      const rpcProvider = provider ?? new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
      const router = new Contract(ADDRESSES.dexRouter, TestRouterABI, rpcProvider);
      const [ethOut, btcOut] = await Promise.all([
        router.getAmountOut(ADDRESSES.weth, ADDRESSES.usdc, BigInt(1e18)) as Promise<bigint>,
        router.getAmountOut(ADDRESSES.wbtc, ADDRESSES.usdc, BigInt(1e8)) as Promise<bigint>,
      ]);
      setPoolPrices({ eth: Number(ethOut) / 1e6, btc: Number(btcOut) / 1e6 });
    } catch (err) {
      console.error('[PAStatus] Failed to fetch pool prices:', err);
    }
  }, [provider]);

  useEffect(() => {
    void fetchBalances();
    void fetchPoolPrices();
  }, [fetchBalances, fetchPoolPrices, refreshFlag]);

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
    <div className="bg-surface border border-line rounded-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs uppercase tracking-widest text-mid">PA Portfolio</p>
        {loading && <span className="text-xs text-mid">Loading...</span>}
      </div>

      {/* PA Address */}
      <div className="mb-5 p-3 bg-base border border-line rounded-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-mid mb-1">PA Address</p>
          <p className="font-mono text-sm text-accent2">{shortenAddress(paAddress)}</p>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded-sm border border-line text-mid hover:border-accent2 hover:text-hi transition-colors duration-150"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'USDC', value: `$${formatUsdc(balances.usdc)}`, sub: null },
          { label: 'WETH', value: formatWeth(balances.weth), sub: `$${wethValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
          { label: 'WBTC', value: formatWbtc(balances.wbtc), sub: `$${wbtcValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-base border border-line rounded-sm p-3">
            <p className="text-xs text-mid mb-1">{label}</p>
            <p className="font-mono tabular-nums text-hi text-sm">{value}</p>
            {sub && <p className="font-mono tabular-nums text-mid text-xs mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Portfolio summary */}
      <div className="border-t border-line pt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-mid mb-1">Total Value</p>
          <p className="font-mono tabular-nums text-hi text-base">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-mid mb-1">P&amp;L vs Initial</p>
          <p className={`font-mono tabular-nums text-base ${isProfitable ? 'text-profit' : pnl < 0 ? 'text-loss' : 'text-mid'}`}>
            {isProfitable ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}
            <span className="text-sm">({isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
          </p>
        </div>
      </div>

      {/* Price Reference */}
      <div className="mt-4 border-t border-line pt-4">
        <p className="text-xs uppercase tracking-widest text-mid mb-2">Price Reference</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: 'Chainlink',
              sub: 'Liquidation ref',
              eth: prices.eth > 0 ? `ETH $${prices.eth.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'ETH —',
              btc: prices.btc > 0 ? `BTC $${prices.btc.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'BTC —',
            },
            {
              label: 'DEX Pool',
              sub: 'Execution price',
              eth: poolPrices ? `ETH $${poolPrices.eth.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'ETH —',
              btc: poolPrices ? `BTC $${poolPrices.btc.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'BTC —',
            },
          ].map(({ label, sub, eth, btc }) => (
            <div key={label} className="bg-base border border-line rounded-sm p-2.5">
              <p className="text-xs text-hi mb-0.5">{label}</p>
              <p className="text-xs text-mid mb-1">{sub}</p>
              <p className="font-mono tabular-nums text-xs text-hi">{eth}</p>
              <p className="font-mono tabular-nums text-xs text-hi">{btc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
