/**
 * Automotive Performance Profile & Adaptive Engine
 * Targets high responsiveness on low-end hardware (e.g. Samsung Galaxy Tab A8)
 * and seamless frame pacing across all devices.
 */

export type PerformanceTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PerformanceSettings {
  tier: PerformanceTier;
  dprCap: number;
  pause3DWhenAppOpen: boolean;
  starfieldCount: number;
  weatherParticles: number;
  shadowMapSize: number;
  contentVisibility: boolean;
  enableAntialiasing: boolean;
}

class PerformanceProfileManager {
  private tier: PerformanceTier = 'HIGH';
  private listeners: Set<(settings: PerformanceSettings) => void> = new Set();
  private frameTimes: number[] = [];
  private lastTimestamp: number = 0;
  private consecutiveGoodFrames: number = 0;
  private isMonitoring: boolean = false;
  private animFrameId: number | null = null;

  constructor() {
    this.detectInitialTier();
    this.startFrameMonitoring();
  }

  private detectInitialTier() {
    if (typeof window === 'undefined') return;

    const concurrency = navigator.hardwareConcurrency || 4;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
    const dpr = window.devicePixelRatio || 1;

    let isLowEnd = concurrency <= 4 || memory <= 3;

    // Check WebGL renderer for mobile/low-end GPUs (e.g., Mali G52/G57, Adreno 5xx/61x, PowerVR)
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
          if (/Mali-G52|Mali-G51|Mali-G71|Mali-T|Adreno 5|Adreno 61|PowerVR/i.test(renderer)) {
            isLowEnd = true;
          }
        }
      }
    } catch {
      // Ignore WebGL context creation error
    }

    if (isLowEnd) {
      this.tier = 'LOW';
    } else if (concurrency <= 6 || memory <= 4 || dpr > 2) {
      this.tier = 'MEDIUM';
    } else {
      this.tier = 'HIGH';
    }
  }

  private startFrameMonitoring() {
    if (typeof window === 'undefined') return;

    this.isMonitoring = true;
    const monitorLoop = (timestamp: number) => {
      if (!this.isMonitoring) return;

      if (this.lastTimestamp > 0) {
        const delta = timestamp - this.lastTimestamp;
        this.frameTimes.push(delta);
        if (this.frameTimes.length > 60) {
          this.frameTimes.shift();
        }

        // Check for sustained frame drops (> 33ms = drop below 30fps)
        if (this.frameTimes.length >= 30) {
          const drops = this.frameTimes.filter((t) => t > 33.3).length;
          if (drops >= 6) {
            // Demote tier if experiencing sustained frame drops
            if (this.tier === 'HIGH') {
              this.setTier('MEDIUM');
              this.consecutiveGoodFrames = 0;
            } else if (this.tier === 'MEDIUM' && drops >= 10) {
              this.setTier('LOW');
              this.consecutiveGoodFrames = 0;
            }
          } else if (drops === 0 && delta < 18) {
            this.consecutiveGoodFrames++;
            // Hysteresis: only promote back up after 360 continuous smooth frames (~6 seconds)
            if (this.consecutiveGoodFrames > 360) {
              if (this.tier === 'LOW') {
                this.setTier('MEDIUM');
                this.consecutiveGoodFrames = 0;
              } else if (this.tier === 'MEDIUM') {
                this.setTier('HIGH');
                this.consecutiveGoodFrames = 0;
              }
            }
          } else {
            this.consecutiveGoodFrames = 0;
          }
        }
      }

      this.lastTimestamp = timestamp;
      this.animFrameId = requestAnimationFrame(monitorLoop);
    };

    this.animFrameId = requestAnimationFrame(monitorLoop);
  }

  public getSettings(): PerformanceSettings {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    switch (this.tier) {
      case 'LOW':
        return {
          tier: 'LOW',
          dprCap: Math.min(dpr, 1.0),
          pause3DWhenAppOpen: true,
          starfieldCount: 40,
          weatherParticles: 25,
          shadowMapSize: 256,
          contentVisibility: true,
          enableAntialiasing: false,
        };
      case 'MEDIUM':
        return {
          tier: 'MEDIUM',
          dprCap: Math.min(dpr, 1.25),
          pause3DWhenAppOpen: true,
          starfieldCount: 75,
          weatherParticles: 50,
          shadowMapSize: 512,
          contentVisibility: true,
          enableAntialiasing: true,
        };
      case 'HIGH':
      default:
        return {
          tier: 'HIGH',
          dprCap: Math.min(dpr, 1.75),
          pause3DWhenAppOpen: true,
          starfieldCount: 150,
          weatherParticles: 80,
          shadowMapSize: 1024,
          contentVisibility: true,
          enableAntialiasing: true,
        };
    }
  }

  public setTier(newTier: PerformanceTier) {
    if (this.tier === newTier) return;
    this.tier = newTier;
    const settings = this.getSettings();
    this.listeners.forEach((listener) => listener(settings));
  }

  public subscribe(listener: (settings: PerformanceSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public stopMonitoring() {
    this.isMonitoring = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const performanceManager = new PerformanceProfileManager();
