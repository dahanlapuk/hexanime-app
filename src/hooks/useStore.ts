import { useState, useEffect, useCallback } from 'react';
import type { Series, StatusMap, TimeMap, EpisodeStatus, WatchOrder } from '../types';

const isCapacitor = !!(
  typeof window !== 'undefined' &&
  (window as unknown as Record<string, unknown>).Capacitor
);

const LIBRARY_DIR = 'HexanimeLibrary';
const MIN_VALID_FILE_SIZE = 1 * 1024 * 1024; // 1MB

const STORAGE_KEYS = {
  status: 'hexanime_status',
  time: 'hexanime_time',
  order: 'hexanime_order',
} as const;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Fetch library.json
export function useLibrary() {
  const [library, setLibrary] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/library.json')
      .then(r => r.json())
      .then((data: Series[]) => { setLibrary(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { library, loading };
}

// Episode status management
export function useStatusMap() {
  const [statusMap, setStatusMap] = useState<StatusMap>(() => loadJSON(STORAGE_KEYS.status, {}));

  const getStatus = useCallback((seriesId: string, ep: string): EpisodeStatus => {
    return statusMap[seriesId]?.[ep] || 'not_downloaded';
  }, [statusMap]);

  const setStatus = useCallback((seriesId: string, ep: string, status: EpisodeStatus) => {
    setStatusMap(prev => {
      const next = { ...prev, [seriesId]: { ...prev[seriesId], [ep]: status } };
      saveJSON(STORAGE_KEYS.status, next);
      return next;
    });
  }, []);

  const setBatchStatus = useCallback((seriesId: string, eps: string[], status: EpisodeStatus) => {
    setStatusMap(prev => {
      const seriesStatus = { ...prev[seriesId] };
      eps.forEach(ep => { seriesStatus[ep] = status; });
      const next = { ...prev, [seriesId]: seriesStatus };
      saveJSON(STORAGE_KEYS.status, next);
      return next;
    });
  }, []);

  const cycleStatus = useCallback((seriesId: string, ep: string) => {
    const current = statusMap[seriesId]?.[ep] || 'not_downloaded';
    const order: EpisodeStatus[] = ['not_downloaded', 'downloaded', 'watched'];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    setStatus(seriesId, ep, next);
  }, [statusMap, setStatus]);

  return { statusMap, getStatus, setStatus, setBatchStatus, cycleStatus };
}

// Resume time management
export function useTimeMap() {
  const [timeMap, setTimeMap] = useState<TimeMap>(() => loadJSON(STORAGE_KEYS.time, {}));

  const getTime = useCallback((seriesId: string, ep: string): number => {
    return timeMap[`${seriesId}_${ep}`] || 0;
  }, [timeMap]);

  const saveTime = useCallback((seriesId: string, ep: string, seconds: number) => {
    setTimeMap(prev => {
      const next = { ...prev, [`${seriesId}_${ep}`]: seconds };
      saveJSON(STORAGE_KEYS.time, next);
      return next;
    });
  }, []);

  return { timeMap, getTime, saveTime };
}

// Watch order preference
export function useWatchOrder() {
  const [order, setOrderState] = useState<WatchOrder>(() =>
    (localStorage.getItem(STORAGE_KEYS.order) as WatchOrder) || 'tv'
  );

  const setOrder = useCallback((o: WatchOrder) => {
    setOrderState(o);
    localStorage.setItem(STORAGE_KEYS.order, o);
  }, []);

  return { order, setOrder };
}

// Get series progress
export function getSeriesProgress(seriesId: string, episodes: { ep: string }[], statusMap: StatusMap) {
  const watched = episodes.filter(e => statusMap[seriesId]?.[e.ep] === 'watched').length;
  const downloaded = episodes.filter(e => ['downloaded', 'watched'].includes(statusMap[seriesId]?.[e.ep] || '')).length;
  return { watched, downloaded, total: episodes.length, percent: episodes.length ? Math.round((watched / episodes.length) * 100) : 0 };
}

// Global Storage Verification
export async function verifyStorage(
  library: Series[],
  getStatus: (sid: string, ep: string) => EpisodeStatus,
  setStatus: (sid: string, ep: string, status: EpisodeStatus) => void
) {
  if (!isCapacitor) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hexadev-log', { detail: 'Browser mode: Skipping verifyStorage' }));
    }
    return;
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    let verified = 0;
    let corrupted = 0;

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
              window.dispatchEvent(new CustomEvent('hexadev-log', { 
                detail: `Corrupted file detected: ${ep.path} (${stat.size} bytes). Deleting.` 
              }));
              await Filesystem.deleteFile({
                path: `${LIBRARY_DIR}/${ep.path}`,
                directory: Directory.Data,
              });
              setStatus(series.id, ep.ep, 'not_downloaded');
              corrupted++;
            } else {
              verified++;
            }
          } catch (e) {
            setStatus(series.id, ep.ep, 'not_downloaded');
            corrupted++;
          }
        }
      }
    }
    
    if (corrupted > 0) {
      window.dispatchEvent(new CustomEvent('hexadev-log', { 
        detail: `verifyStorage complete: ${verified} OK, ${corrupted} corrupted/missing items reset.` 
      }));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    window.dispatchEvent(new CustomEvent('hexadev-log', { detail: `verifyStorage Failed: ${msg}` }));
  }
}
