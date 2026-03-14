import { useParams, useNavigate } from 'react-router-dom';
import type { Series, StatusMap, EpisodeStatus, WatchOrder } from '../types';
import { SERIES_META } from '../data/metadata';
import { getSeriesProgress } from '../hooks/useStore';
import type { useDownloadManager } from '../hooks/useDownloadManager';
import StatusPill from '../components/StatusPill';
import { useState, useMemo } from 'react';

interface Props {
  library: Series[];
  statusMap: StatusMap;
  order: WatchOrder;
  getStatus: (sid: string, ep: string) => EpisodeStatus;
  cycleStatus: (sid: string, ep: string) => void;
  setBatchStatus: (sid: string, eps: string[], status: EpisodeStatus) => void;
  downloadManager: ReturnType<typeof useDownloadManager>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

export default function DetailPage({ library, statusMap, order: _order, getStatus, cycleStatus, setBatchStatus, downloadManager }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const series = library.find(s => s.id === id);
  const meta = id ? SERIES_META[id] : undefined;
  const [queueOpen, setQueueOpen] = useState(false);

  if (!series || !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-muted">Series not found</p>
      </div>
    );
  }

  const [g1, g2] = meta.gradient;
  const progress = getSeriesProgress(series.id, series.episodes, statusMap);

  // Group episodes by arc if series has arcs (id=05)
  const episodeGroups = useMemo(() => {
    if (meta.arcs) {
      return meta.arcs.map(arc => ({
        arcName: arc.name,
        arcColor: arc.color,
        episodes: series.episodes.filter(ep => ep.filename.startsWith(arc.prefix)),
      }));
    }
    return [{ arcName: null, arcColor: null, episodes: series.episodes }];
  }, [series, meta.arcs]);

  const isSplit = (ep: string) => /^\d+[a-z]$/.test(ep);
  const allEps = series.episodes.map(e => e.ep);

  // Download queue items for this series
  const seriesQueueItems = downloadManager.queue.filter(i => i.seriesId === series.id);
  const hasQueueItems = seriesQueueItems.length > 0;

  // Handle batch download — enqueues then starts
  const handleBatchDownload = () => {
    const notDownloaded = series.episodes.filter(ep => {
      const st = getStatus(series.id, ep.ep);
      return st === 'not_downloaded' && ep.file_id;
    });
    if (notDownloaded.length > 0) {
      downloadManager.enqueue(series.id, notDownloaded);
      setQueueOpen(true);
      // Start download after a tick
      setTimeout(() => downloadManager.startDownload(), 100);
    }
  };

