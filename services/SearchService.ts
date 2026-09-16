import { LocationInfo } from '../types/maps';
import { TelemetryStore } from '../context/TelemetryStore';

export interface ISearchProvider {
  search(query: string, referencePos?: { lat: number; lng: number }): Promise<LocationInfo[]>;
  reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null>;
}

// Distance helper in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate driving time in minutes (assumes ~35 km/h urban average)
function estimateMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 35) * 60));
}

// Keyword categorization for automotive POIs
interface CategoryMapping {
  keywords: string[];
  geoapifyCategories: string[];
  category: LocationInfo['category'];
  defaultLabel: string;
}

const AUTOMOTIVE_CATEGORIES: CategoryMapping[] = [
  {
    keywords: [
      'benzina', 'benzinai', 'benzinaio', 'distributore', 'distributori', 'pompe di benzina', 'pompa benzina',
      'carburante', 'gasolio', 'metano', 'gpl', 'rifornimento', 'diesel', 'eni', 'q8', 'ip', 'tamoil',
      'esso', 'total', 'fuel', 'stazione di servizio'
    ],
    geoapifyCategories: ['service.vehicle.fuel'],
    category: 'fuel',
    defaultLabel: 'Distributore Carburante'
  },
  {
    keywords: [
      'parcheggio', 'parcheggi', 'parking', 'garage', 'autosilos', 'sosta', 'park', 'striscia blu',
      'parcheggio coperto', 'area di sosta'
    ],
    geoapifyCategories: ['parking'],
    category: 'parking',
    defaultLabel: 'Parcheggio'
  },
  {
    keywords: [
      'pizzeria', 'pizzerie', 'pizza', 'ristorante', 'ristoranti', 'trattoria', 'trattorie', 'osteria',
      'osterie', 'cibo', 'mangiare', 'sushi', 'pranzo', 'cena', 'hamburger', 'fast food', 'tavola calda'
    ],
    geoapifyCategories: ['catering.restaurant', 'catering.fast_food'],
    category: 'restaurant',
    defaultLabel: 'Ristorante / Pizzeria'
  },
  {
    keywords: ['bar', 'caffè', 'caffe', 'colazione', 'bistrot', 'pub', 'aperitivo'],
    geoapifyCategories: ['catering.cafe'],
    category: 'restaurant',
    defaultLabel: 'Bar / Caffè'
  },
  {
    keywords: [
      'hotel', 'albergo', 'alberghi', 'b&b', 'bed and breakfast', 'motel', 'residence', 'alloggio',
      'pernottamento', 'ostello'
    ],
    geoapifyCategories: ['accommodation.hotel'],
    category: 'hotel',
    defaultLabel: 'Hotel / Alloggio'
  },
  {
    keywords: ['farmacia', 'farmacie', 'parafarmacia', 'parafarmacie', 'medicinali', 'farmaci'],
    geoapifyCategories: ['healthcare.pharmacy'],
    category: 'pharmacy',
    defaultLabel: 'Farmacia'
  },
  {
    keywords: [
      'supermercato', 'supermercati', 'supermarket', 'alimentari', 'market', 'spesa', 'conad', 'coop',
      'esselunga', 'carrefour', 'lidl', 'eurospin', 'ipercoop', 'pam', 'despar'
    ],
    geoapifyCategories: ['commercial.supermarket'],
    category: 'supermarket',
    defaultLabel: 'Supermercato'
  },
  {
    keywords: [
      'ricarica', 'colonnina', 'colonnine', 'ev', 'enel x', 'tesla supercharger', 'supercharger', 'ionity',
      'elettrico', 'be charge', 'free to x'
    ],
    geoapifyCategories: ['service.vehicle.charging_station'],
    category: 'charging',
    defaultLabel: 'Ricarica Veicoli Elettrici'
  }
];

function detectCategory(query: string): CategoryMapping | null {
  const q = query.trim().toLowerCase();
  for (const cat of AUTOMOTIVE_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (
        q === kw ||
        q.startsWith(kw + ' ') ||
        q.endsWith(' ' + kw) ||
        q.includes(' ' + kw + ' ') ||
        q.includes(kw)
      ) {
        return cat;
      }
    }
  }
  return null;
}

