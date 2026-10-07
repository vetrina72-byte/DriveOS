// Store condiviso e reattivo per 3D Performance Lab (Zero overhead quando disattivo)

export type ShadowMapSizeOption = 256 | 512 | 1024;
export type ParticleCountOption = 'default' | 0 | 100 | 400 | 800;

export interface PerfLabConfig {
  enabled3D: boolean;
  reflectorEnabled: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: ShadowMapSizeOption;
  weatherParticlesCount: ParticleCountOption;
}

export interface PerfLabMetrics {
  fps: number;
  frameTime: number;
  p95FrameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  frameloop: string;
  sceneMode: string;
  usedJSHeapSize: string;
}

type Listener = () => void;

class PerfLabStore {
  // Flag per abilitare la raccolta metriche dentro useFrame solo se il tab è aperto
  public isLabOpen: boolean = false;

  public config: PerfLabConfig = {
    enabled3D: true,
    reflectorEnabled: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    weatherParticlesCount: 'default',
  };

  public metrics: PerfLabMetrics = {
    fps: 0,
    frameTime: 0,
    p95FrameTime: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    dpr: 1,
    frameloop: 'always',
    sceneMode: 'idle',
    usedJSHeapSize: 'n/d',
  };

  // Buffer circolare per calcolo frame time e p95 (120 frame)
  private frameTimes: number[] = [];
  private readonly maxFrames = 120;
  private lastFrameTimestamp = 0;
  private lastMetricPublish = 0;

  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public setLabOpen(isOpen: boolean) {
    this.isLabOpen = isOpen;
    if (!isOpen) {
      this.frameTimes = [];
      this.lastFrameTimestamp = 0;
    }
  }

  public setConfig<K extends keyof PerfLabConfig>(key: K, value: PerfLabConfig[K]) {
    this.config[key] = value;
    this.notify();
  }

  public recordFrame(gl: THREE.WebGLRenderer, sceneMode: string) {
    if (!this.isLabOpen) return;

    const now = performance.now();
    if (this.lastFrameTimestamp > 0) {
      const deltaMs = now - this.lastFrameTimestamp;
      this.frameTimes.push(deltaMs);
      if (this.frameTimes.length > this.maxFrames) {
        this.frameTimes.shift();
      }
    }
    this.lastFrameTimestamp = now;

    // Aggiorna le metriche aggregate al massimo ~2 volte al secondo (ogni 500ms)
    if (now - this.lastMetricPublish >= 500 && this.frameTimes.length > 0) {
      this.lastMetricPublish = now;

      const sum = this.frameTimes.reduce((a, b) => a + b, 0);
      const avgFrameTime = sum / this.frameTimes.length;
      const fps = avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0;

      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      const p95FrameTime = sorted[p95Index] || 0;

      // Memory JS Heap
      let heapStr = 'n/d';
      if (typeof window !== 'undefined' && (performance as any).memory?.usedJSHeapSize) {
        const mb = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
        heapStr = `${mb.toFixed(1)} MB`;
      }

      this.metrics = {
        fps,
        frameTime: parseFloat(avgFrameTime.toFixed(1)),
        p95FrameTime: parseFloat(p95FrameTime.toFixed(1)),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        dpr: parseFloat(gl.getPixelRatio().toFixed(2)),
        frameloop: 'always',
        sceneMode,
        usedJSHeapSize: heapStr,
      };
    }
  }
}

export const perfLab = new PerfLabStore();
