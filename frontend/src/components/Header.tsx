import { useWallet } from '../hooks/useWallet';

export function Header() {
  const { address, isConnecting, connect, disconnect, isCorrectChain, switchChain } = useWallet();

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  return (
    <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Monad Prop Trading</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/50">
            Testnet
          </span>
        </div>

        <div className="flex items-center gap-3">
          {address && !isCorrectChain && (
            <button
              onClick={switchChain}
              className="px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
            >
              Switch to Monad
            </button>
          )}
          {address ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 font-mono">{shortAddr}</span>
              <button
                onClick={disconnect}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
