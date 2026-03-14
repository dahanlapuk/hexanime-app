/**
 * useDownloadManager v1.3.1 — Native Streaming Download Engine
 *
 * ── CHANGELOG from v1.3 ──
 * ✅ FIX 1: Pre-download mkdir to prevent immediate error on fresh install
 * ✅ FIX 2: HTTP status validation after downloadFile (detect saved HTML error pages)
 * ✅ FIX 3: resumeTicket counter forces useEffect re-fire on resume
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Episode, DownloadQueueItem, EpisodeStatus } from '../types';

// ── Environment ──
const isCapacitor = !!(
  typeof window !== 'undefined' &&
  (window as unknown as Record<string, unknown>).Capacitor
);

const LIBRARY_DIR = 'HexanimeLibrary';
const APP_VERSION = '1.3.1';
const MIN_VALID_FILE_SIZE = 1 * 1024 * 1024; // 1MB

// ── Debug Logger ──
function hexadevLog(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hexadev-log', { detail: message }));
  }
}

// ── GDrive API v3 URL ──
function getGDriveUrl(fileId: string): string {
  const apiKey = import.meta.env.VITE_GDRIVE_API_KEY || '';
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
}

// ── API Key Guard ──
function assertApiKey(): boolean {
  const key = import.meta.env.VITE_GDRIVE_API_KEY;
  if (!key) {
    const msg = 'Config Error: GDrive API Key is missing.\nSet VITE_GDRIVE_API_KEY in .env';
    console.error(`[DL] ❌ FATAL: ${msg}`);
    hexadevLog(msg);
    alert(msg);
    return false;
  }
  return true;
}

// ── Permission Request ──
async function requestStoragePermission(): Promise<boolean> {
  if (!isCapacitor) return true;

  try {
    const { Filesystem } = await import('@capacitor/filesystem');
    console.log('[Perm] Requesting storage permissions...');
    const result = await Filesystem.requestPermissions();
    console.log('[Perm] Result:', JSON.stringify(result));

    if (result.publicStorage === 'granted') {
      console.log('[Perm] ✅ Granted');
      return true;
    }

    const msg = `System Denied: READ_MEDIA_VIDEO / READ_EXTERNAL_STORAGE.\nAndroid API Level: Android 13+ (or legacy).\nStatus: ${result.publicStorage}`;
    console.error(`[Perm] ❌ ${msg}`);
    console.error('[Perm] User harus enable: Settings → Apps → Hexanime → Permissions');
    hexadevLog(msg);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Perm] ❌ Request failed:', msg);
    hexadevLog(`Permission Request Failed: ${msg}`);
    return false;
  }
}

// ── FIX 1: Ensure download directory exists ──
async function ensureDirectory(subPath?: string): Promise<void> {
  if (!isCapacitor) return;
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const dirPath = subPath ? `${LIBRARY_DIR}/${subPath}` : LIBRARY_DIR;
    await Filesystem.mkdir({
      path: dirPath,
      directory: Directory.Data,
      recursive: true,
    });
    console.log(`[DL] 📁 Directory ensured: Documents/${dirPath}`);
  } catch (err) {
    // mkdir throws if directory already exists — that's fine
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('exists') && !msg.includes('EEXIST')) {
      console.warn(`[DL] mkdir warning: ${msg}`);
      hexadevLog(`Directory Ensure Warning: ${msg}`);
    }
  }
}

interface UseDownloadManagerProps {
  setStatus: (seriesId: string, ep: string, status: EpisodeStatus) => void;
}

export function useDownloadManager({ setStatus }: UseDownloadManagerProps) {
  // Queue in useRef to avoid stale closures
  const [queueState, setQueueState] = useState<DownloadQueueItem[]>([]);
  const queueRef = useRef<DownloadQueueItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const isDownloadingRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [permissionError, setPermissionError] = useState(false);

  // FIX 3: Resume ticket — incrementing this forces useEffect to re-fire
  const [resumeTicket, setResumeTicket] = useState(0);

  // Sync ref with state
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

  // ── Process single item ──
  const processItem = useCallback(async (item: DownloadQueueItem) => {
    const { seriesId, ep, file_id, path } = item;
    console.log(`[DL] ▶ Start: ${path}`);

    updateQueue(prev => prev.map(i =>
      i.seriesId === seriesId && i.ep === ep
        ? { ...i, status: 'downloading' as const, progress: 0 }
        : i
    ));
    setStatus(seriesId, ep, 'downloading');

    try {
      if (isCapacitor) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        // ── FIX 1: Ensure parent directory exists before download ──
        const parentDir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : undefined;
        await ensureDirectory(parentDir);

        const url = getGDriveUrl(file_id);
        console.log(`[DL] ⬇ URL: ${url.slice(0, 90)}...`);
        console.log(`[DL]   Dest: Documents/${LIBRARY_DIR}/${path}`);

        // ── FIX 2: Pre-flight HTTP check before streaming ──
        // Quick HEAD request to validate the file_id & API key
        try {
          const headResp = await fetch(url, { method: 'HEAD' });
          if (!headResp.ok) {
            const status = headResp.status;
            if (status === 403) {
              throw new Error(`API Error (403 Forbidden): Check API key & file sharing. file_id=${file_id}`);
            } else if (status === 404) {
              throw new Error(`API Error (404 Not Found): Invalid file_id=${file_id}`);
            } else if (status === 401) {
              throw new Error(`API Error (401 Unauthorized): API key expired or invalid`);
            } else {
              throw new Error(`API Error (HTTP ${status}): ${headResp.statusText}`);
            }
          }
          const contentType = headResp.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            throw new Error(`API Error: GDrive returned HTML (virus scan page). file_id=${file_id}`);
          }
          const contentLength = Number(headResp.headers.get('content-length') || 0);
          console.log(`[DL] ✓ HEAD OK | ${(contentLength / 1024 / 1024).toFixed(1)}MB | ${contentType}`);
        } catch (headErr) {
          if (headErr instanceof Error && headErr.message.startsWith('API Error')) {
            throw headErr;
          }
          console.warn('[DL] HEAD request failed, trying download anyway:', headErr);
          // Don't hexadevLog here yet, it might still work during downloadFile
        }

        // ── Native streaming download ──
        const result = await Filesystem.downloadFile({
          url,
          path: `${LIBRARY_DIR}/${path}`,
          directory: Directory.Data,
          recursive: true,
          progress: true,
        });

        console.log(`[DL] 📁 Downloaded to: ${result.path}`);

        // ── Post-download integrity check ──
        const stat = await Filesystem.stat({
          path: `${LIBRARY_DIR}/${path}`,
          directory: Directory.Data,
        });

        if (stat.size < MIN_VALID_FILE_SIZE) {
          console.error(`[DL] ❌ File too small (${stat.size} bytes). Likely corrupted/error page.`);
          await Filesystem.deleteFile({
            path: `${LIBRARY_DIR}/${path}`,
            directory: Directory.Data,
          });
          throw new Error(`Download corrupted: only ${stat.size} bytes (expected >1MB). Possible GDrive error page saved.`);
        }

        console.log(`[DL] ✓ Verified: ${(stat.size / 1024 / 1024).toFixed(1)}MB`);

        updateQueue(prev => prev.map(i =>
          i.seriesId === seriesId && i.ep === ep
            ? { ...i, progress: 100, status: 'done' as const }
            : i
        ));
        setStatus(seriesId, ep, 'downloaded');
        console.log(`[DL] ✅ Complete: ${path}`);

      } else {
        // ── BROWSER MODE ──
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
        console.log(`[DL] ✅ Complete (sim): ${path}`);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[DL] ❌ Failed: ${path} — ${errorMsg}`);
      
      hexadevLog(`Download Failed (${ep}):\n${errorMsg}`);

      updateQueue(prev => prev.map(i =>
        i.seriesId === seriesId && i.ep === ep
          ? { ...i, status: 'error' as const, error: errorMsg }
          : i
      ));
    }
  }, [setStatus, updateQueue]);

  // ── Process queue ──
  const processQueue = useCallback(async () => {
    if (isDownloadingRef.current) return;
    if (!assertApiKey()) return;

    if (isCapacitor) {
      const granted = await requestStoragePermission();
      if (!granted) {
        setPermissionError(true);
        return;
      }
      setPermissionError(false);

      // FIX 1: Create base directory on first run
      await ensureDirectory();
    }

    isDownloadingRef.current = true;
    setIsDownloading(true);
    console.log(`[DL] 🚀 Queue processor started (v${APP_VERSION})`);

    // Progress listener
    let removeListener: (() => void) | null = null;
    if (isCapacitor) {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const handle = await Filesystem.addListener('progress', (progress) => {
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

  // ── Auto-start: fires when pending items appear OR resumeTicket changes ──
  useEffect(() => {
    const hasPending = queueState.some(i => i.status === 'pending');
    if (hasPending && !isDownloadingRef.current && !isPausedRef.current) {
      processQueue();
    }
  }, [queueState, processQueue, resumeTicket]);

  // ── Pause ──
  const pauseAll = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    console.log('[DL] ⏸ Pause requested');
  }, []);

  // ── FIX 3: Resume — increment ticket to force useEffect re-fire ──
  const resumeAll = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    setResumeTicket(t => t + 1);
    console.log('[DL] ▶ Resume requested');
  }, []);

  // ── Storage Audit ──
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
                directory: Directory.Data,
              });

              if (stat.size < MIN_VALID_FILE_SIZE) {
                console.warn(`[Audit] ⚠️ Corrupted (${stat.size}B < 1MB): ${ep.path}`);
                await Filesystem.deleteFile({
                  path: `${LIBRARY_DIR}/${ep.path}`,
                  directory: Directory.Data,
                });
                setStatus(series.id, ep.ep, 'not_downloaded');
                deleted++;
                reset++;
              } else {
                verified++;
              }
            } catch {
              setStatus(series.id, ep.ep, 'not_downloaded');
              reset++;
              console.warn(`[Audit] ❌ Missing: ${ep.path}`);
            }
          }
        }
      }

      console.log(`[Audit] ✅ Done. ${verified} OK, ${reset} reset, ${deleted} deleted.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Audit] ❌ Failed:', msg);
      hexadevLog(`Storage Audit Failed: ${msg}`);
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
