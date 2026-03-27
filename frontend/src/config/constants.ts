export const USDC_DECIMALS = 6;
export const PRICE_DECIMALS = 18;
export const MAX_OPEN_POSITIONS = 5;
export const CHALLENGE_FEE = 100_000_000n; // 100 USDC (6 decimals)
export const VIRTUAL_INITIAL = 10_000_000_000n; // 10,000 USDC
export const PROFIT_TARGET = 11_000_000_000n; // 11,000 USDC (10% gain)

export const TOKEN_INFO: Record<string, { symbol: string; name: string; icon: string }> = {
  weth: { symbol: 'WETH', name: 'Wrapped Ether', icon: 'ETH' },
  wbtc: { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: 'BTC' },
};
