/// <reference types="vite/client" />

interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  };
}

interface ImportMetaEnv {
  readonly VITE_MONAD_RPC: string;
  readonly VITE_PROP_CHALLENGE: string;
  readonly VITE_ACCOUNT_FACTORY: string;
  readonly VITE_TREASURY: string;
  readonly VITE_USDC: string;
  readonly VITE_WETH: string;
  readonly VITE_WBTC: string;
}
