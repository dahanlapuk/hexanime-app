import { useParams, useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect, useCallback } from 'react';
import type { Series, Episode, EpisodeStatus } from '../types';
import { SERIES_META } from '../data/metadata';

interface Props {
  library: Series[];
  getStatus: (sid: string, ep: string) => EpisodeStatus;
  setStatus: (sid: string, ep: string, status: EpisodeStatus) => void;
  getTime: (sid: string, ep: string) => number;
  saveTime: (sid: string, ep: string, seconds: number) => void;
  getPlaybackUrl: (episode: Episode) => Promise<string>;
}

export default function PlayerPage({ library, getStatus, setStatus, getTime, saveTime, getPlaybackUrl }: Props) {
  const { seriesId, ep } = useParams<{ seriesId: string; ep: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showUpNext, setShowUpNext] = useState(false);
  const [videoSrc, setVideoSrc] = useState('');
  const overlayTimer = useRef<ReturnType<typeof setTimeout>>();
  const saveInterval = useRef<ReturnType<typeof setInterval>>();

  const series = library.find(s => s.id === seriesId);
  const meta = seriesId ? SERIES_META[seriesId] : undefined;
  const episodes = series?.episodes || [];
  const currentIdx = episodes.findIndex(e => e.ep === ep);
  const currentEp = currentIdx >= 0 ? episodes[currentIdx] : null;

  // ── Split Group Chain Logic ──
  // If current ep has split_group (e.g. "owari_01"), find next ep in SAME group.
  // Only if no more in group → jump to next episode in normal order.
  const getNextEp = useCallback((): Episode | null => {
    if (currentIdx < 0 || !currentEp) return null;

    // If current episode has a split_group, try to find next split part
    if (currentEp.split_group) {
      const nextInGroup = episodes.find((e, i) =>
        i > currentIdx && e.split_group === currentEp.split_group
      );
      if (nextInGroup) return nextInGroup;
    }

    // Normal next: find next episode (skip remaining splits we already completed)
    for (let i = currentIdx + 1; i < episodes.length; i++) {
      const candidate = episodes[i];
      // If candidate is part of a group we're already past, skip it
      if (candidate.split_group && candidate.split_group === currentEp.split_group) continue;
      return candidate;
    }
    return null;
  }, [currentIdx, currentEp, episodes]);

  const getPrevEp = useCallback((): Episode | null => {
    if (currentIdx <= 0) return null;
    return episodes[currentIdx - 1];
  }, [currentIdx, episodes]);

  const nextEp = getNextEp();
  const prevEp = getPrevEp();
  const isSplitChain = currentEp?.split_group && nextEp?.split_group === currentEp.split_group;

  // ── Load video source ──
  useEffect(() => {
    if (currentEp) {
      getPlaybackUrl(currentEp).then(url => {
        setVideoSrc(url);
      });
    }
  }, [currentEp, getPlaybackUrl]);

  // ── Overlay auto-hide ──
  const handleMouseMove = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => {
      if (playing) setShowOverlay(false);
    }, 3000);
  }, [playing]);

  // ── Resume from saved position ──
  useEffect(() => {
    if (videoRef.current && seriesId && ep) {
      const saved = getTime(seriesId, ep);
      if (saved > 0) videoRef.current.currentTime = saved;
    }
  }, [seriesId, ep, getTime]);

  // ── Save position every 5 seconds ──
  useEffect(() => {
    saveInterval.current = setInterval(() => {
      if (videoRef.current && seriesId && ep && playing) {
        saveTime(seriesId, ep, videoRef.current.currentTime);
      }
    }, 5000);
    return () => { if (saveInterval.current) clearInterval(saveInterval.current); };
  }, [seriesId, ep, playing, saveTime]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const ct = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurTime(ct);
    setDuration(dur);

    // Show "Up Next" 20s before end (unless it's a split chain → seamless)
    if (dur > 0 && dur - ct <= 20 && nextEp && !isSplitChain) {
      setShowUpNext(true);
    } else {
      setShowUpNext(false);
    }
  };

  // ── Episode ended ──
  const handleEnded = () => {
    if (seriesId && ep) {
      setStatus(seriesId, ep, 'watched');
      saveTime(seriesId, ep, 0); // reset resume position
    }

    if (nextEp && seriesId) {
      if (isSplitChain) {
        // Split chain: navigate instantly, no menu interruption
        navigate(`/player/${seriesId}/${nextEp.ep}`, { replace: true });
      } else {
        // Normal auto-next
        navigate(`/player/${seriesId}/${nextEp.ep}`, { replace: true });
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * (videoRef.current.duration || 0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const seekPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const [g1, g2] = meta?.gradient || ['#333', '#111'];
  const isSplit = ep && /^\d+[a-z]$/.test(ep);

  if (!series || !currentEp) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-[2000]">
        <div className="text-center">
          <p className="text-text-muted mb-4">Episode not found</p>
          <button onClick={() => navigate(-1)} className="text-accent hover:underline">← Kembali</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[2000] flex flex-col" onMouseMove={handleMouseMove}>
      {/* Video element */}
      {videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onClick={togglePlay}
        />
      ) : (
        /* Placeholder when no video source — shows gradient + file path */
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
          onClick={() => {
            // Simulate ended for testing
            handleEnded();
          }}
        >
          <div className="text-center">
            <span className="text-7xl opacity-15 font-display block mb-4">{meta?.kanji}</span>
            <p className="text-text-secondary text-lg font-semibold">{currentEp.filename}</p>
            <p className="text-text-muted mt-2 text-sm">📁 {currentEp.path}</p>
            {isSplitChain && (
              <p className="text-queued mt-3 text-xs font-medium">⚡ Split chain → otomatis ke {nextEp?.ep}</p>
            )}
            <p className="text-text-muted mt-4 text-xs">(Klik untuk simulasi selesai → auto-next)</p>
          </div>
        </div>
      )}

      {/* Overlay controls */}
      <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Top bar */}
        <div className="px-[3%] py-5 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-4">
          <button onClick={() => navigate(`/detail/${seriesId}`)} className="text-2xl hover:scale-110 transition-transform">←</button>
          <div>
            <p className="text-sm font-semibold">{series.title}</p>
            <p className="text-xs text-text-muted flex items-center gap-2">
              Episode {ep}
              {isSplit && <span className="bg-queued text-white text-[0.55rem] px-1.5 py-0.5 rounded font-bold uppercase">SPLIT</span>}
              {isSplitChain && <span className="text-queued text-[0.55rem]">→ auto {nextEp?.ep}</span>}
              · {currentEp.duration_min} min
            </p>
          </div>
        </div>

        {/* Center controls */}
        <div className="flex items-center justify-center gap-12">
          <button
            onClick={() => prevEp && navigate(`/player/${seriesId}/${prevEp.ep}`, { replace: true })}
            className={`text-3xl transition-all ${prevEp ? 'opacity-80 hover:opacity-100 hover:scale-110' : 'opacity-20 cursor-default'}`}
            disabled={!prevEp}
          >⏮</button>
          <button onClick={togglePlay} className="w-[72px] h-[72px] border-[3px] border-white rounded-full flex items-center justify-center text-3xl hover:scale-110 transition-all">
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => nextEp && navigate(`/player/${seriesId}/${nextEp.ep}`, { replace: true })}
            className={`text-3xl transition-all ${nextEp ? 'opacity-80 hover:opacity-100 hover:scale-110' : 'opacity-20 cursor-default'}`}
            disabled={!nextEp}
          >⏭</button>
        </div>

        {/* Bottom controls */}
        <div className="px-[3%] pb-5 bg-gradient-to-t from-black/80 to-transparent">
          <div className="w-full h-1 hover:h-2 bg-white/20 rounded cursor-pointer mb-3 transition-all group" onClick={handleSeek}>
            <div className="h-full bg-accent rounded relative" style={{ width: `${seekPercent}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-accent rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="text-xl opacity-80 hover:opacity-100 transition-opacity">{playing ? '⏸' : '▶'}</button>
              <span className="text-xs text-text-secondary">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-xs border border-[#555] px-2.5 py-1 rounded hover:border-white transition-colors">720p</button>
              <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }} className="text-xl opacity-80 hover:opacity-100 transition-opacity">⛶</button>
            </div>
          </div>
        </div>
      </div>

      {/* Up Next panel — hidden during split chains */}
      <div className={`absolute bottom-[100px] right-[3%] bg-bg-surface rounded-md p-4 w-[320px] shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-transform duration-400 z-10 ${showUpNext ? 'translate-x-0' : 'translate-x-[120%]'}`}>
        <p className="text-[0.65rem] uppercase tracking-wider text-text-muted mb-2">Selanjutnya</p>
        <p className="text-sm font-semibold mb-1">{nextEp?.filename}</p>
        <p className="text-xs text-text-secondary mb-3">Episode {nextEp?.ep} · {nextEp?.duration_min} min</p>
        <div className="flex gap-2">
          <button onClick={() => nextEp && navigate(`/player/${seriesId}/${nextEp.ep}`, { replace: true })} className="px-4 py-1.5 bg-white text-black text-xs font-semibold rounded hover:bg-[#ddd] transition-all">▶ Play</button>
          <button onClick={() => setShowUpNext(false)} className="px-4 py-1.5 border border-[#666] text-xs font-semibold rounded hover:border-white transition-all">Tutup</button>
        </div>
      </div>
    </div>
  );
}
