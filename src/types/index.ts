export interface Episode {
  ep: string;
  filename: string;
  path: string;
  duration_min: number;
  status: EpisodeStatus;
  file_id: string;
  chrono_idx: number;
  release_idx: number;
  split_group: string | null;
}

export type EpisodeStatus = 'not_downloaded' | 'queued' | 'downloading' | 'downloaded' | 'watched';

export interface Series {
  id: string;
  folder_name: string;
  title: string;
  episodes: Episode[];
}

export interface SeriesMeta {
  synopsis: string;
  genre: string[];
  year: number;
  gradient: [string, string];
  kanji: string;
  arcs?: Arc[];
}

export interface Arc {
  name: string;
  prefix: string;
  eps: string[];
  color: string;
}

export interface WatchOrderEntry {
  seriesId: string;
  label: string;
  filterPrefix?: string;
  type: 'movie' | 'series' | 'arc';
}

export type WatchOrder = 'tv' | 'chronological';

export interface StatusMap {
  [seriesId: string]: { [ep: string]: EpisodeStatus };
}

export interface TimeMap {
  [key: string]: number; // "{seriesId}_{ep}" -> seconds
}

export interface DownloadQueueItem {
  seriesId: string;
  ep: string;
  filename: string;
  file_id: string;
  path: string;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'done' | 'error';
  error?: string;
}
