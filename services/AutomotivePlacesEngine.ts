/**
 * AutomotivePlacesEngine.ts
 * 
 * Industrial-grade Automotive Places Architecture:
 * - Semantic Intent Classification & NER (City/Locality, Address, POI, Category, Along-Route Corridor)
 * - Dynamic Automotive Bias (Anchor Coordinates > Route Corridor > Viewport > Vehicle GPS)
 * - Multi-Factor Learning-To-Rank (Prefix/Token Match + Logarithmic Proximity + Entity Prominence + Category Alignment)
 * - Zero Hardcoding: Generalized algorithmic scoring for any destination/POI in Europe/Italy
 * - Spatial Deduplication & Short-Query Guard
 */

import {
  AutomotiveCategory,
  SearchIntentType,
  PlaceEntity,
  SearchContext,
  LocationInfo
} from '../types/maps';

// ============================================================================
// 1. SEMANTIC AUTOMOTIVE CATEGORY TAXONOMY
// ============================================================================

export interface CategoryDefinition {
  category: AutomotiveCategory;
  label: string;
  tomtomCategorySet: string;
  geoapifyCategory: string;
  keywords: string[];
  brands: string[];
}

export const AUTOMOTIVE_CATEGORIES: Record<AutomotiveCategory, CategoryDefinition> = {
  fuel: {
    category: 'fuel',
    label: 'Carburante',
    tomtomCategorySet: '7311', // Petrol / Fuel Station
    geoapifyCategory: 'service.vehicle.fuel',
    keywords: [
      'benzina', 'benzinai', 'benzinaio', 'distributore', 'distributori',
      'pompa benzina', 'pompe di benzina', 'pompa di benzina', 'carburante', 'gasolio', 'diesel',
      'metano', 'gpl', 'rifornimento', 'stazione di servizio', 'stazioni di servizio', 'fuel'
    ],
    brands: ['eni', 'q8', 'ip', 'tamoil', 'esso', 'total', 'keropetrol', 'repso', 'ego', 'retitalia', 'agip']
  },
  charging: {
    category: 'charging',
    label: 'Ricarica EV',
    tomtomCategorySet: '7309', // Electric Vehicle Charging
    geoapifyCategory: 'service.vehicle.charging_station',
    keywords: [
      'ricarica', 'ricarica ev', 'colonnina', 'colonnine', 'auto elettrica',
      'elettrico', 'supercharger', 'ricarica rapida', 'ricarica veloce', 'charging'
    ],
    brands: ['enel x', 'tesla', 'supercharger', 'ionity', 'be charge', 'free to x', 'a2a', 'neogy', 'plenitude', 'atlantis']
  },
  parking: {
    category: 'parking',
    label: 'Parcheggio',
    tomtomCategorySet: '7369', // Parking Garage / Open Parking
    geoapifyCategory: 'parking',
    keywords: [
      'parcheggio', 'parcheggi', 'parking', 'garage', 'autosilos', 'sosta',
      'striscia blu', 'strisce blu', 'parcheggio coperto', 'area di sosta', 'posto auto', 'park'
    ],
    brands: ['apcoa', 'quick no problem parking', 'interparking', 'best in parking']
  },
  restaurant: {
    category: 'restaurant',
    label: 'Ristorazione',
    tomtomCategorySet: '7315', // Restaurant, Dining
    geoapifyCategory: 'catering.restaurant,catering.fast_food,catering.cafe',
    keywords: [
      'ristorante', 'ristoranti', 'pizzeria', 'pizzerie', 'pizza', 'trattoria',
      'trattorie', 'osteria', 'osterie', 'mangiare', 'dove mangiare', 'cibo',
      'sushi', 'pranzo', 'cena', 'hamburger', 'fast food', 'bar', 'caffe', 'caffetteria', 'pub', 'bistrot'
    ],
    brands: ['mcdonald', "mcdonald's", 'burger king', 'kfc', 'roadhouse', 'old wild west', 'rossopomodoro', 'autogrill', 'chef express']
  },
  hotel: {
    category: 'hotel',
    label: 'Hotel & B&B',
    tomtomCategorySet: '7314', // Hotel / Motel
    geoapifyCategory: 'accommodation.hotel,accommodation.motel,accommodation.bed_and_breakfast',
    keywords: [
      'hotel', 'albergo', 'alberghi', 'b&b', 'bed and breakfast', 'motel',
      'residence', 'alloggio', 'pernottamento', 'ostello', 'agriturismo', 'resort', 'camera'
    ],
    brands: ['hilton', 'marriott', 'accor', 'ibis', 'best western', 'nh hotels', 'starhotels', 'una hotels', 'novotel', 'holiday inn']
  },
  pharmacy: {
    category: 'pharmacy',
    label: 'Farmacia',
    tomtomCategorySet: '7326', // Pharmacy
    geoapifyCategory: 'healthcare.pharmacy',
    keywords: ['farmacia', 'farmacie', 'parafarmacia', 'parafarmacie', 'medicinali', 'farmaci', 'farmacia di turno', 'medicine'],
    brands: ['lloyds farmacia', 'boots', 'farmacie comunali', 'redcare', 'dr max']
  },
  supermarket: {
    category: 'supermarket',
    label: 'Supermercato',
    tomtomCategorySet: '7332', // Grocery / Supermarket / Hypermarket
    geoapifyCategory: 'commercial.supermarket',
    keywords: [
      'supermercato', 'supermercati', 'supermarket', 'alimentari', 'market',
      'spesa', 'ipermercato', 'discount'
    ],
    brands: ['conad', 'coop', 'esselunga', 'carrefour', 'lidl', 'eurospin', 'ipercoop', 'pam', 'despar', 'aldi', 'deco', 'penny market', 'crai', 'md']
  },
  repair: {
    category: 'repair',
    label: 'Officina & Meccanico',
    tomtomCategorySet: '7312', // Automotive Repair / Service Facility
    geoapifyCategory: 'service.vehicle.repair',
    keywords: [
      'officina', 'meccanico', 'gommista', 'elettrauto', 'carrozzeria',
      'soccorso stradale', 'assistenza auto', 'tagliando', 'gomme', 'revisione'
    ],
    brands: ['bosch car service', 'midas', 'norauto', 'point s', 'driver center', 'euromaster', 'carglass', 'doctor glass']
  },
  airport: {
    category: 'airport',
    label: 'Aeroporto',
    tomtomCategorySet: '7383', // Airport
    geoapifyCategory: 'airport',
    keywords: ['aeroporto', 'airport', 'terminal', 'terminal 1', 'terminal 2', 'aerostazione', 'voli'],
    brands: ['aeroporto falcone borsellino', 'aeroporto fontanarossa', 'aeroporto malpensa', 'aeroporto fiumicino', 'aeroporto linate', 'aeroporto orio al serio']
  },
  train_station: {
    category: 'train_station',
    label: 'Stazione Ferroviaria',
    tomtomCategorySet: '7380', // Railway Station
    geoapifyCategory: 'public_transport.train',
    keywords: ['stazione', 'stazione centrale', 'stazione ferroviaria', 'treni', 'ferrovia', 'treno'],
    brands: ['trenitalia', 'italo', 'fs', 'ferrovie dello stato', 'centostazioni']
  },
  address: {
    category: 'address',
    label: 'Indirizzo',
    tomtomCategorySet: '',
    geoapifyCategory: '',
    keywords: ['via', 'viale', 'corso', 'piazza', 'piazzale', 'strada', 'contrada', 'vicolo', 'largo', 'borgo'],
    brands: []
  },
  place: {
    category: 'place',
    label: 'Luogo',
    tomtomCategorySet: '',
    geoapifyCategory: '',
    keywords: [],
    brands: []
  }
};

