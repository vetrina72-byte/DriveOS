import { LocationInfo, StepInfo, TrafficSegment, RouteTrafficInfo, NormalizedRoute, RouteRequest } from '../types/maps';
import {
  AutomotiveCategory,
  PlaceEntity,
  SearchContext,
  SearchProvider
} from '../types/maps';
import {
  AUTOMOTIVE_CATEGORIES,
  calculateDistanceMeters,
  estimateDriveMinutes,
  placeEntityToLocationInfo
} from './AutomotivePlacesEngine';

export interface TomTomRouteSummary {
  lengthInMeters: number;
  travelTimeInSeconds: number;
  trafficDelayInSeconds: number;
  trafficLengthInMeters: number;
  departureTime: string;
  arrivalTime: string;
  noTrafficTravelTimeInSeconds?: number;
  historicTrafficTravelTimeInSeconds?: number;
  liveTrafficIncidentsTravelTimeInSeconds?: number;
}

export interface TomTomInstruction {
  routeOffsetInMeters: number;
  travelTimeInSeconds: number;
  point: { latitude: number; longitude: number };
  pointIndex: number;
  instructionType: string;
  street?: string;
  roadNumbers?: string[];
  countryCode?: string;
  message: string;
  maneuver: string;
  roundaboutExitNumber?: number;
  possibleCombineWithNext?: boolean;
}

export interface TomTomSection {
  startPointIndex: number;
  endPointIndex: number;
  sectionType: 'traffic' | 'motorway' | 'tollRoad' | 'tunnel' | 'ferry' | string;
  travelMode?: string;
  simpleCategory?: 'SLOW' | 'QUEUING' | 'STATIONARY' | string;
  effectiveSpeedInKmh?: number;
  delayInSeconds?: number;
  magnitudeOfDelay?: number;
}

export class TomTomProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly errorType: 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'INVALID_REQUEST' | 'SERVER_ERROR' | 'EMPTY' = 'SERVER_ERROR'
  ) {
    super(message);
    this.name = 'TomTomProviderError';
  }
}

const DEFAULT_TOMTOM_KEY = '28kLFnoWWWw0k0LZVQDqpZJqQ8j5fDQe';

export function getTomTomApiKey(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const local = window.localStorage.getItem('tomtom_api_key');
    if (local) return local;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TOMTOM_API_KEY) {
    return import.meta.env.VITE_TOMTOM_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env && process.env.VITE_TOMTOM_API_KEY) {
    return process.env.VITE_TOMTOM_API_KEY;
  }
  return DEFAULT_TOMTOM_KEY;
}

export function setTomTomApiKey(key: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (key && key.trim().length > 0) {
      window.localStorage.setItem('tomtom_api_key', key.trim());
    } else {
      window.localStorage.removeItem('tomtom_api_key');
    }
    window.dispatchEvent(new CustomEvent('tomtom-key-updated', { detail: key }));
  }
}

/**
 * Diagnostic logger (development only, excludes tokens/keys)
 */
function logDiagnostic(tag: string, payload: Record<string, any>) {
  if (
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') ||
    (typeof window !== 'undefined' && ((window as any).__DEV__ || (window as any).__DIAGNOSTIC_LOGS__))
  ) {
    console.log(`[${tag}]`, payload);
  }
}

/**
 * Maps TomTom maneuver string into standardized OSRM/Turn maneuver type & modifier
 */
function parseTomTomManeuver(maneuver: string, instructionText: string, exitNum?: number): { type: string; modifier?: string } {
  const m = (maneuver || '').toUpperCase();
  const text = (instructionText || '').toLowerCase();

  if (m.includes('ROUNDABOUT')) {
    return { type: 'roundabout', modifier: exitNum ? `exit-${exitNum}` : 'right' };
  }
  if (m.includes('ENTER_MOTORWAY') || m.includes('MOTORWAY')) {
    return { type: 'on ramp', modifier: m.includes('LEFT') ? 'left' : 'right' };
  }
  if (m.includes('TAKE_EXIT') || m.includes('EXIT')) {
    return { type: 'off ramp', modifier: m.includes('LEFT') ? 'left' : 'right' };
  }
  if (m === 'TURN_LEFT' || m === 'SHARP_LEFT') {
    return { type: 'turn', modifier: 'left' };
  }
  if (m === 'BEAR_LEFT' || m === 'KEEP_LEFT') {
    return { type: 'turn', modifier: 'slight left' };
  }
  if (m === 'TURN_RIGHT' || m === 'SHARP_RIGHT') {
    return { type: 'turn', modifier: 'right' };
  }
  if (m === 'BEAR_RIGHT' || m === 'KEEP_RIGHT') {
    return { type: 'turn', modifier: 'slight right' };
  }
  if (m === 'STRAIGHT' || m === 'FOLLOW') {
    return { type: 'continue', modifier: 'straight' };
  }
  if (m === 'ARRIVE' || m.includes('DESTINATION')) {
    return { type: 'arrive', modifier: 'straight' };
  }
  if (text.includes('sinistra')) {
    return { type: 'turn', modifier: 'left' };
  }
  if (text.includes('destra')) {
    return { type: 'turn', modifier: 'right' };
  }
  return { type: 'continue', modifier: 'straight' };
}

/**
 * Determines whether two routes are meaningfully different:
 * - Compares length delta
 * - Compares duration delta
 * - Calculates shared path ratio (coordinate sampling)
 * 
 * If two routes share > 90% of coordinate paths AND have < 3% duration difference,
 * they are deemed duplicates and the redundant route is pruned.
 */
