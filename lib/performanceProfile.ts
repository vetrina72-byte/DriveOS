/**
 * Automotive Performance Profile & Adaptive Engine
 * Targets high responsiveness on low-end hardware (e.g. Samsung Galaxy Tab A8)
 * and seamless frame pacing across all devices (including iPad / Desktop).
 */

export type PerformanceTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PerformanceSettings {
  tier: PerformanceTier;
  dprCap: number;
  pause3DWhenAppOpen: boolean;
  enable3DDemandRendering: boolean;
  enableReflector: boolean;
  enableDynamicShadows: boolean;
  shadowMapSize: number;
  weatherParticles: number;
  mapTileCacheSize: number;
  envResolution: number;
  enableAntialiasing: boolean;
  simplifyCSSBlur: boolean;
}

class PerformanceProfileManager {
  private tier: PerformanceTier = 'HIGH';
  private listeners: Set<(settings: PerformanceSettings) => void> = new Set();
  private fpsListeners: Set<(fps: number) => void> = new Set();
  private frameTimes: number[] = [];
  private lastTimestamp: number = 0;
  private isMonitoring: boolean = false;
  private animFrameId: number | null = null;
  private currentFps: number = 60;

  constructor() {
    this.detectInitialTier();
  }

  private detectInitialTier() {
    if (typeof window === 'undefined') return;

    // Check manual override first
    try {
      const savedTier = localStorage.getItem('driveos_performance_tier') as PerformanceTier | null;
      if (savedTier === 'HIGH' || savedTier === 'MEDIUM' || savedTier === 'LOW') {
        this.tier = savedTier;
        return;
      }
    } catch {}

    const concurrency = navigator.hardwareConcurrency || 4;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    let isLowEnd = concurrency <= 4 || memory <= 3;
    let isMedium = concurrency <= 6 || memory <= 4;

    // Multi-factor detection: Check WebGL renderer unmasked info for mobile entry GPUs
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
          if (/Mali-G52|Mali-G51|Mali-G57|Mali-G71|Mali-G72|Mali-T|Adreno 5|Adreno 61|Adreno 62|Adreno 616|Adreno 618|Adreno 619|PowerVR|Unisoc|Spreadtrum|Vivante/i.test(renderer)) {
            isLowEnd = true;
          } else if (/Mali-G76|Mali-G77|Mali-G78|Adreno 63|Adreno 64|Adreno 65|Apple A10|Apple A11|Apple A12/i.test(renderer)) {
            isMedium = true;
          }
        }
      }
    } catch {
      // Ignore WebGL detection error
    }

    // Android tablet with <= 4GB RAM + touch
    if (isLowEnd || (maxTouchPoints > 0 && memory <= 4 && concurrency <= 8 && /Android/i.test(navigator.userAgent))) {
      this.tier = 'LOW';
    } else if (isMedium) {
      this.tier = 'MEDIUM';
    } else {
      this.tier = 'HIGH';
    }
  }

  public getSettings(): PerformanceSettings {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    switch (this.tier) {
      case 'LOW':
        return {
          tier: 'LOW',
          dprCap: 1.0,
          pause3DWhenAppOpen: true,
          enable3DDemandRendering: true,
          enableReflector: false,
          enableDynamicShadows: false,
          shadowMapSize: 256,
          weatherParticles: 35,
          mapTileCacheSize: 120,
          envResolution: 128,
          enableAntialiasing: false,
          simplifyCSSBlur: true,
        };
      case 'MEDIUM':
        return {
          tier: 'MEDIUM',
          dprCap: Math.min(dpr, 1.25),
          pause3DWhenAppOpen: true,
          enable3DDemandRendering: true,
          enableReflector: true,
          enableDynamicShadows: true,
          shadowMapSize: 512,
          weatherParticles: 150,
          mapTileCacheSize: 300,
          envResolution: 256,
          enableAntialiasing: true,
          simplifyCSSBlur: false,
        };
      case 'HIGH':
      default:
        return {
          tier: 'HIGH',
          dprCap: Math.min(dpr, 1.5),
          pause3DWhenAppOpen: true,
          enable3DDemandRendering: true,
          enableReflector: true,
          enableDynamicShadows: true,
          shadowMapSize: 1024,
          weatherParticles: 400,
          mapTileCacheSize: 600,
          envResolution: 512,
          enableAntialiasing: true,
          simplifyCSSBlur: false,
        };
    }
  }

  public setTier(newTier: PerformanceTier) {
    if (this.tier === newTier) return;
    this.tier = newTier;
    try {
      localStorage.setItem('driveos_performance_tier', newTier);
    } catch {}
    const settings = this.getSettings();
    this.listeners.forEach((listener) => listener(settings));
  }

  public getTier(): PerformanceTier {
    return this.tier;
  }

  public getFps(): number {
    return this.currentFps;
  }

  public subscribe(listener: (settings: PerformanceSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeFps(listener: (fps: number) => void): () => void {
    this.fpsListeners.add(listener);
    if (!this.isMonitoring && this.fpsListeners.size > 0) {
      this.startMonitoring();
    }
    return () => {
      this.fpsListeners.delete(listener);
      if (this.fpsListeners.size === 0) {
        this.stopMonitoring();
      }
    };
  }

  public startMonitoring() {
    if (typeof window === 'undefined' || this.isMonitoring) return;
    this.isMonitoring = true;
    this.lastTimestamp = performance.now();
    this.frameTimes = [];

    const monitorLoop = (timestamp: number) => {
      if (!this.isMonitoring) return;

      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      if (delta > 0) {
        this.frameTimes.push(delta);
        if (this.frameTimes.length > 30) {
          this.frameTimes.shift();
        }

        const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.currentFps = Math.round(1000 / avgDelta);
        this.fpsListeners.forEach((l) => l(this.currentFps));
      }

      this.animFrameId = requestAnimationFrame(monitorLoop);
    };

    this.animFrameId = requestAnimationFrame(monitorLoop);
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