// ============================================================================
// 2. TEXT NORMALIZATION & SIMILARITY METRICS
// ============================================================================

export function normalizeQuery(text: any): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row: number[] = [];
  for (let i = 0; i <= b.length; i++) row[i] = i;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val: number;
      if (a.charAt(i - 1) === b.charAt(j - 1)) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Computes multi-level string match score [0.0 - 1.0]:
 * 1. Exact normalized match = 1.0
 * 2. Prefix match on primary name = 0.90 + 0.10 * (qLen / targetLen)
 * 3. Token-initial match (any word starts with prefix) = 0.85
 * 4. Substring containment in primary name = 0.65
 * 5. Containment in address line = 0.40
 * 6. Levenshtein fuzzy distance fallback
 */
export function computeTextSimilarity(query: string, targetName: string, targetAddress?: string): number {
  const q = normalizeQuery(query);
  const tName = normalizeQuery(targetName);
  const tAddr = targetAddress ? normalizeQuery(targetAddress) : '';

  if (!q || !tName) return 0;
  if (q === tName) return 1.0;

  // Exact prefix match on primary name (first word)
  if (tName.startsWith(q)) {
    return 0.92 + 0.08 * (q.length / Math.max(q.length, tName.length));
  }

  // Token word match on primary name (e.g. query "orlando" or "capo d" matching "Capo d'Orlando")
  const qTokens = q.split(' ').filter(Boolean);
  const nameTokens = tName.split(' ').filter(Boolean);

  if (qTokens.length > 0) {
    let allTokensMatched = true;
    for (const qt of qTokens) {
      const match = nameTokens.some(nt => nt.startsWith(qt) || levenshtein(qt, nt) <= (qt.length > 4 ? 1 : 0));
      if (!match) {
        allTokensMatched = false;
        break;
      }
    }
    if (allTokensMatched) {
      // If the first token of the name matches, give higher score than if only later tokens match
      const firstTokenMatch = nameTokens[0] && nameTokens[0].startsWith(qTokens[0]);
      const base = firstTokenMatch ? 0.88 : 0.65;
      return base + 0.10 * (q.length / Math.max(q.length, tName.length));
    }
  }

  // Any single word in name starts with query (if single-token query and not the first word)
  if (qTokens.length === 1 && nameTokens.some(nt => nt.startsWith(q))) {
    return 0.60;
  }

  // Substring containment in primary name
  if (tName.includes(q)) {
    return 0.68 + 0.15 * (q.length / Math.max(q.length, tName.length));
  }

  // Match in address line
  if (tAddr && tAddr.includes(q)) {
    return 0.45;
  }

  // Fuzzy Levenshtein on primary name
  const maxLen = Math.max(q.length, tName.length);
  const dist = levenshtein(q, tName);
  if (dist <= 2 && q.length >= 3) {
    return Math.max(0, 0.60 - (dist * 0.20));
  }

  return 0.0;
}

