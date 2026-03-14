/**
 * useDownloadManager v1.2b — Download engine for HexAnime
 *
 * ── Key features ──
 * 1. Explicit runtime permission request before any download (Android 13+)
 * 2. Google Drive API v3 endpoint (bypasses virus scan for large files)
 * 3. Directory.Documents for Android scoped storage compliance
 * 4. Detailed error logging with HTTP status codes
 *
 * GDrive URL: https://www.googleapis.com/drive/v3/files/{id}?alt=media&key={API_KEY}
 */

import { useState, useCallback, useRef } from 'react';
import type { Episode, DownloadQueueItem, EpisodeStatus } from '../types';

// ── Environment detection ──
const isCapacitor = !!(
  typeof window !== 'undefined' &&
  (window as unknown as Record<string, unknown>).Capacitor
);

// ── GDrive API v3 URL builder ──
const getGDriveUrl = (fileId: string): string => {
  const apiKey = import.meta.env.VITE_GDRIVE_API_KEY || '';
  if (!apiKey) {
    console.warn('[DL] ⚠️ VITE_GDRIVE_API_KEY not set! Downloads will fail.');
  }
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
};

// ── Constants ──
const LIBRARY_DIR = 'HexanimeLibrary';
const APP_VERSION = '1.2b';

interface UseDownloadManagerProps {
  setStatus: (seriesId: string, ep: string, status: EpisodeStatus) => void;
}

// ── Permission helper ──
async function requestStoragePermission(): Promise<boolean> {
  if (!isCapacitor) return true; // Browser mode — no permission needed

  try {
    const { Filesystem } = await import('@capacitor/filesystem');

    // Request filesystem permissions (triggers Android popup)
    const permResult = await Filesystem.requestPermissions();
    console.log('[Perm] Permission result:', JSON.stringify(permResult));

    // Check if granted — Capacitor returns { publicStorage: 'granted' | 'denied' | 'prompt' }
    const status = permResult.publicStorage;
    if (status === 'granted') {
      console.log('[Perm] ✅ Storage permission granted');
      return true;
    } else {
      console.error(`[Perm] ❌ Storage permission ${status}. User must enable in Settings.`);
      return false;
    }
  } catch (err) {
    console.error('[Perm] Permission request failed:', err);
    return false;
  }
}

