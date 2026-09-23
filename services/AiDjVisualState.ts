/**
 * AI DJ Soft Ambient Glow & Event Engine (Refined Compact Edition)
 * 
 * Visual Architecture:
 * - Dominant Perceived Color: Emerald Green / Pure Spotify AI DJ Green (142° - 152°).
 * - Standby / Paused Glow: 100% Pure Soft Emerald Green, static, compact, pleasant.
 * - Active Playback Glow: Emerald dominant with a very subtle, faint cool inner sheen (cyan/mint)
 *   that is only visible as a delicate inner reflection.
 * - Compact Spatial Footprint: Light stays concentrated near the player.
 *   Inner wave excursion: +1.5px to +3.5px.
 *   Outer wave excursion: +3.0px to +6.5px.
 *   Zero explosive bloom: play start enhances brightness softly with minimal radius change.
 * - Seamless Unified Aura: Multi-stop soft overlapping shadows, zero hard lines or borders.
 * - Player container remains 100% STATIC (transform: none).
 */

import { extractArtworkAccentColor, RgbColor } from '../lib/artworkColorExtractor';

const DEFAULT_EMERALD: RgbColor = { r: 16, g: 185, b: 129 };

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

export interface AiDjGlowFrame {
    activeOpacity: number;
    baseShadow: string;
    baseBorderColor: string;
    innerWaveExcursionPx: number;
    innerWaveOpacity: number;
    innerWaveShadow: string;
    innerWaveBorder: string;
    outerWaveExcursionPx: number;
    outerWaveOpacity: number;
    outerWaveShadow: string;
    outerWaveBorder: string;
}

class AiDjVisualStateManager {
    private activeWeight = 0;   // 0 (inactive) to 1 (active)
    private playingWeight = 0;  // 0 (paused/standby) to 1 (full playing)
    
    // Wave oscillation phase
    private wavePhase = 0;

    // Accent color interpolation (very subtle integration in outer fringe)
    private currentAccentColor: RgbColor = { ...DEFAULT_EMERALD };
    private targetAccentColor: RgbColor = { ...DEFAULT_EMERALD };
    private lastArtworkUrl: string | null = null;

    // Event impulse timers (normalized 1.0 down to 0.0)
    private bloomTimer = 0;     // resume / play start impulse
    private trackTimer = 0;     // track change impulse
    private moodTimer = 0;      // mood change impulse

    // State tracking for automated edge detection
    private lastTrackKey: string | null = null;
    private lastPlayingState = false;
    private lastDjActiveState = false;

    public triggerPlayBloom(): void {
        this.bloomTimer = 1.0;
    }

    public triggerTrackTransition(): void {
        this.trackTimer = 1.0;
    }

    public triggerMoodTransition(): void {
        this.moodTimer = 1.0;
    }

    public setArtworkUrl(imageUrl?: string): void {
        if (!imageUrl || imageUrl === this.lastArtworkUrl) return;
        this.lastArtworkUrl = imageUrl;

        extractArtworkAccentColor(imageUrl).then((color) => {
            this.targetAccentColor = color;
        });
    }

