/**
 * useDownloadManager — Download engine for HexAnime
 *
 * Browser mode: Simulates download via GDrive direct URL (for dev/testing)
 * Capacitor mode: Uses @capacitor/filesystem to write files to device storage
 *
 * GDrive direct download URL: https://drive.google.com/uc?export=download&id={FILE_ID}
 */

import { useState, useCallback, useRef } from 'react';
import type { Episode, DownloadQueueItem, EpisodeStatus } from '../types';

// Detect Capacitor environment
const isCapacitor = typeof (window as unknown as Record<string, unknown>).Capacitor !== 'undefined';

// GDrive download URL builder
const getGDriveUrl = (fileId: string) =>
  `https://drive.google.com/uc?export=download&id=${fileId}`;

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
      .filter(ep => ep.file_id) // only if has file_id
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
      // Don't add duplicates
      const existing = new Set(prev.map(i => `${i.seriesId}_${i.ep}`));
      const filtered = newItems.filter(i => !existing.has(`${i.seriesId}_${i.ep}`));
      return [...prev, ...filtered];
    });

    // Mark as queued in status
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
      // Find next pending item
      const currentQueue = queue;
      const nextItem = currentQueue.find(i => i.status === 'pending');
      if (!nextItem || isPaused) {
        setIsDownloading(false);
        return;
      }

      const { seriesId, ep, file_id, path } = nextItem;

      // Update queue item status
      setQueue(prev => prev.map(i =>
        i.seriesId === seriesId && i.ep === ep
          ? { ...i, status: 'downloading' as const, progress: 0 }
          : i
      ));
      setStatus(seriesId, ep, 'downloading');

      try {
        abortControllerRef.current = new AbortController();

        if (isCapacitor) {
          // --- CAPACITOR MODE: Real download to device ---
          // Dynamic import to avoid breaking web builds
          const { Filesystem, Directory } = await import('@capacitor/filesystem');

          const url = getGDriveUrl(file_id);
          const response = await fetch(url, {
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) throw new Error(`Download failed: ${response.status}`);

          const blob = await response.blob();
          const reader = new FileReader();

          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Write to device storage
          await Filesystem.writeFile({
            path: `${LIBRARY_DIR}/${path}`,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });

          // Simulate progress stages
          for (let p = 0; p <= 100; p += 25) {
            setQueue(prev => prev.map(i =>
              i.seriesId === seriesId && i.ep === ep ? { ...i, progress: p } : i
            ));
          }
        } else {
          // --- BROWSER MODE: Simulate download with progress ---
          const totalSteps = 20;
          for (let step = 0; step <= totalSteps; step++) {
            if (isPaused || abortControllerRef.current?.signal.aborted) break;
            await new Promise(r => setTimeout(r, 150)); // simulate network delay
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

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
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

      // Process next item
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
  }, []);

  // Resume downloads
  const resumeAll = useCallback(() => {
    setIsPaused(false);
    startDownload();
  }, [startDownload]);

  // Check storage — verify downloaded files still exist (Capacitor only)
  const checkStorage = useCallback(async (
    library: { id: string; episodes: Episode[] }[],
    getStatus: (sid: string, ep: string) => EpisodeStatus,
  ) => {
    if (!isCapacitor) return;

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      for (const series of library) {
        for (const ep of series.episodes) {
          const currentStatus = getStatus(series.id, ep.ep);
          if (currentStatus === 'downloaded' || currentStatus === 'watched') {
            try {
              await Filesystem.stat({
                path: `${LIBRARY_DIR}/${ep.path}`,
                directory: Directory.Documents,
              });
              // File exists — status OK
            } catch {
              // File missing — reset to not_downloaded
              setStatus(series.id, ep.ep, 'not_downloaded');
              console.warn(`[Audit] File missing, reset: ${ep.path}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Audit] Filesystem check failed:', err);
    }
  }, [setStatus]);

  // Get file URL for playback
  const getPlaybackUrl = useCallback(async (episode: Episode): Promise<string> => {
    if (isCapacitor) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const result = await Filesystem.getUri({
          path: `${LIBRARY_DIR}/${episode.path}`,
          directory: Directory.Documents,
        });
        // Convert Capacitor URI to web-viewable URL
        return result.uri;
      } catch {
        return '';
      }
    } else {
      // Browser mode: use GDrive streaming URL (may have CORS issues)
      // For dev, return empty — player shows gradient placeholder
      return episode.file_id ? getGDriveUrl(episode.file_id) : '';
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