  // Handle single episode download
  const handleSingleDownload = (epNum: string) => {
    const ep = series.episodes.find(e => e.ep === epNum);
    if (ep && ep.file_id) {
      downloadManager.enqueue(series.id, [ep]);
      setQueueOpen(true);
      setTimeout(() => downloadManager.startDownload(), 100);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative min-h-[400px] flex items-end px-[4%] pb-12 pt-24">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${g1}60, ${g2})` }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[16rem] font-light opacity-[0.03] font-display select-none">{meta.kanji}</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-40% to-bg-primary" />
        </div>

        <div className="relative z-10 w-full">
          <button onClick={() => navigate('/')} className="text-text-secondary hover:text-white mb-4 text-sm flex items-center gap-2 transition-colors">← Kembali</button>
          <p className="text-xs tracking-[6px] text-accent mb-2">{meta.kanji}</p>
          <h1 className="font-display text-[3.5rem] tracking-[3px] mb-2 leading-none">{series.title}</h1>

          <div className="flex flex-wrap gap-3 mb-4 text-sm text-text-secondary">
            <span className="flex items-center gap-1">📅 {meta.year}</span>
            <span className="flex items-center gap-1">📂 {series.episodes.length} episode</span>
            <span className="flex items-center gap-1">⏱ {series.episodes.reduce((a, e) => a + e.duration_min, 0)} min</span>
            {meta.genre.map(g => (
              <span key={g} className="border border-[#444] px-2 py-0.5 rounded text-xs">{g}</span>
            ))}
          </div>

          <p className="max-w-[700px] text-sm leading-relaxed text-text-secondary mb-5">{meta.synopsis}</p>

          <div className="max-w-[400px] mb-5">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>{progress.watched} watched</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-1 bg-[#333] rounded overflow-hidden">
              <div className="h-full bg-accent rounded transition-all duration-500" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={handleBatchDownload} className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-semibold rounded text-sm hover:bg-accent-hover transition-all">
              ⬇ Download Semua
            </button>
            <button onClick={() => setBatchStatus(series.id, allEps, 'watched')} className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#666] text-text-primary font-semibold rounded text-sm hover:border-white transition-all">
              ✓ Tandai Semua Watched
            </button>
            <button onClick={() => setBatchStatus(series.id, allEps, 'not_downloaded')} className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#444] text-text-muted font-semibold rounded text-sm hover:border-[#666] transition-all">
              ↺ Reset
            </button>
          </div>
        </div>
      </div>

      {/* Episode List */}
      <section className="px-[4%] py-4 pb-32">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold">Episodes</h2>
          {hasQueueItems && (
            <button onClick={() => setQueueOpen(!queueOpen)} className="text-xs bg-bg-surface border border-[#333] px-3 py-1.5 rounded-full hover:border-accent transition-colors flex items-center gap-1.5">
              📥 Queue
              <span className="bg-accent text-white rounded-full px-2 py-0.5 text-[0.6rem]">{seriesQueueItems.length}</span>
            </button>
          )}
        </div>

        {episodeGroups.map((group, gi) => (
          <div key={gi} className="mb-6">
            {group.arcName && (
              <div className="mb-3">
                <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ backgroundColor: `${group.arcColor}20`, color: group.arcColor || '#fff' }}>
                  {group.arcName}
                </span>
              </div>
            )}

            {group.episodes.map((ep) => {
              const status = getStatus(series.id, ep.ep);
              const split = isSplit(ep.ep);
              const queueItem = downloadManager.queue.find(q => q.seriesId === series.id && q.ep === ep.ep);

              return (
                <div key={ep.ep + ep.filename} className="flex items-center px-4 py-3 bg-bg-surface rounded-md mb-1 hover:bg-bg-surface-hover transition-all gap-4">
                  <span className="text-base font-bold text-text-muted min-w-[40px] text-center">{ep.ep}</span>

                  {split && (
                    <span className="text-[0.6rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-queued text-white">SPLIT</span>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-[0.85rem] font-medium truncate">{ep.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">{ep.duration_min} min</span>
                      {queueItem && queueItem.status === 'downloading' && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-20 h-1 bg-[#333] rounded overflow-hidden">
                            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${queueItem.progress}%` }} />
                          </div>
                          <span className="text-[0.6rem] text-accent">{queueItem.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <StatusPill status={status} onClick={() => cycleStatus(series.id, ep.ep)} />

                  <div className="flex gap-2">
                    {status === 'downloaded' || status === 'watched' ? (
                      <button onClick={() => navigate(`/player/${series.id}/${ep.ep}`)} className="w-9 h-9 rounded-full border border-[#444] flex items-center justify-center text-sm hover:bg-white hover:text-black hover:border-white transition-all" title="Play">▶</button>
                    ) : status === 'downloading' || status === 'queued' ? (
                      <button className="w-9 h-9 rounded-full border border-accent/30 flex items-center justify-center text-sm text-accent animate-pulse" title="Downloading...">⏳</button>
                    ) : (
                      <button onClick={() => handleSingleDownload(ep.ep)} className="w-9 h-9 rounded-full border border-[#444] flex items-center justify-center text-sm hover:border-accent hover:text-accent transition-all" title="Download">⬇</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {/* Download Queue Panel */}
      <div className={`fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-[#333] transition-transform duration-400 z-50 max-h-[40vh] overflow-y-auto ${queueOpen && hasQueueItems ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center justify-between px-[4%] py-3 border-b border-[#292929] sticky top-0 bg-bg-surface">
          <span className="text-sm font-semibold flex items-center gap-2">
            📥 Download Queue
            <span className="bg-accent text-white rounded-full px-2 py-0.5 text-[0.65rem]">{seriesQueueItems.length}</span>
          </span>
          <div className="flex gap-2">
            {downloadManager.isDownloading ? (
              <button onClick={downloadManager.pauseAll} className="text-xs bg-warning/20 text-warning px-3 py-1 rounded-full">⏸ Pause</button>
            ) : (
              <button onClick={downloadManager.resumeAll} className="text-xs bg-success/20 text-success px-3 py-1 rounded-full">▶ Resume</button>
            )}
            <button onClick={downloadManager.clearCompleted} className="text-xs bg-bg-surface-hover px-3 py-1 rounded-full text-text-muted">Clear Done</button>
            <button onClick={() => setQueueOpen(false)} className="text-text-muted hover:text-white transition-colors">✕</button>
          </div>
        </div>
        {seriesQueueItems.map(item => (
          <div key={item.ep} className="flex items-center px-[4%] py-2.5 gap-4 border-b border-[#222]">
            <span className={`text-[0.65rem] font-bold uppercase w-16 ${item.status === 'done' ? 'text-success' : item.status === 'downloading' ? 'text-accent' : item.status === 'error' ? 'text-red-400' : 'text-text-muted'}`}>
              {item.status === 'done' ? '✓ Done' : item.status === 'downloading' ? '⬇ DL...' : item.status === 'error' ? '✕ Error' : '⏳ Wait'}
            </span>
            <span className="flex-1 text-xs truncate">{item.filename}</span>
            <div className="w-[120px] h-1 bg-[#333] rounded overflow-hidden">
              <div className={`h-full rounded transition-all duration-300 ${item.status === 'done' ? 'bg-success' : 'bg-accent'}`} style={{ width: `${item.progress}%` }} />
            </div>
            <span className="text-[0.65rem] text-text-muted min-w-[35px] text-right">{item.progress}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
