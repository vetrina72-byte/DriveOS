export interface LocationInfo {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  category?: 'restaurant' | 'fuel' | 'parking' | 'hotel' | 'pharmacy' | 'supermarket' | 'charging' | 'address' | 'place';
  isShop?: boolean;
  dk?: number; // distance in km
  em?: number; // ETA in minutes
  osm_key?: string;
  osm_value?: string;
  type?: string;
}

export interface TrafficSegment {
  coordinates: [number, number][];
  level: 'free' | 'moderate' | 'heavy';
  speedKmh: number;
}

export interface RouteOption {
  index: number;
  distance: number; // in meters
  duration: number; // in seconds
  summary: string;
  hasMotorway: boolean;
  timeDiffMinutes: number; // 0 for primary, >0 for slower
  distDiffKm: number; // difference in km relative to primary
  label: string; // e.g. "Più veloce", "Panoramico", "Senza pedaggio", "Più breve"
  tag: string; // e.g. "Autostrada", "Strada Statale / Panoramica"
  gainSummary?: string; // e.g. "Risparmi 18 min", "Eviti pedaggi", "Meno km"
  whyChoose?: string; // Clear explanation of why the driver might prefer this route
  badgeType?: 'fastest' | 'scenic' | 'toll_free' | 'shortest' | 'alternative';
  speedCamerasCount?: number;
  trafficSignalsCount?: number;
  trafficCondition?: 'free' | 'moderate' | 'heavy';
  trafficDelayMinutes?: number;
  trafficSegments?: TrafficSegment[];
  geometry: any; // GeoJSON LineString
  steps: any[];
}

export interface RoadHazard {
  id: string;
  type: 'speed_camera' | 'traffic_signal' | 'roadworks' | 'detour' | 'hazard' | 'congestion';
  lat: number;
  lng: number;
  speedLimit?: number; // in km/h
  name?: string;
  description?: string;
  distanceFromStartMeters?: number;
}