export class GeoapifyAutomotiveSearchProvider implements ISearchProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, referencePos?: { lat: number; lng: number }): Promise<LocationInfo[]> {
    try {
      const q = query.trim();
      const detectedCat = detectCategory(q);
      const results: LocationInfo[] = [];
      const seen = new Set<string>();

      const refLat = referencePos?.lat ?? TelemetryStore.position?.lat ?? 41.9028;
      const refLng = referencePos?.lng ?? TelemetryStore.position?.lng ?? 12.4964;

      const addResult = (item: LocationInfo) => {
        const key = `${item.name.toLowerCase().trim()}_${item.lat.toFixed(4)}_${item.lng.toFixed(4)}`;
        if (!seen.has(key)) {
          seen.add(key);
          item.dk = calculateDistanceKm(refLat, refLng, item.lat, item.lng);
          item.em = estimateMinutes(item.dk);
          results.push(item);
        }
      };

      // 1. If category recognized: Query Places API around reference position
      if (detectedCat) {
        try {
          const catStr = detectedCat.geoapifyCategories.join(',');
          const placesUrl = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(
            catStr
          )}&filter=circle:${refLng},${refLat},25000&bias=proximity:${refLng},${refLat}&limit=15&apiKey=${this.apiKey}`;
          
          const placesRes = await fetch(placesUrl);
          if (placesRes.ok) {
            const placesData = await placesRes.json();
            for (const f of placesData.features || []) {
              const p = f.properties;
              const name = p.name || p.brand || p.address_line1 || detectedCat.defaultLabel;
              const address = p.address_line2 || [p.street, p.city].filter(Boolean).join(', ') || p.formatted || '';
              addResult({
                lat: p.lat,
                lng: p.lon,
                name: name,
                address: address,
                category: detectedCat.category,
                isShop: true,
                type: p.categories?.[0] || detectedCat.category
              });
            }
          }
        } catch (e) {
          console.warn('Geoapify places search error:', e);
        }
      }

      // 2. Query Geocode Search (handles specific addresses, business names, cities, landmarks)
      // Only run geocode if not a pure category search or if category produced very few results
      if (!detectedCat || results.length < 3) {
        try {
          const bias = `&bias=proximity:${refLng},${refLat}`;
          const searchUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
            q
          )}&filter=countrycode:it${bias}&limit=10&apiKey=${this.apiKey}`;
          
          const searchRes = await fetch(searchUrl);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            for (const f of searchData.features || []) {
              const p = f.properties;
              const name = p.name || (p.street ? p.street + (p.housenumber ? ' ' + p.housenumber : '') : '') || p.formatted?.split(',')[0] || '';
              const address = p.address_line2 || [p.city || p.town || p.village, p.state].filter(Boolean).join(', ') || p.formatted || '';
              
              let cat: LocationInfo['category'] = 'place';
              if (p.result_type === 'street' || p.result_type === 'building' || p.result_type === 'amenity') {
                cat = 'address';
              }
              if (p.categories?.some((c: string) => c.includes('restaurant') || c.includes('food') || c.includes('catering'))) {
                cat = 'restaurant';
              } else if (p.categories?.some((c: string) => c.includes('fuel'))) {
                cat = 'fuel';
              } else if (p.categories?.some((c: string) => c.includes('parking'))) {
                cat = 'parking';
              } else if (p.categories?.some((c: string) => c.includes('hotel') || c.includes('accommodation'))) {
                cat = 'hotel';
              } else if (p.categories?.some((c: string) => c.includes('pharmacy'))) {
                cat = 'pharmacy';
              }

              if (name && p.lat && p.lon) {
                addResult({
                  lat: p.lat,
                  lng: p.lon,
                  name: name,
                  address: address,
                  category: detectedCat?.category || cat,
                  isShop: cat !== 'address' && cat !== 'place',
                  type: p.result_type
                });
              }
            }
          }
        } catch (e) {
          console.warn('Geoapify geocode search error:', e);
        }
      }

      // 3. If results < 3, query autocomplete for fuzzy matches
      if (results.length < 3) {
        try {
          const autoUrl = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
            q
          )}&filter=countrycode:it&bias=proximity:${refLng},${refLat}&limit=8&apiKey=${this.apiKey}`;
          const autoRes = await fetch(autoUrl);
          if (autoRes.ok) {
            const autoData = await autoRes.json();
            for (const f of autoData.features || []) {
              const p = f.properties;
              const name = p.name || (p.street ? p.street + (p.housenumber ? ' ' + p.housenumber : '') : '') || p.formatted?.split(',')[0] || '';
              const address = p.address_line2 || [p.city || p.town, p.state].filter(Boolean).join(', ') || '';
              if (name && p.lat && p.lon) {
                addResult({
                  lat: p.lat,
                  lng: p.lon,
                  name: name,
                  address: address,
                  category: detectedCat?.category || 'place',
                  isShop: false,
                  type: p.result_type
                });
              }
            }
          }
        } catch (e) {
          console.warn('Geoapify autocomplete fallback error:', e);
        }
      }

      // Sort by proximity
      results.sort((a, b) => (a.dk ?? 9999) - (b.dk ?? 9999));
      return results;
    } catch (e) {
      console.error('Automotive search failure:', e);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null> {
    try {
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.features || !data.features.length) return null;
      const p = data.features[0].properties;
      return {
        lat: p.lat,
        lng: p.lon,
        name: p.street || p.name || p.city || 'Posizione attuale',
        address: [p.city || p.town, p.state].filter(Boolean).join(', ')
      };
    } catch (e) {
      return null;
    }
  }
}

export class PhotonSearchProvider implements ISearchProvider {
  async search(query: string, referencePos?: { lat: number; lng: number }): Promise<LocationInfo[]> {
    try {
      const refLat = referencePos?.lat ?? TelemetryStore.position?.lat ?? 41.9028;
      const refLng = referencePos?.lng ?? TelemetryStore.position?.lng ?? 12.4964;
      const loc = `&lat=${refLat}&lon=${refLng}`;
      // Note: Photon does NOT support lang=it (only default, de, en, fr) - omit lang param
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=12${loc}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      
      const results: LocationInfo[] = (data.features || []).map((f: any) => {
        const p = f.properties;
        const name = p.name || p.street || p.city || p.state || '';
        const addressParts = [];
        if (p.name && p.street) addressParts.push(p.street + (p.housenumber ? ' ' + p.housenumber : ''));
        else if (p.housenumber && p.street) addressParts.push(p.street + ' ' + p.housenumber);
        
        if (p.city && p.city !== name) addressParts.push(p.city);
        else if (p.town && p.town !== name) addressParts.push(p.town);
        
        const isShop = p.osm_key === 'shop' || p.osm_key === 'amenity' || p.osm_key === 'tourism' || p.osm_key === 'leisure';
        let cat: LocationInfo['category'] = 'place';
        if (p.osm_value === 'restaurant' || p.osm_value === 'cafe' || p.osm_value === 'fast_food') cat = 'restaurant';
        else if (p.osm_value === 'fuel') cat = 'fuel';
        else if (p.osm_value === 'parking') cat = 'parking';
        else if (p.osm_value === 'hotel') cat = 'hotel';
        else if (p.osm_value === 'pharmacy') cat = 'pharmacy';
        else if (p.osm_value === 'supermarket') cat = 'supermarket';

        const lat = f.geometry.coordinates[1];
        const lng = f.geometry.coordinates[0];
        const dk = calculateDistanceKm(refLat, refLng, lat, lng);
        const em = estimateMinutes(dk);

        return {
          lat: lat,
          lng: lng,
          name: name,
          address: addressParts.join(', '),
          category: cat,
          isShop: isShop,
          dk,
          em,
          osm_key: p.osm_key,
          osm_value: p.osm_value
        };
      }).filter((r: any) => r.lat && r.lng && r.name);

      results.sort((a, b) => (a.dk ?? 9999) - (b.dk ?? 9999));
      return results;
    } catch (e) {
      console.error('Photon search error:', e);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null> {
    try {
      const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=it`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.features || data.features.length === 0) return null;
      const p = data.features[0].properties;
      return {
        lat: data.features[0].geometry.coordinates[1],
        lng: data.features[0].geometry.coordinates[0],
        name: p.street || p.name || p.city || '',
        address: [p.city || p.town, p.state].filter(Boolean).join(', ')
      };
    } catch (e) {
      return null;
    }
  }
}

