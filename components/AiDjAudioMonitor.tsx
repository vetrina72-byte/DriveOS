import React, { useState, useEffect, useRef } from 'react';
import { Activity, Power, Volume2, VolumeX, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { aiDjAudioAnalyzer, type AudioMetrics } from '../services/AiDjAudioAnalyzer';

interface AiDjAudioMonitorProps {
  isDjActive: boolean;
  isDjPlaying: boolean;
  isNight: boolean;
}

export const AiDjAudioMonitor: React.FC<AiDjAudioMonitorProps> = ({ isDjActive, isDjPlaying, isNight }) => {
  const [isLoopbackActive, setIsLoopbackActive] = useState(aiDjAudioAnalyzer.isLoopbackActive());
  const [metrics, setMetrics] = useState<AudioMetrics>({
    rms: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    rawRms: 0,
    isLoopbackActive: false,
    isAnalyzing: false,
    sampleRate: 44100,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = aiDjAudioAnalyzer.subscribe(() => {
      setIsLoopbackActive(aiDjAudioAnalyzer.isLoopbackActive());
    });
    return unsub;
  }, []);

  // Real-time metrics polling at 60fps for UI visualization
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const deltaSec = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Real query to audio engine
      const current = aiDjAudioAnalyzer.getMetrics(deltaSec, isDjPlaying && isDjActive);
      setMetrics(current);

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isDjPlaying, isDjActive]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const success = await aiDjAudioAnalyzer.startLoopbackCapture();
      if (!success) {
        setErrorMessage(
          'Flusso audio non rilevato. Nella finestra di condivisione del browser, assicurati di selezionare "Condividi audio della scheda" o "Audio di sistema".'
        );
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Errore durante la connessione loopback');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    aiDjAudioAnalyzer.stopLoopbackCapture();
    setErrorMessage(null);
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-300 font-sans ${
        isNight
          ? 'bg-zinc-900/90 border-zinc-800 text-zinc-200'
          : 'bg-white/95 border-zinc-200 text-zinc-800 shadow-sm'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/20 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl ${
              isLoopbackActive && isDjPlaying && metrics.rms > 0.01
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-zinc-800/50 text-zinc-400'
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight">Audio Analyzer Reale (PCM / FFT)</h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isLoopbackActive
                    ? isDjPlaying
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                {isLoopbackActive
                  ? isDjPlaying
                    ? 'STREAM ATTIVO'
                    : 'IN PAUSA (VALORI AZZERATI)'
                  : 'LOOPBACK NON COLLEGATO'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Nessun timer, nessun ritmo artificiale, nessun movimento del player.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isLoopbackActive ? (
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Power className="w-3.5 h-3.5" /> Disconnetti
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1db954] hover:bg-[#1aa34a] text-black transition-all cursor-pointer flex items-center gap-1.5 font-bold shadow-md active:scale-95 disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5" />
              {isConnecting ? 'Connessione in corso...' : 'Collega Audio Reale (Loopback)'}
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Real-time Meter Bars */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* RMS Meter */}
        <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/40">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-zinc-400">RMS (Energia PCM)</span>
            <span className="font-mono font-bold text-emerald-400">
              {metrics.rms.toFixed(3)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.min(100, metrics.rms * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-500 mt-1 flex justify-between font-mono">
            <span>0.000</span>
            <span>Raw: {metrics.rawRms.toFixed(3)}</span>
            <span>1.000</span>
          </div>
        </div>

        {/* Bass / Lows Meter */}
        <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/40">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-zinc-400">Bassi (20-500Hz FFT)</span>
            <span className="font-mono font-bold text-emerald-400">
              {metrics.bass.toFixed(3)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-75"
              style={{ width: `${Math.min(100, metrics.bass * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-500 mt-1 flex justify-between font-mono">
            <span>Guida raggio glow</span>
            <span>{Math.round(metrics.bass * 100)}%</span>
          </div>
        </div>

        {/* Mid Meter */}
        <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/40">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-zinc-400">Medi (500-3kHz FFT)</span>
            <span className="font-mono font-bold text-teal-400">
              {metrics.mid.toFixed(3)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className="h-full bg-teal-400 transition-all duration-75"
              style={{ width: `${Math.min(100, metrics.mid * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-500 mt-1 flex justify-between font-mono">
            <span>Voci / Strumenti</span>
            <span>{Math.round(metrics.mid * 100)}%</span>
          </div>
        </div>

        {/* Treble Meter */}
        <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/40">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-zinc-400">Alti (3k-9kHz FFT)</span>
            <span className="font-mono font-bold text-cyan-400">
              {metrics.treble.toFixed(3)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-75"
              style={{ width: `${Math.min(100, metrics.treble * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-500 mt-1 flex justify-between font-mono">
            <span>Dettagli acuti</span>
            <span>{Math.round(metrics.treble * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Live Behavior Explanation */}
      <div className="mt-3 pt-3 border-t border-zinc-800/20 text-xs text-zinc-400 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <span>
            {!isLoopbackActive ? (
              <span>
                <strong>Stato attuale:</strong> Il loopback audio non è connesso. Poiché non sono ammesse animazioni simulate, il glow è <strong>completamente spento</strong>. Premi "Collega Audio Reale" per visualizzare il segnale reale di Spotify.
              </span>
            ) : !isDjActive ? (
              <span>
                <strong>Stato attuale:</strong> Spotify AI DJ non è la traccia attiva. L'analizzatore è <strong>inattivo</strong> e il glow è disattivato.
              </span>
            ) : !isDjPlaying ? (
              <span>
                <strong>Stato attuale:</strong> Spotify AI DJ è <strong>in pausa</strong>. I valori PCM sono <strong>azzerati a 0.000</strong> e il glow è spento.
              </span>
            ) : (
              <span>
                <strong>Stato attuale:</strong> Analisi in tempo reale attiva. L'intensità e l'espansione del glow posteriore seguono matematicamente l'onda PCM e i bassi FFT. Il player è <strong>completamente statico</strong>.
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
