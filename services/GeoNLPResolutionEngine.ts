/**
 * GeoNLPResolutionEngine.ts
 * 
 * Industrial-grade Search, Entity Resolution, Spatial NER & Geospatial LTR Ranking Engine
 * Inspired by Google Maps Geospatial Entity Resolution Architecture:
 * 
 * 1. Tokenization & Diacritics Normalization Pipeline
 * 2. Spatial NER (Named Entity Recognition: Category, Proper Name, Spatial Operator, Location Anchor)
 * 3. Fast Typeahead Trie & Prefix Sharding for <50ms instant predictions
 * 4. Geospatial LTR Ranking Engine (Text Similarity + Distance Decay + Prominence + Category Alignment)
 */

import { LocationInfo } from '../types/maps';

// ==========================================
// 1. NORMALIZATION & STRING METRICS
// ==========================================

export function normalizeText(input: any): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein Distance for fuzzy typo tolerance
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * String similarity score [0.0 - 1.0] combining exact match, prefix, token overlap, and Levenshtein
 */
export function calculateTextSimilarity(queryRaw: string, targetRaw: string): number {
  const q = normalizeText(queryRaw);
  const t = normalizeText(targetRaw);

  if (!q || !t) return 0;
  if (q === t) return 1.0;

  // Exact prefix match
  if (t.startsWith(q)) {
    return 0.85 + 0.15 * (q.length / t.length);
  }

  // Token containment
  const qTokens = q.split(' ').filter(Boolean);
  const tTokens = t.split(' ').filter(Boolean);

  let matchedTokens = 0;
  for (const qt of qTokens) {
    if (tTokens.some(tt => tt.startsWith(qt) || qt.startsWith(tt) || levenshteinDistance(qt, tt) <= 1)) {
      matchedTokens++;
    }
  }

  const tokenScore = matchedTokens / qTokens.length;
  if (tokenScore === 1.0) {
    return 0.80 + 0.15 * (q.length / t.length);
  }

  // Substring containment
  if (t.includes(q)) {
    return 0.70 + 0.20 * (q.length / t.length);
  }

  // Levenshtein fuzzy fallback
  const maxLen = Math.max(q.length, t.length);
  const dist = levenshteinDistance(q, t);
  const levScore = Math.max(0, 1 - dist / maxLen);

  return Math.max(tokenScore * 0.75, levScore);
}

// ==========================================
// 2. SPATIAL NER (NAMED ENTITY RECOGNITION)
// ==========================================

export type EntityCategoryType =
  | 'fuel'
  | 'parking'
  | 'restaurant'
  | 'hotel'
  | 'pharmacy'
  | 'supermarket'
  | 'charging'
  | 'place'
  | 'address';

export interface SpatialNERResult {
  rawQuery: string;
  normalizedQuery: string;
  category: EntityCategoryType | null;
  categoryKeyword: string | null;
  properName: string | null;
  spatialOperator: string | null;
  locationAnchor: string | null;
  isCategoryOnly: boolean;
}

const SPATIAL_OPERATORS = [
  'vicino a',
  'vicino',
  'nei pressi di',
  'presso',
  'intorno a',
  'davanti a',
  'verso',
  'zona',
  'a ',
  'in '
];

const CATEGORY_DICTIONARY: { type: EntityCategoryType; keywords: string[] }[] = [
  {
    type: 'fuel',
    keywords: [
      'benzina', 'benzinai', 'benzinaio', 'distributore', 'distributori', 'pompe di benzina',
      'pompa benzina', 'carburante', 'gasolio', 'metano', 'gpl', 'rifornimento', 'diesel',
      'eni', 'q8', 'ip', 'tamoil', 'esso', 'total', 'fuel', 'stazione di servizio', 'keropetrol'
    ]
  },
  {
    type: 'parking',
    keywords: [
      'parcheggio', 'parcheggi', 'parking', 'garage', 'autosilos', 'sosta', 'park',
      'striscia blu', 'strisce blu', 'parcheggio coperto', 'area di sosta'
    ]
  },
  {
    type: 'restaurant',
    keywords: [
      'pizzeria', 'pizzerie', 'pizza', 'ristorante', 'ristoranti', 'trattoria', 'trattorie',
      'osteria', 'osterie', 'cibo', 'mangiare', 'sushi', 'pranzo', 'cena', 'hamburger',
      'fast food', 'tavola calda', 'bar', 'caffe', 'caffetteria', 'pub', 'bistrot', 'aperitivo'
    ]
  },
  {
    type: 'hotel',
    keywords: [
      'hotel', 'albergo', 'alberghi', 'b&b', 'bed and breakfast', 'motel', 'residence',
      'alloggio', 'pernottamento', 'ostello', 'agriturismo', 'resort', 'camera'
    ]
  },
  {
    type: 'pharmacy',
    keywords: [
      'farmacia', 'farmacie', 'parafarmacia', 'parafarmacie', 'medicinali', 'farmaci', 'chemist'
    ]
  },
  {
    type: 'supermarket',
    keywords: [
      'supermercato', 'supermercati', 'supermarket', 'alimentari', 'market', 'spesa',
      'conad', 'coop', 'esselunga', 'carrefour', 'lidl', 'eurospin', 'ipercoop', 'pam', 'despar', 'aldi', 'deco'
    ]
  },
  {
    type: 'charging',
    keywords: [
      'ricarica', 'colonnina', 'colonnine', 'ev', 'enel x', 'tesla supercharger',
      'supercharger', 'ionity', 'elettrico', 'be charge', 'free to x', 'a2a', 'charging'
    ]
  }
];

