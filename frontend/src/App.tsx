import { useState } from 'react';
import { WalletProvider } from './hooks/useWallet';
import { Header } from './components/Header';
import { ChallengePage } from './pages/ChallengePage';
import { PAPage } from './pages/PAPage';

export type AppPage = 'challenge' | 'pa';

function App() {
  const [page, setPage] = useState<AppPage>('challenge');

  return (
    <WalletProvider>
      <div className="min-h-screen bg-[#0a0b0f]">
        <Header page={page} setPage={setPage} />
        {page === 'challenge' ? <ChallengePage /> : <PAPage />}
      </div>
    </WalletProvider>
  );
}

export default App;