export class MapboxSearchProvider implements ISearchProvider {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  async search(query: string, referencePos?: { lat: number; lng: number }): Promise<LocationInfo[]> {
    if (!this.apiKey) return [];
    try {
      const proximity = referencePos ? `&proximity=${referencePos.lng},${referencePos.lat}` : '';
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${this.apiKey}&country=it&limit=10${proximity}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.features || []).map((f: any) => {
        const category = f.properties?.category || '';
        let cat: LocationInfo['category'] = 'place';
        if (category.includes('restaurant') || category.includes('food') || category.includes('pizza')) cat = 'restaurant';
        else if (category.includes('gas') || category.includes('fuel')) cat = 'fuel';
        else if (category.includes('parking')) cat = 'parking';
        else if (category.includes('hotel')) cat = 'hotel';
        else if (category.includes('pharmacy')) cat = 'pharmacy';
        
        const lat = f.center[1];
        const lng = f.center[0];
        const dk = referencePos ? calculateDistanceKm(referencePos.lat, referencePos.lng, lat, lng) : undefined;
        const em = dk !== undefined ? estimateMinutes(dk) : undefined;

        return {
          lat: lat,
          lng: lng,
          name: f.text,
          address: f.place_name.split(',').slice(1).join(',').trim() || f.place_name,
          category: cat,
          isShop: cat !== 'place' && cat !== 'address',
          dk,
          em,
          type: category
        };
      }).filter((r: any) => r.lat && r.lng && r.name);
    } catch (e) {
      console.error('Mapbox search error:', e);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null> {
    if (!this.apiKey) return null;
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.apiKey}&types=address,poi&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.features || !data.features.length) return null;
      const f = data.features[0];
      return {
        lat: f.center[1],
        lng: f.center[0],
        name: f.text,
        address: f.place_name.split(',').slice(1).join(',').trim() || f.place_name
      };
    } catch (e) {
      return null;
    }
  }
}

