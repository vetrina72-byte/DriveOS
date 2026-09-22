export interface WeatherFrame {
  time: number; // Unix timestamp
  path: string; // URL path or full URL for the raster tile
}

export interface IRadarProvider {
  fetchFrames(): Promise<{ past: WeatherFrame[]; nowcast: WeatherFrame[] }>;
  getTileUrl(path: string, x: number | string, y: number | string, z: number | string): string;
}

// Legacy RainViewer Provider (Historical only)
export class RainViewerProvider implements IRadarProvider {
  async fetchFrames(): Promise<{ past: WeatherFrame[]; nowcast: WeatherFrame[] }> {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) throw new Error();
      const d = await res.json();
      const past = (d.radar?.past || [])
        .filter((f: any) => f && f.path)
        .map((f: any) => ({ time: f.time, path: f.path }));
      const nowcast = (d.radar?.nowcast || [])
        .filter((f: any) => f && f.path)
        .map((f: any) => ({ time: f.time, path: f.path }));
      return { past, nowcast };
    } catch (e) {
      console.error('[WEATHER] Failed to load RainViewer config', e);
      return { past: [], nowcast: [] };
    }
  }

  getTileUrl(path: string, x: number | string, y: number | string, z: number | string): string {
    if (!path) return '';
    // Scheme 8: Emerald/Green Tesla-style radar palette
    // Options 1_1: Smooth tile interpolation (1) + Snow/Ice rendering (1)
    return `https://tilecache.rainviewer.com${path}/512/${z}/${x}/${y}/8/1_1.webp`;
  }
}

// Future Meteomatics Provider
export class MeteomaticsProvider implements IRadarProvider {
  // Requires authentication, WMS endpoint configuration
  // For now, this is a stub for architectural readiness
  private baseUrl = 'https://api.meteomatics.com';

  async fetchFrames(): Promise<{ past: WeatherFrame[]; nowcast: WeatherFrame[] }> {
    console.warn('MeteomaticsProvider requires backend proxy or API key configuration.');
    return { past: [], nowcast: [] };
  }

  getTileUrl(path: string, x: number | string, y: number | string, z: number | string): string {
    // Meteomatics WMS URL structure would go here
    return '';
  }
}

export class RadarService {
  private provider: IRadarProvider;

  constructor(provider: IRadarProvider) {
    this.provider = provider;
  }

  async fetchFrames() {
    return await this.provider.fetchFrames();
  }

  getTileUrl(path: string, x: number | string, y: number | string, z: number | string): string {
    return this.provider.getTileUrl(path, x, y, z);
  }
}

// Currently active provider
export const globalRadarService = new RadarService(new RainViewerProvider());
