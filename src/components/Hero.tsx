import { useNavigate } from 'react-router-dom';
import type { Series } from '../types';
import { SERIES_META } from '../data/metadata';

interface Props {
  series: Series;
}

export default function Hero({ series }: Props) {
  const navigate = useNavigate();
  const meta = SERIES_META[series.id];
  const [g1, g2] = meta?.gradient || ['#333', '#111'];

  return (
    <section className="relative h-[85vh] min-h-[500px] max-h-[900px] flex items-end overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${g1}40, ${g2})` }}>
        {/* Kanji watermark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[20rem] font-light opacity-[0.04] font-display select-none">{meta?.kanji}</span>
        </div>
        {/* Bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-50% to-bg-primary" />
        {/* Left gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0fCC] to-transparent to-60%" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-[4%] pb-[8%] max-w-[560px]">
        <p className="text-sm tracking-[4px] text-accent mb-2 font-light">{meta?.kanji}</p>
        <h1 className="font-display text-[4rem] tracking-[3px] leading-none mb-3">{series.title}</h1>
        <div className="flex items-center gap-3 text-sm text-text-secondary mb-3">
          <span className="bg-accent text-white px-2 py-0.5 rounded text-xs font-bold">{meta?.year}</span>
          {meta?.genre.map(g => (
            <span key={g} className="border border-[#555] text-text-secondary px-2 py-0.5 rounded text-xs">{g}</span>
          ))}
          <span>{series.episodes.length} Episodes</span>
        </div>
        <p className="text-[0.95rem] leading-relaxed text-text-secondary mb-6 line-clamp-3">{meta?.synopsis}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/detail/${series.id}`)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black font-semibold rounded hover:bg-[#ddd] transition-all"
          >
            ▶ Tonton
          </button>
          <button
            onClick={() => navigate(`/detail/${series.id}`)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[rgba(109,109,110,0.7)] text-white font-semibold rounded hover:bg-[rgba(109,109,110,0.5)] transition-all"
          >
            ℹ Info
          </button>
        </div>
      </div>
    </section>
  );
}
