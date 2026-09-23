/**
 * AI DJ Audio Reactive Engine
 * 
 * Provides 100% REAL PCM Audio Signal Analysis (RMS and FFT Frequency Spectrum)
 * EXCLUSIVELY for Spotify AI DJ playback via Web Audio Loopback (System/Tab Audio).
 * 
 * STRICT RULES:
 * - NO artificial rhythms, NO simulated BPM, NO timers, NO Math.sin/cos pulse loops.
 * - NO random values.
 * - When audio is silent, RMS = 0.
 * - When paused or DJ is inactive, all metrics = 0 and glow is completely OFF.
 * - Derives metrics ONLY from actual PCM samples and FFT frequency data.
 */

export interface AudioMetrics {
    rms: number;          // 0.0 - 1.0 (actual signal energy from PCM waveform)
    bass: number;         // 0.0 - 1.0 (actual low-frequency energy from FFT)
    mid: number;          // 0.0 - 1.0 (actual mid-frequency energy from FFT)
    treble: number;       // 0.0 - 1.0 (actual high-frequency energy from FFT)
    rawRms: number;       // 0.0 - 1.0 (unfiltered instant PCM RMS)
    isLoopbackActive: boolean;
    isAnalyzing: boolean;
    sampleRate: number;
    audioTrackCount: number;
    audioTrackState: string;
    audioContextState: string;
}

/**
 * Robust check to determine if the given playerState is Spotify AI DJ.
 */
export function isSpotifyAiDj(playerState: any): boolean {
    if (!playerState) return false;
    const contextUri = playerState.context?.uri || '';
    const currentTrack = playerState.track_window?.current_track ?? playerState.item;
    const currentUri = currentTrack?.uri || '';
    const trackName = currentTrack?.name?.toLowerCase() || '';
    const trackId = currentTrack?.id || '';
    const contextDesc = playerState.context?.metadata?.context_description?.toLowerCase() || '';

    return Boolean(
        contextUri.includes('37i9dQZF1EYkqdzj48dyYq') ||
        currentUri.includes('37i9dQZF1EYkqdzj48dyYq') ||
        trackId === 'spotify-dj' ||
        trackName.includes('dj spotify') ||
        trackName.includes('spotify dj') ||
        trackName === 'dj' ||
        contextDesc.includes('ai dj') ||
        contextDesc.includes('spotify dj')
    );
}

/**
 * Checks if Spotify AI DJ is both active AND actively playing (not paused).
 */
export function isSpotifyAiDjPlaying(playerState: any): boolean {
    return isSpotifyAiDj(playerState) && !playerState?.paused;
}

class AiDjAudioAnalyzerService {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private loopbackStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    
    private loopbackActive = false;
    private analyzing = false;

    // Buffer for real PCM time-domain samples (waveform)
    private timeDomainBuffer = new Uint8Array(256);
    // Buffer for real FFT frequency bins
    private frequencyBuffer = new Uint8Array(128);

    private smoothedRms = 0;
    private smoothedBass = 0;
    private smoothedMid = 0;
    private smoothedTreble = 0;

    private lastDebugLogTime = 0;
    private captureRequestInProgress = false;

    private listeners = new Set<() => void>();

    constructor() {
        // AudioContext initialized upon user gesture or DJ start
    }

    public isLoopbackActive(): boolean {
        return this.loopbackActive;
    }

    public isAnalyzing(): boolean {
        return this.analyzing;
    }

    public isSupported(): boolean {
        return typeof window !== 'undefined' && 
               Boolean(window.AudioContext || (window as any).webkitAudioContext);
    }

    public isLoopbackSupported(): boolean {
        return typeof navigator !== 'undefined' && 
               Boolean(navigator.mediaDevices?.getDisplayMedia);
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(fn => {
            try { fn(); } catch (_) {}
        });
    }

