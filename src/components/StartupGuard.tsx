import { useState, useEffect } from 'react';
import type { Series, EpisodeStatus } from '../types';
import { verifyStorage } from '../hooks/useStore';

const isCapacitor = !!(
  typeof window !== 'undefined' &&
  (window as unknown as Record<string, unknown>).Capacitor
);

interface Props {
  library: Series[];
  getStatus: (sid: string, ep: string) => EpisodeStatus;
  setStatus: (sid: string, ep: string, status: EpisodeStatus) => void;
  onComplete: () => void;
}

export default function StartupGuard({ library, getStatus, setStatus, onComplete }: Props) {
  const [step, setStep] = useState<string>('Initializing system...');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function runStartupSequence() {
      try {
        if (!isCapacitor) {
          setStep('Browser mode — skipping native checks');
          setProgress(100);
          setTimeout(() => { if (mounted) onComplete(); }, 500);
          return;
        }

        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        // ── 1. Permission Check ──
        setStep('Requesting storage permission...');
        setProgress(20);
        window.dispatchEvent(new CustomEvent('hexadev-log', { detail: 'StartupGuard: Requesting permissions' }));
        
        const permResult = await Filesystem.requestPermissions();
        if (permResult.publicStorage !== 'granted') {
          throw new Error('Permission denied. Please enable Storage/Media permissions in Android Settings.');
        }

        // ── 2. The Big Sync Engine ──
        setStep('Checking HexanimeLibrary...');
        setProgress(30);
        
        let needsSync = true;
        try {
          // Check if HexanimeLibrary exists and has contents
          const dirStat = await Filesystem.readdir({
            path: 'HexanimeLibrary',
            directory: Directory.Data
          });
          if (dirStat.files.length > 0) {
            needsSync = false;
          }
        } catch {
          // Directory doesn't exist, needs sync
        }

        if (needsSync) {
          setStep('Connecting to Big Sync Node...');
          setProgress(40);
          window.dispatchEvent(new CustomEvent('hexadev-log', { detail: 'StartupGuard: Starting Big Sync for monogatari-assets.zip' }));
          
          try {
            const apiKey = import.meta.env.VITE_GDRIVE_API_KEY || '';
            const zipId = '1WL5yolGqHPpMiTH4pSrozXYoODMdZCpX';
            const zipUrl = `https://www.googleapis.com/drive/v3/files/${zipId}?alt=media&key=${apiKey}`;
            
            setStep('Downloading 15.8GB Assets...');
            setProgress(50);
            
            // Note: Since this is 15.8GB, we must rely on native download directly.
            // We use standard Filesystem.downloadFile to Data dir.
            await Filesystem.downloadFile({
              url: zipUrl,
              path: 'HexanimeLibrary_Temp.zip',
              directory: Directory.Data,
              recursive: true
            });

            setStep('Extracting Big Sync (This may take a while)...');
            setProgress(75);
            window.dispatchEvent(new CustomEvent('hexadev-log', { detail: 'StartupGuard: Downloaded ZIP. Extracting...' }));

            const { Zip } = await import('@capacitor-community/zip');
            // Extract to Data dir directly. The zip has a root folder `Monogatari_Clean/`.
            // After extraction, the files will be in Data/Monogatari_Clean/...
            // Since our app expects HexanimeLibrary/..., we should extract directly to HexanimeLibrary, 
            // but if the ZIP wraps them in Monogatari_Clean, it might end up as HexanimeLibrary/Monogatari_Clean/.
            // For now, extract to Data/. Then we'll rename Monogatari_Clean to HexanimeLibrary.
            await Zip.unzip({
              source: 'HexanimeLibrary_Temp.zip',
              destination: '', // Extracts to root of Directory.Data
              path: Directory.Data,
            });

            setStep('Mapping filesystem...');
            setProgress(85);

            // Rename Monogatari_Clean to HexanimeLibrary
            try {
              // Ensure HexanimeLibrary is removed if it's an empty shell
              await Filesystem.rmdir({ path: 'HexanimeLibrary', directory: Directory.Data }).catch(() => {});
              
              await Filesystem.rename({
                from: 'Monogatari_Clean',
                to: 'HexanimeLibrary',
                directory: Directory.Data
              });
            } catch (err) {
               window.dispatchEvent(new CustomEvent('hexadev-log', { detail: `StartupGuard: Rename mapping failed: ${err}` }));
               // If rename fails, try to fallback or just throw
               throw new Error('Failed to map extracted ZIP. Clean your /Android/data folder and reinstall.');
            }

            // Cleanup ZIP to save 15.8GB space
            setStep('Cleaning up temp files...');
            await Filesystem.deleteFile({
              path: 'HexanimeLibrary_Temp.zip',
              directory: Directory.Data
            });

            window.dispatchEvent(new CustomEvent('hexadev-log', { detail: 'StartupGuard: Big Sync complete. Cleaned up ZIP.' }));
          } catch (syncErr) {
             const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
             throw new Error(`Big Sync Failed: ${msg}`);
          }
        }

        // ── 3. Integrity Verification ──
        setStep('Running Anti-Zonk Engine...');
        setProgress(90);
        await verifyStorage(library, getStatus, setStatus);

        setStep('System ready.');
        setProgress(100);
        setTimeout(() => { if (mounted) onComplete(); }, 800);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        window.dispatchEvent(new CustomEvent('hexadev-log', { detail: `StartupGuard FATAL: ${msg}` }));
        setErrorMsg(msg);
      }
    }

    runStartupSequence();

    return () => { mounted = false; };
  }, [library, getStatus, setStatus, onComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary text-white p-6 relative z-[9998]">
      <div className="w-full max-w-md bg-bg-surface rounded-xl p-8 border border-[#333] shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -ml-32 w-64 h-32 bg-accent/20 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="text-center relative z-10 mb-8">
          <p className="font-display text-4xl tracking-widest text-accent mb-2 drop-shadow-[0_0_10px_rgba(229,9,20,0.5)]">HEXANIME</p>
          <p className="text-[0.65rem] font-bold tracking-widest uppercase text-text-muted">System Initialization • v1.5</p>
        </div>

        {errorMsg ? (
          <div className="bg-red-900/40 border border-red-500/50 rounded-md p-4 mb-4 text-center">
            <p className="text-red-400 font-bold mb-2">Startup Failed</p>
            <p className="text-sm text-red-200/80 mb-4">{errorMsg}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6 relative z-10">
            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Status Text Area */}
            <div className="flex border-l-2 border-accent pl-3 py-1">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-accent/80 font-bold mb-1">Status</p>
                <p className="text-sm font-mono text-text-secondary h-5">{step}</p>
              </div>
              <div className="flex items-center justify-center pl-4 border-l border-[#333] w-12 text-xs font-mono text-text-muted">
                {progress}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
