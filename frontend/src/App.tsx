import { useState } from 'react';
import { WalletProvider } from './hooks/useWallet';
import { Header } from './components/Header';
import { ChallengePage } from './pages/ChallengePage';
import { PAPage } from './pages/PAPage';
import { DebugPage } from './pages/DebugPage';

export type AppPage = 'challenge' | 'pa' | 'debug';

function App() {
  const [page, setPage] = useState<AppPage>('challenge');

  return (
    <WalletProvider>
      <div className="flex min-h-screen bg-base text-hi">
        <Header page={page} setPage={setPage} />
        <main className="flex-1 min-h-screen overflow-auto">
          {page === 'challenge' ? <ChallengePage /> : page === 'pa' ? <PAPage /> : <DebugPage />}
        </main>
      </div>
    </WalletProvider>
  );
}

export default App;
