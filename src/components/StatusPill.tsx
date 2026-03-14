import type { EpisodeStatus } from '../types';

const STATUS_CONFIG: Record<EpisodeStatus, { label: string; className: string }> = {
  not_downloaded: { label: 'Not DL', className: 'bg-[#333] text-[#888]' },
  queued: { label: 'Queued', className: 'bg-queued/20 text-queued' },
  downloading: { label: 'DL...', className: 'bg-info/20 text-info' },
  downloaded: { label: 'Ready', className: 'bg-warning/15 text-warning' },
  watched: { label: 'Watched', className: 'bg-success/15 text-success' },
};

interface Props {
  status: EpisodeStatus;
  onClick?: () => void;
}

export default function StatusPill({ status, onClick }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <button
      onClick={onClick}
      className={`text-[0.65rem] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap transition-all hover:brightness-125 ${config.className}`}
      title="Click to cycle status"
    >
      {config.label}
    </button>
  );
}