// ============================================================================
// 3. SEARCH INTENT CLASSIFIER
// ============================================================================

export interface ClassifiedIntent {
  intentType: SearchIntentType;
  category: AutomotiveCategory | null;
  categoryKeyword: string | null;
  properName: string | null;
  locationAnchor: string | null;
  isAlongRouteQuery: boolean;
  cleanSearchTerm: string;
  isShortTypeahead: boolean;
}

const SPATIAL_OPERATORS = [
  'vicino a',
  'vicino',
  'nei pressi di',
  'presso',
  'intorno a',
  'davanti a',
  'verso',
  'lungo la strada per',
  'sulla strada per',
  'lungo il percorso',
  'sulla strada',
  'zona',
  'a ',
  'in '
];

const ALONG_ROUTE_KEYWORDS = [
  'lungo il percorso',
  'sulla strada',
  'sul percorso',
  'sulla strada per',
  'lungo la strada per',
  'in viaggio'
];

const ADDRESS_INDICATORS = [
  'via ', 'viale ', 'corso ', 'piazza ', 'piazzale ', 'strada ', 'contrada ',
  'c da ', 'vicolo ', 'largo ', 'borgo ', 'strada statale', 'ss ', 'sp '
];

export function classifySearchIntent(rawQuery: string, context?: SearchContext): ClassifiedIntent {
  const norm = normalizeQuery(rawQuery);

  // 1. Short Typeahead check (1-2 characters)
  const isShortTypeahead = norm.length <= 2 && !ADDRESS_INDICATORS.some(ind => norm.startsWith(ind.trim()));

  // 2. Along Route Corridor intent
  let isAlongRouteQuery = false;
  let textWithoutRoute = norm;
  for (const rk of ALONG_ROUTE_KEYWORDS) {
    if (norm.includes(rk)) {
      isAlongRouteQuery = true;
      textWithoutRoute = norm.replace(rk, '').trim();
      break;
    }
  }

  // 3. Category & Brand Detection
  let detectedCategory: AutomotiveCategory | null = null;
  let detectedKeyword: string | null = null;
  let detectedBrand: string | null = null;

  for (const catKey of Object.keys(AUTOMOTIVE_CATEGORIES) as AutomotiveCategory[]) {
    const def = AUTOMOTIVE_CATEGORIES[catKey];
    for (const b of def.brands) {
      const bNorm = normalizeQuery(b);
      if (norm === bNorm || norm.startsWith(bNorm + ' ') || norm.endsWith(' ' + bNorm) || norm.includes(' ' + bNorm + ' ')) {
        detectedCategory = catKey;
        detectedBrand = b;
        break;
      }
    }
    if (detectedBrand) break;

    for (const kw of def.keywords) {
      const kwNorm = normalizeQuery(kw);
      if (norm === kwNorm || norm.startsWith(kwNorm + ' ') || norm.endsWith(' ' + kwNorm) || norm.includes(' ' + kwNorm + ' ')) {
        detectedCategory = catKey;
        detectedKeyword = kw;
        break;
      }
    }
    if (detectedCategory) break;
  }

  // 4. Spatial Operators & Anchor Extraction (e.g. "ristoranti a Palermo" -> locationAnchor: "palermo")
  let spatialOp: string | null = null;
  let locationAnchor: string | null = null;
  let remainder = textWithoutRoute;

  for (const op of SPATIAL_OPERATORS) {
    const opNorm = normalizeQuery(op);
    const idx = norm.indexOf(' ' + opNorm + ' ');
    if (idx !== -1) {
      spatialOp = op;
      const anchorPart = norm.substring(idx + opNorm.length + 2).trim();
      if (anchorPart.length > 1) {
        if (anchorPart !== 'me' && anchorPart !== 'noi' && anchorPart !== 'qui') {
          locationAnchor = anchorPart;
        }
        remainder = norm.substring(0, idx).trim();
      }
      break;
    }
  }

  // 5. Address pattern detection
  const isAddress = ADDRESS_INDICATORS.some(ind => norm.startsWith(ind) || norm.includes(' ' + ind)) ||
    (/\b\d{1,4}\b/.test(norm) && ADDRESS_INDICATORS.some(ind => norm.includes(ind.trim())));

  // 6. Extract Proper Name
  let properName: string | null = remainder || null;
  if (detectedKeyword && properName && typeof properName === 'string') {
    properName = normalizeQuery(properName.replace(normalizeQuery(detectedKeyword), '').trim());
  }
  if (detectedBrand) {
    properName = detectedBrand;
  }
  if (!properName || properName.length === 0) {
    properName = null;
  }

  // 7. Intent Type assignment
  let intentType: SearchIntentType = 'SPECIFIC_POI';

  if (isShortTypeahead) {
    intentType = 'AUTOCOMPLETE_PREDICTION';
  } else if (isAlongRouteQuery) {
    intentType = 'ALONG_ROUTE';
  } else if (isAddress) {
    intentType = 'ADDRESS';
  } else if (detectedCategory && locationAnchor) {
    intentType = 'CATEGORY_WITH_LOCATION';
  } else if (detectedCategory && !properName && !locationAnchor) {
    intentType = 'CATEGORY_NEARBY';
  } else if (spatialOp || norm.includes('vicino') || norm.includes('sulla')) {
    intentType = 'NATURAL_QUERY';
  } else if (detectedBrand) {
    intentType = 'SPECIFIC_POI';
  } else {
    intentType = 'CITY_LOCALITY';
  }

  // Clean Search Term for API
  let cleanSearchTerm = rawQuery.trim();
  if (detectedBrand) {
    cleanSearchTerm = detectedBrand;
  } else if (intentType === 'CATEGORY_WITH_LOCATION' && locationAnchor) {
    cleanSearchTerm = `${detectedKeyword || detectedCategory} ${locationAnchor}`;
  } else if (intentType === 'CATEGORY_NEARBY' && detectedKeyword) {
    cleanSearchTerm = detectedKeyword;
  }

  return {
    intentType,
    category: detectedCategory,
    categoryKeyword: detectedKeyword || detectedBrand,
    properName: detectedBrand || properName,
    locationAnchor,
    isAlongRouteQuery,
    cleanSearchTerm,
    isShortTypeahead
  };
}