export function parseSpatialNER(rawQuery: string): SpatialNERResult {
  const norm = normalizeText(rawQuery);
  let detectedCategory: EntityCategoryType | null = null;
  let detectedKeyword: string | null = null;
  let isCategoryOnly = false;

  // 1. Detect Category Entity
  for (const cat of CATEGORY_DICTIONARY) {
    for (const kw of cat.keywords) {
      const kwNorm = normalizeText(kw);
      if (norm === kwNorm) {
        detectedCategory = cat.type;
        detectedKeyword = kw;
        isCategoryOnly = true;
        break;
      }
      if (
        norm.startsWith(kwNorm + ' ') ||
        norm.endsWith(' ' + kwNorm) ||
        norm.includes(' ' + kwNorm + ' ')
      ) {
        detectedCategory = cat.type;
        detectedKeyword = kw;
        break;
      }
    }
    if (detectedCategory) break;
  }

  // 2. Detect Spatial Qualifier & Location Anchor
  let spatialOp: string | null = null;
  let locationAnchor: string | null = null;
  let remainder = norm;

  for (const op of SPATIAL_OPERATORS) {
    const opNorm = normalizeText(op);
    const opIndex = norm.indexOf(' ' + opNorm + ' ');
    if (opIndex !== -1) {
      spatialOp = op;
      const anchorPart = norm.substring(opIndex + opNorm.length + 2).trim();
      if (anchorPart.length > 1) {
        locationAnchor = anchorPart;
        remainder = norm.substring(0, opIndex).trim();
      }
      break;
    }
  }

  // 3. Extract Proper Name (if present)
  let properName: string | null = remainder || null;
  if (detectedKeyword && properName && typeof properName === 'string') {
    properName = normalizeText(properName.replace(normalizeText(detectedKeyword), '').trim());
  }
  if (!properName || properName.length === 0) {
    properName = null;
  }

  return {
    rawQuery,
    normalizedQuery: norm,
    category: detectedCategory,
    categoryKeyword: detectedKeyword,
    properName,
    spatialOperator: spatialOp,
    locationAnchor,
    isCategoryOnly: isCategoryOnly || (detectedCategory !== null && !properName && !locationAnchor)
  };
}

// ==========================================
// 3. FAST-PATH TYPEAHEAD TRIE
// ==========================================

export interface TrieSuggestion {
  text: string;
  category: EntityCategoryType;
  label: string;
  sublabel: string;
  isCategoryShortcut?: boolean;
}

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  suggestions: TrieSuggestion[] = [];
}

export class GeoPrefixTrie {
  private root = new TrieNode();

  insert(prefix: string, suggestion: TrieSuggestion) {
    const norm = normalizeText(prefix);
    let curr = this.root;
    for (let i = 0; i < norm.length; i++) {
      const char = norm[i];
      if (!curr.children.has(char)) {
        curr.children.set(char, new TrieNode());
      }
      curr = curr.children.get(char)!;
      // Keep up to 6 distinct top suggestions per prefix
      if (!curr.suggestions.some(s => s.text === suggestion.text && s.category === suggestion.category)) {
        curr.suggestions.push(suggestion);
      }
    }
  }

  searchPrefix(prefix: string): TrieSuggestion[] {
    const norm = normalizeText(prefix);
    let curr = this.root;
    for (let i = 0; i < norm.length; i++) {
      const char = norm[i];
      if (!curr.children.has(char)) {
        return [];
      }
      curr = curr.children.get(char)!;
    }
    return curr.suggestions;
  }
}

// Global Static Trie Instance populated with fast typeaheads
export const fastTypeaheadTrie = new GeoPrefixTrie();

