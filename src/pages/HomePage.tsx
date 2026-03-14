import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Series, StatusMap, WatchOrder } from '../types';
import { SERIES_META, WATCH_ORDER_TV, WATCH_ORDER_CHRONOLOGICAL } from '../data/metadata';
import { getSeriesProgress } from '../hooks/useStore';
import Hero from '../components/Hero';
import SeriesCard from '../components/SeriesCard';

interface Props {
  library: Series[];
  statusMap: StatusMap;
  order: WatchOrder;
  searchQuery: string;
}

export default function HomePage({ library, statusMap, order, searchQuery }: Props) {
  // Featured series for hero
  const heroSeries = library.find(s => s.id === '01') || library[0];

  // Sort library by watch order
  const watchOrder = order === 'tv' ? WATCH_ORDER_TV : WATCH_ORDER_CHRONOLOGICAL;

  const sortedLibrary = useMemo(() => {
    // Get unique series IDs in watch order
    const seen = new Set<string>();
    const ordered: string[] = [];
    watchOrder.forEach(w => {
      if (!seen.has(w.seriesId)) { seen.add(w.seriesId); ordered.push(w.seriesId); }
    });
    // Add any remaining not in watch order
    library.forEach(s => {
      if (!seen.has(s.id)) { ordered.push(s.id); }
    });
    return ordered.map(id => library.find(s => s.id === id)).filter((s): s is Series => !!s);
  }, [library, watchOrder]);

  // Continue watching: series with at least 1 watched but not all
  const continueWatching = useMemo(() => {
    return library.filter(s => {
      const p = getSeriesProgress(s.id, s.episodes, statusMap);
      return p.watched > 0 && p.watched < p.total;
    });
  }, [library, statusMap]);

  // Search filter
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sortedLibrary;
    const q = searchQuery.toLowerCase();
    return sortedLibrary.filter(s => {
      const meta = SERIES_META[s.id];
      return s.title.toLowerCase().includes(q) || meta?.kanji.includes(q) || meta?.genre.some(g => g.toLowerCase().includes(q));
    });
  }, [sortedLibrary, searchQuery]);

  if (!library.length) return null;

  return (
    <div>
      {/* Hero */}
      {heroSeries && <Hero series={heroSeries} />}

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section id="continue" className="px-[4%] mb-8 -mt-16 relative z-10">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            ▶ Lanjutkan Menonton
            <span className="text-sm text-text-muted font-normal">{continueWatching.length}</span>
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {continueWatching.map(s => {
              const meta = SERIES_META[s.id];
              const progress = getSeriesProgress(s.id, s.episodes, statusMap);
              const [g1, g2] = meta?.gradient || ['#333', '#111'];
              // Find next episode to watch
              const nextEp = s.episodes.find(e => statusMap[s.id]?.[e.ep] !== 'watched');
              return (
                <Link
                  key={s.id}
                  to={`/detail/${s.id}`}
                  className="flex-shrink-0 w-[320px] bg-bg-card rounded-md overflow-hidden hover:scale-[1.03] hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all group"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                      <span className="w-12 h-12 rounded-full border-2 border-white bg-black/70 flex items-center justify-center text-lg group-hover:bg-white group-hover:text-black transition-all">▶</span>
                    </div>
                  </div>
                  <div className="h-1 bg-[#333]">
                    <div className="h-full bg-accent" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <div className="px-3.5 py-2.5">
                    <p className="text-[0.85rem] font-semibold">{s.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {nextEp ? `Ep ${nextEp.ep} · ${nextEp.duration_min}m` : `${progress.watched}/${progress.total} watched`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Library grid */}
      <section id="library" className="px-[4%] mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          📚 Library
          <span className="text-sm text-text-muted font-normal">{filtered.length} series</span>
          <span className="text-xs bg-bg-surface px-3 py-1 rounded-full border border-[#333] text-text-muted ml-2">
            {order === 'tv' ? '📺 TV Order' : '⏳ Chronological'}
          </span>
        </h2>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p className="text-3xl mb-4">🔍</p>
            <p>Tidak ada series ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {filtered.map((s, i) => (
              <SeriesCard key={s.id} series={s} statusMap={statusMap} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="px-[4%] pt-8 pb-6 border-t border-[#222] mt-8">
        <h3 className="font-display text-xl text-accent tracking-wider mb-2">HEXANIME</h3>
        <p className="text-xs text-text-muted leading-relaxed">Personal Anime Library Manager · Monogatari Series · Built for offline viewing</p>
      </footer>
    </div>
  );
}
