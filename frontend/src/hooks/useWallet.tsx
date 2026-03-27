import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { MONAD_CHAIN } from '../config/addresses';

interface WalletState {
  address: string | null;
  signer: JsonRpcSigner | null;
  provider: BrowserProvider | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isCorrectChain: boolean;
  switchChain: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCorrectChain = chainId === MONAD_CHAIN.chainId;

  const switchChain = useCallback(async () => {
    if (!window.ethereum) return;
    const hexChainId = '0x' + MONAD_CHAIN.chainId.toString(16);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: unknown) {
      if ((switchError as { code: number }).code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hexChainId,
            chainName: MONAD_CHAIN.name,
            rpcUrls: [MONAD_CHAIN.rpcUrl],
            blockExplorerUrls: [MONAD_CHAIN.explorer],
            nativeCurrency: MONAD_CHAIN.currency,
          }],
        });
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install it.');
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const bp = new BrowserProvider(window.ethereum);
      await bp.send('eth_requestAccounts', []);
      const s = await bp.getSigner();
      const addr = await s.getAddress();
      const network = await bp.getNetwork();
      setProvider(bp);
      setSigner(s);
      setAddress(addr);
      setChainId(Number(network.chainId));

      if (Number(network.chainId) !== MONAD_CHAIN.chainId) {
        await switchChain();
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, [switchChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else setAddress(accounts[0]);
    };
    const handleChainChanged = async (_id: string) => {
      // 체인 변경 시 provider/signer 재생성
      const bp = new BrowserProvider(window.ethereum!);
      const network = await bp.getNetwork();
      setChainId(Number(network.chainId));
      try {
        const s = await bp.getSigner();
        const addr = await s.getAddress();
        setProvider(bp);
        setSigner(s);
        setAddress(addr);
      } catch {
        // 체인 변경 중 계정 없을 수 있음
      }
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect]);

  return (
    <WalletContext.Provider value={{
      address, signer, provider, chainId, isConnecting, error,
      connect, disconnect, isCorrectChain, switchChain,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