export function areRoutesMeaningfullyDifferent(routeA: any, routeB: any): boolean {
  if (!routeA || !routeB) return true;

  const distDiffMeters = Math.abs(routeA.distance - routeB.distance);
  const durDiffSeconds = Math.abs(routeA.duration - routeB.duration);

  // If distance differs by more than 8 km or duration by more than 8 minutes, they are definitely different
  if (distDiffMeters > 8000 || durDiffSeconds > 480) {
    return true;
  }

  const coordsA: [number, number][] = routeA.geometry?.coordinates || [];
  const coordsB: [number, number][] = routeB.geometry?.coordinates || [];

  if (coordsA.length < 5 || coordsB.length < 5) {
    return distDiffMeters > 1500 || durDiffSeconds > 120;
  }

  // Sample routeA at ~20-30 points along its path
  const sampleStep = Math.max(1, Math.floor(coordsA.length / 25));
  let matchedPoints = 0;
  let totalSampled = 0;

  for (let i = 0; i < coordsA.length; i += sampleStep) {
    const ptA = coordsA[i];
    totalSampled++;

    // Check if any point in routeB is within 350 meters (~0.0035 degrees)
    let isNear = false;
    for (let j = 0; j < coordsB.length; j += Math.max(1, Math.floor(coordsB.length / 50))) {
      const ptB = coordsB[j];
      const dLng = ptA[0] - ptB[0];
      const dLat = ptA[1] - ptB[1];
      if (Math.abs(dLng) < 0.004 && Math.abs(dLat) < 0.004) {
        isNear = true;
        break;
      }
    }
    if (isNear) matchedPoints++;
  }

  const sharedRatio = totalSampled > 0 ? matchedPoints / totalSampled : 0;

  // If routes share more than 90% geometry and have under 3 min / 2 km difference, reject duplicate
  if (sharedRatio > 0.90 && durDiffSeconds < 180 && distDiffMeters < 2500) {
    return false;
  }

  return true;
}

// In-memory route cache for ultra-fast instant recall of computed routes
const tomtomRouteCache = new Map<string, { timestamp: number; data: any[] }>();
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Calculates high-accuracy automotive routes using TomTom Routing API v1
 * Includes live real-time traffic delays, motorway sections, and turn-by-turn guidance.
 */