    private ensureAudioContext(): AudioContext | null {
        if (!this.audioContext && typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.audioContext = new AudioContextClass();
            }
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }
        return this.audioContext;
    }

    /**
     * Captures REAL system/tab audio via loopback WITHOUT microphone.
     * Uses navigator.mediaDevices.getDisplayMedia with system audio enabled.
     */
    public async startLoopbackCapture(): Promise<boolean> {
        console.log('[AI DJ CAPTURE] startLoopbackCapture CALLED');

        if (this.captureRequestInProgress) {
            console.log('[AI DJ CAPTURE] capture already in progress, skipping duplicate call');
            return false;
        }

        if (typeof window !== 'undefined') {
            console.log('[DISPLAY CAPTURE POLICY]', {
                isTopLevel: window.top === window.self,
                origin: window.location.origin,
                href: window.location.href,
                allowsDisplayCapture:
                    typeof (document as any).permissionsPolicy?.allowsFeature === 'function'
                        ? (document as any).permissionsPolicy.allowsFeature('display-capture')
                        : 'API unavailable',
            });
        }

        if (!this.isLoopbackSupported()) {
            console.warn('[AI DJ CAPTURE] getDisplayMedia non supportato in questo ambiente browser.');
            return false;
        }

        this.captureRequestInProgress = true;

        const ctx = this.ensureAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        try {
            console.log('[AI DJ CAPTURE] requesting getDisplayMedia...');
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1 },
                    height: { ideal: 1 },
                    frameRate: { ideal: 1 }
                },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    suppressLocalAudioPlayback: false
                } as any,
                preferCurrentTab: true,
                systemAudio: 'include',
                selfBrowserSurface: 'include'
            } as any);

            const audioTracks = stream.getAudioTracks();
            const videoTracks = stream.getVideoTracks();

            console.log('[AI DJ CAPTURE] getDisplayMedia RESOLVED');
            console.log(`[AI DJ CAPTURE] stream id: "${stream.id}"`);
            console.log(`[AI DJ CAPTURE] videoTracks count: ${videoTracks.length}`);
            console.log(`[AI DJ CAPTURE] audioTracks count: ${audioTracks.length}`);

            audioTracks.forEach((track, idx) => {
                console.log(`[AI DJ CAPTURE] Audio Track ${idx}: label="${track.label}", readyState="${track.readyState}", enabled=${track.enabled}, muted=${track.muted}`);
            });

            if (!audioTracks || audioTracks.length === 0) {
                console.warn('[AI DJ CAPTURE] NESSUNA TRACCIA AUDIO: audioTracks = 0. Il browser ha restituito uno stream senza traccia audio (l\'utente non ha spuntato "Condividi audio" oppure la sorgente scelta non include stream audio).');
                stream.getTracks().forEach(t => t.stop());
                return false;
            }

            const track = audioTracks[0];

            // Immediately stop video tracks to save 100% video processing
            videoTracks.forEach(vTrack => {
                try {
                    vTrack.enabled = false;
                    vTrack.stop();
                } catch (_) {}
            });

            this.stopLoopbackCapture();

            this.loopbackStream = stream;
            this.setupAudioGraph(stream);
            this.loopbackActive = true;
            this.analyzing = true;
            this.notifyListeners();

            track.onended = () => {
                console.log('[AI DJ CAPTURE] Loopback audio track conclusa (ended).');
                this.stopLoopbackCapture();
            };

            console.log('[AI DJ CAPTURE] Cattura audio loopback collegata con successo (tracks=1, state=live).');
            return true;
        } catch (err: any) {
            console.error(`[AI DJ CAPTURE] getDisplayMedia ERROR: ${err?.name || 'Error'} - ${err?.message || err}`);
            return false;
        } finally {
            this.captureRequestInProgress = false;
        }
    }

    public stopLoopbackCapture(): void {
        if (this.loopbackStream) {
            try {
                this.loopbackStream.getTracks().forEach(t => t.stop());
            } catch (_) {}
            this.loopbackStream = null;
        }
        if (this.sourceNode) {
            try { this.sourceNode.disconnect(); } catch (_) {}
            this.sourceNode = null;
        }
        this.analyser = null;
        this.loopbackActive = false;
        this.smoothedRms = 0;
        this.smoothedBass = 0;
        this.smoothedMid = 0;
        this.smoothedTreble = 0;
        this.notifyListeners();
    }

    private setupAudioGraph(stream: MediaStream) {
        const ctx = this.ensureAudioContext();
        if (!ctx) return;

        try {
            if (this.sourceNode) {
                try { this.sourceNode.disconnect(); } catch (_) {}
                this.sourceNode = null;
            }

            const sourceNode = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            
            // 256 fftSize gives 128 frequency bins with fast temporal resolution (~5.3ms at 48kHz)
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.35;

            sourceNode.connect(analyser);

            this.sourceNode = sourceNode;
            this.analyser = analyser;
            this.timeDomainBuffer = new Uint8Array(analyser.fftSize);
            this.frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);

            console.log(`[AI DJ CAPTURE] createMediaStreamSource & createAnalyser CREATED: AudioContext state="${ctx.state}", sampleRate=${ctx.sampleRate}Hz, fftSize=${analyser.fftSize}`);
        } catch (err) {
            console.warn('[AI DJ CAPTURE] Errore configurazione grafo audio:', err);
        }
    }

    public startAnalysis(): void {
        this.analyzing = true;
        this.ensureAudioContext();
    }

    public stopAnalysis(): void {
        this.analyzing = false;
        this.smoothedRms = 0;
        this.smoothedBass = 0;
        this.smoothedMid = 0;
        this.smoothedTreble = 0;

        if (this.audioContext && this.audioContext.state === 'running' && !this.loopbackActive) {
            this.audioContext.suspend().catch(() => {});
        }
    }

    /**
     * Fetches current frame metrics and prints technical debug every ~500ms.
     */
    public getMetrics(deltaSec: number, isDjPlaying: boolean): AudioMetrics {
        const sampleRate = this.audioContext?.sampleRate || 44100;
        const ctxState = this.audioContext?.state || 'uninitialized';
        const audioTracks = this.loopbackStream ? this.loopbackStream.getAudioTracks() : [];
        const trackCount = audioTracks.length;
        const trackState = trackCount > 0 ? audioTracks[0].readyState : 'none';
        const now = performance.now();

        // If DJ is not playing, or loopback is not active, return 0 for audio metrics
        if (!isDjPlaying || !this.analyzing || !this.loopbackActive || !this.analyser) {
            this.smoothedRms = Math.max(0, this.smoothedRms - deltaSec * 10.0);
            this.smoothedBass = Math.max(0, this.smoothedBass - deltaSec * 10.0);
            this.smoothedMid = Math.max(0, this.smoothedMid - deltaSec * 10.0);
            this.smoothedTreble = Math.max(0, this.smoothedTreble - deltaSec * 10.0);

            if (isDjPlaying && now - this.lastDebugLogTime > 500) {
                this.lastDebugLogTime = now;
                console.log(`[AI DJ AUDIO] tracks=${trackCount} state=${trackState} ctx=${ctxState} rms=0.000 bass=0.000 mid=0.000 high=0.000 isLoopbackActive=${this.loopbackActive} [Glow in Base Mode] timestamp=${Math.floor(Date.now())}`);
            }

            return {
                rms: this.smoothedRms,
                bass: this.smoothedBass,
                mid: this.smoothedMid,
                treble: this.smoothedTreble,
                rawRms: 0,
                isLoopbackActive: this.loopbackActive,
                isAnalyzing: false,
                sampleRate,
                audioTrackCount: trackCount,
                audioTrackState: trackState,
                audioContextState: ctxState,
            };
        }

        try {
            // 1. REAL PCM TIME-DOMAIN WAVEFORM SAMPLES -> ROOT MEAN SQUARE (RMS)
            this.analyser.getByteTimeDomainData(this.timeDomainBuffer);
            let sumSquares = 0;
            let non128Count = 0;
            let minSample = 255;
            let maxSample = 0;
            const len = this.timeDomainBuffer.length;

            for (let i = 0; i < len; i++) {
                const rawVal = this.timeDomainBuffer[i];
                if (rawVal < minSample) minSample = rawVal;
                if (rawVal > maxSample) maxSample = rawVal;
                if (rawVal !== 128) non128Count++;

                const pcm = (rawVal - 128) / 128; // -1.0 to +1.0
                sumSquares += pcm * pcm;
            }
            const rawRms = Math.sqrt(sumSquares / len);

            // Normalize raw RMS: typical music peak RMS in digital audio is ~0.25 - 0.50
            const normRms = Math.min(1.0, Math.max(0, rawRms * 3.2));
            
            // Exponential smoothing
            const rmsSpeed = normRms > this.smoothedRms ? 22.0 : 12.0;
            this.smoothedRms += (normRms - this.smoothedRms) * Math.min(1.0, deltaSec * rmsSpeed);

            // 2. REAL FFT FREQUENCY SPECTRUM
            this.analyser.getByteFrequencyData(this.frequencyBuffer);
            
            // Bass: bins 0 to 2 (~0 Hz - ~500 Hz)
            const b0 = this.frequencyBuffer[0] || 0;
            const b1 = this.frequencyBuffer[1] || 0;
            const b2 = this.frequencyBuffer[2] || 0;
            const rawBass = ((b0 + b1 + b2) / 3) / 255;
            
            const bassSpeed = rawBass > this.smoothedBass ? 26.0 : 14.0;
            this.smoothedBass += (rawBass - this.smoothedBass) * Math.min(1.0, deltaSec * bassSpeed);

            // Mids: bins 3 to 15 (~500 Hz - ~3000 Hz)
            let midSum = 0;
            for (let i = 3; i <= 15; i++) {
                midSum += this.frequencyBuffer[i] || 0;
            }
            const rawMid = (midSum / 13) / 255;
            this.smoothedMid += (rawMid - this.smoothedMid) * Math.min(1.0, deltaSec * 14.0);

            // Treble: bins 16 to 48 (~3000 Hz - ~9000 Hz)
            let trebleSum = 0;
            for (let i = 16; i <= 48; i++) {
                trebleSum += this.frequencyBuffer[i] || 0;
            }
            const rawTreble = (trebleSum / 33) / 255;
            this.smoothedTreble += (rawTreble - this.smoothedTreble) * Math.min(1.0, deltaSec * 14.0);

            // Debug log every ~500ms
            if (isDjPlaying && now - this.lastDebugLogTime > 500) {
                this.lastDebugLogTime = now;
                console.log(`[AI DJ AUDIO] tracks=${trackCount} state=${trackState} ctx=${ctxState} rms=${this.smoothedRms.toFixed(3)} bass=${this.smoothedBass.toFixed(3)} mid=${this.smoothedMid.toFixed(3)} high=${this.smoothedTreble.toFixed(3)} rawRms=${rawRms.toFixed(4)} minSample=${minSample} maxSample=${maxSample} non128=${non128Count}/256 isLoopbackActive=${this.loopbackActive} timestamp=${Math.floor(Date.now())}`);
            }

            return {
                rms: this.smoothedRms,
                bass: this.smoothedBass,
                mid: this.smoothedMid,
                treble: this.smoothedTreble,
                rawRms,
                isLoopbackActive: true,
                isAnalyzing: true,
                sampleRate,
                audioTrackCount: trackCount,
                audioTrackState: trackState,
                audioContextState: ctxState,
            };
        } catch (err) {
            console.warn('[AI DJ AUDIO] Errore lettura campioni:', err);
            return {
                rms: 0,
                bass: 0,
                mid: 0,
                treble: 0,
                rawRms: 0,
                isLoopbackActive: this.loopbackActive,
                isAnalyzing: false,
                sampleRate,
                audioTrackCount: trackCount,
                audioTrackState: trackState,
                audioContextState: ctxState,
            };
        }
    }
}

export const aiDjAudioAnalyzer = new AiDjAudioAnalyzerService();