// ============================================================================
// 4. AUTOMOTIVE CONTEXT RESOLVER
// ============================================================================

export interface ResolvedSearchOrigin {
  center: { lat: number; lng: number };
  radiusMeters?: number;
  originType: 'EXPLICIT_ANCHOR' | 'ALONG_ROUTE' | 'MAP_VIEWPORT' | 'VEHICLE_GPS';
  heading?: number;
}

export function resolveSearchOrigin(
  intent: ClassifiedIntent,
  context: SearchContext,
  resolvedAnchorCoords?: { lat: number; lng: number } | null
): ResolvedSearchOrigin {
  // Priority 1: Explicit Location Anchor in Query (e.g. "a Palermo")
  if (resolvedAnchorCoords) {
    return {
      center: resolvedAnchorCoords,
      radiusMeters: 30000,
      originType: 'EXPLICIT_ANCHOR'
    };
  }

  // Priority 2: Along Route Corridor (if navigating)
  if ((intent.isAlongRouteQuery || intent.intentType === 'ALONG_ROUTE') && context.activeRoute?.destination) {
    return {
      center: context.vehiclePosition,
      originType: 'ALONG_ROUTE',
      heading: context.vehicleHeading
    };
  }

  // Priority 3: Map Viewport (if user explicitly dragged away > 5km from vehicle)
  if (context.mapViewport?.center) {
    const dLat = context.mapViewport.center.lat - context.vehiclePosition.lat;
    const dLng = context.mapViewport.center.lng - context.vehiclePosition.lng;
    const distDeg = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distDeg > 0.05) { // ~5.5 km
      return {
        center: context.mapViewport.center,
        originType: 'MAP_VIEWPORT'
      };
    }
  }

  // Priority 4: Vehicle GPS Position
  return {
    center: context.vehiclePosition,
    originType: 'VEHICLE_GPS',
    heading: context.vehicleHeading
  };
}

