import React, { useState } from 'react';
import { 
  Fuel, 
  Zap, 
  ParkingCircle, 
  Utensils, 
  Hotel, 
  Pill, 
  ShoppingBag, 
  Wrench, 
  Plane, 
  Train, 
  MapPin,
  Navigation,
  Coffee,
  Landmark,
  Trees
} from 'lucide-react';
import { AutomotiveCategory } from '../types/maps';

export interface BrandInfo {
  id: string;
  name: string;
  category: AutomotiveCategory;
  bgColor: string;
  textColor: string;
  borderColor?: string;
  domain?: string;
  logoUrl?: string;
  renderLogo: (size: number) => React.ReactNode;
}

/**
 * Builds reliable high-resolution online logo URL using official domain CDN
 */
function makeOnlineLogoUrl(domain: string): string {
  return `https://unavatar.io/${domain}?fallback=https://www.google.com/s2/favicons?domain=${domain}%26sz=128`;
}

/**
 * Normalizes brand string for consistent matching
 */
export function normalizeBrandId(raw?: any): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Dictionary of automotive and retail brands with real online logos and vector fallbacks
 */
const BRAND_REGISTRY: Record<string, BrandInfo> = {
  // --- FUEL ---
  eni: {
    id: 'eni',
    name: 'Eni Station',
    category: 'fuel',
    bgColor: '#FFCC00',
    textColor: '#000000',
    borderColor: '#E6B800',
    domain: 'eni.com',
    logoUrl: makeOnlineLogoUrl('eni.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#FFCC00" />
        <path d="M7 21 C7 17, 10 14, 15 14 C17 14, 18 12, 18 10 C18 9, 19 8, 20 8 C21 8, 22 9, 22 11 C22 13, 20 15, 18 16 C22 16, 25 18, 25 21 L23 21 C23 19, 21 17.5, 18 17.5 L17 21 L15 21 L16 17.5 C13 17.5, 10 19, 9 21 Z" fill="#000000" />
        <circle cx="21" cy="9" r="1" fill="#FF0000" />
        <text x="16" y="27" fontSize="7" fontWeight="900" textAnchor="middle" fill="#000000" fontFamily="sans-serif">eni</text>
      </svg>
    )
  },
  q8: {
    id: 'q8',
    name: 'Q8',
    category: 'fuel',
    bgColor: '#003399',
    textColor: '#FFFFFF',
    borderColor: '#002266',
    domain: 'q8.it',
    logoUrl: makeOnlineLogoUrl('q8.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#003399" />
        <path d="M12 7 C14 10, 16 13, 16 16 L12 16 Z" fill="#FFCC00" />
        <path d="M17 6 C20 10, 22 14, 22 17 L17 17 Z" fill="#FF3300" />
        <text x="16" y="26" fontSize="9" fontWeight="900" textAnchor="middle" fill="#FFFFFF" fontFamily="sans-serif" letterSpacing="0.5">Q8</text>
      </svg>
    )
  },
  ip: {
    id: 'ip',
    name: 'IP Gruppo api',
    category: 'fuel',
    bgColor: '#002B66',
    textColor: '#FFFFFF',
    borderColor: '#0055AA',
    domain: 'gruppoapi.com',
    logoUrl: makeOnlineLogoUrl('gruppoapi.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#002B66" />
        <circle cx="16" cy="16" r="11" fill="#0077CC" />
        <text x="16" y="20" fontSize="11" fontWeight="900" fontStyle="italic" textAnchor="middle" fill="#FFFFFF" fontFamily="sans-serif">IP</text>
      </svg>
    )
  },
  tamoil: {
    id: 'tamoil',
    name: 'Tamoil',
    category: 'fuel',
    bgColor: '#FFFFFF',
    textColor: '#003399',
    borderColor: '#CC0000',
    domain: 'tamoil.it',
    logoUrl: makeOnlineLogoUrl('tamoil.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="1" />
        <circle cx="16" cy="12" r="6" fill="#CC0000" />
        <path d="M16 8 L18 12 L14 12 Z" fill="#FFFFFF" />
        <text x="16" y="25" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="#003399" fontFamily="sans-serif">TAMOIL</text>
      </svg>
    )
  },
  esso: {
    id: 'esso',
    name: 'Esso',
    category: 'fuel',
    bgColor: '#FFFFFF',
    textColor: '#CC0000',
    borderColor: '#003399',
    domain: 'esso.it',
    logoUrl: makeOnlineLogoUrl('esso.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#FFFFFF" stroke="#003399" strokeWidth="1.5" />
        <ellipse cx="16" cy="16" rx="13" ry="9" fill="#CC0000" />
        <text x="16" y="19" fontSize="8" fontWeight="900" textAnchor="middle" fill="#FFFFFF" fontFamily="sans-serif" fontStyle="italic">Esso</text>
      </svg>
    )
  },
  shell: {
    id: 'shell',
    name: 'Shell',
    category: 'fuel',
    bgColor: '#FBCE07',
    textColor: '#DD1D21',
    borderColor: '#DD1D21',
    domain: 'shell.it',
    logoUrl: makeOnlineLogoUrl('shell.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#FBCE07" />
        <path d="M16 6 C11 6 8 11 9 18 C10 23 13 25 16 26 C19 25 22 23 23 18 C24 11 21 6 16 6 Z" fill="#DD1D21" />
        <path d="M16 9 C13 9 11 12 11 16 C12 20 14 22 16 23 C18 22 20 20 21 16 C21 12 19 9 16 9 Z" fill="#FBCE07" />
      </svg>
    )
  },
  totalenergies: {
    id: 'totalenergies',
    name: 'TotalEnergies',
    category: 'fuel',
    bgColor: '#FFFFFF',
    textColor: '#ED1C24',
    domain: 'totalenergies.it',
    logoUrl: makeOnlineLogoUrl('totalenergies.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M16 7 C11 7 8 11 8 16 C8 21 12 25 17 25 C21 25 24 22 24 18" stroke="#ED1C24" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="21" cy="11" r="3" fill="#00A3E0" />
      </svg>
    )
  },
  repsol: {
    id: 'repsol',
    name: 'Repsol',
    category: 'fuel',
    bgColor: '#002E6D',
    textColor: '#FFFFFF',
    domain: 'repsol.com',
    logoUrl: makeOnlineLogoUrl('repsol.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#002E6D" />
        <ellipse cx="16" cy="14" rx="10" ry="6" fill="#FF4F00" />
        <ellipse cx="16" cy="14" rx="6" ry="3.5" fill="#FFFFFF" />
        <text x="16" y="27" fontSize="5" fontWeight="900" textAnchor="middle" fill="#FFFFFF">REPSOL</text>
      </svg>
    )
  },
  beyfin: {
    id: 'beyfin',
    name: 'Beyfin',
    category: 'fuel',
    bgColor: '#008751',
    textColor: '#FFFFFF',
    domain: 'beyfin.it',
    logoUrl: makeOnlineLogoUrl('beyfin.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#008751" />
        <circle cx="16" cy="16" r="10" fill="#FFFFFF" />
        <text x="16" y="20" fontSize="7" fontWeight="900" textAnchor="middle" fill="#008751">B</text>
      </svg>
    )
  },

  // --- EV CHARGING ---
  tesla: {
    id: 'tesla',
    name: 'Tesla Supercharger',
    category: 'charging',
    bgColor: '#E82127',
    textColor: '#FFFFFF',
    domain: 'tesla.com',
    logoUrl: makeOnlineLogoUrl('tesla.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#E82127" />
        <path d="M9 10 C13 9, 19 9, 23 10 L23 12 C19 11, 13 11, 9 12 Z" fill="#FFFFFF" />
        <path d="M16 11 L16 24 C15.5 22, 14 17, 12 14 L14 14 C15 16, 15.5 19, 15.5 21 L16.5 21 C16.5 19, 17 16, 18 14 L20 14 C18 17, 16.5 22, 16 24 Z" fill="#FFFFFF" />
      </svg>
    )
  },
  enelx: {
    id: 'enelx',
    name: 'Enel X Way',
    category: 'charging',
    bgColor: '#6A1B9A',
    textColor: '#FFFFFF',
    domain: 'enelxway.com',
    logoUrl: makeOnlineLogoUrl('enelxway.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#6A1B9A" />
        <text x="11" y="20" fontSize="8" fontWeight="800" fill="#FFFFFF" fontFamily="sans-serif">enel</text>
        <text x="23" y="21" fontSize="12" fontWeight="900" fill="#00E5FF" fontFamily="sans-serif">x</text>
      </svg>
    )
  },
  ionity: {
    id: 'ionity',
    name: 'IONITY',
    category: 'charging',
    bgColor: '#0A192F',
    textColor: '#00D8A5',
    domain: 'ionity.eu',
    logoUrl: makeOnlineLogoUrl('ionity.eu'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#0A192F" />
        <circle cx="16" cy="13" r="6" stroke="#00D8A5" strokeWidth="2.5" fill="none" />
        <text x="16" y="26" fontSize="5.5" fontWeight="900" textAnchor="middle" fill="#FFFFFF" letterSpacing="0.8">IONITY</text>
      </svg>
    )
  },
  becharge: {
    id: 'becharge',
    name: 'Be Charge (Plenitude)',
    category: 'charging',
    bgColor: '#FFEB3B',
    textColor: '#1A1A1A',
    domain: 'bec.energy',
    logoUrl: makeOnlineLogoUrl('bec.energy'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#FFEB3B" />
        <text x="16" y="16" fontSize="9" fontWeight="900" textAnchor="middle" fill="#1A1A1A" fontFamily="sans-serif">BE</text>
        <text x="16" y="25" fontSize="5" fontWeight="700" textAnchor="middle" fill="#1A1A1A" fontFamily="sans-serif">CHARGE</text>
      </svg>
    )
  },
  freetox: {
    id: 'freetox',
    name: 'Free To X',
    category: 'charging',
    bgColor: '#004B87',
    textColor: '#00FF99',
    domain: 'freeto-x.it',
    logoUrl: makeOnlineLogoUrl('freeto-x.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#004B87" />
        <text x="16" y="19" fontSize="7" fontWeight="900" textAnchor="middle" fill="#FFFFFF">FREE TO</text>
        <text x="16" y="27" fontSize="9" fontWeight="900" textAnchor="middle" fill="#00FF99">X</text>
      </svg>
    )
  },
  a2a: {
    id: 'a2a',
    name: 'A2A E-Moving',
    category: 'charging',
    bgColor: '#00A3E0',
    textColor: '#FFFFFF',
    domain: 'a2a.it',
    logoUrl: makeOnlineLogoUrl('a2a.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#00A3E0" />
        <text x="16" y="21" fontSize="10" fontWeight="900" textAnchor="middle" fill="#FFFFFF">a2a</text>
      </svg>
    )
  },

  // --- PARKING ---
  apcoa: {
    id: 'apcoa',
    name: 'APCOA Parking',
    category: 'parking',
    bgColor: '#004B87',
    textColor: '#FFFFFF',
    domain: 'apcoa.it',
    logoUrl: makeOnlineLogoUrl('apcoa.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#004B87" />
        <text x="16" y="18" fontSize="13" fontWeight="900" textAnchor="middle" fill="#FFFFFF" fontFamily="sans-serif">P</text>
        <text x="16" y="26" fontSize="5" fontWeight="800" textAnchor="middle" fill="#66B2FF" letterSpacing="0.5">APCOA</text>
      </svg>
    )
  },
  saba: {
    id: 'saba',
    name: 'Saba Parking',
    category: 'parking',
    bgColor: '#003366',
    textColor: '#FFFFFF',
    domain: 'sabait.it',
    logoUrl: makeOnlineLogoUrl('sabait.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#003366" />
        <text x="16" y="22" fontSize="9" fontWeight="900" textAnchor="middle" fill="#FFFFFF">saba</text>
      </svg>
    )
  },

  // --- FOOD & RESTAURANT ---
  mcdonalds: {
    id: 'mcdonalds',
    name: "McDonald's",
    category: 'restaurant',
    bgColor: '#DA291C',
    textColor: '#FFC72C',
    domain: 'mcdonalds.it',
    logoUrl: makeOnlineLogoUrl('mcdonalds.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#DA291C" />
        <path d="M9 25 L9 15 C9 11, 13 11, 13 15 L13 25 L16 25 L16 15 C16 11, 20 11, 20 15 L20 25 L23 25 L23 14 C23 9, 17 9, 16 12 C15 9, 9 9, 9 14 Z" fill="#FFC72C" />
      </svg>
    )
  },
  burgerking: {
    id: 'burgerking',
    name: 'Burger King',
    category: 'restaurant',
    bgColor: '#D62300',
    textColor: '#F5EBDC',
    domain: 'burgerking.it',
    logoUrl: makeOnlineLogoUrl('burgerking.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#D62300" />
        <circle cx="16" cy="16" r="10" fill="#ED7902" />
        <text x="16" y="16" fontSize="6" fontWeight="900" textAnchor="middle" fill="#FFFFFF">BURGER</text>
        <text x="16" y="21" fontSize="6" fontWeight="900" textAnchor="middle" fill="#FFFFFF">KING</text>
      </svg>
    )
  },
  autogrill: {
    id: 'autogrill',
    name: 'Autogrill',
    category: 'restaurant',
    bgColor: '#D32F2F',
    textColor: '#FFFFFF',
    domain: 'autogrill.it',
    logoUrl: makeOnlineLogoUrl('autogrill.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#D32F2F" />
        <text x="16" y="18" fontSize="13" fontWeight="900" textAnchor="middle" fill="#FFFFFF">A</text>
        <text x="16" y="26" fontSize="4.5" fontWeight="800" textAnchor="middle" fill="#FFFFFF" letterSpacing="0.5">AUTOGRILL</text>
      </svg>
    )
  },
  kfc: {
    id: 'kfc',
    name: 'KFC',
    category: 'restaurant',
    bgColor: '#A3080C',
    textColor: '#FFFFFF',
    domain: 'kfc.it',
    logoUrl: makeOnlineLogoUrl('kfc.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#A3080C" />
        <text x="16" y="21" fontSize="9" fontWeight="900" textAnchor="middle" fill="#FFFFFF">KFC</text>
      </svg>
    )
  },
  starbucks: {
    id: 'starbucks',
    name: 'Starbucks',
    category: 'restaurant',
    bgColor: '#006241',
    textColor: '#FFFFFF',
    domain: 'starbucks.it',
    logoUrl: makeOnlineLogoUrl('starbucks.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#006241" />
        <circle cx="16" cy="16" r="9" stroke="#FFFFFF" strokeWidth="2" fill="none" />
        <circle cx="16" cy="16" r="4" fill="#FFFFFF" />
      </svg>
    )
  },
  oldwildwest: {
    id: 'oldwildwest',
    name: 'Old Wild West',
    category: 'restaurant',
    bgColor: '#3A1F04',
    textColor: '#F5A623',
    domain: 'oldwildwest.it',
    logoUrl: makeOnlineLogoUrl('oldwildwest.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#3A1F04" />
        <text x="16" y="16" fontSize="5.5" fontWeight="900" textAnchor="middle" fill="#F5A623">OLD WILD</text>
        <text x="16" y="24" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="#FFFFFF">WEST</text>
      </svg>
    )
  },
  roadhouse: {
    id: 'roadhouse',
    name: 'Roadhouse Restaurant',
    category: 'restaurant',
    bgColor: '#8B0000',
    textColor: '#FFFFFF',
    domain: 'roadhouse.it',
    logoUrl: makeOnlineLogoUrl('roadhouse.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#8B0000" />
        <text x="16" y="20" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="#FFFFFF">ROADHOUSE</text>
      </svg>
    )
  },

  // --- SUPERMARKET & RETAIL ---
  conad: {
    id: 'conad',
    name: 'Conad',
    category: 'supermarket',
    bgColor: '#E30613',
    textColor: '#FFFFFF',
    domain: 'conad.it',
    logoUrl: makeOnlineLogoUrl('conad.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#E30613" />
        <circle cx="16" cy="12" r="3.5" fill="#FFCC00" />
        <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
        <circle cx="20" cy="12" r="2" fill="#FFFFFF" />
        <circle cx="16" cy="8" r="2" fill="#FFFFFF" />
        <circle cx="16" cy="16" r="2" fill="#FFFFFF" />
        <text x="16" y="26" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="#FFFFFF" letterSpacing="0.5">CONAD</text>
      </svg>
    )
  },
  coop: {
    id: 'coop',
    name: 'Coop',
    category: 'supermarket',
    bgColor: '#FFFFFF',
    textColor: '#E30613',
    borderColor: '#E30613',
    domain: 'coop.it',
    logoUrl: makeOnlineLogoUrl('coop.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#FFFFFF" stroke="#E30613" strokeWidth="1.5" />
        <text x="16" y="21" fontSize="10" fontWeight="900" textAnchor="middle" fill="#E30613" letterSpacing="-0.5">coop</text>
      </svg>
    )
  },
  esselunga: {
    id: 'esselunga',
    name: 'Esselunga',
    category: 'supermarket',
    bgColor: '#002B49',
    textColor: '#E30613',
    domain: 'esselunga.it',
    logoUrl: makeOnlineLogoUrl('esselunga.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#002B49" />
        <text x="16" y="20" fontSize="14" fontWeight="900" textAnchor="middle" fill="#E30613" fontStyle="italic">S</text>
        <text x="16" y="27" fontSize="4" fontWeight="700" textAnchor="middle" fill="#FFFFFF">ESSELUNGA</text>
      </svg>
    )
  },
  lidl: {
    id: 'lidl',
    name: 'Lidl',
    category: 'supermarket',
    bgColor: '#0050AA',
    textColor: '#FFF000',
    domain: 'lidl.it',
    logoUrl: makeOnlineLogoUrl('lidl.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#0050AA" />
        <circle cx="16" cy="16" r="11" fill="#FFF000" stroke="#E60A14" strokeWidth="1.5" />
        <text x="16" y="19" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="#0050AA" fontFamily="sans-serif">LIDL</text>
      </svg>
    )
  },
  eurospin: {
    id: 'eurospin',
    name: 'Eurospin',
    category: 'supermarket',
    bgColor: '#003399',
    textColor: '#FFCC00',
    domain: 'eurospin.it',
    logoUrl: makeOnlineLogoUrl('eurospin.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#003399" />
        <polygon points="16,8 18,13 23,13 19,16 21,21 16,18 11,21 13,16 9,13 14,13" fill="#FFCC00" />
        <text x="16" y="27" fontSize="4.5" fontWeight="900" textAnchor="middle" fill="#FFFFFF">EUROSPIN</text>
      </svg>
    )
  },
  carrefour: {
    id: 'carrefour',
    name: 'Carrefour',
    category: 'supermarket',
    bgColor: '#FFFFFF',
    textColor: '#004E98',
    domain: 'carrefour.it',
    logoUrl: makeOnlineLogoUrl('carrefour.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
        <path d="M12 10 L8 16 L12 22 Z" fill="#ED1C24" />
        <path d="M20 10 L24 16 L20 22 Z" fill="#004E98" />
      </svg>
    )
  },
  decathlon: {
    id: 'decathlon',
    name: 'Decathlon',
    category: 'supermarket',
    bgColor: '#0082C3',
    textColor: '#FFFFFF',
    domain: 'decathlon.it',
    logoUrl: makeOnlineLogoUrl('decathlon.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#0082C3" />
        <text x="16" y="20" fontSize="5.5" fontWeight="900" textAnchor="middle" fill="#FFFFFF">DECATHLON</text>
      </svg>
    )
  },
  ikea: {
    id: 'ikea',
    name: 'IKEA',
    category: 'supermarket',
    bgColor: '#0058A3',
    textColor: '#FFCC00',
    domain: 'ikea.com',
    logoUrl: makeOnlineLogoUrl('ikea.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#0058A3" />
        <ellipse cx="16" cy="16" rx="13" ry="9" fill="#FFCC00" />
        <text x="16" y="19" fontSize="8" fontWeight="900" textAnchor="middle" fill="#0058A3">IKEA</text>
      </svg>
    )
  },
  leroymerlin: {
    id: 'leroymerlin',
    name: 'Leroy Merlin',
    category: 'supermarket',
    bgColor: '#78BE20',
    textColor: '#FFFFFF',
    domain: 'leroymerlin.it',
    logoUrl: makeOnlineLogoUrl('leroymerlin.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#78BE20" />
        <polygon points="16,8 24,24 8,24" fill="#FFFFFF" />
      </svg>
    )
  },
  mediaworld: {
    id: 'mediaworld',
    name: 'MediaWorld',
    category: 'supermarket',
    bgColor: '#DF0000',
    textColor: '#FFFFFF',
    domain: 'mediaworld.it',
    logoUrl: makeOnlineLogoUrl('mediaworld.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#DF0000" />
        <text x="16" y="16" fontSize="5" fontWeight="900" textAnchor="middle" fill="#FFFFFF">MEDIA</text>
        <text x="16" y="24" fontSize="5" fontWeight="900" textAnchor="middle" fill="#FFFFFF">WORLD</text>
      </svg>
    )
  },
  unieuro: {
    id: 'unieuro',
    name: 'Unieuro',
    category: 'supermarket',
    bgColor: '#002B49',
    textColor: '#FF7900',
    domain: 'unieuro.it',
    logoUrl: makeOnlineLogoUrl('unieuro.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#002B49" />
        <circle cx="16" cy="14" r="6" fill="#FF7900" />
        <text x="16" y="26" fontSize="5" fontWeight="900" textAnchor="middle" fill="#FFFFFF">UNIEURO</text>
      </svg>
    )
  },

  // --- PHARMACY ---
  farmacia: {
    id: 'farmacia',
    name: 'Farmacia',
    category: 'pharmacy',
    bgColor: '#10B981',
    textColor: '#FFFFFF',
    domain: 'federfarma.it',
    logoUrl: makeOnlineLogoUrl('federfarma.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#10B981" />
        <path d="M12 7 L20 7 L20 12 L25 12 L25 20 L20 20 L20 25 L12 25 L12 20 L7 20 L7 12 L12 12 Z" fill="#FFFFFF" />
      </svg>
    )
  },
  lloyds: {
    id: 'lloyds',
    name: 'LloydsFarmacia',
    category: 'pharmacy',
    bgColor: '#006241',
    textColor: '#FFFFFF',
    domain: 'lloydsfarmacia.it',
    logoUrl: makeOnlineLogoUrl('lloydsfarmacia.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#006241" />
        <text x="16" y="20" fontSize="7" fontWeight="900" textAnchor="middle" fill="#FFFFFF">LLOYDS</text>
      </svg>
    )
  },

  // --- HOTELS ---
  bbhotels: {
    id: 'bbhotels',
    name: 'B&B Hotels',
    category: 'hotel',
    bgColor: '#003366',
    textColor: '#FFFFFF',
    domain: 'hotel-bb.com',
    logoUrl: makeOnlineLogoUrl('hotel-bb.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#003366" />
        <text x="16" y="21" fontSize="9" fontWeight="900" textAnchor="middle" fill="#FFFFFF">B&B</text>
      </svg>
    )
  },
  ibishotels: {
    id: 'ibishotels',
    name: 'ibis Hotel',
    category: 'hotel',
    bgColor: '#ED1B24',
    textColor: '#FFFFFF',
    domain: 'all.accor.com',
    logoUrl: makeOnlineLogoUrl('all.accor.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#ED1B24" />
        <text x="16" y="20" fontSize="8" fontWeight="900" textAnchor="middle" fill="#FFFFFF">ibis</text>
      </svg>
    )
  },
  bestwestern: {
    id: 'bestwestern',
    name: 'Best Western',
    category: 'hotel',
    bgColor: '#002D62',
    textColor: '#FFFFFF',
    domain: 'bestwestern.it',
    logoUrl: makeOnlineLogoUrl('bestwestern.it'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#002D62" />
        <text x="16" y="20" fontSize="9" fontWeight="900" textAnchor="middle" fill="#FBB034">BW</text>
      </svg>
    )
  },
  hilton: {
    id: 'hilton',
    name: 'Hilton Hotels',
    category: 'hotel',
    bgColor: '#002C6C',
    textColor: '#FFFFFF',
    domain: 'hilton.com',
    logoUrl: makeOnlineLogoUrl('hilton.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#002C6C" />
        <text x="16" y="20" fontSize="7" fontWeight="900" textAnchor="middle" fill="#FFFFFF">HILTON</text>
      </svg>
    )
  },
  marriott: {
    id: 'marriott',
    name: 'Marriott',
    category: 'hotel',
    bgColor: '#A00028',
    textColor: '#FFFFFF',
    domain: 'marriott.com',
    logoUrl: makeOnlineLogoUrl('marriott.com'),
    renderLogo: (size) => (
      <svg viewBox="0 0 32 32" width={size} height={size} className="flex-shrink-0">
        <rect width="32" height="32" rx="6" fill="#A00028" />
        <text x="16" y="21" fontSize="11" fontWeight="900" textAnchor="middle" fill="#FFFFFF">M</text>
      </svg>
    )
  }
};

