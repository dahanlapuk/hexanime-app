import { useNavigate } from 'react-router-dom';
import type { Series, StatusMap } from '../types';
import { SERIES_META } from '../data/metadata';
import { getSeriesProgress } from '../hooks/useStore';

interface Props {
  series: Series;
  statusMap: StatusMap;
  index: number;
}

export default function SeriesCard({ series, statusMap, index }: Props) {
  const navigate = useNavigate();
  const meta = SERIES_META[series.id];
  const progress = getSeriesProgress(series.id, series.episodes, statusMap);
  const [g1, g2] = meta?.gradient || ['#333', '#111'];

  return (
    <div
      onClick={() => navigate(`/detail/${series.id}`)}
      className="group relative rounded-md overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:z-10 bg-bg-card"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Cover gradient */}
      <div className="w-full aspect-[2/3] relative overflow-hidden">
        <div
          className="w-full h-full flex flex-col items-center justify-center p-4 text-center"
          style={{ background: `linear-gradient(145deg, ${g1}, ${g2})` }}
        >
          <span className="text-3xl font-light opacity-40 mb-2">{meta?.kanji}</span>
          <span className="font-display text-xl tracking-wider leading-tight">{series.title}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Info */}
      <div className="p-2.5 pb-3">
        <p className="text-[0.82rem] font-semibold truncate mb-1">{series.title}</p>
        <div className="flex items-center justify-between text-[0.7rem] text-text-muted mb-1.5">
          <span>{meta?.year}</span>
          <span>{progress.watched}/{progress.total} ep</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-[3px] bg-[#333] rounded-sm overflow-hidden">
          <div className="h-full bg-accent rounded-sm transition-all duration-500" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 text-center">
        <button className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-lg hover:bg-white hover:text-black transition-all">
          ▶
        </button>
        <p className="text-[0.7rem] leading-relaxed text-text-secondary line-clamp-4">{meta?.synopsis}</p>
        <div className="flex gap-1 flex-wrap justify-center">
          {meta?.genre.slice(0, 3).map(g => (
            <span key={g} className="text-[0.6rem] border border-[#555] px-2 py-0.5 rounded text-text-muted">{g}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