// ============================================================================
// 5. DISTANCE & SPATIAL MATH
// ============================================================================

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function estimateDriveMinutes(distanceMeters: number): number {
  const km = distanceMeters / 1000;
  if (km <= 0.5) return 1;
  const avgSpeedKmh = km < 5 ? 32 : km < 25 ? 50 : 75;
  return Math.max(1, Math.round((km / avgSpeedKmh) * 60));
}

// ============================================================================
// 6. GEOSPATIAL LEARNING-TO-RANK (LTR) SCORING
// ============================================================================

/**
 * Logarithmic / Soft Proximity Decay:
 * Decay S_prox = 1 / (1 + ln(1 + distKm / 20))
 * 
 * - 0 km   -> 1.00
 * - 10 km  -> 0.71
 * - 50 km  -> 0.44
 * - 100 km -> 0.36
 * - 500 km -> 0.23
 * - 1000 km -> 0.20
 * 
 * Crucial property: never goes to 0 or penalizes far-away destinations so severely
 * that a low-quality 2km noise match can beat a strong prefix match on a distant city!
 */
export function calculateLogProximityDecay(distKm: number): number {
  if (distKm <= 0.5) return 1.0;
  return 1 / (1 + Math.log(1 + distKm / 20));
}

/**
 * Evaluates the intrinsic geographic prominence of the place entity:
 * - Municipalities / Cities: High intrinsic prominence (1.0)
 * - Major POIs (Airports, Stations, Major Landmarks): 0.85
 * - Street Addresses: 0.70
 * - Generic POI / Business: 0.55
 */
