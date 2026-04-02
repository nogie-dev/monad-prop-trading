import { useEffect, useState } from 'react';
import { Contract, JsonRpcProvider } from 'ethers';
import { ADDRESSES, MONAD_CHAIN } from '../config/addresses';
import { ERC20ABI } from '../abi/ERC20';
import { TestRouterABI } from '../abi/TestRouter';

interface TokenPosition {
  symbol: string;
  balance: bigint;
  decimals: number;
  poolPrice: number;
  valueUsdc: number;
}

interface Props {
  paAddress: string | null;
}

function fmt2(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PositionSummary({ paAddress }: Props) {
  const [positions, setPositions] = useState<TokenPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paAddress || !ADDRESSES.weth || !ADDRESSES.wbtc || !ADDRESSES.dexRouter) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const provider = new JsonRpcProvider(MONAD_CHAIN.rpcUrl);
        const router = new Contract(ADDRESSES.dexRouter, TestRouterABI, provider);
        const wethContract = new Contract(ADDRESSES.weth, ERC20ABI, provider);
        const wbtcContract = new Contract(ADDRESSES.wbtc, ERC20ABI, provider);

        const [wethBal, wbtcBal, ethOut, btcOut] = await Promise.all([
          wethContract.balanceOf(paAddress) as Promise<bigint>,
          wbtcContract.balanceOf(paAddress) as Promise<bigint>,
          router.getAmountOut(ADDRESSES.weth, ADDRESSES.usdc, BigInt(1e18)) as Promise<bigint>,
          router.getAmountOut(ADDRESSES.wbtc, ADDRESSES.usdc, BigInt(1e8)) as Promise<bigint>,
        ]);

        const ethPrice = Number(ethOut) / 1e6;
        const btcPrice = Number(btcOut) / 1e6;

        const result: TokenPosition[] = [];

        if (wethBal > 0n) {
          const balNum = Number(wethBal) / 1e18;
          result.push({ symbol: 'WETH', balance: wethBal, decimals: 18, poolPrice: ethPrice, valueUsdc: balNum * ethPrice });
        }
        if (wbtcBal > 0n) {
          const balNum = Number(wbtcBal) / 1e8;
          result.push({ symbol: 'WBTC', balance: wbtcBal, decimals: 8, poolPrice: btcPrice, valueUsdc: balNum * btcPrice });
        }

        setPositions(result);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void run();
    const id = setInterval(() => void run(), 10_000);
    return () => clearInterval(id);
  }, [paAddress]);

  if (!paAddress) return null;

  return (
    <div className="bg-surface border border-line rounded-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-mid">Holdings</p>
        {loading && <span className="text-[11px] text-mid">Loading...</span>}
      </div>

      {error && <p className="text-xs text-loss break-words">{error}</p>}

      {!loading && !error && positions.length === 0 && (
        <p className="text-sm text-mid">No token holdings in PA. Swap USDC to open a position.</p>
      )}

      {positions.length > 0 && (
        <div className="space-y-2">
          {positions.map((pos) => {
            const balNum = Number(pos.balance) / 10 ** pos.decimals;
            const priceFmt = pos.decimals === 18 ? balNum.toFixed(4) : balNum.toFixed(6);

            return (
              <div key={pos.symbol} className="bg-base border border-line rounded-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-hi text-sm font-medium">{pos.symbol}</span>
                  <span className="font-mono tabular-nums text-hi text-sm font-medium">
                    ${fmt2(pos.valueUsdc)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-mid mb-0.5">Balance</span>
                    <span className="font-mono tabular-nums text-hi">{priceFmt} {pos.symbol}</span>
                  </div>
                  <div>
                    <span className="block text-mid mb-0.5">Pool Price</span>
                    <span className="font-mono tabular-nums text-accent2">${fmt2(pos.poolPrice)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
