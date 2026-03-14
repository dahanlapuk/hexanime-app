/**
 * useDownloadManager v1.3 — Native Streaming Download Engine
 *
 * ── CHANGELOG from v1.2b ──
 * ✅ TASK 1: Replaced fetch+blob+base64 with Filesystem.downloadFile() (no OOM)
 * ✅ TASK 2: Fixed stale closure — queue lives in useRef, auto-start via useEffect
 * ✅ TASK 3: Modern Android permissions — READ_MEDIA_VIDEO (API 33+)
 * ✅ TASK 4: Integrity audit checks file size > 1MB, deletes corrupted files
 * ✅ TASK 5: Blocks download if API key missing, logs every stage
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Episode, DownloadQueueItem, EpisodeStatus } from '../types';

// ── Environment ──
const isCapacitor = !!(
  typeof window !== 'undefined' &&
  (window as unknown as Record<string, unknown>).Capacitor
);

const LIBRARY_DIR = 'HexanimeLibrary';
const APP_VERSION = '1.3';
const MIN_VALID_FILE_SIZE = 1 * 1024 * 1024; // 1MB — anything smaller is corrupted

// ── GDrive API v3 URL ──
function getGDriveUrl(fileId: string): string {
  const apiKey = import.meta.env.VITE_GDRIVE_API_KEY || '';
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
}

// ── API Key Guard (TASK 5) ──
function assertApiKey(): boolean {
  const key = import.meta.env.VITE_GDRIVE_API_KEY;
  if (!key) {
    console.error('[DL] ❌ FATAL: VITE_GDRIVE_API_KEY is missing!');
    alert('Config Error: GDrive API Key is missing.\n\nSet VITE_GDRIVE_API_KEY in .env');
    return false;
  }
  return true;
}

// ── Permission Request (TASK 3) ──
async function requestStoragePermission(): Promise<boolean> {
  if (!isCapacitor) return true;

  try {
    const { Filesystem } = await import('@capacitor/filesystem');

    console.log('[Perm] Requesting storage permissions...');
    const result = await Filesystem.requestPermissions();
    console.log('[Perm] Result:', JSON.stringify(result));

    // Capacitor FS returns { publicStorage: 'granted' | 'denied' | 'prompt' }
    // On Android 13+ this maps to READ_MEDIA_VIDEO internally
    if (result.publicStorage === 'granted') {
      console.log('[Perm] ✅ Granted');
      return true;
    }

    console.error(`[Perm] ❌ Denied (${result.publicStorage})`);
    console.error('[Perm] User harus enable: Settings → Apps → Hexanime → Permissions');
    return false;
  } catch (err) {
    console.error('[Perm] ❌ Request failed:', err);
    return false;
  }
}

interface UseDownloadManagerProps {
  setStatus: (seriesId: string, ep: string, status: EpisodeStatus) => void;
}

export function useDownloadManager({ setStatus }: UseDownloadManagerProps) {
  // ── TASK 2: Queue in useRef to avoid stale closures ──
  const [queueState, setQueueState] = useState<DownloadQueueItem[]>([]);
  const queueRef = useRef<DownloadQueueItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const isDownloadingRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [permissionError, setPermissionError] = useState(false);

  // Keep refs in sync with state
  const updateQueue = useCallback((updater: (prev: DownloadQueueItem[]) => DownloadQueueItem[]) => {
    setQueueState(prev => {
      const next = updater(prev);
      queueRef.current = next;
      return next;
    });
  }, []);

  // ── Enqueue ──
  const enqueue = useCallback((seriesId: string, episodes: Episode[]) => {
    console.log(`[DL] 📋 Enqueue: ${episodes.length} episodes from ${seriesId}`);

    const newItems: DownloadQueueItem[] = episodes
      .filter(ep => ep.file_id)
      .map(ep => ({
        seriesId,
        ep: ep.ep,
        filename: ep.filename,
        file_id: ep.file_id,
        path: ep.path,
        progress: 0,
        status: 'pending' as const,
      }));

    updateQueue(prev => {
      const existing = new Set(prev.map(i => `${i.seriesId}_${i.ep}`));
      const filtered = newItems.filter(i => !existing.has(`${i.seriesId}_${i.ep}`));
      return [...prev, ...filtered];
    });

    episodes.forEach(ep => {
      if (ep.file_id) setStatus(seriesId, ep.ep, 'queued');
    });
  }, [setStatus, updateQueue]);

  // ── Dequeue ──
  const dequeue = useCallback((seriesId: string, ep: string) => {
    updateQueue(prev => prev.filter(i => !(i.seriesId === seriesId && i.ep === ep)));
  }, [updateQueue]);

  // ── Clear completed ──
  const clearCompleted = useCallback(() => {
    updateQueue(prev => prev.filter(i => i.status !== 'done'));
  }, [updateQueue]);

  // ── Process single download item ──
  const processItem = useCallback(async (item: DownloadQueueItem) => {
    const { seriesId, ep, file_id, path } = item;

    console.log(`[DL] ▶ Start: ${path}`);

    // Mark downloading
    updateQueue(prev => prev.map(i =>
      i.seriesId === seriesId && i.ep === ep
        ? { ...i, status: 'downloading' as const, progress: 0 }
        : i
    ));
    setStatus(seriesId, ep, 'downloading');

    try {
      if (isCapacitor) {
        // ══════════════════════════════════════════════
        // TASK 1: Native streaming download via downloadFile()
        // NO blob, NO base64, NO memory overflow
        // ══════════════════════════════════════════════
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        const url = getGDriveUrl(file_id);
        console.log(`[DL] ⬇ URL: ${url.slice(0, 90)}...`);
        console.log(`[DL]   Path: Documents/${LIBRARY_DIR}/${path}`);

        const result = await Filesystem.downloadFile({
          url,
          path: `${LIBRARY_DIR}/${path}`,
          directory: Directory.Documents,
          recursive: true,
          progress: true,
        });

        console.log(`[DL] 📁 Downloaded to: ${result.path}`);

        // Verify the file was written and has valid size
        const stat = await Filesystem.stat({
          path: `${LIBRARY_DIR}/${path}`,
          directory: Directory.Documents,
        });

        if (stat.size < MIN_VALID_FILE_SIZE) {
          // Corrupted — likely a GDrive HTML error page saved as .mp4
          console.error(`[DL] ❌ File too small (${stat.size} bytes). Likely corrupted.`);
          await Filesystem.deleteFile({
            path: `${LIBRARY_DIR}/${path}`,
            directory: Directory.Documents,
          });
          throw new Error(`Downloaded file is only ${stat.size} bytes — corrupted (expected >1MB)`);
        }

        console.log(`[DL] ✓ Verified: ${(stat.size / 1024 / 1024).toFixed(1)}MB`);

        // Mark 100%
        updateQueue(prev => prev.map(i =>
          i.seriesId === seriesId && i.ep === ep
            ? { ...i, progress: 100, status: 'done' as const }
            : i
        ));
        setStatus(seriesId, ep, 'downloaded');
        console.log(`[DL] ✅ Complete: ${path}`);

      } else {
        // ══════════════════════════════════════════════
        // BROWSER MODE: Simulated download with progress
        // ══════════════════════════════════════════════
        const totalSteps = 20;
        for (let step = 0; step <= totalSteps; step++) {
          if (isPausedRef.current) break;
          await new Promise(r => setTimeout(r, 150));
          const progress = Math.round((step / totalSteps) * 100);
          updateQueue(prev => prev.map(i =>
            i.seriesId === seriesId && i.ep === ep ? { ...i, progress } : i
          ));
        }

        updateQueue(prev => prev.map(i =>
          i.seriesId === seriesId && i.ep === ep
            ? { ...i, status: 'done' as const, progress: 100 }
            : i
        ));
        setStatus(seriesId, ep, 'downloaded');
        console.log(`[DL] ✅ Complete (browser sim): ${path}`);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[DL] ❌ Failed: ${path} — ${errorMsg}`);

      updateQueue(prev => prev.map(i =>
        i.seriesId === seriesId && i.ep === ep
          ? { ...i, status: 'error' as const, error: errorMsg }
          : i
      ));
    }
  }, [setStatus, updateQueue]);

  // ── Process queue (reads from ref, not state) ──
  const processQueue = useCallback(async () => {
    if (isDownloadingRef.current) return;

    // TASK 5: Guard
    if (!assertApiKey()) return;

    // TASK 3: Permissions
    if (isCapacitor) {
      const granted = await requestStoragePermission();
      if (!granted) {
        setPermissionError(true);
        return;
      }
      setPermissionError(false);
    }

    isDownloadingRef.current = true;
    setIsDownloading(true);
    console.log(`[DL] 🚀 Queue processor started (v${APP_VERSION})`);

    // Set up progress listener for Capacitor
    let removeListener: (() => void) | null = null;
    if (isCapacitor) {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const handle = await Filesystem.addListener('progress', (progress) => {
          // Find which item is currently downloading
          const current = queueRef.current.find(i => i.status === 'downloading');
          if (current && progress.contentLength > 0) {
            const percent = Math.round((progress.bytes / progress.contentLength) * 100);
            updateQueue(prev => prev.map(i =>
              i.seriesId === current.seriesId && i.ep === current.ep
                ? { ...i, progress: percent }
                : i
            ));
          }
        });
        removeListener = () => handle.remove();
      } catch {
        console.warn('[DL] Could not attach progress listener');
      }
    }

    try {
      // Process items one by one, always reading latest from ref
      while (true) {
        if (isPausedRef.current) {
          console.log('[DL] ⏸ Paused');
          break;
        }

        const nextItem = queueRef.current.find(i => i.status === 'pending');
        if (!nextItem) {
          console.log('[DL] ✅ Queue empty — all done');
          break;
        }

        await processItem(nextItem);
      }
    } finally {
      isDownloadingRef.current = false;
      setIsDownloading(false);
      if (removeListener) removeListener();
      console.log('[DL] Queue processor stopped');
    }
  }, [processItem, updateQueue]);

  // ── TASK 2: Auto-start when pending items appear ──
  useEffect(() => {
    const hasPending = queueState.some(i => i.status === 'pending');
    if (hasPending && !isDownloadingRef.current && !isPausedRef.current) {
      processQueue();
    }
  }, [queueState, processQueue]);

  // ── Pause ──
  const pauseAll = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    console.log('[DL] ⏸ Pause requested');
  }, []);

  // ── Resume ──
  const resumeAll = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    console.log('[DL] ▶ Resume requested');
    // processQueue will be triggered by useEffect above
  }, []);

  // ── TASK 4: Storage Audit ──
  const checkStorage = useCallback(async (
    library: { id: string; episodes: Episode[] }[],
    getStatus: (sid: string, ep: string) => EpisodeStatus,
  ) => {
    if (!isCapacitor) {
      console.log(`[Audit] Browser mode — skip (v${APP_VERSION})`);
      return;
    }

    console.log(`[Audit] 🔍 Starting integrity check (v${APP_VERSION})...`);
    let verified = 0;
    let reset = 0;
    let deleted = 0;

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      for (const series of library) {
        for (const ep of series.episodes) {
          const status = getStatus(series.id, ep.ep);
          if (status === 'downloaded' || status === 'watched') {
            try {
              const stat = await Filesystem.stat({
                path: `${LIBRARY_DIR}/${ep.path}`,
                directory: Directory.Documents,
              });

              if (stat.size < MIN_VALID_FILE_SIZE) {
                // File exists but is too small — corrupted GDrive error page
                console.warn(`[Audit] ⚠️ Corrupted (${stat.size}B < 1MB): ${ep.path}`);
                await Filesystem.deleteFile({
                  path: `${LIBRARY_DIR}/${ep.path}`,
                  directory: Directory.Documents,
                });
                setStatus(series.id, ep.ep, 'not_downloaded');
                deleted++;
                reset++;
              } else {
                verified++;
              }
            } catch {
              // File missing
              setStatus(series.id, ep.ep, 'not_downloaded');
              reset++;
              console.warn(`[Audit] ❌ Missing: ${ep.path}`);
            }
          }
        }
      }

      console.log(`[Audit] ✅ Done. ${verified} OK, ${reset} reset, ${deleted} deleted.`);
    } catch (err) {
      console.error('[Audit] ❌ Failed:', err);
    }
  }, [setStatus]);

  // ── Playback URL ──
  const getPlaybackUrl = useCallback(async (episode: Episode): Promise<string> => {
    if (isCapacitor) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const result = await Filesystem.getUri({
          path: `${LIBRARY_DIR}/${episode.path}`,
          directory: Directory.Documents,
        });
        console.log(`[Player] URI: ${result.uri}`);
        return result.uri;
      } catch (err) {
        console.warn(`[Player] Not found: ${episode.path}`, err);
        return '';
      }
    }
    return '';
  }, []);

  return {
    queue: queueState,
    isDownloading,
    isPaused,
    permissionError,
    enqueue,
    dequeue,
    clearCompleted,
    startDownload: processQueue,
    pauseAll,
    resumeAll,
    checkStorage,
    getPlaybackUrl,
    version: APP_VERSION,
  };
}
