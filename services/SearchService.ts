/**
 * SearchService.ts
 * 
 * Automotive Search & Autocomplete Orchestrator:
 * - Provider-based decoupled architecture (TomTom, Geoapify, Nominatim)
 * - Strict separation of Autocomplete Typeahead (<100ms) vs Comprehensive Search vs POI Category Search
 * - Strategy pattern based on Classified Semantic Intent
 * - Automotive context integration (Vehicle Position, Heading, Route Corridor, Viewport)
 * - True Error-based fallback: Fallback ONLY triggers on genuine provider failure, NOT on low result count!
 * - Zero hardcoding: pure generalized spatial and linguistic ranking.
 */

import { LocationInfo, PlaceEntity, SearchContext, AutocompletePrediction, AutomotiveCategory, SearchProvider } from '../types/maps';
import { TelemetryStore } from '../context/TelemetryStore';
import { TomTomSearchProvider, TomTomProviderError } from './TomTomService';
import {
  classifySearchIntent,
  resolveSearchOrigin,
  rankPlaceEntity,
  deduplicatePlaces,
  placeEntityToLocationInfo,
  calculateDistanceMeters,
  estimateDriveMinutes,
  AUTOMOTIVE_CATEGORIES,
  normalizeQuery
} from './AutomotivePlacesEngine';
import { fastTypeaheadTrie } from './GeoNLPResolutionEngine';

export { fastTypeaheadTrie };

export interface ISearchProvider {
  search(query: string, referencePos?: { lat: number; lng: number }, signal?: AbortSignal): Promise<LocationInfo[]>;
  reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<LocationInfo | null>;
}

/**
 * Geoapify Automotive Search Provider (Fallback)
 */
export class GeoapifyAutomotiveSearchProvider implements ISearchProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, referencePos?: { lat: number; lng: number }, signal?: AbortSignal): Promise<LocationInfo[]> {
    try {
      const q = query.trim();
      const refLat = referencePos?.lat ?? TelemetryStore.position?.lat ?? 41.9028;
      const refLng = referencePos?.lng ?? TelemetryStore.position?.lng ?? 12.4964;

      const geocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
        q
      )}&filter=countrycode:it&bias=proximity:${refLng},${refLat}&lang=it&limit=15&apiKey=${this.apiKey}`;

      const res = await fetch(geocodeUrl, { signal });
      if (!res.ok) return [];

      const data = await res.json();
      const results: LocationInfo[] = [];

      for (const f of data.features || []) {
        const p = f.properties;
        const lat = p.lat;
        const lng = p.lon;
        const distM = calculateDistanceMeters(refLat, refLng, lat, lng);
        const distKm = distM / 1000;

        results.push({
          lat,
          lng,
          name: p.name || p.street || p.city || p.formatted || q,
          address: p.formatted ? p.formatted.replace(/, Italy$/i, ', Italia') : `${p.city || ''}, Italia`,
          category: 'place',
          isShop: Boolean(p.category && (p.category.includes('commercial') || p.category.includes('catering'))),
          dk: distKm,
          em: estimateDriveMinutes(distM),
          placeId: p.place_id
        });
      }

      return results;
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e;
      console.warn('Geoapify search error:', e);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<LocationInfo | null> {
    try {
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&lang=it&apiKey=${this.apiKey}`;
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.features || data.features.length === 0) return null;
      const p = data.features[0].properties;
      return {
        lat,
        lng,
        name: p.street || p.name || p.city || 'Posizione attuale',
        address: p.formatted ? p.formatted.replace(/, Italy$/i, ', Italia') : [p.city, p.country].filter(Boolean).join(', ')
      };
    } catch (e) {
      return null;
    }
  }
}

/**
 * Nominatim / OpenStreetMap Search Provider (Secondary Fallback)
 */