// Populate standard shortcuts
const STANDARD_SHORTCUTS: { prefixes: string[]; item: TrieSuggestion }[] = [
  {
    prefixes: ['be', 'ben', 'benz', 'benzina', 'carb', 'carburante', 'dist', 'distributore', 'eni', 'q8', 'ip', 'tam', 'tamoil'],
    item: { text: 'Benzina e Carburanti', category: 'fuel', label: 'Distributori di Carburante', sublabel: 'Eni, Q8, IP, Tamoil, Esso', isCategoryShortcut: true }
  },
  {
    prefixes: ['pa', 'par', 'parc', 'parcheggio', 'park', 'garage', 'auto', 'sosta'],
    item: { text: 'Parcheggi', category: 'parking', label: 'Parcheggi & Garage', sublabel: 'Aree di sosta, strisce blu, silos', isCategoryShortcut: true }
  },
  {
    prefixes: ['ri', 'rist', 'ristorante', 'piz', 'pizz', 'pizzeria', 'tra', 'trattoria', 'ost', 'osteria', 'bar', 'caff', 'caffe'],
    item: { text: 'Ristoranti & Pizzerie', category: 'restaurant', label: 'Ristoranti & Pizzerie', sublabel: 'Cucina locale, trattorie, bar', isCategoryShortcut: true }
  },
  {
    prefixes: ['ho', 'hot', 'hotel', 'alb', 'albergo', 'b&', 'bb', 'bed', 'resi', 'resort', 'agri', 'agriturismo'],
    item: { text: 'Hotel & Alberghi', category: 'hotel', label: 'Hotel & B&B', sublabel: 'Alloggi, resort e pernottamento', isCategoryShortcut: true }
  },
  {
    prefixes: ['fa', 'far', 'farm', 'farmacia', 'para', 'parafarmacia', 'med', 'medicinali'],
    item: { text: 'Farmacie', category: 'pharmacy', label: 'Farmacie di Turno', sublabel: 'Farmacie e parafarmacie vicine', isCategoryShortcut: true }
  },
  {
    prefixes: ['su', 'sup', 'super', 'supermercato', 'con', 'conad', 'coo', 'coop', 'ess', 'esselunga', 'lid', 'lidl', 'eur', 'eurospin', 'spe', 'spesa'],
    item: { text: 'Supermercati', category: 'supermarket', label: 'Supermercati & Alimentari', sublabel: 'Conad, Coop, Esselunga, Lidl, Eurospin', isCategoryShortcut: true }
  },
  {
    prefixes: ['col', 'colo', 'colonnina', 'ric', 'ricarica', 'ev', 'ene', 'enel x', 'tes', 'tesla', 'superch', 'ioni', 'ionity'],
    item: { text: 'Ricarica EV', category: 'charging', label: 'Colonnine Ricarica Elettrica', sublabel: 'Enel X, Tesla Supercharger, Be Charge', isCategoryShortcut: true }
  }
];

for (const entry of STANDARD_SHORTCUTS) {
  for (const p of entry.prefixes) {
    fastTypeaheadTrie.insert(p, entry.item);
  }
}

// ==========================================
// 4. GEOSPATIAL LTR (LEARNING TO RANK) SCORING
// ==========================================

export interface RankingWeights {
  wText: number;
  wProx: number;
  wProm: number;
  wCat: number;
}

const DEFAULT_LTR_WEIGHTS: RankingWeights = {
  wText: 0.45,
  wProx: 0.35,
  wProm: 0.10,
  wCat: 0.10
};

/**
 * Hyperbolic / Gaussian proximity decay function:
 * decay = 1 / (1 + (distanceKm / d0)^2)
 * Ensures 0-10km gets a high score, but does not totally suppress exact text matches at 20-40km
 */
export function calculateProximityDecay(distanceKm: number, scaleKm = 15): number {
  if (distanceKm <= 0.2) return 1.0;
  return 1 / (1 + Math.pow(distanceKm / scaleKm, 1.8));
}

/**
 * Calculates prominence score based on POI entity richness
 */
export function calculateProminenceScore(item: LocationInfo): number {
  let score = 0.50;
  if (item.isShop || item.type === 'POI') score += 0.25;
  if (item.address && item.address.length > 8) score += 0.15;
  if (item.category && item.category !== 'place') score += 0.10;
  return Math.min(1.0, score);
}

/**
 * Compute the final multi-dimensional LTR match score S:
 * S = w1*TextSimilarity + w2*ProximityScore + w3*ProminenceScore + w4*CategoryAlignment
 */
export function rankCandidate(
  query: string,
  candidate: LocationInfo,
  ner: SpatialNERResult,
  weights: RankingWeights = DEFAULT_LTR_WEIGHTS
): number {
  const targetText = candidate.name + ' ' + (candidate.address || '');
  const targetName = candidate.name;

  // 1. Text Similarity
  let textSim = calculateTextSimilarity(
    ner.properName || ner.rawQuery,
    targetName
  );

  // Bonus if address also contains parts of query
  if (candidate.address && calculateTextSimilarity(ner.rawQuery, candidate.address) > 0.6) {
    textSim = Math.min(1.0, textSim + 0.15);
  }

  // 2. Proximity Score
  const distKm = candidate.dk ?? 25;
  const proxScore = calculateProximityDecay(distKm);

  // 3. Prominence Score
  const promScore = calculateProminenceScore(candidate);

  // 4. Category Alignment
  let catScore = 0.5;
  if (ner.category) {
    if (candidate.category === ner.category) {
      catScore = 1.0;
    } else if (candidate.category === 'place' || candidate.category === 'address') {
      catScore = 0.4;
    } else {
      catScore = 0.1; // Category mismatch penalty
    }
  }

  // Linear combination
  const finalScore =
    weights.wText * textSim +
    weights.wProx * proxScore +
    weights.wProm * promScore +
    weights.wCat * catScore;

  return finalScore;
}