export class SearchService {
  private primaryProvider: ISearchProvider;
  private fallbackProvider: ISearchProvider;

  constructor(primary: ISearchProvider, fallback?: ISearchProvider) {
    this.primaryProvider = primary;
    this.fallbackProvider = fallback || primary;
  }

  async search(query: string, referencePos?: { lat: number; lng: number }): Promise<LocationInfo[]> {
    let results = await this.primaryProvider.search(query, referencePos);
    
    // Fallback if primary returned too few results
    if (results.length < 2 && this.fallbackProvider !== this.primaryProvider) {
      const fallbackResults = await this.fallbackProvider.search(query, referencePos);
      const seen = new Set(results.map(r => `${r.name.toLowerCase()}_${r.lat.toFixed(3)}`));
      for (const r of fallbackResults) {
        const key = `${r.name.toLowerCase()}_${r.lat.toFixed(3)}`;
        if (!seen.has(key)) {
          results.push(r);
        }
      }
    }
    
    // Final proximity sort
    if (referencePos) {
      results.sort((a, b) => (a.dk ?? 9999) - (b.dk ?? 9999));
    }

    return results;
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null> {
    const res = await this.primaryProvider.reverseGeocode(lat, lng);
    if (res) return res;
    return this.fallbackProvider.reverseGeocode(lat, lng);
  }
}

// Singleton instance with active automotive providers
const GEOAPIFY_KEY = '0d2c9c7f72c0477eb3260838db72a383';
const MAPBOX_TOKEN =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MAPBOX_TOKEN) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_MAPBOX_TOKEN) ||
  '';

export const globalSearchService = new SearchService(
  MAPBOX_TOKEN ? new MapboxSearchProvider(MAPBOX_TOKEN) : new GeoapifyAutomotiveSearchProvider(GEOAPIFY_KEY),
  new PhotonSearchProvider()
);