export class NominatimSearchProvider implements ISearchProvider {
  async search(query: string, referencePos?: { lat: number; lng: number }, signal?: AbortSignal): Promise<LocationInfo[]> {
    try {
      const refLat = referencePos?.lat ?? TelemetryStore.position?.lat ?? 41.9028;
      const refLng = referencePos?.lng ?? TelemetryStore.position?.lng ?? 12.4964;
      const viewbox = `${refLng - 0.5},${refLat + 0.5},${refLng + 0.5},${refLat - 0.5}`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&countrycodes=it&viewbox=${viewbox}&bounded=0&addressdetails=1&limit=12&accept-language=it`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'AutomotiveInfotainmentApp/3.0' },
        signal
      });
      if (!res.ok) return [];
      const data = await res.json();

      return data.map((item: any) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const addr = item.address || {};
        const name = item.name || addr.road || addr.city || addr.town || addr.village || query;
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        const prov = addr.county || addr.state || '';
        const formattedAddress = [addr.road ? `${addr.road}${addr.house_number ? ' ' + addr.house_number : ''}` : '', city, prov].filter(Boolean).join(', ');
        const distM = calculateDistanceMeters(refLat, refLng, lat, lng);

        return {
          lat,
          lng,
          name,
          address: formattedAddress || item.display_name,
          category: 'place',
          isShop: item.class === 'shop' || item.class === 'amenity',
          dk: distM / 1000,
          em: estimateDriveMinutes(distM),
          osm_key: item.class,
          osm_value: item.type
        };
      });
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e;
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<LocationInfo | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=it`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AutomotiveInfotainmentApp/3.0' },
        signal
      });
      if (!res.ok) return null;
      const data = await res.json();
      const addr = data.address || {};
      const street = addr.road || '';
      const num = addr.house_number ? ` ${addr.house_number}` : '';
      const city = addr.city || addr.town || addr.village || '';

      return {
        lat,
        lng,
        name: street ? `${street}${num}` : (city || 'Posizione attuale'),
        address: data.display_name
      };
    } catch (e) {
      return null;
    }
  }
}

/**
 * Automotive Unified Search Service Orchestrator
 */
export class SearchService {
  private tomtomProvider: TomTomSearchProvider;
  private primaryFallback: ISearchProvider;
  private nominatimProvider: ISearchProvider;
  private anchorCache: Map<string, { lat: number; lng: number }> = new Map();

  constructor(primaryFallback?: ISearchProvider) {
    this.tomtomProvider = new TomTomSearchProvider();
    this.primaryFallback = primaryFallback || new GeoapifyAutomotiveSearchProvider('0d2c9c7f72c0477eb3260838db72a383');
    this.nominatimProvider = new NominatimSearchProvider();
  }

  private buildSearchContext(referencePosOrContext?: { lat: number; lng: number } | SearchContext): SearchContext {
    if (referencePosOrContext && 'vehiclePosition' in referencePosOrContext) {
      return referencePosOrContext as SearchContext;
    }
    const pos = referencePosOrContext as { lat: number; lng: number } | undefined;
    const carLat = pos?.lat ?? TelemetryStore.position?.lat ?? 38.1157; // Palermo default
    const carLng = pos?.lng ?? TelemetryStore.position?.lng ?? 13.3615;
    return {
      vehiclePosition: { lat: carLat, lng: carLng },
      vehicleHeading: TelemetryStore.heading || 0,
      vehicleSpeedKmh: TelemetryStore.speed || 0
    };
  }

