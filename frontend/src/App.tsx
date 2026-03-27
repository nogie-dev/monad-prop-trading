import { WalletProvider } from './hooks/useWallet';
import { Header } from './components/Header';
import { ChallengePage } from './pages/ChallengePage';

function App() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-[#0a0b0f]">
        <Header />
        <ChallengePage />
      </div>
    </WalletProvider>
  );
}

export default App;
