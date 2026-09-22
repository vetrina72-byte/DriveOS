export type AutomotiveCategory =
  | 'fuel'
  | 'charging'
  | 'parking'
  | 'restaurant'
  | 'hotel'
  | 'pharmacy'
  | 'supermarket'
  | 'repair'
  | 'airport'
  | 'train_station'
  | 'address'
  | 'place';

export type SearchIntentType =
  | 'ADDRESS'
  | 'SPECIFIC_POI'
  | 'CITY_LOCALITY'
  | 'CATEGORY_NEARBY'
  | 'CATEGORY_WITH_LOCATION'
  | 'NATURAL_QUERY'
  | 'ALONG_ROUTE'
  | 'AUTOCOMPLETE_PREDICTION';

export interface PlaceEntity {
  id: string;
  name: string;
  formattedAddress: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  province?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  category: AutomotiveCategory;
  categoryLabel?: string;
  position: { lat: number; lng: number };
  distanceMeters?: number;
  distanceKm?: number;
  estimatedMinutes?: number;
  phone?: string;
  website?: string;
  openingHours?: { openNow?: boolean; text?: string };
  rating?: number;
  priceLevel?: number;
  brand?: string;
  type?: string;
  entityType?: 'city' | 'locality' | 'street' | 'address' | 'poi' | 'category' | 'administrative';
  source?: 'tomtom' | 'geoapify' | 'osm' | 'trie';
  detourMinutes?: number;
  providerScore?: number;
  matchScore?: number;
}

export interface SearchContext {
  vehiclePosition: { lat: number; lng: number };
  vehicleHeading?: number;
  vehicleSpeedKmh?: number;
  currentRoad?: string;
  mapViewport?: { center: { lat: number; lng: number }; zoom: number; bounds?: [number, number, number, number] };
  isNavigating?: boolean;
  activeRoute?: {
    destination?: { lat: number; lng: number; name: string };
    coordinates?: [number, number][];
    remainingDistanceMeters?: number;
    remainingDurationSeconds?: number;
  };
}

export interface AutocompletePrediction {
  id: string;
  text: string;
  primaryText: string;
  secondaryText: string;
  type: 'category' | 'place' | 'address' | 'brand';
  category: AutomotiveCategory;
  categoryLabel: string;
  placeId?: string;
  position?: { lat: number; lng: number };
}

export interface SearchProvider {
  readonly id: string;
  readonly name: string;
  autocomplete(query: string, context: SearchContext, signal?: AbortSignal): Promise<PlaceEntity[]>;
  search(query: string, context: SearchContext, signal?: AbortSignal): Promise<PlaceEntity[]>;
  reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceEntity | null>;
  searchAlongRoute?(query: string, routePoints: [number, number][], maxDetourSeconds?: number, signal?: AbortSignal): Promise<PlaceEntity[]>;
}

export interface LocationInfo {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  category?: AutomotiveCategory;
  isShop?: boolean;
  dk?: number; // distance in km
  em?: number; // ETA in minutes
  osm_key?: string;
  osm_value?: string;
  type?: string;
  placeId?: string;
  phone?: string;
  website?: string;
  openNow?: boolean;
  rating?: number;
  brand?: string;
  detourMinutes?: number;
}

export interface TrafficSegment {
  coordinates: [number, number][];
  level: 'free' | 'moderate' | 'heavy';
  speedKmh: number;
}

export interface RouteTrafficInfo {
  requested: boolean;
  available: boolean;
  delaySeconds: number | null;
  noTrafficDurationSeconds: number | null;
  trafficSegments: TrafficSegment[];
  congestionLevel: 'free' | 'slow' | 'heavy';
}

export interface RouteRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  travelMode?: 'car';
  departAt?: string;
  trafficEnabled?: boolean;
  routeType?: 'fastest' | 'shortest' | 'eco';
  maxAlternatives?: number;
  avoid?: ('tollRoads' | 'motorways' | 'ferries')[];
}

export interface LastMileWalkInfo {
  isWalkingRequired: boolean;
  distanceMeters: number;
  durationSeconds: number;
  vehicularStopPoint: { lat: number; lng: number };
  destinationPoint: { lat: number; lng: number };
  streetName?: string;
  warningMessage: string;
  coordinates: [number, number][]; // [lng, lat] coordinate pair array connecting vehicle stop to exact target pin
}

export interface RouteOption {
  index: number;
  distance: number; // in meters
  duration: number; // in seconds
  summary: string;
  hasMotorway: boolean;
  hasFerry?: boolean;
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
  trafficInfo?: RouteTrafficInfo;
  lastMileWalk?: LastMileWalkInfo | null;
  geometry: any; // GeoJSON LineString
  steps: any[];
}

export interface NormalizedRoute {
  id: string;
  index: number;
  distanceMeters: number;
  durationSeconds: number;
  noTrafficDurationSeconds: number;
  trafficDelaySeconds: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  legs: any[];
  sections: any[];
  hasMotorway: boolean;
  hasTollRoad: boolean;
  hasFerry: boolean;
  significantRoads: string[];
  trafficInfo: RouteTrafficInfo;
  lastMileWalk?: LastMileWalkInfo | null;
  label: string;
  tag: string;
  gainSummary: string;
  whyChoose: string;
  badgeType: 'fastest' | 'scenic' | 'toll_free' | 'shortest' | 'alternative';
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

