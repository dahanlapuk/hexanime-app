import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLibrary, useStatusMap, useTimeMap, useWatchOrder } from './hooks/useStore';
import { useDownloadManager } from './hooks/useDownloadManager';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import DetailPage from './pages/DetailPage';
import PlayerPage from './pages/PlayerPage';
import DebugConsole from './components/DebugConsole';
import StartupGuard from './components/StartupGuard';
import ChangelogModal from './components/ChangelogModal';

export default function App() {
  const { library, loading } = useLibrary();
  const { statusMap, getStatus, setStatus, setBatchStatus, cycleStatus } = useStatusMap();
  const { getTime, saveTime } = useTimeMap();
  const { order, setOrder } = useWatchOrder();
  const [searchQuery, setSearchQuery] = useState('');
  const downloadManager = useDownloadManager({ setStatus });
  const [startupComplete, setStartupComplete] = useState(false);
  const [showChangelog, setShowChangelog] = useState(!localStorage.getItem('hexanime_v16_seen'));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <p className="text-5xl mb-4 animate-pulse">⬡</p>
          <p className="font-display text-3xl tracking-wider text-accent">HEXANIME</p>
          <p className="text-sm text-text-muted mt-2">Loading library...</p>
        </div>
      </div>
    );
  }

  if (!startupComplete) {
    return (
      <>
        <DebugConsole />
        <StartupGuard 
          library={library} 
          getStatus={getStatus} 
          setStatus={setStatus} 
          onComplete={() => setStartupComplete(true)} 
        />
      </>
    );
  }

  return (
    <BrowserRouter>
      <DebugConsole />
      {showChangelog && (
        <ChangelogModal onClose={() => {
          setShowChangelog(false);
          localStorage.setItem('hexanime_v16_seen', 'true');
        }} />
      )}
      <Routes>
        <Route path="/player/:seriesId/:ep" element={
          <PlayerPage
            library={library}
            getStatus={getStatus}
            setStatus={setStatus}
            getTime={getTime}
            saveTime={saveTime}
            getPlaybackUrl={downloadManager.getPlaybackUrl}
          />
        } />
        <Route path="*" element={
          <>
            <Navbar order={order} onOrderChange={setOrder} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            <Routes>
              <Route path="/" element={
                <HomePage library={library} statusMap={statusMap} order={order} searchQuery={searchQuery} />
              } />
              <Route path="/detail/:id" element={
                <DetailPage
                  library={library}
                  statusMap={statusMap}
                  order={order}
                  getStatus={getStatus}
                  cycleStatus={cycleStatus}
                  setBatchStatus={setBatchStatus}
                  downloadManager={downloadManager}
                />
              } />
            </Routes>
          </>
        } />
      </Routes>
    </BrowserRouter>
  );
}
