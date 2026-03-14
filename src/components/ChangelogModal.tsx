interface Props {
  onClose: () => void;
}

export default function ChangelogModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-surface w-full max-w-md rounded-xl p-6 border border-[#333] shadow-[0_10px_40px_rgba(229,9,20,0.15)] relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 blur-[40px] rounded-full pointer-events-none" />
        
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-text-muted bg-clip-text text-transparent">
              Update v1.6
            </h2>
            <p className="text-sm font-mono text-accent mt-1">The Absolute Sync & Transparency Update</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#222] hover:bg-[#333] transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 text-sm text-text-secondary relative z-10">
          <p className="leading-relaxed">
            Selamat datang di Hexanime v1.6! Update masif kali ini merombak total engine download, UI yang lebih premium, dan fitur sinkronisasi file raksasa.
          </p>
          
          <ul className="space-y-3 mt-4">
            <li className="flex gap-2">
              <span className="text-accent">✓</span>
              <span><strong>Big Sync Engine:</strong> Auto-download 15.8GB metadata dan direktori via sinkronisasi otomatis di awal aplikasi.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">✓</span>
              <span><strong>Internal Scoped Storage:</strong> Migrasi data ke <code>Directory.Data</code>. Kini Android bisa otomatis menghapus sisa file raksasa saat aplikasi di-uninstall.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">✓</span>
              <span><strong>Premium Thumbnail-Free UI:</strong> Tampilan card tanpa gambar, menggunakan tipografi Bebas Neue dan gradien cantik. Modals dengan glassmorphism.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">✓</span>
              <span><strong>Dev Transparency:</strong> Debug log transparan dengan tombol 'Copy Logs' menggunakan Clipboard native.</span>
            </li>
          </ul>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-8 py-3 bg-accent hover:bg-red-700 text-white font-semibold rounded-lg shadow-[0_0_15px_rgba(229,9,20,0.4)] transition-all active:scale-95"
        >
          Lanjutkan ke Aplikasi
        </button>
      </div>
    </div>
  );
}
