import type { ReactNode } from 'react';
import { useWallet } from '../hooks/useWallet';
import { type AppPage } from '../App';

interface Props {
  page: AppPage;
  setPage: (p: AppPage) => void;
}

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function NavItem({ active, onClick, children }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-2.5 text-sm transition-colors duration-150 border-l-2 ${
        active
          ? 'border-accent text-hi bg-accent/5'
          : 'border-transparent text-mid hover:text-hi hover:bg-white/[0.03]'
      }`}
    >
      {children}
    </button>
  );
}

export function Header({ page, setPage }: Props) {
  const { address, isConnecting, connect, disconnect, isCorrectChain, switchChain } = useWallet();
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  return (
    <aside className="w-52 shrink-0 bg-surface border-r border-line flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-line">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-sm font-semibold text-hi tracking-tight">Monad Prop</h1>
          <span className="text-xs px-1.5 py-0.5 rounded-sm border border-accent/30 bg-accent/10 text-accent font-mono">
            Testnet
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        <p className="px-5 pb-2 text-xs uppercase tracking-widest text-mid">Navigation</p>
        <NavItem active={page === 'challenge'} onClick={() => setPage('challenge')}>
          Challenge
        </NavItem>
        <NavItem active={page === 'trade'} onClick={() => setPage('trade')}>
          Trade
        </NavItem>
        <NavItem active={page === 'pa'} onClick={() => setPage('pa')}>
          PA Dashboard
        </NavItem>
        <NavItem active={page === 'debug'} onClick={() => setPage('debug')}>
          Debug
        </NavItem>
      </nav>

      {/* Wallet */}
      <div className="border-t border-line p-4 space-y-2">
        {address && !isCorrectChain && (
          <button
            onClick={() => { void switchChain(); }}
            className="w-full px-3 py-1.5 text-xs border border-loss/50 text-loss hover:bg-loss/5 rounded-sm transition-colors duration-150"
          >
            Switch to Monad
          </button>
        )}
        {address ? (
          <>
            <p className="text-xs font-mono text-mid truncate">{shortAddr}</p>
            <button
              onClick={disconnect}
              className="w-full px-3 py-1.5 text-xs border border-line text-mid hover:border-accent2 hover:text-hi rounded-sm transition-colors duration-150"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => { void connect(); }}
            disabled={isConnecting}
            className="w-full px-3 py-2 text-xs font-medium bg-accent text-black hover:brightness-110 disabled:opacity-60 rounded-sm transition-colors duration-150"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </aside>
  );
}