export async function calculateTomTomRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  apiKey: string = getTomTomApiKey()
): Promise<any[] | null> {
  if (!apiKey) return null;

  // Check cache first for 0ms immediate response
  const cacheKey = `${start.lat.toFixed(4)},${start.lng.toFixed(4)}_${end.lat.toFixed(4)},${end.lng.toFixed(4)}`;
  const cached = tomtomRouteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ROUTE_CACHE_TTL_MS) {
    return cached.data;
  }

  const startTime = Date.now();
  logDiagnostic('ROUTE_REQUEST', {
    provider: 'tomtom',
    origin: { lat: start.lat, lng: start.lng },
    destination: { lat: end.lat, lng: end.lng },
    trafficEnabled: true,
    departAt: 'now',
    alternatives: 2,
    routeType: 'fastest',
    timestamp: new Date().toISOString()
  });

  try {
    // Step 1: Resolve legal vehicular access point on public drivable street
    const accessPoint = await resolveVehicularAccessPoint(end.lat, end.lng, apiKey);
    let currentTargetEnd = accessPoint.vehicularStopPoint;

    // Step 2: Build URL enforcing strict automotive constraints:
    // - travelMode=car: respects one-way streets (divieti d'accesso) & vehicular rules
    // - avoid=unpavedRoads,alreadyUsedRoads,carpools: excludes dirt roads, impassable paths, and unpaved trails
    // - vehicleWidth=2.2 & vehicleHeight=1.8 & vehicleWeight=1800: prevents routing through narrow pedestrian alleys, bollards, or streets too narrow for a car
    // - traffic=true & departAt=now: dynamic routing around active road closures, construction blocks, and incident shutdowns
    const buildRoutingUrl = (targetEnd: { lat: number; lng: number }, strictVehicleDimensions = true) => {
      let u = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lng}:${targetEnd.lat},${targetEnd.lng}/json` +
        `?key=${encodeURIComponent(apiKey)}` +
        `&traffic=true` +
        `&travelMode=car` +
        `&routeType=fastest` +
        `&avoid=unpavedRoads` +
        `&vehicleEngineType=combustion` +
        `&vehicleMaxSpeed=130` +
        `&vehicleCommercial=false` +
        `&computeTravelTimeFor=all` +
        `&sectionType=traffic` +
        `&sectionType=motorway` +
        `&sectionType=tollRoad` +
        `&sectionType=tunnel` +
        `&sectionType=ferry` +
        `&maxAlternatives=3` +
        `&instructionsType=text` +
        `&language=it-IT` +
        `&departAt=now` +
        `&report=effectiveSettings`;

      if (strictVehicleDimensions) {
        u += `&vehicleWidth=2.2&vehicleHeight=1.8&vehicleWeight=1800&vehicleLength=4.4`;
      }
      return u;
    };

    // Add 4.5s timeout so long routes never hang indefinitely and fallback quickly
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    let res = await fetch(buildRoutingUrl(currentTargetEnd, true), { signal: controller.signal });
    
    // If strict dimensions or impassable road returned 400 (e.g., dead-end garage ramp or private alley like Contrada Bastione 90),
    // snap destination to the nearest legal drivable public street
    if (!res.ok && res.status === 400) {
      logDiagnostic('ROUTE_RETRY_SMART_SNAP', {
        reason: 'TomTom rejected route for endpoint, snapping destination to nearest public drivable road'
      });
      const snapped = await snapToNearestDrivableRoad(end.lat, end.lng, apiKey);
      if (snapped) {
        currentTargetEnd = { lat: snapped.lat, lng: snapped.lng };
        res = await fetch(buildRoutingUrl(currentTargetEnd, true), { signal: controller.signal });
      }
      if (!res.ok) {
        res = await fetch(buildRoutingUrl(currentTargetEnd, false), { signal: controller.signal });
      }
    }
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`TomTom Routing API returned HTTP ${res.status}:`, errText);
      throw new TomTomProviderError(
        `TomTom Routing returned HTTP ${res.status}`,
        res.status,
        res.status === 429 ? 'RATE_LIMIT' : res.status === 401 || res.status === 403 ? 'AUTH' : 'SERVER_ERROR'
      );
    }

    const data = await res.json();
    if (!data.routes || !data.routes.length) {
      return null;
    }

    // Map TomTom routes to our application's unified route schema
    const formattedRoutes = data.routes.map((ttRoute: any, routeIndex: number) => {
      const summary: TomTomRouteSummary = ttRoute.summary;
      const leg = ttRoute.legs?.[0];
      const points: { latitude: number; longitude: number }[] = leg?.points || [];
      const instructions: TomTomInstruction[] = ttRoute.guidance?.instructions || [];
      const sections: TomTomSection[] = ttRoute.sections || [];

      // Build GeoJSON coordinates array [lng, lat]
      const coordinates: [number, number][] = points.map(p => [p.longitude, p.latitude]);

      // Build turn-by-turn steps
      const steps: StepInfo[] = [];
      const significantRoadSet = new Set<string>();

      if (instructions.length > 0) {
        for (let i = 0; i < instructions.length; i++) {
          const instr = instructions[i];
          const nextInstr = instructions[i + 1];
          const stepDist = nextInstr 
            ? Math.max(0, nextInstr.routeOffsetInMeters - instr.routeOffsetInMeters) 
            : Math.max(0, summary.lengthInMeters - instr.routeOffsetInMeters);
          const stepDur = nextInstr 
            ? Math.max(0, nextInstr.travelTimeInSeconds - instr.travelTimeInSeconds)
            : Math.max(0, summary.travelTimeInSeconds - instr.travelTimeInSeconds);

          const maneuverInfo = parseTomTomManeuver(instr.maneuver, instr.message, instr.roundaboutExitNumber);

          if (instr.roadNumbers && instr.roadNumbers.length > 0) {
            instr.roadNumbers.forEach(r => significantRoadSet.add(r));
          } else if (instr.street && instr.street.length > 3 && !instr.street.toLowerCase().includes('strada') && !instr.street.toLowerCase().includes('via')) {
            significantRoadSet.add(instr.street);
          }

          steps.push({
            maneuver: {
              type: maneuverInfo.type,
              modifier: maneuverInfo.modifier,
              location: [instr.point.longitude, instr.point.latitude],
              instruction: instr.message,
              exit: instr.roundaboutExitNumber
            },
            name: instr.street || (instr.roadNumbers && instr.roadNumbers[0]) || instr.message,
            ref: instr.roadNumbers ? instr.roadNumbers.join(', ') : '',
            distance: stepDist,
            duration: stepDur,
            driving_side: 'right'
          });
        }
      } else {
        steps.push({
          maneuver: {
            type: 'depart',
            location: coordinates[0] || [start.lng, start.lat],
            instruction: 'Procedi lungo il percorso'
          },
          name: 'Percorso',
          distance: summary.lengthInMeters,
          duration: summary.travelTimeInSeconds,
          driving_side: 'right'
        });
      }

      // If destination is inaccessible by car and requires walking the last meters:
      if (accessPoint.isWalkingRequired && accessPoint.distanceMeters > 0) {
        steps.push({
          maneuver: {
            type: 'walk',
            modifier: 'straight',
            location: [end.lng, end.lat],
            instruction: `Destinazione raggiungibile a piedi negli ultimi ${accessPoint.distanceMeters} m (strada non percorribile in auto)`
          },
          name: accessPoint.streetName ? `Punto di arresto auto su ${accessPoint.streetName}` : 'Tratto pedonale',
          ref: 'A piedi',
          distance: accessPoint.distanceMeters,
          duration: accessPoint.durationSeconds,
          driving_side: 'right',
          isWalkStep: true
        });
      }

      // Build live traffic segments from TomTom sections
      const trafficSegments: TrafficSegment[] = [];
      const trafficSections = sections.filter(s => (s.sectionType || '').toUpperCase() === 'TRAFFIC');

      for (const tSec of trafficSections) {
        const startIdx = Math.max(0, tSec.startPointIndex);
        const endIdx = Math.min(coordinates.length - 1, tSec.endPointIndex);
        if (endIdx > startIdx) {
          const segCoords = coordinates.slice(startIdx, endIdx + 1);
          const simpleCat = (tSec.simpleCategory || '').toUpperCase();
          let level: 'free' | 'moderate' | 'heavy' = 'moderate';
          if (simpleCat === 'STATIONARY' || simpleCat === 'QUEUING' || (tSec.delayInSeconds && tSec.delayInSeconds > 120)) {
            level = 'heavy';
          } else if (simpleCat === 'SLOW') {
            level = 'moderate';
          }

          trafficSegments.push({
            coordinates: segCoords,
            level,
            speedKmh: tSec.effectiveSpeedInKmh || (level === 'heavy' ? 20 : 45)
          });
        }
      }

      const hasMotorway = sections.some(s => (s.sectionType || '').toUpperCase() === 'MOTORWAY');
      const hasTollRoad = sections.some(s => {
        const st = (s.sectionType || '').toUpperCase();
        return st === 'TOLL_ROAD' || st === 'TOLLROAD' || st === 'TOLL';
      });
      const hasFerry = sections.some(s => (s.sectionType || '').toUpperCase() === 'FERRY');
      const trafficDelaySeconds = summary.trafficDelayInSeconds || 0;
      const noTrafficDuration = summary.noTrafficTravelTimeInSeconds || Math.max(0, summary.travelTimeInSeconds - trafficDelaySeconds);

      const trafficInfo: RouteTrafficInfo = {
        requested: true,
        available: summary.trafficDelayInSeconds !== undefined,
        delaySeconds: trafficDelaySeconds,
        noTrafficDurationSeconds: noTrafficDuration,
        trafficSegments,
        congestionLevel: trafficDelaySeconds > 300 ? 'heavy' : trafficDelaySeconds > 60 ? 'slow' : 'free'
      };

      return {
        id: `tt_route_${routeIndex}_${Date.now()}`,
        index: routeIndex,
        duration: summary.travelTimeInSeconds,
        distance: summary.lengthInMeters,
        trafficDelayInSeconds: trafficDelaySeconds,
        noTrafficDuration,
        departureTime: summary.departureTime,
        arrivalTime: summary.arrivalTime,
        hasMotorway,
        hasTollRoad,
        hasFerry,
        significantRoads: Array.from(significantRoadSet),
        trafficSegments,
        trafficInfo,
        lastMileWalk: accessPoint.isWalkingRequired ? accessPoint : null,
        legs: [
          {
            summary: `${summary.lengthInMeters} m`,
            weight: summary.travelTimeInSeconds,
            duration: summary.travelTimeInSeconds,
            distance: summary.lengthInMeters,
            steps
          }
        ],
        geometry: {
          type: 'LineString',
          coordinates
        },
        provider: 'tomtom'
      };
    });

    // Validate and deduplicate alternatives using areRoutesMeaningfullyDifferent
    const validRoutes: any[] = [];
    for (let i = 0; i < formattedRoutes.length; i++) {
      const cand = formattedRoutes[i];
      if (i === 0) {
        validRoutes.push(cand);
        continue;
      }
      // Check against already accepted routes
      let isUnique = true;
      for (const accepted of validRoutes) {
        if (!areRoutesMeaningfullyDifferent(cand, accepted)) {
          isUnique = false;
          logDiagnostic('ROUTE_PRUNED_DUPLICATE', {
            routeIndex: i,
            reason: 'Route overlaps >90% with accepted route with negligible duration delta',
            durationDeltaSec: Math.abs(cand.duration - accepted.duration),
            distanceDeltaM: Math.abs(cand.distance - accepted.distance)
          });
          break;
        }
      }
      if (isUnique) {
        validRoutes.push(cand);
      }
    }

    logDiagnostic('ROUTE_RESPONSE', {
      provider: 'tomtom',
      count: validRoutes.length,
      rawCount: formattedRoutes.length,
      durations: validRoutes.map(r => r.duration),
      distances: validRoutes.map(r => r.distance),
      trafficAvailable: true,
      trafficDelays: validRoutes.map(r => r.trafficDelayInSeconds),
      latencyMs: Date.now() - startTime
    });

    if (validRoutes.length > 0) {
      tomtomRouteCache.set(cacheKey, { timestamp: Date.now(), data: validRoutes });
    }

    return validRoutes;
  } catch (error) {
    if ((error as any)?.name === 'TomTomProviderError') throw error;
    console.error('TomTom route calculation error:', error);
    return null;
  }
}

/**
 * TomTom Search & Places Provider
 * Implements real destination autocomplete, POI category search, and corridor search.
 */
export class TomTomSearchProvider implements SearchProvider {
  readonly id = 'tomtom';
  readonly name = 'TomTom Places & Geocoding';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private getKey(): string {
    return this.apiKey || getTomTomApiKey();
  }

  /**
   * Fast Typeahead Autocomplete for Destinations and Places
   * Uses verified TomTom Search v2 with typeahead=true and idxSet=Geo,POI,PAD,Str,Addr
   */
  async autocomplete(
    query: string,
    context: SearchContext,
    signal?: AbortSignal
  ): Promise<PlaceEntity[]> {
    const key = this.getKey();
    const q = query.trim();
    if (!key || !q) return [];

    const startTime = Date.now();
    const refLat = context.vehiclePosition.lat || 41.9028;
    const refLng = context.vehiclePosition.lng || 12.4964;

    logDiagnostic('SEARCH_REQUEST', {
      provider: 'tomtom',
      mode: 'autocomplete',
      query: q,
      intent: 'typeahead_destination',
      position: { lat: refLat, lng: refLng },
      locale: 'it-IT',
      country: 'IT',
      timestamp: new Date().toISOString()
    });

    try {
      const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(q)}.json` +
        `?key=${encodeURIComponent(key)}` +
        `&typeahead=true` +
        `&language=it-IT` +
        `&countrySet=IT` +
        `&lat=${refLat}&lon=${refLng}` +
        `&idxSet=Geo,POI,PAD,Str,Addr` +
        `&limit=25`;

      const res = await fetch(url, { signal });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`TomTom autocomplete HTTP ${res.status}:`, errText);
        throw new TomTomProviderError(
          `TomTom autocomplete failed: ${res.status} ${errText}`,
          res.status,
          res.status === 429 ? 'RATE_LIMIT' : res.status === 400 ? 'INVALID_REQUEST' : res.status === 401 || res.status === 403 ? 'AUTH' : 'SERVER_ERROR'
        );
      }

      const data = await res.json();
      const rawResults = data.results || [];
      const places = this.parseTomTomResults(rawResults, refLat, refLng, q);

      logDiagnostic('SEARCH_RESPONSE', {
        provider: 'tomtom',
        query: q,
        status: 200,
        resultCount: places.length,
        latencyMs: Date.now() - startTime,
        rawResultTypes: rawResults.map((r: any) => `${r.type}:${r.entityType || r.poi?.name || 'addr'}`).slice(0, 5)
      });

      return places;
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e;
      if ((e as any) instanceof TomTomProviderError) throw e;
      throw new TomTomProviderError((e as any)?.message || 'Network error', undefined, 'NETWORK');
    }
  }

  /**
   * High-accuracy Destination & Address search (typeahead=false)
   */
  async search(
    query: string,
    context: SearchContext,
    signal?: AbortSignal
  ): Promise<PlaceEntity[]> {
    const key = this.getKey();
    const q = query.trim();
    if (!key || !q) return [];

    const startTime = Date.now();
    const refLat = context.vehiclePosition.lat || 41.9028;
    const refLng = context.vehiclePosition.lng || 12.4964;

    logDiagnostic('SEARCH_REQUEST', {
      provider: 'tomtom',
      mode: 'comprehensive_search',
      query: q,
      position: { lat: refLat, lng: refLng },
      locale: 'it-IT',
      country: 'IT',
      timestamp: new Date().toISOString()
    });

    try {
      const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(q)}.json` +
        `?key=${encodeURIComponent(key)}` +
        `&typeahead=false` +
        `&language=it-IT` +
        `&countrySet=IT` +
        `&lat=${refLat}&lon=${refLng}` +
        `&idxSet=Geo,POI,PAD,Str,Addr` +
        `&limit=20`;

      const res = await fetch(url, { signal });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new TomTomProviderError(
          `TomTom search failed: ${res.status}`,
          res.status,
          res.status === 429 ? 'RATE_LIMIT' : res.status === 400 ? 'INVALID_REQUEST' : 'SERVER_ERROR'
        );
      }

      const data = await res.json();
      const places = this.parseTomTomResults(data.results || [], refLat, refLng, q);

      logDiagnostic('SEARCH_RESPONSE', {
        provider: 'tomtom',
        query: q,
        status: 200,
        resultCount: places.length,
        latencyMs: Date.now() - startTime
      });

      return places;
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e;
      if ((e as any) instanceof TomTomProviderError) throw e;
      throw new TomTomProviderError((e as any)?.message || 'Network error', undefined, 'NETWORK');
    }
  }

  /**
   * Dedicated POI Category Search around center
   * Uses TomTom Nearby Search API: /search/2/nearbySearch/.json?categorySet=...
   */
  async searchCategory(
    categorySet: string,
    center: { lat: number; lng: number },
    radiusMeters: number = 30000,
    signal?: AbortSignal
  ): Promise<PlaceEntity[]> {
    const key = this.getKey();
    if (!key || !categorySet) return [];

    const startTime = Date.now();
    logDiagnostic('SEARCH_REQUEST', {
      provider: 'tomtom',
      mode: 'category_nearby',
      categorySet,
      position: center,
      radiusMeters,
      timestamp: new Date().toISOString()
    });

    try {
      const url = `https://api.tomtom.com/search/2/nearbySearch/.json` +
        `?key=${encodeURIComponent(key)}` +
        `&categorySet=${encodeURIComponent(categorySet)}` +
        `&lat=${center.lat}&lon=${center.lng}` +
        `&radius=${radiusMeters}` +
        `&language=it-IT` +
        `&countrySet=IT` +
        `&limit=20`;

      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new TomTomProviderError(
          `TomTom nearbySearch failed: ${res.status}`,
          res.status,
          res.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR'
        );
      }

      const data = await res.json();
      const places = this.parseTomTomResults(data.results || [], center.lat, center.lng, 'category_search');

      logDiagnostic('SEARCH_RESPONSE', {
        provider: 'tomtom',
        categorySet,
        status: 200,
        resultCount: places.length,
        latencyMs: Date.now() - startTime
      });

      return places;
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e;
      if ((e as any) instanceof TomTomProviderError) throw e;
      throw new TomTomProviderError((e as any)?.message || 'Network error', undefined, 'NETWORK');
    }
  }

  /**
   * Dedicated Brand Search around center with idxSet=POI
   * Returns exact brand locations (e.g. McDonald's, Eni, Q8, Conad, IKEA)
   */
  async searchBrand(
    brand: string,
    center: { lat: number; lng: number },
    radiusMeters: number = 40000,
    signal?: AbortSignal
  ): Promise<PlaceEntity[]> {
    const key = this.getKey();
    if (!key || !brand) return [];

    const startTime = Date.now();
    logDiagnostic('SEARCH_REQUEST', {
      provider: 'tomtom',
      mode: 'brand_search',
      brand,
      position: center,
      radiusMeters,
      timestamp: new Date().toISOString()
    });

    try {
      const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(brand)}.json` +
        `?key=${encodeURIComponent(key)}` +
        `&typeahead=false` +
        `&language=it-IT` +
        `&countrySet=IT` +
        `&lat=${center.lat}&lon=${center.lng}` +
        `&idxSet=POI` +
        `&radius=${radiusMeters}` +
        `&limit=20`;

      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new TomTomProviderError(
          `TomTom brand search failed: ${res.status}`,
          res.status,
          res.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR'
        );
      }

      const data = await res.json();
      const places = this.parseTomTomResults(data.results || [], center.lat, center.lng, brand);

      logDiagnostic('SEARCH_RESPONSE', {
        provider: 'tomtom',
        brand,
        status: 200,
        resultCount: places.length,
        latencyMs: Date.now() - startTime
      });

      return places;
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e;
      if ((e as any) instanceof TomTomProviderError) throw e;
      throw new TomTomProviderError((e as any)?.message || 'Network error', undefined, 'NETWORK');
    }
  }

  /**
   * Search Along Route Corridor (Highway / Trip corridor POIs)
   */
  async searchAlongRoute(
    query: string,
    routePoints: [number, number][],
    maxDetourSeconds: number = 900,
    categorySet?: string,
    signal?: AbortSignal
  ): Promise<PlaceEntity[]> {
    const key = this.getKey();
    if (!key || !routePoints || routePoints.length < 2) return [];

    try {
      const sampled: { lat: number; lon: number }[] = [];
      const step = Math.max(1, Math.floor(routePoints.length / 40));
      for (let i = 0; i < routePoints.length; i += step) {
        sampled.push({ lat: routePoints[i][0], lon: routePoints[i][1] });
      }
      if (sampled.length > 0 && (sampled[sampled.length - 1].lat !== routePoints[routePoints.length - 1][0])) {
        sampled.push({ lat: routePoints[routePoints.length - 1][0], lon: routePoints[routePoints.length - 1][1] });
      }

      const url = `https://api.tomtom.com/search/2/alongRouteSearch/${encodeURIComponent(query || 'service')}.json` +
        `?key=${encodeURIComponent(key)}` +
        `&maxDetourTime=${maxDetourSeconds}` +
        `&language=it-IT` +
        `&limit=15` +
        (categorySet ? `&categorySet=${encodeURIComponent(categorySet)}` : '');

      const body = {
        route: {
          points: sampled
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });

      if (!res.ok) {
        return this.search(query, { vehiclePosition: { lat: routePoints[0][0], lng: routePoints[0][1] } }, signal);
      }

      const data = await res.json();
      const places: PlaceEntity[] = [];

      for (const item of (data.results || [])) {
        const p = item.poi;
        const addr = item.address;
        const name = p?.name || addr?.freeformAddress || query;
        const detourSec = item.detourTime || 0;
        const detourMin = Math.round(detourSec / 60);

        places.push({
          id: item.id || `tt_ar_${item.position.lat}_${item.position.lon}`,
          name,
          formattedAddress: addr?.freeformAddress || [addr?.streetName, addr?.municipality].filter(Boolean).join(', '),
          category: 'fuel',
          position: { lat: item.position.lat, lng: item.position.lon },
          distanceMeters: item.dist,
          distanceKm: item.dist ? item.dist / 1000 : undefined,
          estimatedMinutes: estimateDriveMinutes(item.dist || 5000),
          detourMinutes: detourMin,
          source: 'tomtom'
        });
      }

      return places;
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e;
      console.warn('TomTom alongRoute error, falling back:', e);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceEntity | null> {
    const key = this.getKey();
    if (!key) return null;

    try {
      const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${encodeURIComponent(key)}&language=it-IT`;
      const res = await fetch(url, { signal });
      if (!res.ok) return null;

      const data = await res.json();
      const addr = data.addresses?.[0]?.address;
      if (!addr) return null;

      const street = addr.streetName || addr.street || '';
      const num = addr.streetNumber ? ` ${addr.streetNumber}` : '';
      const city = addr.municipality || addr.countrySubdivision || '';

      return {
        id: `rev_${lat}_${lng}`,
        name: street ? `${street}${num}` : (city || 'Posizione attuale'),
        formattedAddress: [city, addr.country].filter(Boolean).join(', '),
        position: { lat, lng },
        category: 'place',
        source: 'tomtom'
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Helper to parse and normalize TomTom search response objects into PlaceEntity
   */
  private parseTomTomResults(
    results: any[],
    refLat: number,
    refLng: number,
    originalQuery: string
  ): PlaceEntity[] {
    const places: PlaceEntity[] = [];

    for (const item of results) {
      const p = item.poi;
      const addr = item.address || {};
      const itemType = item.type; // 'Geography', 'POI', 'PAD', 'Str', 'Address', 'Cross Street'

      // 1. Resolve Primary Place Name and Entity Type
      let name = '';
      let entityType: PlaceEntity['entityType'] = 'place';

      if (itemType === 'Geography') {
        entityType = 'city';
        // Prominently use municipality name for cities/villages/localities
        name = addr.municipality || addr.localName || addr.freeformAddress || item.name || originalQuery;
      } else if (itemType === 'POI' && p?.name) {
        entityType = 'poi';
        name = p.name;
      } else if (itemType === 'PAD' || itemType === 'Address' || itemType === 'Addr') {
        entityType = 'address';
        name = addr.freeformAddress || [addr.streetName, addr.streetNumber].filter(Boolean).join(' ') || originalQuery;
      } else if (itemType === 'Str') {
        entityType = 'street';
        name = addr.streetName || addr.freeformAddress || originalQuery;
      } else {
        name = p?.name || addr.freeformAddress || addr.municipality || originalQuery;
      }

      const street = addr.streetName || '';
      const houseNumber = addr.streetNumber || '';
      const city = addr.municipality || addr.localName || '';
      const prov = addr.countrySecondarySubdivision || '';
      const region = addr.countrySubdivision || '';
      const postalCode = addr.postalCode || '';
      const country = 'Italia';

      // 2. Format clean address line
      let formattedAddress = '';
      if (itemType === 'Geography') {
        formattedAddress = [city, prov || region, country].filter(Boolean).join(', ');
      } else if (itemType === 'POI') {
        const streetPart = street ? `${street}${houseNumber ? ' ' + houseNumber : ''}` : '';
        formattedAddress = [streetPart, city, prov].filter(Boolean).join(', ') || addr.freeformAddress || '';
      } else {
        formattedAddress = addr.freeformAddress || [street ? `${street}${houseNumber ? ' ' + houseNumber : ''}` : '', city, prov].filter(Boolean).join(', ');
      }

      if (!formattedAddress) {
        formattedAddress = [city, region, country].filter(Boolean).join(', ');
      }
      formattedAddress = formattedAddress.replace(/, Italy$/i, ', Italia');

      // 3. Category Mapping
      let category: AutomotiveCategory = 'place';
      const cats = (p?.categories || []).map((c: string) => c.toLowerCase());
      const catStr = cats.join(' ');

      if (catStr.includes('petrol') || catStr.includes('gas') || catStr.includes('fuel') || catStr.includes('oil')) {
        category = 'fuel';
      } else if (catStr.includes('charging') || catStr.includes('electric vehicle')) {
        category = 'charging';
      } else if (catStr.includes('parking') || catStr.includes('garage')) {
        category = 'parking';
      } else if (catStr.includes('pizza') || catStr.includes('pizzeria')) {
        category = 'restaurant';
      } else if (catStr.includes('restaurant') || catStr.includes('cafe') || catStr.includes('food') || catStr.includes('bar') || catStr.includes('fast food')) {
        category = 'restaurant';
      } else if (catStr.includes('hotel') || catStr.includes('motel') || catStr.includes('accommodation') || catStr.includes('bed & breakfast')) {
        category = 'hotel';
      } else if (catStr.includes('pharmacy') || catStr.includes('chemist')) {
        category = 'pharmacy';
      } else if (catStr.includes('shop') || catStr.includes('supermarket') || catStr.includes('grocery') || catStr.includes('market')) {
        category = 'supermarket';
      } else if (catStr.includes('repair') || catStr.includes('service') || catStr.includes('workshop')) {
        category = 'repair';
      } else if (catStr.includes('airport')) {
        category = 'airport';
      } else if (catStr.includes('rail') || catStr.includes('train') || catStr.includes('station')) {
        category = 'train_station';
      } else if (entityType === 'address' || entityType === 'street') {
        category = 'address';
      }

      const lat = item.position.lat;
      const lng = item.position.lon;
      const distMeters = item.dist ?? calculateDistanceMeters(refLat, refLng, lat, lng);
      const distKm = distMeters / 1000;
      const estMin = estimateDriveMinutes(distMeters);
      const brand = (p?.brands && p.brands.length > 0) ? p.brands[0].name : undefined;

      places.push({
        id: item.id || `tt_${lat}_${lng}`,
        name,
        formattedAddress,
        street,
        houseNumber,
        city,
        province: prov,
        region,
        postalCode,
        country,
        category,
        categoryLabel: AUTOMOTIVE_CATEGORIES[category]?.label || 'Luogo',
        position: { lat, lng },
        distanceMeters: distMeters,
        distanceKm: distKm,
        estimatedMinutes: estMin,
        phone: p?.phone,
        website: p?.url,
        brand,
        type: itemType,
        entityType,
        providerScore: item.score,
        source: 'tomtom'
      });
    }

    return places;
  }
}

export async function searchTomTom(query: string, referencePos?: { lat: number; lng: number }, apiKey?: string): Promise<LocationInfo[]> {
  const provider = new TomTomSearchProvider(apiKey);
  const context: SearchContext = {
    vehiclePosition: referencePos || { lat: 41.9028, lng: 12.4964 }
  };
  const places = await provider.search(query, context);
  return places.map(placeEntityToLocationInfo);
}

export async function reverseGeocodeTomTom(lat: number, lng: number, apiKey?: string): Promise<LocationInfo | null> {
  const provider = new TomTomSearchProvider(apiKey);
  const place = await provider.reverseGeocode(lat, lng);
  return place ? placeEntityToLocationInfo(place) : null;
}

/**
 * Snap coordinate to nearest public vehicular drivable road.
 * Uses TomTom Reverse Geocoding with strict roadUse filtering (Arterial, LocalStreet, MajorRoad, SecondaryRoad, TertiaryRoad)
 * and strict filtering against private paths, ramps, staircases, or impassable cul-de-sacs.
 */
export async function snapToNearestDrivableRoad(
  lat: number,
  lng: number,
  apiKey: string = getTomTomApiKey()
): Promise<{ 
  lat: number; 
  lng: number; 
  streetName?: string; 
  isPrivateSnap?: boolean;
  distanceToTargetMeters?: number;
  isWalkingRequired?: boolean;
} | null> {
  if (!apiKey) return null;
  try {
    const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&roadUse=Arterial,LocalStreet,MajorRoad,SecondaryRoad,TertiaryRoad` +
      `&returnRoadUse=true` +
      `&returnSpeedLimit=true` +
      `&radius=300`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    
    // Find first valid vehicular roadway that is not a pedestrian alley, ramp, or private court
    const addresses = data.addresses || [];
    for (const addr of addresses) {
      if (addr && addr.position) {
        const parts = addr.position.split(',');
        const rLat = parseFloat(parts[0]);
        const rLng = parseFloat(parts[1]);
        if (isNaN(rLat) || isNaN(rLng)) continue;

        const street = (addr.address?.streetName || addr.address?.freeformAddress || '').toLowerCase();
        const roadUseArray = Array.isArray(addr.roadUse) ? addr.roadUse : (typeof addr.roadUse === 'string' ? [addr.roadUse] : []);
        const roadUseStr = roadUseArray.join(' ').toLowerCase();

        // Check if roadUse indicates non-car or restricted infrastructure
        const isRestrictedRoadUse = 
          roadUseStr.includes('pedestrian') ||
          roadUseStr.includes('bicycle') ||
          roadUseStr.includes('walkway') ||
          roadUseStr.includes('service') ||
          roadUseStr.includes('parking') ||
          roadUseStr.includes('steps') ||
          roadUseStr.includes('track');

        // Exclude pedestrian paths, stairways, garage ramps, and private interior passages
        const isInaccessibleAlley = 
          isRestrictedRoadUse ||
          street.includes('scalinata') || 
          street.includes('scalette') || 
          street.includes('scalina') || 
          street.includes('gradini') || 
          street.includes('rampa') || 
          street.includes('passaggio privato') || 
          street.includes('strada privata') || 
          street.includes('stradella privata') || 
          street.includes('stradella') || 
          street.includes('cortile') || 
          street.includes('garage') ||
          street.includes('box') ||
          street.includes('vicoletto') || 
          street.includes('chiasso') || 
          street.includes('passo carrabile') ||
          street.includes('pedonale') ||
          street.includes('sentiero') ||
          street.includes('mulattiera') ||
          street.includes('cul-de-sac') ||
          street.includes('vicolo cieco') ||
          street.includes('fondo chiuso') ||
          street.includes('accesso privato');

        if (isInaccessibleAlley && addresses.length > 1) {
          continue; // Skip to next candidate on main public road
        }

        const distMeters = Math.hypot((rLat - lat) * 111320, (rLng - lng) * 111320 * Math.cos((lat * Math.PI) / 180));
        return {
          lat: rLat,
          lng: rLng,
          streetName: addr.address?.streetName || addr.address?.freeformAddress,
          isPrivateSnap: false,
          distanceToTargetMeters: Math.round(distMeters),
          isWalkingRequired: distMeters > 10
        };
      }
    }
  } catch (e) {
    console.warn('snapToNearestDrivableRoad error:', e);
  }
  return null;
}

export async function resolveVehicularAccessPoint(
  lat: number,
  lng: number,
  apiKey: string = getTomTomApiKey()
): Promise<{
  vehicularStopPoint: { lat: number; lng: number };
  destinationPoint: { lat: number; lng: number };
  isWalkingRequired: boolean;
  distanceMeters: number;
  durationSeconds: number;
  streetName?: string;
  warningMessage: string;
  coordinates: [number, number][];
}> {
  const defaultRes = {
    vehicularStopPoint: { lat, lng },
    destinationPoint: { lat, lng },
    isWalkingRequired: false,
    distanceMeters: 0,
    durationSeconds: 0,
    streetName: undefined,
    warningMessage: '',
    coordinates: [[lng, lat], [lng, lat]] as [number, number][]
  };

  const snapped = await snapToNearestDrivableRoad(lat, lng, apiKey);
  if (!snapped) return defaultRes;

  const distMeters = Math.hypot((snapped.lat - lat) * 111320, (snapped.lng - lng) * 111320 * Math.cos((lat * Math.PI) / 180));
  const isWalkingRequired = distMeters > 12;
  const distanceMeters = Math.round(distMeters);
  const durationSeconds = Math.round(distMeters / 1.1); // ~4 km/h walking speed

  return {
    vehicularStopPoint: { lat: snapped.lat, lng: snapped.lng },
    destinationPoint: { lat, lng },
    isWalkingRequired,
    distanceMeters,
    durationSeconds,
    streetName: snapped.streetName,
    warningMessage: isWalkingRequired 
      ? `Destinazione raggiungibile solo a piedi negli ultimi ${distanceMeters} metri (strada non percorribile in auto)` 
      : '',
    coordinates: [[snapped.lng, snapped.lat], [lng, lat]]
  };
}