/**
 * Brand aliases / lookup mappings
 */
const BRAND_ALIASES: Record<string, string> = {
  eni: 'eni',
  enistation: 'eni',
  agip: 'eni',
  q8: 'q8',
  kuwait: 'q8',
  q8easy: 'q8',
  ip: 'ip',
  italianapetroli: 'ip',
  gruppoapi: 'ip',
  tamoil: 'tamoil',
  esso: 'esso',
  exxon: 'esso',
  shell: 'shell',
  total: 'totalenergies',
  totalenergies: 'totalenergies',
  repsol: 'repsol',
  beyfin: 'beyfin',
  tesla: 'tesla',
  teslasupercharger: 'tesla',
  supercharger: 'tesla',
  enelx: 'enelx',
  enelxway: 'enelx',
  ionity: 'ionity',
  becharge: 'becharge',
  plenitude: 'becharge',
  freetox: 'freetox',
  a2a: 'a2a',
  apcoa: 'apcoa',
  apcoaparking: 'apcoa',
  saba: 'saba',
  mcdonalds: 'mcdonalds',
  mcdonald: 'mcdonalds',
  mc: 'mcdonalds',
  burgerking: 'burgerking',
  autogrill: 'autogrill',
  kfc: 'kfc',
  starbucks: 'starbucks',
  oldwildwest: 'oldwildwest',
  roadhouse: 'roadhouse',
  conad: 'conad',
  conadsuperstore: 'conad',
  conadcity: 'conad',
  coop: 'coop',
  ipercoop: 'coop',
  esselunga: 'esselunga',
  lidl: 'lidl',
  eurospin: 'eurospin',
  carrefour: 'carrefour',
  decathlon: 'decathlon',
  ikea: 'ikea',
  leroymerlin: 'leroymerlin',
  mediaworld: 'mediaworld',
  unieuro: 'unieuro',
  farmacia: 'farmacia',
  lloyds: 'lloyds',
  lloydsfarmacia: 'lloyds',
  bbhotels: 'bbhotels',
  ibis: 'ibishotels',
  ibishotels: 'ibishotels',
  bestwestern: 'bestwestern',
  hilton: 'hilton',
  marriott: 'marriott'
};