    /**
     * Advances the engine by dt seconds and computes the refined compact frame.
     */
    public update(
        deltaTimeSec: number,
        isDjActive: boolean,
        isDjPlaying: boolean,
        currentTrackKey?: string,
        artworkUrl?: string,
        playerBaseShadow = '0 20px 40px -15px rgba(0,0,0,0.35)'
    ): AiDjGlowFrame {
        const dt = Math.min(0.1, Math.max(0.001, deltaTimeSec));

        // 1. Artwork updates & color lerp
        if (artworkUrl && artworkUrl !== this.lastArtworkUrl) {
            this.setArtworkUrl(artworkUrl);
        }

        const colorLerp = 1.0 - Math.exp(-dt * 3.0);
        this.currentAccentColor.r += (this.targetAccentColor.r - this.currentAccentColor.r) * colorLerp;
        this.currentAccentColor.g += (this.targetAccentColor.g - this.currentAccentColor.g) * colorLerp;
        this.currentAccentColor.b += (this.targetAccentColor.b - this.currentAccentColor.b) * colorLerp;

        // 2. Real Player Event Triggers
        if (isDjActive) {
            // Resume / Play transition
            if (isDjPlaying && (!this.lastPlayingState || !this.lastDjActiveState)) {
                this.triggerPlayBloom();
            }
            // Track change transition (logged once per real change)
            if (currentTrackKey && this.lastTrackKey && currentTrackKey !== this.lastTrackKey) {
                console.log(`[AI DJ VISUAL] TRACK CHANGE\nprevious = ${this.lastTrackKey}\ncurrent = ${currentTrackKey}`);
                this.triggerTrackTransition();
            }
        }

        this.lastPlayingState = isDjPlaying;
        this.lastDjActiveState = isDjActive;
        if (currentTrackKey) {
            this.lastTrackKey = currentTrackKey;
        }

        // 3. Smooth continuous interpolation towards targets
        const targetActive = isDjActive ? 1.0 : 0.0;
        const targetPlaying = (isDjActive && isDjPlaying) ? 1.0 : 0.0;

        // Active weight transitions smoothly
        const activeLerp = 1.0 - Math.exp(-dt * 4.0);
        this.activeWeight += (targetActive - this.activeWeight) * activeLerp;

        // Playing weight smoothly ramps up/down without abrupt cutoff
        const playingLerp = 1.0 - Math.exp(-dt * 3.2);
        this.playingWeight += (targetPlaying - this.playingWeight) * playingLerp;

        // 4. Advance event impulse timers and compute soft, controlled curves
        if (this.bloomTimer > 0) {
            this.bloomTimer = Math.max(0, this.bloomTimer - dt / 0.75);
        }
        if (this.trackTimer > 0) {
            this.trackTimer = Math.max(0, this.trackTimer - dt / 1.25);
        }
        if (this.moodTimer > 0) {
            this.moodTimer = Math.max(0, this.moodTimer - dt / 1.6);
        }

        // --- Track change lifecycle curve (compact & elegant) ---
        let trackExcursionMod = 0;
        let trackBrightnessMod = 0;
        if (this.trackTimer > 0) {
            const progress = 1.0 - this.trackTimer;
            if (progress < 0.22) {
                // Phase 1: Tiny contraction (-1.0px)
                const phase1T = progress / 0.22;
                const dip = Math.sin(phase1T * Math.PI);
                trackExcursionMod = -1.0 * dip;
                trackBrightnessMod = 0.10 * dip;
            } else {
                // Phase 2: Gentle luminous wave (+1.6px)
                const phase2T = (progress - 0.22) / 0.78;
                const surge = Math.sin(phase2T * Math.PI);
                trackExcursionMod = 1.6 * surge;
                trackBrightnessMod = 0.22 * surge;
            }
        }

        // --- Mood change lifecycle curve (controlled) ---
        let moodExcursionMod = 0;
        let moodBrightnessMod = 0;
        if (this.moodTimer > 0) {
            const progress = 1.0 - this.moodTimer;
            if (progress < 0.20) {
                const phase1T = progress / 0.20;
                const dip = Math.sin(phase1T * Math.PI);
                moodExcursionMod = -1.4 * dip;
                moodBrightnessMod = 0.12 * dip;
            } else {
                const phase2T = (progress - 0.20) / 0.80;
                const surge = Math.sin(phase2T * Math.PI);
                moodExcursionMod = 2.4 * surge;
                moodBrightnessMod = 0.30 * surge;
            }
        }

        // Play resume bloom: mostly brightness boost (+0.18), very little spatial expansion (+0.8px)
        const bloomProgress = 1.0 - this.bloomTimer;
        const bloomCurve = this.bloomTimer > 0 ? Math.sin(bloomProgress * Math.PI) : 0;
        const bloomExcursionMod = bloomCurve * 0.8;
        const bloomBrightnessMod = bloomCurve * 0.18;

        const totalExcursionEventMod = trackExcursionMod + moodExcursionMod + bloomExcursionMod;
        const totalBrightnessEventMod = trackBrightnessMod + moodBrightnessMod + bloomBrightnessMod;

        // 5. Advance continuous wave phase (smoothly decelerates on pause)
        this.wavePhase += dt * (0.85 + this.playingWeight * 0.65);

        // Organic dual-harmonic non-repeating micro-undulations
        const w1 = Math.sin(this.wavePhase * 1.4) * 0.6 + Math.sin(this.wavePhase * 2.2 + 0.9) * 0.4;
        const w2 = Math.sin(this.wavePhase * 1.0 + 0.65) * 0.65 + Math.cos(this.wavePhase * 1.7) * 0.35;

        const innerHarmonic = (w1 * 0.5 + 0.5); // 0.0 to 1.0
        const outerHarmonic = (w2 * 0.5 + 0.5); // 0.0 to 1.0

        // -------------------------------------------------------------
        // LAYER 0: BASE GLOW (Solid Emerald Foundation on Static Player)
        // -------------------------------------------------------------
        // Paused: 100% PURE SOFT EMERALD GREEN (compact, soothing, static)
        // Playing: Emerald dominant + very faint subtle cool inner highlight (alpha ~0.16)
        
        // Pure emerald base core
        const baseCoreBlur = 12 + this.playingWeight * 5 + totalBrightnessEventMod * 3;
        const baseCoreSpread = 1.2 + this.playingWeight * 0.8 + totalBrightnessEventMod * 0.5;
        const baseCoreAlpha = Math.min(0.9, (0.48 + this.playingWeight * 0.22 + totalBrightnessEventMod * 0.15) * this.activeWeight);

        // Soft ambient emerald diffusion
        const baseAmbientBlur = 22 + this.playingWeight * 8 + totalBrightnessEventMod * 4;
        const baseAmbientSpread = 2.2 + this.playingWeight * 1.0 + totalBrightnessEventMod * 0.8;
        const baseAmbientAlpha = Math.min(0.6, (0.28 + this.playingWeight * 0.16 + totalBrightnessEventMod * 0.10) * this.activeWeight);

        // Delicate cool electric blue/cyan inner sheen (ACTIVE ONLY DURING PLAYBACK)
        // When music plays, a subtle cool blue touch appears near the player border.
        // When music is paused (playingWeight = 0), coolSheenAlpha drops to 0 and the blue completely disappears, leaving pure emerald green.
        const coolSheenBlur = 8 + totalBrightnessEventMod * 3;
        const coolSheenSpread = 0.8 + totalBrightnessEventMod * 0.4;
        const coolSheenAlpha = (0.28 * this.playingWeight + totalBrightnessEventMod * 0.08) * this.activeWeight;

        let baseDjShadow = `0px 0px ${baseCoreBlur.toFixed(1)}px ${baseCoreSpread.toFixed(1)}px hsla(144, 88%, 46%, ${baseCoreAlpha.toFixed(3)}), 0px 0px ${baseAmbientBlur.toFixed(1)}px ${baseAmbientSpread.toFixed(1)}px hsla(152, 82%, 42%, ${baseAmbientAlpha.toFixed(3)})`;
        
        if (coolSheenAlpha > 0.01) {
            baseDjShadow = `0px 0px ${coolSheenBlur.toFixed(1)}px ${coolSheenSpread.toFixed(1)}px hsla(195, 88%, 52%, ${coolSheenAlpha.toFixed(3)}), ` + baseDjShadow;
        }

        const combinedBaseShadow = this.activeWeight > 0.01 
            ? `${baseDjShadow}, ${playerBaseShadow}`
            : playerBaseShadow;

        // Border: Pure emerald (144°) on pause; soft emerald with cool cyan highlight (up to 175°) during play
        const borderAlpha = Math.min(0.85, (0.40 + this.playingWeight * 0.30 + totalBrightnessEventMod * 0.12) * this.activeWeight);
        const borderHue = 144 + this.playingWeight * 31; // 144° (emerald) on pause -> 175° (cool cyan/emerald) on play
        const baseBorderColor = this.activeWeight > 0.01
            ? `hsla(${borderHue.toFixed(0)}, 85%, 48%, ${borderAlpha.toFixed(3)})`
            : '';

        // -------------------------------------------------------------
        // LAYER 1: INNER WAVE (Compact Micro-Wave: Mint / Emerald Mid-Zone)
        // -------------------------------------------------------------
        // Distance from player: +1.8px to +3.6px during steady play
        // ZERO hard borders - purely seamless soft diffused glow
        const innerBaseExcursion = 1.8 + innerHarmonic * 1.8; // 1.8 to 3.6px
        const innerWaveExcursionPx = Math.max(0, innerBaseExcursion * this.playingWeight + totalExcursionEventMod);

        const innerWaveOpacity = Math.min(1.0, Math.max(0, (this.playingWeight * 0.75 + totalBrightnessEventMod * 0.20) * this.activeWeight));
        
        const innerBlur = 14 + innerHarmonic * 6 + totalBrightnessEventMod * 4;
        const innerSpread = 1.6 + innerHarmonic * 1.2 + totalBrightnessEventMod * 0.8;
        const innerAlpha = Math.min(0.65, (0.40 + innerHarmonic * 0.18) * innerWaveOpacity);

        // Soft emerald with faint mint tone
        const innerWaveShadow = `0px 0px ${innerBlur.toFixed(1)}px ${innerSpread.toFixed(1)}px hsla(148, 86%, 46%, ${innerAlpha.toFixed(3)})`;
        const innerWaveBorder = 'none';

        // -------------------------------------------------------------
        // LAYER 2: OUTER WAVE (Compact Soft Fringe: Emerald -> Teal Fade)
        // -------------------------------------------------------------
        // Distance from player: +3.2px to +6.2px during steady play
        // ZERO hard borders - soft atmospheric taper close to the player
        const outerBaseExcursion = 3.2 + outerHarmonic * 3.0; // 3.2 to 6.2px
        const outerWaveExcursionPx = Math.max(0, outerBaseExcursion * this.playingWeight + totalExcursionEventMod * 1.2);

        const outerWaveOpacity = Math.min(1.0, Math.max(0, (this.playingWeight * 0.60 + totalBrightnessEventMod * 0.22) * this.activeWeight));
        
        const outerBlur = 24 + outerHarmonic * 8 + totalBrightnessEventMod * 6;
        const outerSpread = 2.4 + outerHarmonic * 1.6 + totalBrightnessEventMod * 1.0;
        const outerAlpha = Math.min(0.42, (0.26 + outerHarmonic * 0.14) * outerWaveOpacity);

        // Very faint artwork accent integration (max 10% weight)
        const rAcc = Math.round(this.currentAccentColor.r);
        const gAcc = Math.round(this.currentAccentColor.g);
        const bAcc = Math.round(this.currentAccentColor.b);
        const accAlpha = Math.min(0.12, (0.08 + outerHarmonic * 0.04) * outerWaveOpacity);

        const outerWaveShadow = `0px 0px ${outerBlur.toFixed(1)}px ${outerSpread.toFixed(1)}px hsla(156, 80%, 42%, ${outerAlpha.toFixed(3)}), 0px 0px ${(outerBlur * 1.15).toFixed(1)}px ${(outerSpread * 1.1).toFixed(1)}px rgba(${rAcc}, ${gAcc}, ${bAcc}, ${accAlpha.toFixed(3)})`;
        const outerWaveBorder = 'none';

        return {
            activeOpacity: this.activeWeight,
            baseShadow: combinedBaseShadow,
            baseBorderColor,
            innerWaveExcursionPx,
            innerWaveOpacity,
            innerWaveShadow,
            innerWaveBorder,
            outerWaveExcursionPx,
            outerWaveOpacity,
            outerWaveShadow,
            outerWaveBorder,
        };
    }
}

export const aiDjVisualState = new AiDjVisualStateManager();
