import { useState, useEffect } from 'react';
import { Clipboard } from '@capacitor/clipboard';

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
}

export default function DebugConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const handleLog = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setLogs((prev) => {
        // Keep last 3 logs
        const newLogs = [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date(),
          message: customEvent.detail
        }];
        return newLogs.slice(-3);
      });
    };

    window.addEventListener('hexadev-log', handleLog);
    return () => window.removeEventListener('hexadev-log', handleLog);
  }, []);

  if (logs.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 pointer-events-none flex flex-col gap-2">
      {logs.map(log => (
        <div 
          key={log.id} 
          className="bg-red-600/95 text-white p-3 rounded-md shadow-[0_4px_20px_rgba(255,0,0,0.4)] pointer-events-auto border-l-4 border-red-900 animate-slide-up"
        >
          <div className="flex justify-between items-start mb-1">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider opacity-80">
              Hexadev System Log
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[0.6rem] font-mono opacity-80">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <button 
                onClick={async () => {
                  const text = logs.map(l => `[${l.timestamp.toLocaleTimeString()}] TYPE: ${l.message}`).join('\n');
                  try {
                    await Clipboard.write({ string: text });
                    alert('Logs copied to clipboard!');
                  } catch (e) {
                    console.error('Failed to copy logs', e);
                  }
                }}
                className="text-[0.6rem] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-mono"
              >
                Copy
              </button>
            </div>
          </div>
          <p className="font-mono text-xs whitespace-pre-wrap leading-relaxed">
            {log.message}
          </p>
          <button 
            onClick={() => setLogs(prev => prev.filter(l => l.id !== log.id))}
            className="absolute top-2 right-2 opacity-50 hover:opacity-100 text-sm w-6 h-6 flex items-center justify-center bg-black/20 rounded"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