export function calculateProminenceScore(place: PlaceEntity): number {
  if (place.entityType === 'city' || place.type === 'Geography' || place.entityType === 'administrative') {
    return 1.0;
  }
  if (place.category === 'airport' || place.category === 'train_station') {
    return 0.90;
  }
  if (place.brand) {
    return 0.80;
  }
  if (place.entityType === 'address' || place.type === 'PAD' || place.type === 'Address') {
    return 0.70;
  }
  if (place.type === 'POI') {
    return 0.60;
  }
  return 0.50;
}

export function rankPlaceEntity(
  place: PlaceEntity,
  intent: ClassifiedIntent,
  origin: ResolvedSearchOrigin,
  vehiclePos: { lat: number; lng: number }
): number {
  // 1. Text Similarity [0.0 - 1.0]
  const targetName = place.name;
  const targetAddress = place.formattedAddress;
  const queryTerm = intent.properName || intent.cleanSearchTerm;
  const textSim = computeTextSimilarity(queryTerm, targetName, targetAddress);

  // Short query guard (length <= 3):
  // If query is very short (e.g. "k", "c", "ce") and the primary place name DOES NOT match prefix,
  // heavily penalize to prevent filling the autocomplete with irrelevant random noise!
  const normQ = normalizeQuery(queryTerm);
  const normName = normalizeQuery(targetName);
  
  const hasWordPrefix = normName.split(' ').some(w => w.startsWith(normQ));
  if (normQ.length <= 3 && !normName.startsWith(normQ) && !hasWordPrefix) {
    return 0.0; // Filter out completely
  }

  // Ensure relevance: if this is a name/address search and the text similarity is too low, filter it out.
  if ((intent.intentType === 'CITY_LOCALITY' || intent.intentType === 'SPECIFIC_POI' || intent.intentType === 'AUTOCOMPLETE_PREDICTION' || intent.intentType === 'ADDRESS') && textSim < 0.1) {
    return 0.0;
  }

  // 2. Proximity Score from Reference Origin
  const distMeters = calculateDistanceMeters(origin.center.lat, origin.center.lng, place.position.lat, place.position.lng);
  const distKm = distMeters / 1000;
  
  const isDestination = intent.intentType === 'CITY_LOCALITY' || intent.intentType === 'AUTOCOMPLETE_PREDICTION' || intent.intentType === 'ADDRESS';
  // For destinations/cities, use a wide logarithmic decay (300km) so regional cities retain high score
  const proxScore = isDestination 
    ? 1 / (1 + Math.log(1 + distKm / 300))
    : calculateLogProximityDecay(distKm);

  // 3. Intrinsic Prominence Score [0.5 - 1.0]
  let promScore = calculateProminenceScore(place);
  if (isDestination && (place.entityType === 'city' || place.type === 'Geography')) {
    if (normName === normQ) {
      promScore += 0.45; // Exact city name match
    } else if (normName.startsWith(normQ)) {
      promScore += 0.35; // City starts with prefix
    } else {
      promScore += 0.20;
    }
  } else if (isDestination && (place.entityType === 'poi' || place.type === 'POI') && !intent.category) {
    promScore -= 0.25; // Demote commercial POIs when searching for destination localities
  }

  // 4. Category Alignment Score [0.1 - 1.0]
  let catScore = 0.5;
  if (intent.category) {
    if (place.category === intent.category) {
      catScore = 1.0;
    } else if (place.category === 'place' || place.category === 'address') {
      catScore = 0.4;
    } else {
      catScore = 0.1;
    }
  }

  // 5. Provider Score boost (if TomTom/Geoapify provided match confidence)
  const providerBoost = place.providerScore ? Math.min(0.25, place.providerScore * 0.02) : 0;

  // 6. Dynamic Weights based on Search Intent
  let wText = 0.75;
  let wProm = 0.20;
  let wProx = 0.05;
  let wCat = 0.00;

  if (intent.intentType === 'CATEGORY_NEARBY') {
    wText = 0.10;
    wProx = 0.50;
    wCat = 0.30;
    wProm = 0.10;
  } else if (intent.intentType === 'CATEGORY_WITH_LOCATION') {
    wText = 0.40;
    wProx = 0.25;
    wCat = 0.25;
    wProm = 0.10;
  } else if (intent.intentType === 'ADDRESS') {
    wText = 0.70;
    wProx = 0.15;
    wProm = 0.15;
    wCat = 0.00;
  } else if (intent.intentType === 'SPECIFIC_POI') {
    wText = 0.65;
    wProx = 0.18;
    wProm = 0.17;
    wCat = 0.00;
  } else {
    // CITY_LOCALITY / AUTOCOMPLETE_PREDICTION
    wText = 0.75;
    wProm = 0.20;
    wProx = 0.05;
    wCat = 0.00;
  }

  const finalScore = (wText * textSim) + (wProm * promScore) + (wProx * proxScore) + (wCat * catScore) + providerBoost;
  return finalScore;
}

