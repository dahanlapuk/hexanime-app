import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLibrary, useStatusMap, useTimeMap, useWatchOrder } from './hooks/useStore';
import { useDownloadManager } from './hooks/useDownloadManager';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import DetailPage from './pages/DetailPage';
import PlayerPage from './pages/PlayerPage';

export default function App() {
  const { library, loading } = useLibrary();
  const { statusMap, getStatus, setStatus, setBatchStatus, cycleStatus } = useStatusMap();
  const { getTime, saveTime } = useTimeMap();
  const { order, setOrder } = useWatchOrder();
  const [searchQuery, setSearchQuery] = useState('');
  const [auditDone, setAuditDone] = useState(false);

  const downloadManager = useDownloadManager({ setStatus });

  // ── Startup Audit ──
  // Verify that files marked "downloaded" / "watched" still exist on device storage.
  // If user deleted them via File Manager, reset status to "not_downloaded".
  useEffect(() => {
    if (!loading && library.length > 0 && !auditDone) {
      downloadManager.checkStorage(library, getStatus).then(() => {
        setAuditDone(true);
        console.log('[HexAnime] Startup audit complete');
      });
    }
  }, [loading, library, auditDone, downloadManager, getStatus]);

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

  return (
    <BrowserRouter>
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
