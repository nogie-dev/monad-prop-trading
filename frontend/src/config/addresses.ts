export const ADDRESSES = {
  propChallenge: import.meta.env.VITE_PROP_CHALLENGE || '',
  accountFactory: import.meta.env.VITE_ACCOUNT_FACTORY || '',
  treasury: import.meta.env.VITE_TREASURY || '',
  faucet: import.meta.env.VITE_FAUCET || '',
  usdc: import.meta.env.VITE_USDC || '',
  weth: import.meta.env.VITE_WETH || '',
  wbtc: import.meta.env.VITE_WBTC || '',
  dexRouter: import.meta.env.VITE_DEX_ROUTER || '',
} as const;

export const MONAD_CHAIN = {
  chainId: 10143,
  name: 'Monad Testnet',
  rpcUrl: import.meta.env.VITE_MONAD_RPC || 'https://testnet-rpc.monad.xyz',
  explorer: 'https://testnet.monadexplorer.com',
  currency: { name: 'MON', symbol: 'MON', decimals: 18 },
} as const;