// ============================================================================
// 7. SPATIAL DEDUPLICATION
// ============================================================================

export function deduplicatePlaces(places: PlaceEntity[]): PlaceEntity[] {
  const result: PlaceEntity[] = [];
  const seenIds = new Set<string>();

  for (const p of places) {
    if (p.id && seenIds.has(p.id)) continue;

    const normName = normalizeQuery(p.name);
    const isDuplicate = result.some(existing => {
      const existingNorm = normalizeQuery(existing.name);
      const nameMatch = existingNorm === normName ||
        (existingNorm.length > 5 && normName.length > 5 && (existingNorm.includes(normName) || normName.includes(existingNorm)));
      if (nameMatch) {
        const d = calculateDistanceMeters(p.position.lat, p.position.lng, existing.position.lat, existing.position.lng);
        return d < 200; // within 200m
      }
      return false;
    });

    if (!isDuplicate) {
      if (p.id) seenIds.add(p.id);
      result.push(p);
    }
  }

  return result;
}

// ============================================================================
// 8. CONVERSION TO LOCATIONINFO
// ============================================================================

export function placeEntityToLocationInfo(p: PlaceEntity): LocationInfo {
  return {
    lat: p.position.lat,
    lng: p.position.lng,
    name: p.name,
    address: p.formattedAddress,
    category: p.category,
    isShop: p.type === 'POI',
    dk: p.distanceKm,
    em: p.estimatedMinutes,
    type: p.type,
    placeId: p.id,
    phone: p.phone,
    website: p.website,
    openNow: p.openingHours?.openNow,
    rating: p.rating,
    brand: p.brand,
    detourMinutes: p.detourMinutes
  };
}