/**
 * Resolves a brand name or brandId from a place into a BrandInfo entity
 */
export function resolveBrand(
  brandName?: any, 
  placeName?: any, 
  category: AutomotiveCategory = 'place'
): BrandInfo | null {
  const normBrand = normalizeBrandId(brandName);
  if (normBrand && BRAND_ALIASES[normBrand]) {
    const key = BRAND_ALIASES[normBrand];
    if (BRAND_REGISTRY[key]) return BRAND_REGISTRY[key];
  }

  // Scan place name for known brand patterns
  if (placeName && typeof placeName === 'string') {
    const normPlace = normalizeBrandId(placeName);
    for (const [alias, key] of Object.entries(BRAND_ALIASES)) {
      if (normPlace.includes(alias)) {
        if (BRAND_REGISTRY[key]) return BRAND_REGISTRY[key];
      }
    }
  }

  // Generic category fallbacks for prominent items (e.g. any Farmacia)
  if (category === 'pharmacy' && BRAND_REGISTRY.farmacia) {
    return BRAND_REGISTRY.farmacia;
  }

  return null;
}

/**
 * Renders an automotive vector icon for a given category
 */
export function renderCategoryIcon(category: AutomotiveCategory = 'place', className = 'w-4 h-4') {
  switch (category) {
    case 'fuel':
      return <Fuel className={className} />;
    case 'charging':
      return <Zap className={className} />;
    case 'parking':
      return <ParkingCircle className={className} />;
    case 'restaurant':
      return <Utensils className={className} />;
    case 'hotel':
      return <Hotel className={className} />;
    case 'pharmacy':
      return <Pill className={className} />;
    case 'supermarket':
      return <ShoppingBag className={className} />;
    case 'repair':
      return <Wrench className={className} />;
    case 'airport':
      return <Plane className={className} />;
    case 'train_station':
      return <Train className={className} />;
    case 'address':
      return <MapPin className={className} />;
    default:
      return <MapPin className={className} />;
  }
}