export function useDownloadManager({ setStatus }: UseDownloadManagerProps) {
  const [queue, setQueue] = useState<DownloadQueueItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Enqueue episodes ──
  const enqueue = useCallback((seriesId: string, episodes: Episode[]) => {
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

    setQueue(prev => {
      const existing = new Set(prev.map(i => `${i.seriesId}_${i.ep}`));
      const filtered = newItems.filter(i => !existing.has(`${i.seriesId}_${i.ep}`));
      return [...prev, ...filtered];
    });

    episodes.forEach(ep => {
      if (ep.file_id) setStatus(seriesId, ep.ep, 'queued');
    });
  }, [setStatus]);

  // ── Dequeue ──
  const dequeue = useCallback((seriesId: string, ep: string) => {
    setQueue(prev => prev.filter(i => !(i.seriesId === seriesId && i.ep === ep)));
  }, []);

  // ── Clear completed ──
  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(i => i.status !== 'done'));
  }, []);

  // ── Start download queue ──
  const startDownload = useCallback(async () => {
    if (isDownloading) return;

    // ── TASK 1: Explicit runtime permission request ──
    if (isCapacitor) {
      const granted = await requestStoragePermission();
      if (!granted) {
        setPermissionError(true);
        console.error('[DL] ❌ Cannot download: storage permission denied');
        console.error('[DL] User harus enable permission di: Settings → Apps → Hexanime → Permissions → Storage');
        return;
      }
      setPermissionError(false);
    }

    setIsDownloading(true);
    setIsPaused(false);
    console.log(`[DL] 🚀 Starting download queue (v${APP_VERSION})`);

    const processNext = async () => {
      const currentQueue = queue;
      const nextItem = currentQueue.find(i => i.status === 'pending');
      if (!nextItem || isPaused) {
        setIsDownloading(false);
        console.log('[DL] Queue complete or paused');
        return;
      }

      const { seriesId, ep, file_id, path } = nextItem;

      // Mark downloading
      setQueue(prev => prev.map(i =>
        i.seriesId === seriesId && i.ep === ep
          ? { ...i, status: 'downloading' as const, progress: 0 }
          : i
      ));
      setStatus(seriesId, ep, 'downloading');

      try {
        abortControllerRef.current = new AbortController();

        if (isCapacitor) {
          // ══════════════════════════════════════════
          // CAPACITOR MODE: Real download to device
          // ══════════════════════════════════════════
          const { Filesystem, Directory } = await import('@capacitor/filesystem');

          // ── TASK 2: GDrive API v3 fetch ──
          const url = getGDriveUrl(file_id);
          console.log(`[DL] ⬇ Fetching: ${path}`);
          console.log(`[DL]   URL: ${url.slice(0, 90)}...`);

          const response = await fetch(url, {
            signal: abortControllerRef.current.signal,
          });

          // ── Detailed error logging ──
          if (!response.ok) {
            const statusCode = response.status;
            const statusText = response.statusText || 'Unknown';
            let errorBody = '';
            try { errorBody = await response.text(); } catch { /* ignore */ }
            console.error(`[DL] ❌ HTTP ${statusCode} ${statusText}`);
            console.error(`[DL]   file_id: ${file_id}`);
            console.error(`[DL]   body: ${errorBody.slice(0, 200)}`);

            if (statusCode === 403) {
              throw new Error(`Download denied (403). Check API key & file sharing settings.`);
            } else if (statusCode === 404) {
              throw new Error(`File not found (404). file_id may be invalid.`);
            } else {
              throw new Error(`Download failed: HTTP ${statusCode} ${statusText}`);
            }
          }

          const contentLength = Number(response.headers.get('content-length') || 0);
          const contentType = response.headers.get('content-type') || 'unknown';
          console.log(`[DL] ✓ Response OK | size: ${(contentLength / 1024 / 1024).toFixed(1)}MB | type: ${contentType}`);

          // ── Check for HTML virus warning (shouldn't happen with API v3, but safety check) ──
          if (contentType.includes('text/html')) {
            throw new Error('Received HTML instead of video. GDrive virus scan warning detected. Use API v3 with key.');
          }

          // ── Convert blob to base64 ──
          const blob = await response.blob();
          console.log(`[DL] Blob received: ${(blob.size / 1024 / 1024).toFixed(1)}MB`);

          // Update progress: fetch complete
          setQueue(prev => prev.map(i =>
            i.seriesId === seriesId && i.ep === ep ? { ...i, progress: 50 } : i
          ));

          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              if (!base64) {
                reject(new Error('Base64 conversion failed — empty result'));
                return;
              }
              resolve(base64);
            };
            reader.onerror = () => reject(new Error(`FileReader error: ${reader.error?.message}`));
            reader.readAsDataURL(blob);
          });

          // Update progress: base64 conversion complete
          setQueue(prev => prev.map(i =>
            i.seriesId === seriesId && i.ep === ep ? { ...i, progress: 75 } : i
          ));

          // ── TASK 4: Write to device storage ──
          // Directory.Documents = scoped storage compliant on Android 13+
          // Path: /Documents/HexanimeLibrary/{folder}/{filename}
          await Filesystem.writeFile({
            path: `${LIBRARY_DIR}/${path}`,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true, // auto-create subdirectories
          });

          console.log(`[DL] 💾 Written to Documents/${LIBRARY_DIR}/${path}`);

          // Progress: write complete
          setQueue(prev => prev.map(i =>
            i.seriesId === seriesId && i.ep === ep ? { ...i, progress: 100 } : i
          ));

        } else {
          // ══════════════════════════════════════════
          // BROWSER MODE: Simulated download
          // ══════════════════════════════════════════
          const totalSteps = 20;
          for (let step = 0; step <= totalSteps; step++) {
            if (isPaused || abortControllerRef.current?.signal.aborted) break;
            await new Promise(r => setTimeout(r, 150));
            const progress = Math.round((step / totalSteps) * 100);
            setQueue(prev => prev.map(i =>
              i.seriesId === seriesId && i.ep === ep ? { ...i, progress } : i
            ));
          }
        }

        // ── Mark as done ──
        setQueue(prev => prev.map(i =>
          i.seriesId === seriesId && i.ep === ep
            ? { ...i, status: 'done' as const, progress: 100 }
            : i
        ));
        setStatus(seriesId, ep, 'downloaded');
        console.log(`[DL] ✅ Complete: ${path}`);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[DL] ❌ Failed: ${path} — ${errorMsg}`);

        if (errorMsg.includes('abort')) {
          setQueue(prev => prev.map(i =>
            i.seriesId === seriesId && i.ep === ep
              ? { ...i, status: 'pending' as const, progress: 0 }
              : i
          ));
          setStatus(seriesId, ep, 'queued');
        } else {
          setQueue(prev => prev.map(i =>
            i.seriesId === seriesId && i.ep === ep
              ? { ...i, status: 'error' as const, error: errorMsg }
              : i
          ));
        }
      }

      // Process next item
      if (!isPaused) {
        await processNext();
      } else {
        setIsDownloading(false);
      }
    };

    await processNext();
  }, [isDownloading, isPaused, queue, setStatus]);

  // ── Pause ──
  const pauseAll = useCallback(() => {
    setIsPaused(true);
    abortControllerRef.current?.abort();
    console.log('[DL] ⏸ Paused');
  }, []);

  // ── Resume ──
  const resumeAll = useCallback(() => {
    setIsPaused(false);
    console.log('[DL] ▶ Resumed');
    startDownload();
  }, [startDownload]);

  // ── Storage Audit (TASK 4 — checkStorage) ──
  const checkStorage = useCallback(async (
    library: { id: string; episodes: Episode[] }[],
    getStatus: (sid: string, ep: string) => EpisodeStatus,
  ) => {
    if (!isCapacitor) {
      console.log(`[Audit] Browser mode — skip (v${APP_VERSION})`);
      return;
    }

    console.log(`[Audit] Starting integrity check (v${APP_VERSION})...`);
    let resetCount = 0;
    let verifiedCount = 0;

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      for (const series of library) {
        for (const ep of series.episodes) {
          const currentStatus = getStatus(series.id, ep.ep);
          if (currentStatus === 'downloaded' || currentStatus === 'watched') {
            try {
              // Stat the file at Documents/HexanimeLibrary/{path}
              const statResult = await Filesystem.stat({
                path: `${LIBRARY_DIR}/${ep.path}`,
                directory: Directory.Documents,
              });

              // Verify non-zero size (corrupted / incomplete download)
              if (statResult.size === 0) {
                setStatus(series.id, ep.ep, 'not_downloaded');
                resetCount++;
                console.warn(`[Audit] ⚠️ Empty file (0 bytes), reset: ${ep.path}`);
              } else {
                verifiedCount++;
              }
            } catch {
              // File missing from storage
              setStatus(series.id, ep.ep, 'not_downloaded');
              resetCount++;
              console.warn(`[Audit] ❌ File missing, reset: ${ep.path}`);
            }
          }
        }
      }

      console.log(`[Audit] ✅ Done. ${verifiedCount} verified, ${resetCount} reset.`);
    } catch (err) {
      console.error('[Audit] Filesystem check failed:', err);
    }
  }, [setStatus]);

  // ── Playback URL (TASK 4 — getPlaybackUrl) ──
  const getPlaybackUrl = useCallback(async (episode: Episode): Promise<string> => {
    if (isCapacitor) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        // Get the native file URI from Documents directory
        const result = await Filesystem.getUri({
          path: `${LIBRARY_DIR}/${episode.path}`,
          directory: Directory.Documents,
        });

        // Capacitor returns native URI like:
        //   file:///data/user/0/com.hexadev.hexanime/files/Documents/HexanimeLibrary/...
        // Android WebView can use this directly as <video src>
        const nativeUri = result.uri;
        console.log(`[Player] Resolved: ${nativeUri}`);
        return nativeUri;
      } catch (err) {
        console.warn(`[Player] File not found locally: ${episode.path}`, err);
        return '';
      }
    }
    // Browser mode — empty (player shows gradient placeholder)
    return '';
  }, []);

  return {
    queue,
    isDownloading,
    isPaused,
    permissionError,
    enqueue,
    dequeue,
    clearCompleted,
    startDownload,
    pauseAll,
    resumeAll,
    checkStorage,
    getPlaybackUrl,
    version: APP_VERSION,
  };
}
