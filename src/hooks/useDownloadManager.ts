/**
 * useDownloadManager v2 — Download engine for HexAnime
 *
 * Uses Google Drive API v3 with API key to bypass virus scan warning on large files.
 * URL: https://www.googleapis.com/drive/v3/files/{FILE_ID}?alt=media&key={API_KEY}
 *
 * Capacitor mode: @capacitor/filesystem → Documents directory
 * Browser mode: Simulated progress for dev/testing
 */

import { useState, useCallback, useRef } from 'react';
import type { Episode, DownloadQueueItem, EpisodeStatus } from '../types';

// Detect Capacitor environment
const isCapacitor = typeof (window as unknown as Record<string, unknown>).Capacitor !== 'undefined';

// Google Drive API v3 download URL
const getGDriveUrl = (fileId: string): string => {
  const apiKey = import.meta.env.VITE_GDRIVE_API_KEY || '';
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
};

// Storage base path for Capacitor
const LIBRARY_DIR = 'HexanimeLibrary';

interface UseDownloadManagerProps {
  setStatus: (seriesId: string, ep: string, status: EpisodeStatus) => void;
}

export function useDownloadManager({ setStatus }: UseDownloadManagerProps) {
  const [queue, setQueue] = useState<DownloadQueueItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Add episode(s) to queue
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

  // Remove from queue
  const dequeue = useCallback((seriesId: string, ep: string) => {
    setQueue(prev => prev.filter(i => !(i.seriesId === seriesId && i.ep === ep)));
  }, []);

  // Clear completed from queue
  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(i => i.status !== 'done'));
  }, []);

  // Start downloading queue items
  const startDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setIsPaused(false);

    const processNext = async () => {
      const currentQueue = queue;
      const nextItem = currentQueue.find(i => i.status === 'pending');
      if (!nextItem || isPaused) {
        setIsDownloading(false);
        return;
      }

      const { seriesId, ep, file_id, path } = nextItem;

      // Update status → downloading
      setQueue(prev => prev.map(i =>
        i.seriesId === seriesId && i.ep === ep
          ? { ...i, status: 'downloading' as const, progress: 0 }
          : i
      ));
      setStatus(seriesId, ep, 'downloading');

      try {
        abortControllerRef.current = new AbortController();

        if (isCapacitor) {
          // ── CAPACITOR MODE: Real download to device ──
          const { Filesystem, Directory } = await import('@capacitor/filesystem');

          const url = getGDriveUrl(file_id);
          console.log(`[DL] Starting: ${path} from ${url.slice(0, 80)}...`);

          const response = await fetch(url, {
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const statusText = response.statusText || 'Unknown';
            console.error(`[DL] HTTP ${response.status} ${statusText} for file_id=${file_id}`);
            throw new Error(`Download failed: HTTP ${response.status} ${statusText}`);
          }

          const contentLength = Number(response.headers.get('content-length') || 0);
          console.log(`[DL] Response OK, size: ${(contentLength / 1024 / 1024).toFixed(1)}MB`);

          const blob = await response.blob();
          const reader = new FileReader();

          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              if (!base64) {
                reject(new Error('Failed to convert blob to base64'));
                return;
              }
              resolve(base64);
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsDataURL(blob);
          });

          // Write to device storage — Documents directory for Android 13+ scoped storage
          await Filesystem.writeFile({
            path: `${LIBRARY_DIR}/${path}`,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });

          console.log(`[DL] Written to Documents/${LIBRARY_DIR}/${path}`);

          // Update progress to 100
          setQueue(prev => prev.map(i =>
            i.seriesId === seriesId && i.ep === ep ? { ...i, progress: 100 } : i
          ));

        } else {
          // ── BROWSER MODE: Simulate download with progress ──
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

        // Mark as done
        setQueue(prev => prev.map(i =>
          i.seriesId === seriesId && i.ep === ep
            ? { ...i, status: 'done' as const, progress: 100 }
            : i
        ));
        setStatus(seriesId, ep, 'downloaded');
        console.log(`[DL] ✅ Complete: ${path}`);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[DL] ❌ Error downloading ${path}:`, errorMsg);

        if (errorMsg.includes('abort')) {
          // Paused by user
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

      // Process next
      if (!isPaused) {
        await processNext();
      } else {
        setIsDownloading(false);
      }
    };

    await processNext();
  }, [isDownloading, isPaused, queue, setStatus]);

  // Pause all downloads
  const pauseAll = useCallback(() => {
    setIsPaused(true);
    abortControllerRef.current?.abort();
    console.log('[DL] ⏸ Paused');
  }, []);

  // Resume downloads
  const resumeAll = useCallback(() => {
    setIsPaused(false);
    console.log('[DL] ▶ Resumed');
    startDownload();
  }, [startDownload]);

  // ── Storage Audit ──
  // Verify downloaded files still exist on device (Capacitor only)
  const checkStorage = useCallback(async (
    library: { id: string; episodes: Episode[] }[],
    getStatus: (sid: string, ep: string) => EpisodeStatus,
  ) => {
    if (!isCapacitor) {
      console.log('[Audit] Browser mode — skipping storage audit');
      return;
    }

    console.log('[Audit] Starting storage integrity check...');
    let resetCount = 0;

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      for (const series of library) {
        for (const ep of series.episodes) {
          const currentStatus = getStatus(series.id, ep.ep);
          if (currentStatus === 'downloaded' || currentStatus === 'watched') {
            try {
              const statResult = await Filesystem.stat({
                path: `${LIBRARY_DIR}/${ep.path}`,
                directory: Directory.Documents,
              });
              // File exists — verify it has non-zero size
              if (statResult.size === 0) {
                setStatus(series.id, ep.ep, 'not_downloaded');
                resetCount++;
                console.warn(`[Audit] Empty file, reset: ${ep.path}`);
              }
            } catch {
              // File missing — reset to not_downloaded
              setStatus(series.id, ep.ep, 'not_downloaded');
              resetCount++;
              console.warn(`[Audit] File missing, reset: ${ep.path}`);
            }
          }
        }
      }

      console.log(`[Audit] ✅ Complete. ${resetCount} files reset to not_downloaded`);
    } catch (err) {
      console.error('[Audit] Filesystem check failed:', err);
    }
  }, [setStatus]);

  // ── Get Playback URL ──
  // Returns the native file URI for downloaded files, or empty string
  const getPlaybackUrl = useCallback(async (episode: Episode): Promise<string> => {
    if (isCapacitor) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const result = await Filesystem.getUri({
          path: `${LIBRARY_DIR}/${episode.path}`,
          directory: Directory.Documents,
        });
        // Capacitor returns a native URI like:
        // file:///data/user/0/com.hexadev.hexanime/files/Documents/HexanimeLibrary/...
        // WebView can play this directly via <video src="...">
        const uri = result.uri;
        console.log(`[Player] Resolved URI: ${uri}`);
        return uri;
      } catch (err) {
        console.warn(`[Player] File not found: ${episode.path}`, err);
        return '';
      }
    } else {
      // Browser mode — return empty (player shows gradient placeholder)
      return '';
    }
  }, []);

  return {
    queue,
    isDownloading,
    isPaused,
    enqueue,
    dequeue,
    clearCompleted,
    startDownload,
    pauseAll,
    resumeAll,
    checkStorage,
    getPlaybackUrl,
  };
}