/**
 * Visual Brand Badge Component that displays real online logos with robust fallback
 */
export const BrandBadge: React.FC<{
  brand?: any;
  placeName?: any;
  category?: AutomotiveCategory;
  size?: number;
  showName?: boolean;
}> = ({ brand, placeName, category = 'place', size = 32, showName = false }) => {
  const resolved = resolveBrand(brand, placeName, category);
  const [imgFailed, setImgFailed] = useState(false);

  if (resolved) {
    const hasOnlineLogo = resolved.logoUrl && !imgFailed;
    return (
      <div className="inline-flex items-center gap-2 flex-shrink-0 select-none">
        <div 
          className="relative flex items-center justify-center rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-white border border-black/10 dark:border-white/15 p-1"
          style={{ width: size, height: size }}
          title={resolved.name}
        >
          {hasOnlineLogo ? (
            <img
              src={resolved.logoUrl}
              alt={resolved.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain transition-opacity duration-150"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: resolved.bgColor }}>
              {resolved.renderLogo(size * 0.75)}
            </div>
          )}
        </div>
        {showName && (
          <span className="text-xs font-bold text-zinc-100 tracking-tight truncate max-w-[140px]">
            {resolved.name}
          </span>
        )}
      </div>
    );
  }

  // Derive semantic icon based on category and place name keywords
  const pName = typeof placeName === 'string' ? placeName.toLowerCase() : '';
  let effectiveCategory = category;
  if (/bar|caff[eè]|coffee/i.test(pName)) effectiveCategory = 'restaurant';
  else if (/parco|giardin[oi]|villa\s/i.test(pName)) effectiveCategory = 'place';
  else if (/museo|monumento|chiesa|duomo|teatro|basilica/i.test(pName)) effectiveCategory = 'hotel';

  const catStyles = getCategoryBadgeStyle(effectiveCategory);

  const getSemanticIcon = () => {
    const iconClass = size <= 28 ? 'w-4 h-4' : 'w-4.5 h-4.5';
    if (/bar|caff[eè]|coffee/i.test(pName)) return <Coffee className={iconClass} />;
    if (/parco|giardin[oi]|villa\s/i.test(pName)) return <Trees className={iconClass} />;
    if (/museo|monumento|chiesa|duomo|teatro|basilica/i.test(pName)) return <Landmark className={iconClass} />;
    if (category === 'address' || category === 'place') return <Navigation className={iconClass} />;
    return renderCategoryIcon(category, iconClass);
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl select-none flex-shrink-0 shadow-sm transition-all border ${catStyles.bg} ${catStyles.border || ''}`}
      style={{ width: size, height: size }}
      title={typeof placeName === 'string' ? placeName : ''}
    >
      <div className={`flex items-center justify-center ${catStyles.text}`}>
        {getSemanticIcon()}
      </div>
    </div>
  );
};

function getCategoryBadgeStyle(category: AutomotiveCategory) {
  switch (category) {
    case 'fuel':
      return { bg: 'bg-amber-500/15', text: 'text-amber-500', border: 'border border-amber-500/25' };
    case 'charging':
      return { bg: 'bg-cyan-500/15', text: 'text-cyan-500', border: 'border border-cyan-500/25' };
    case 'parking':
      return { bg: 'bg-blue-500/15', text: 'text-blue-500', border: 'border border-blue-500/25' };
    case 'restaurant':
      return { bg: 'bg-rose-500/15', text: 'text-rose-500', border: 'border border-rose-500/25' };
    case 'hotel':
      return { bg: 'bg-purple-500/15', text: 'text-purple-500', border: 'border border-purple-500/25' };
    case 'pharmacy':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-500', border: 'border border-emerald-500/25' };
    case 'supermarket':
      return { bg: 'bg-orange-500/15', text: 'text-orange-500', border: 'border border-orange-500/25' };
    case 'repair':
      return { bg: 'bg-zinc-600/15', text: 'text-zinc-400', border: 'border border-zinc-500/25' };
    case 'airport':
      return { bg: 'bg-sky-500/15', text: 'text-sky-500', border: 'border border-sky-500/25' };
    case 'train_station':
      return { bg: 'bg-teal-500/15', text: 'text-teal-500', border: 'border border-teal-500/25' };
    default:
      return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border border-blue-500/20' };
  }
}