  /**
   * Resolves a geographic location anchor (e.g. "Palermo", "Cefalù", "Milazzo") to coordinates
   */
  private async resolveAnchor(anchorText: string, signal?: AbortSignal): Promise<{ lat: number; lng: number } | null> {
    const key = normalizeQuery(anchorText);
    if (this.anchorCache.has(key)) {
      return this.anchorCache.get(key)!;
    }

    try {
      const places = await this.tomtomProvider.search(anchorText, { vehiclePosition: { lat: 41.9028, lng: 12.4964 } }, signal);
      if (places && places.length > 0) {
        const pos = places[0].position;
        this.anchorCache.set(key, pos);
        return pos;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /**
   * Fast Autocomplete Predictions (Typeahead as user types)
   * Dispatches according to Classified Intent:
   * - CATEGORY_NEARBY -> Dedicated Nearby Search with categorySet
   * - SPECIFIC_POI (Brand) -> Dedicated Brand Search with idxSet=POI
   * - CITY_LOCALITY / ADDRESS / DESTINATION -> TomTom Autocomplete with idxSet=Geo,POI,PAD,Str,Addr
   * 
   * Fallback rule: NEVER fallback simply because results count is small (1 result like Milazzo is valid!).
   * ONLY fallback if the provider genuinely fails with network/server error.
   */
  async autocomplete(
    query: string,
    referencePosOrContext?: { lat: number; lng: number } | SearchContext,
    signal?: AbortSignal
  ): Promise<LocationInfo[]> {
    const q = query.trim();
    if (!q || q.length < 1) return [];

    const context = this.buildSearchContext(referencePosOrContext);
    const intent = classifySearchIntent(q, context);
    const origin = resolveSearchOrigin(intent, context, null);

    let rawPlaces: PlaceEntity[] = [];
    let providerSucceeded = false;

    try {
      // Strategy 1: Dedicated Category Autocomplete (e.g. "benzina", "parcheggio", "ricarica")
      if (intent.intentType === 'CATEGORY_NEARBY' && intent.category) {
        const catDef = AUTOMOTIVE_CATEGORIES[intent.category];
        if (catDef && catDef.tomtomCategorySet) {
          rawPlaces = await this.tomtomProvider.searchCategory(
            catDef.tomtomCategorySet,
            origin.center,
            30000,
            signal
          );
          providerSucceeded = true;
        }
      }
      // Strategy 2: Dedicated Brand Autocomplete (e.g. "McDonald's", "Eni", "Q8")
      else if (intent.intentType === 'SPECIFIC_POI' && intent.properName && AUTOMOTIVE_CATEGORIES[intent.category as any]?.brands?.some(b => normalizeQuery(b) === normalizeQuery(intent.properName!))) {
        rawPlaces = await this.tomtomProvider.searchBrand(
          intent.properName,
          origin.center,
          40000,
          signal
        );
        providerSucceeded = true;
      }
      // Strategy 3: Standard Destination / Locality Typeahead Autocomplete
      else {
        rawPlaces = await this.tomtomProvider.autocomplete(q, context, signal);
        providerSucceeded = true;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      console.warn('TomTom autocomplete primary provider failed, executing fallback:', err?.message || err);
      providerSucceeded = false;
    }

    // Only fallback if the primary provider actually threw or failed!
    if (!providerSucceeded) {
      try {
        const fallbackResults = await this.primaryFallback.search(q, origin.center, signal);
        for (const fb of fallbackResults) {
          rawPlaces.push({
            id: `fb_${fb.lat}_${fb.lng}`,
            name: fb.name,
            formattedAddress: fb.address || '',
            category: fb.category || 'place',
            position: { lat: fb.lat, lng: fb.lng },
            distanceMeters: calculateDistanceMeters(context.vehiclePosition.lat, context.vehiclePosition.lng, fb.lat, fb.lng),
            distanceKm: fb.dk,
            estimatedMinutes: fb.em,
            type: fb.type,
            source: 'geoapify'
          });
        }
      } catch (fbErr: any) {
        if (fbErr?.name === 'AbortError') throw fbErr;
      }
    }

    // Distance and drive time calculations from vehicle
    for (const p of rawPlaces) {
      p.distanceMeters = calculateDistanceMeters(
        context.vehiclePosition.lat,
        context.vehiclePosition.lng,
        p.position.lat,
        p.position.lng
      );
      p.distanceKm = p.distanceMeters / 1000;
      p.estimatedMinutes = estimateDriveMinutes(p.distanceMeters);
    }

    // Spatial Deduplication
    const deduplicated = deduplicatePlaces(rawPlaces);

    // Learning-to-Rank Scoring
    const scored = deduplicated
      .map(p => {
        const score = rankPlaceEntity(p, intent, origin, context.vehiclePosition);
        p.matchScore = score;
        return { place: p, score };
      })
      .filter(item => item.score > 0.12);

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 8).map(s => placeEntityToLocationInfo(s.place));
  }

  /**
   * Comprehensive Final Search (On Enter, destination select, or category browse)
   */
  async search(
    query: string,
    referencePosOrContext?: { lat: number; lng: number } | SearchContext,
    signal?: AbortSignal
  ): Promise<LocationInfo[]> {
    const q = query.trim();
    if (!q) return [];

    const context = this.buildSearchContext(referencePosOrContext);
    const intent = classifySearchIntent(q, context);

    let anchorCoords: { lat: number; lng: number } | null = null;
    if (intent.locationAnchor) {
      anchorCoords = await this.resolveAnchor(intent.locationAnchor, signal);
    }

    const origin = resolveSearchOrigin(intent, context, anchorCoords);
    let rawPlaces: PlaceEntity[] = [];
    let providerSucceeded = false;

    try {
      // A. Along-Route Corridor Search
      if (
        (intent.isAlongRouteQuery || intent.intentType === 'ALONG_ROUTE') &&
        context.activeRoute?.coordinates &&
        context.activeRoute.coordinates.length > 1
      ) {
        const catSet = intent.category ? AUTOMOTIVE_CATEGORIES[intent.category]?.tomtomCategorySet : undefined;
        rawPlaces = await this.tomtomProvider.searchAlongRoute(
          intent.cleanSearchTerm,
          context.activeRoute.coordinates,
          900,
          catSet,
          signal
        );
        providerSucceeded = true;
      }
      // B. Category POI Search
      else if (intent.intentType === 'CATEGORY_NEARBY' && intent.category) {
        const catSet = AUTOMOTIVE_CATEGORIES[intent.category]?.tomtomCategorySet;
        if (catSet) {
          rawPlaces = await this.tomtomProvider.searchCategory(catSet, origin.center, origin.radiusMeters || 35000, signal);
          providerSucceeded = true;
        }
      }
      // C. Brand Search
      else if (intent.intentType === 'SPECIFIC_POI' && intent.properName && AUTOMOTIVE_CATEGORIES[intent.category as any]?.brands?.some(b => normalizeQuery(b) === normalizeQuery(intent.properName!))) {
        rawPlaces = await this.tomtomProvider.searchBrand(intent.properName, origin.center, origin.radiusMeters || 40000, signal);
        providerSucceeded = true;
      }
      // D. Standard Entity & Destination Search
      else {
        rawPlaces = await this.tomtomProvider.search(intent.cleanSearchTerm, context, signal);
        providerSucceeded = true;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      console.warn('TomTom comprehensive search failed, executing fallback:', err);
      providerSucceeded = false;
    }

    // Fallback ONLY if provider failed
    if (!providerSucceeded) {
      try {
        const fallbackResults = await this.primaryFallback.search(intent.cleanSearchTerm, origin.center, signal);
        for (const fb of fallbackResults) {
          rawPlaces.push({
            id: `geo_${fb.lat}_${fb.lng}`,
            name: fb.name,
            formattedAddress: fb.address || '',
            category: fb.category || 'place',
            position: { lat: fb.lat, lng: fb.lng },
            distanceMeters: calculateDistanceMeters(context.vehiclePosition.lat, context.vehiclePosition.lng, fb.lat, fb.lng),
            distanceKm: fb.dk,
            estimatedMinutes: fb.em,
            type: fb.type,
            source: 'geoapify'
          });
        }
      } catch (fbErr: any) {
        if (fbErr?.name === 'AbortError') throw fbErr;
        const nomResults = await this.nominatimProvider.search(q, origin.center, signal);
        return nomResults;
      }
    }

    // Distance & Drive Times
    for (const p of rawPlaces) {
      p.distanceMeters = calculateDistanceMeters(
        context.vehiclePosition.lat,
        context.vehiclePosition.lng,
        p.position.lat,
        p.position.lng
      );
      p.distanceKm = p.distanceMeters / 1000;
      p.estimatedMinutes = estimateDriveMinutes(p.distanceMeters);
    }

    // Deduplicate
    const deduplicated = deduplicatePlaces(rawPlaces);

    // Score & Rank
    const scored = deduplicated.map(p => {
      const score = rankPlaceEntity(p, intent, origin, context.vehiclePosition);
      p.matchScore = score;
      return { place: p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => placeEntityToLocationInfo(s.place));
  }

  /**
   * Dedicated Category Search (Fuel, Charging, Parking, Restaurant, Hotel, etc.)
   * Direct category intent without string prompt mutation.
   */
  async searchCategory(
    category: AutomotiveCategory,
    referencePosOrContext?: { lat: number; lng: number } | SearchContext,
    signal?: AbortSignal
  ): Promise<LocationInfo[]> {
    const context = this.buildSearchContext(referencePosOrContext);
    const catDef = AUTOMOTIVE_CATEGORIES[category];
    const catSet = catDef?.tomtomCategorySet;

    const origin = {
      center: context.vehiclePosition,
      radiusMeters: 35000,
      priority: 'gps' as const
    };

    let rawPlaces: PlaceEntity[] = [];
    let providerSucceeded = false;

    try {
      if (context.activeRoute?.coordinates && context.activeRoute.coordinates.length > 1) {
        rawPlaces = await this.tomtomProvider.searchAlongRoute(
          catDef?.label || category,
          context.activeRoute.coordinates,
          900,
          catSet,
          signal
        );
        providerSucceeded = true;
      } else if (catSet) {
        rawPlaces = await this.tomtomProvider.searchCategory(
          catSet,
          origin.center,
          origin.radiusMeters,
          signal
        );
        providerSucceeded = true;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      console.warn('TomTom category search failed, executing fallback:', err);
      providerSucceeded = false;
    }

    if (!providerSucceeded && catDef?.keywords?.length) {
      try {
        const fallbackResults = await this.primaryFallback.search(catDef.keywords[0], origin.center, signal);
        for (const fb of fallbackResults) {
          rawPlaces.push({
            id: `geo_cat_${fb.lat}_${fb.lng}`,
            name: fb.name,
            formattedAddress: fb.address || '',
            category,
            categoryLabel: catDef.label,
            position: { lat: fb.lat, lng: fb.lng },
            distanceMeters: calculateDistanceMeters(context.vehiclePosition.lat, context.vehiclePosition.lng, fb.lat, fb.lng),
            distanceKm: fb.dk,
            estimatedMinutes: fb.em,
            type: 'POI',
            source: 'geoapify'
          });
        }
      } catch (fbErr: any) {
        if (fbErr?.name === 'AbortError') throw fbErr;
      }
    }

    for (const p of rawPlaces) {
      p.distanceMeters = calculateDistanceMeters(
        context.vehiclePosition.lat,
        context.vehiclePosition.lng,
        p.position.lat,
        p.position.lng
      );
      p.distanceKm = (p.distanceMeters || 0) / 1000;
      p.estimatedMinutes = estimateDriveMinutes(p.distanceMeters || 0);
      p.category = category;
      if (!p.categoryLabel && catDef?.label) {
        p.categoryLabel = catDef.label;
      }
    }

    const deduplicated = deduplicatePlaces(rawPlaces);
    deduplicated.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

    return deduplicated.slice(0, 15).map(p => placeEntityToLocationInfo(p));
  }

  async reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<LocationInfo | null> {
    try {
      const tomtomRes = await this.tomtomProvider.reverseGeocode(lat, lng, signal);
      if (tomtomRes) return placeEntityToLocationInfo(tomtomRes);
    } catch (e) {
      // fallback
    }

    const primRes = await this.primaryFallback.reverseGeocode(lat, lng, signal);
    if (primRes) return primRes;

    return this.nominatimProvider.reverseGeocode(lat, lng, signal);
  }
}

// Global Singleton
export const globalSearchService = new SearchService();
