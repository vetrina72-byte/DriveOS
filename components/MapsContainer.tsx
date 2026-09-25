import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { globalRadarService, WeatherFrame } from "../services/RadarService";
import maplibregl from 'maplibre-gl';
import { useNavigation, LocationData } from '../context/NavigationContext';
import { useWeather } from '../context/WeatherContext';
import { routeStore } from './routeStore';
import NavigateTool from './NavigateTool';

import SearchPanel from './SearchPanel';
import NavigationHUD from './NavigationHUD';
import TripStatsHUD from './TripStatsHUD';
import MapControls from './MapControls';
import { POIPreviewCard } from './POIPreviewCard';
import { resolveBrand } from './BrandResolver';
import { buildMapStyle, dist, bear, OSRM_URL } from './MapEngineUtils';
import { CosmicStarfield } from './CosmicStarfield';
import { cubicBezierEase } from './VehicleCanvas';
import { useUIConfig, APP_TRANSITION_DURATION } from '../context/UIConfigContext';
import { RouteOption, RoadHazard, LocationInfo, AutomotiveCategory } from '../types/maps';
import { fetchRoadHazardsForRoute } from '../services/RoadHazardService';
import { analyzeRouteTraffic, buildTrafficGeoJSON } from '../services/TrafficService';
import { TelemetryStore } from '../context/TelemetryStore';
import { calculateTomTomRoute, getTomTomApiKey } from '../services/TomTomService';
import { globalSearchService } from '../services/SearchService';

interface StepInfo {
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
    exit?: number;
  };
  name: string;
  ref?: string;
  distance: number;
  duration: number;
  _dfs?: number;
}

// Classic red teardrop destination pin with sharp floating title pill
function createDestinationMarkerElement(name: string, isNight: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'dest-marker-container flex flex-col items-center select-none pointer-events-none';
  container.style.transformOrigin = 'bottom center';

  const cleanName = (name || '').trim();

  container.innerHTML = `
    <div class="relative flex flex-col items-center" style="transform: translateZ(0); -webkit-font-smoothing: antialiased;">
      ${cleanName ? `
      <div class="px-3 py-1 mb-1.5 rounded-lg text-xs font-bold tracking-tight border shadow-md whitespace-nowrap max-w-[16rem] truncate ${
        isNight
          ? 'bg-zinc-900 text-white border-zinc-700 shadow-black/70'
          : 'bg-white text-zinc-900 border-zinc-200 shadow-zinc-400/40'
      }">
        ${cleanName}
      </div>` : ''}

      <!-- Classic Red Teardrop Map Pin -->
      <div class="relative flex items-center justify-center">
        <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
          <defs>
            <filter id="dest-classic-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.45"/>
            </filter>
          </defs>
          <!-- Classic teardrop needle body -->
          <path d="M14 0C6.26801 0 0 6.26801 0 14C0 23.5 12.8 36.8 13.4 37.4C13.8 37.8 14.2 37.8 14.6 37.4C15.2 36.8 28 23.5 28 14C28 6.26801 21.732 0 14 0Z" fill="#E53935" filter="url(#dest-classic-shadow)"/>
          <!-- Pure white center dot -->
          <circle cx="14" cy="13.5" r="4.5" fill="#FFFFFF"/>
        </svg>
      </div>
    </div>
  `;
  return container;
}

function getPOIIconAndColor(cat?: AutomotiveCategory): { bg: string; svg: string } {
  switch (cat) {
    case 'fuel':
      return {
        bg: '#F59E0B',
        svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v17"/><path d="M14 13h2a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 0 3 0V9a2.4 2.4 0 0 0-2.4-2.4H17"/><path d="M3 11h10"/><circle cx="8" cy="7" r="1.5"/></svg>'
      };
    case 'charging':
      return {
        bg: '#06B6D4',
        svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
      };
    case 'parking':
      return {
        bg: '#2563EB',
        svg: '<span style="font-weight:900;font-size:13px;line-height:1;color:#FFFFFF;font-family:sans-serif;">P</span>'
      };
    case 'restaurant':
      return {
        bg: '#E11D48',
        svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M22 2v20"/><path d="M16 11v11"/><path d="M2 2v8a2 2 0 0 0 2 2h2v10"/><path d="M6 2v6"/></svg>'
      };
    case 'pharmacy':
      return {
        bg: '#10B981',
        svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>'
      };
    case 'supermarket':
      return {
        bg: '#F97316',
        svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
      };
    case 'hotel':
      return {
        bg: '#8B5CF6',
        svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>'
      };
    default:
      return {
        bg: '#3B82F6',
        svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
      };
  }
}

// Interactive automotive POI marker with category/brand indicator
function createPOIMarkerElement(poi: LocationInfo, isNight: boolean, onClick: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'poi-marker-container flex flex-col items-center select-none cursor-pointer group';
  container.style.transformOrigin = 'bottom center';

  const cleanName = (poi.name || '').trim();
  const brand = resolveBrand(poi.brand, poi.name, poi.category);
  const { bg, svg } = getPOIIconAndColor(poi.category);

  const markerBg = brand?.bgColor || bg;
  const logoUrl = brand?.logoUrl;

  container.innerHTML = `
    <div class="relative flex flex-col items-center hover:scale-110 transition-transform duration-150" style="transform: translateZ(0);">
      ${cleanName ? `
      <div class="px-2 py-0.5 mb-1 rounded-md text-[10.5px] font-bold tracking-tight border shadow-sm whitespace-nowrap max-w-[12rem] truncate pointer-events-none ${
        isNight
          ? 'bg-zinc-900/95 text-zinc-100 border-zinc-700/80 shadow-black/40'
          : 'bg-white/95 text-zinc-900 border-zinc-300/80 shadow-zinc-400/20'
      }">
        ${cleanName}
      </div>` : ''}

      <div class="relative flex flex-col items-center">
        <div class="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-md border border-black/15 overflow-hidden p-1">
          ${logoUrl ? `
            <img src="${logoUrl}" alt="${cleanName}" referrerpolicy="no-referrer" class="w-full h-full object-contain transition-opacity duration-150" onerror="this.onerror=null;this.parentElement.innerHTML='${svg.replace(/'/g, "\\'")}'" />
          ` : `
            <div style="background-color: ${bg};" class="w-full h-full rounded-lg flex items-center justify-center text-white">
              ${svg}
            </div>
          `}
        </div>
        <div class="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[4.5px] border-t-zinc-700/60 -mt-[0.5px]"></div>
      </div>
    </div>
  `;

  container.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  return container;
}

// Speed camera (autovelox) badge marker
function createSpeedCameraMarkerElement(hazard: RoadHazard, isNight: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hazard-marker speed-camera-marker flex flex-col items-center select-none cursor-pointer';
  container.setAttribute('title', `Autovelox ${hazard.speedLimit ? `• Limite ${hazard.speedLimit} km/h` : ''}`);

  container.innerHTML = `
    <div class="relative flex items-center justify-center hover:scale-105 transition-transform">
      <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-600 border border-white text-white font-extrabold text-[10px] shadow-sm">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        <span>${hazard.speedLimit ? `${hazard.speedLimit}` : 'VELOX'}</span>
      </div>
    </div>
  `;
  return container;
}

// Traffic signal (semaforo) vertical lights marker
function createTrafficSignalMarkerElement(hazard: RoadHazard, isNight: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hazard-marker traffic-signal-marker flex flex-col items-center select-none cursor-pointer';
  container.setAttribute('title', 'Semaforo');

  container.innerHTML = `
    <div class="relative flex items-center justify-center hover:scale-105 transition-transform">
      <div class="flex flex-col items-center gap-0.5 px-1 py-1 rounded-md bg-zinc-950 border border-zinc-700 text-white shadow-sm">
        <div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
        <div class="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
        <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
      </div>
    </div>
  `;
  return container;
}

// Roadworks (cantiere / lavori in corso) badge marker
function createRoadworksMarkerElement(hazard: RoadHazard, isNight: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hazard-marker roadworks-marker flex flex-col items-center select-none cursor-pointer';
  container.setAttribute('title', hazard.description || 'Lavori in corso');

  container.innerHTML = `
    <div class="relative flex items-center justify-center hover:scale-105 transition-transform">
      <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500 border border-white text-zinc-950 font-black text-[10px] shadow-sm">
        <svg class="w-3.5 h-3.5 fill-current text-zinc-950" viewBox="0 0 24 24">
          <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10h2v4h-2zm0 6h2v2h-2z"/>
        </svg>
        <span>LAVORI</span>
      </div>
    </div>
  `;
  return container;
}

// Detour (deviazione) badge marker
function createDetourMarkerElement(hazard: RoadHazard, isNight: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hazard-marker detour-marker flex flex-col items-center select-none cursor-pointer';
  container.setAttribute('title', hazard.description || 'Deviazione');

  container.innerHTML = `
    <div class="relative flex items-center justify-center hover:scale-105 transition-transform">
      <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-600 border border-white text-white font-extrabold text-[10px] shadow-sm">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m16 3 4 4-4 4"/>
          <path d="M20 7H9a4 4 0 0 0-4 4v10"/>
        </svg>
        <span>DEVIAZIONE</span>
      </div>
    </div>
  `;
  return container;
}

// General road hazard / danger badge marker
function createHazardMarkerElement(hazard: RoadHazard, isNight: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hazard-marker danger-marker flex flex-col items-center select-none cursor-pointer';
  container.setAttribute('title', hazard.description || 'Attenzione su questo tratto');

  container.innerHTML = `
    <div class="relative flex items-center justify-center hover:scale-105 transition-transform">
      <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-600 border border-white text-white font-extrabold text-[10px] shadow-sm">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>ATTENZIONE</span>
      </div>
    </div>
  `;
  return container;
}

// Traffic congestion (coda) badge marker
function createTrafficCongestionMarkerElement(hazard: RoadHazard, isNight: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'hazard-marker traffic-congestion-marker flex flex-col items-center select-none cursor-pointer';
  container.setAttribute('title', hazard.description || 'Rallentamento per traffico');

  container.innerHTML = `
    <div class="relative flex items-center justify-center hover:scale-105 transition-transform">
      <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-600 border border-white text-white font-black text-[10px] shadow-sm">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <span>CODA</span>
      </div>
    </div>
  `;
  return container;
}

const MapsContainer = React.memo(({ 
    isOpen, 
    onClose,
    onDragProgress,
    onInteractionStart,
    spotifyPlayerBottom: propSpotifyPlayerBottom,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    onDragProgress?: (progress: number | null) => void;
    onInteractionStart?: () => void;
    spotifyPlayerBottom?: number;
}) => {
  const {
    navigateToolWidth: width,
    widgetBgColor,
    dayPlayerButtonColor,
    nightPlayerButtonColor,
    darkNavigateInputBg,
    sceneTransitionSpeed = 1.10,
    spotifyPlayerBottom: configSpotifyPlayerBottom = 80,
  } = useUIConfig();

  const spotifyPlayerBottom = propSpotifyPlayerBottom ?? configSpotifyPlayerBottom ?? 80;

  const {
    navigationTarget,
    homeLocation,
    workLocation,
    setHomeLocation,
    setWorkLocation,
    isNavigating: naving,
    setIsNavigating: setNaving,
    isRoutePreview,
    setIsRoutePreview,
    setTripInfo,
    handleSelectDestination: onSelectDestination,
    handleCancelNavigation,
  } = useNavigation();

  const { useDarkTheme: isNight } = useWeather();

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // MapLibre and marker references
  const mapRef = useRef<maplibregl.Map | null>(null);
  
  const destMarkRef = useRef<maplibregl.Marker | null>(null);
  const proxMarkRef = useRef<maplibregl.Marker | null>(null);
  const poiMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<LocationInfo | null>(null);
  const destinationNameRef = useRef<string>('');
  const routeAnimIdRef = useRef<number | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Dead reckoning, bearing, and geolocationsRefs
  const initialPos = TelemetryStore.position;
  const rposRef = useRef<{ lat: number; lng: number } | null>(initialPos ? { lat: initialPos.lat, lng: initialPos.lng } : null);
  const tgtRef = useRef<{ lat: number; lng: number } | null>(initialPos ? { lat: initialPos.lat, lng: initialPos.lng } : null);
  const tbearRef = useRef<number>(TelemetryStore.bearing || 0);
  const cbearRef = useRef<number>(TelemetryStore.bearing || 0);
  const mbearRef = useRef<number>(TelemetryStore.bearing || 0);
  const speedRef = useRef<number>(0);
  const lastGpsPosRef = useRef<any>(null);

  // Navigation track state references to prevent closure rendering lag
  const navingRef = useRef<boolean>(false);
  const stepsRef = useRef<StepInfo[]>([]);
  const geoRef = useRef<any[] | null>(null);
  const siRef = useRef<number>(0);
  const nearIdxRef = useRef<number>(0);
  const recalcCDRef = useRef<boolean>(false);
  const devCntRef = useRef<number>(0);

  // Controls visual triggers
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const routesRef = useRef<any[]>([]);
  const selectedRouteIndexRef = useRef<number>(0);
  const lastSourceCoordRef = useRef<{ lng: number; lat: number; bearing: number }>({
    lng: 0,
    lat: 0,
    bearing: -9999
  });
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [destinationName, setDestinationName] = useState('Destinazione');
  const remainingDistanceRef = useRef(0);
  const remainingTimeRef = useRef(0);

  // Road hazards state & references (Speed Cameras, Traffic Signals, Roadworks, Hazards, Congestion)
  const [roadHazards, setRoadHazards] = useState<RoadHazard[]>([]);
  const roadHazardsRef = useRef<RoadHazard[]>([]);
  const hazardMarkersRef = useRef<maplibregl.Marker[]>([]);
  const stepFocusMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [upcomingHazard, setUpcomingHazard] = useState<{ hazard: RoadHazard; distanceMeters: number } | null>(null);
  const [hazardsSummary, setHazardsSummary] = useState<{
    cameras: number;
    signals: number;
    roadworks?: number;
    hazards?: number;
    congestion?: number;
  }>({ cameras: 0, signals: 0, roadworks: 0, hazards: 0, congestion: 0 });

  // Map Point Picker State for Casa / Lavoro
  const [pickingMapType, setPickingMapType] = useState<'home' | 'work' | null>(null);
  const pickingMapTypeRef = useRef<'home' | 'work' | null>(null);
  pickingMapTypeRef.current = pickingMapType;
  const [pointPickToast, setPointPickToast] = useState<string | null>(null);

  useEffect(() => {
    const handleStartPicker = (e: any) => {
      const type = e.detail?.type || 'home';
      setPickingMapType(type);
    };
    window.addEventListener('start-map-point-picker' as any, handleStartPicker);
    return () => {
      window.removeEventListener('start-map-point-picker' as any, handleStartPicker);
    };
  }, []);

  // Focus and inspect individual navigation turn / step on the map
  const handleFocusStep = useCallback((location: [number, number], stepName?: string) => {
    if (!mapRef.current) return;

    let targetLng = Number(location?.[0]);
    let targetLat = Number(location?.[1]);
    if (isNaN(targetLng) || isNaN(targetLat)) return;

    // Automatic normalization if [lat, lng] was passed instead of [lng, lat]
    if (targetLng > 30 && targetLat < 25) {
      const tmp = targetLng;
      targetLng = targetLat;
      targetLat = tmp;
    }

    // Temporarily pause vehicle tracking so the user can inspect this turn
    followRef.current = false;
    setIsMapFollowing(false);
    interactRef.current = true;
    flyingRef.current = true;

    if (recTimerRef.current) {
      clearTimeout(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (interactTimerRef.current) {
      clearTimeout(interactTimerRef.current);
      interactTimerRef.current = null;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const leftPadding = isMobile ? 30 : 420; // Keep clear from Navigation HUD

    mapRef.current.flyTo({
      center: [targetLng, targetLat],
      zoom: 17.5,
      pitch: 35,
      bearing: mapRef.current.getBearing(),
      speed: 1.5,
      curve: 1.2,
      essential: true,
      padding: { top: 120, bottom: 100, left: leftPadding, right: 60 },
    });

    mapRef.current.once('moveend', () => {
      flyingRef.current = false;
    });

    if (stepFocusMarkerRef.current) {
      stepFocusMarkerRef.current.remove();
      stepFocusMarkerRef.current = null;
    }

    const el = document.createElement('div');
    el.className = 'step-focus-pin pointer-events-none flex flex-col items-center select-none z-[60]';
    el.innerHTML = `
      <div class="flex flex-col items-center transform -translate-y-2">
        ${stepName ? `
          <div class="px-3 py-1 mb-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-md border border-white/30 whitespace-nowrap max-w-[260px] truncate">
            ${stepName}
          </div>
        ` : ''}
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-black">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      </div>
    `;
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([targetLng, targetLat])
      .addTo(mapRef.current);
    stepFocusMarkerRef.current = marker;

    // Auto resume tracking after 14 seconds of inspection
    recTimerRef.current = setTimeout(() => {
      if (stepFocusMarkerRef.current === marker) {
        marker.remove();
        stepFocusMarkerRef.current = null;
      }
      if (navingRef.current) {
        followRef.current = true;
        setIsMapFollowing(true);
        interactRef.current = false;
        flyingRef.current = false;
        if (smoothRecRef.current) smoothRecRef.current();
      }
    }, 14000);
  }, []);

  // Helper functions for DOM updates
  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };
  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h} h ${m} min`;
    }
    return `${minutes} min`;
  };
  const computeETA = (seconds: number) => {
    const etaDate = new Date(Date.now() + seconds * 1000);
    const hrs = etaDate.getHours().toString().padStart(2, '0');
    const mins = etaDate.getMinutes().toString().padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  const updateHUD = (remDist: number, remTime: number) => {
    remainingDistanceRef.current = remDist;
    remainingTimeRef.current = remTime;
    const elKm = document.getElementById('nb-km');
    if(elKm) elKm.innerText = formatDistance(remDist);
    const elMin = document.getElementById('nb-min');
    if(elMin) elMin.innerText = formatDuration(remTime);
    const elEta = document.getElementById('nb-eta');
    if(elEta) elEta.innerText = computeETA(remTime);
  };

  const [cmode, setCmode] = useState<'north-up' | 'heading-up'>('north-up');
  const [is3D, setIs3D] = useState<boolean>(false);
  const [bearing, setBearing] = useState(0);
  const [currentPitch, setCurrentPitch] = useState<number>(0);
  const [isSatellite, setIsSatellite] = useState(false);
  const [isWeatherActive, setIsWeatherActive] = useState(false);
  const [isMapFollowing, setIsMapFollowing] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(14);

  // Custom additions for authentic maps template
  const [currentStreet, setCurrentStreet] = useState<string>('Viale Andrea Doria');
  const lastGeocodeTimeRef = useRef<number>(0);

  // Sync ref values for render frame loops
  const cmodeRef = useRef<'north-up' | 'heading-up'>('north-up');
  const is3DRef = useRef<boolean>(false);
  const ccamPitchRef = useRef<number>(0);
  const ccamBearRef = useRef<number>(0);
  const followRef = useRef<boolean>(true);
  const interactRef = useRef<boolean>(false);
  const flyingRef = useRef<boolean>(false);
  const flightSeqRef = useRef<number>(0);
  const isWeatherActiveRef = useRef<boolean>(false);
  const recTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTrackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPendingStartRef = useRef<boolean>(false);
  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  const isRoutePreviewRef = useRef(false);
  const activeFetchIdRef = useRef<number>(0);
  const autoZoomedRef = useRef<boolean>(false);
  const pendDestRef = useRef<{ coords: { lat: number; lng: number }; name: string } | null>(null);
  const savedModeRef = useRef<'north-up' | 'heading-up' | null>(null);
  const prevCmodeRef = useRef<'north-up' | 'heading-up'>('north-up');
  const weatherSlotRef = useRef<'A' | 'B'>('A');
  const flyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Physics animation variables for drawer slide sheet
  const physics = useRef({
      currentX: 100,
      targetX: 100,
      startX: 100,
      animStartTime: 0,
      animDuration: 350,
      isDragging: false,
      isInteracting: false,
      dragStartX: 0,
      dragStartCurrentX: 0,
      panelWidth: 0,
      animationId: 0,
      lastClientX: 0,
      lastTime: 0,
      velocityX: 0
  });

  const ANIMATION_SPEED = 0.18; 
  const CLOSE_THRESHOLD_PERCENT = 25;

  // Global CSS bouncing animations
  useEffect(() => {
    const handleOpenRadar = () => {
      setIsWeatherActive(true);
      isWeatherActiveRef.current = true;
      if (mapRef.current) {
        mapRef.current.setMaxZoom(7.5);
        mapRef.current.flyTo({
          zoom: 5.8,
          pitch: 0,
          duration: 2000,
          essential: true,
          easing: (t) => 1 - Math.pow(1 - t, 3)
        });
      }
    };
    window.addEventListener('open-weather-radar', handleOpenRadar);
    return () => window.removeEventListener('open-weather-radar', handleOpenRadar);
  }, []);

  useEffect(() => {
    const styles = `
      @keyframes pin-bounce {
        0% { transform: translateY(0); }
        100% { transform: translateY(-8px); }
      }
      .dest-pin {
        animation: pin-bounce 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite alternate;
      }
      .map-pin-arrow {
        width: 36px;
        height: 36px;
        background: #181c25;
        border: 2px solid rgba(255,255,255,0.15);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .map-pin-arrow.near {
        background: #3b82f6;
        border-color: #ffffff;
        transform: scale(1.3);
      }
      @keyframes slide-up {
        0% { transform: translate(-50%, 20px); opacity: 0; }
        100% { transform: translate(-50%, 0); opacity: 1; }
      }
      .animate-slide-up {
        animation: slide-up 0.35s cubic-bezier(0.19, 1, 0.22, 1) forwards;
      }
    `;
    const styleEl = document.createElement('style');
    styleEl.innerHTML = styles;
    const targetHead = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
    if (targetHead) {
      targetHead.appendChild(styleEl);
    }
    return () => {
      try {
        if (targetHead && styleEl.parentNode) {
          targetHead.removeChild(styleEl);
        }
      } catch (e) {}
    };
  }, []);

  // Map is always active. Optimization screen removed.
  const mapActive = true;
  const mapActiveRef = useRef(true);

  const updateRef = useRef<() => void>(() => {});
  const startAnimation = useCallback(() => {
    if (!physics.current.animationId) {
      physics.current.animationId = requestAnimationFrame(() => {
        physics.current.animationId = 0;
        updateRef.current();
      });
    }
  }, []);

  // Sync drawer slides positioning with isOpen state
  useEffect(() => {
    const state = physics.current;
    if (!state.isDragging) {
        const newTargetX = isOpen ? 0 : 100;
        if (state.targetX !== newTargetX || state.animStartTime === 0 || Math.abs(state.currentX - newTargetX) > 0.01) {
            state.startX = state.currentX;
            state.targetX = newTargetX;
            state.animDuration = APP_TRANSITION_DURATION;
            state.animStartTime = performance.now();
            startAnimation();
        }
    }
  }, [isOpen, startAnimation]);

  // Drawer slide frame cycle animation
  useEffect(() => {
    const update = () => {
        const state = physics.current;
        const panel = panelRef.current;

        let isSettled = false;
        if (!state.isDragging) {
            if (state.animStartTime > 0) {
                const elapsed = performance.now() - state.animStartTime;
                const duration = APP_TRANSITION_DURATION; // 580ms App transition duration (synchronized with player and 3D camera)
                const t = Math.min(elapsed / duration, 1.0);
                const easeT = cubicBezierEase(t);
                state.currentX = state.startX + (state.targetX - state.startX) * easeT;
                if (t >= 1.0) {
                  state.currentX = state.targetX;
                  state.animStartTime = 0;
                  isSettled = true;
                }
            } else {
                state.currentX = state.targetX;
                isSettled = true;
            }
        }

        if (state.isInteracting) {
            let visualProgress = state.currentX / 100;
            visualProgress = Math.max(0, Math.min(1, visualProgress));
            
            onDragProgress?.(visualProgress);

            if (!state.isDragging && (isSettled || Math.abs(state.targetX - state.currentX) < 0.2)) {
                state.isInteracting = false;
                onDragProgress?.(null);
            }
        }

        if (panel) {
            let visualX = state.currentX;
            if (!state.isDragging) {
                if (visualX < 0.01) visualX = 0;
                if (visualX > 99.9) visualX = 100;
            }
            panel.style.transform = `translateX(${visualX}%)`;
        }

        // Schedule next frame ONLY if active (animating, dragging, interacting)
        if (!isSettled || state.isDragging || state.isInteracting) {
            state.animationId = requestAnimationFrame(() => {
                state.animationId = 0;
                updateRef.current();
            });
        } else {
            state.animationId = 0;
        }
    };

    updateRef.current = update;
  });

  useEffect(() => {
    // Initial positioning render
    updateRef.current();
    return () => {
        if (physics.current.animationId) {
            cancelAnimationFrame(physics.current.animationId);
            physics.current.animationId = 0;
        }
    };
  }, []);

  // Handle slide drag starts
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!panelRef.current) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startAnimation();
    
    onInteractionStart?.();

    const state = physics.current;
    state.isDragging = true;
    state.isInteracting = true;
    state.dragStartX = e.clientX;
    state.dragStartCurrentX = state.currentX;
    state.panelWidth = panelRef.current.offsetWidth || window.innerWidth * 0.66;
    state.lastClientX = e.clientX;
    state.lastTime = performance.now();
    state.velocityX = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = physics.current;
    if (!state.isDragging) return;
    e.stopPropagation();

    const now = performance.now();
    const dt = now - state.lastTime;
    if (dt > 8) {
      state.velocityX = (e.clientX - state.lastClientX) / dt;
      state.lastClientX = e.clientX;
      state.lastTime = now;
    }

    const deltaPx = e.clientX - state.dragStartX;
    const deltaPercent = (deltaPx / state.panelWidth) * 100;
    
    let newPercent = state.dragStartCurrentX + deltaPercent;
    if (newPercent < 0) newPercent = 0; 
    
    state.currentX = newPercent;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    
    const state = physics.current;
    if (!state.isDragging) return;

    state.isDragging = false;

    // Determine close intent by threshold OR swipe velocity
    const shouldClose = state.velocityX > 0.35 || (state.currentX > CLOSE_THRESHOLD_PERCENT && state.velocityX > -0.25);

    if (shouldClose) {
        state.startX = state.currentX;
        state.targetX = 100;
        state.animDuration = Math.max(180, Math.min(400, (100 - state.currentX) * 3));
        state.animStartTime = performance.now();
        if (isOpen) onClose();
    } else {
        state.startX = state.currentX;
        state.targetX = 0;
        state.animDuration = Math.max(180, Math.min(350, state.currentX * 3));
        state.animStartTime = performance.now();
    }
  };

  // Speaks navigation instructions using browser TTS
  const speakInstructions = (step: StepInfo) => {
    if (!window.speechSynthesis) return;
    const t = (step.maneuver.type || '').toLowerCase();
    const m = (step.maneuver.modifier || '').toLowerCase();
    const name = step.name || '';
    const ref = step.ref || '';
    const road = name || ref || '';
    const ex = step.maneuver.exit;
    const IT: any = { right: 'a destra', 'slight right': 'leggermente a destra', 'sharp right': 'nettamente a destra', left: 'a sinistra', 'slight left': 'leggermente a sinistra', 'sharp left': 'nettamente a sinistra', straight: 'dritto', uturn: 'inversione a U' };
    
    let text = '';
    if (t === 'depart') text = road ? 'Verso ' + road : 'Parti';
    else if (t === 'arrive') text = 'Sei arrivato!';
    else if (t === 'roundabout' || t === 'rotary') { const ex2 = ex ? ' - ' + ex + 'ª uscita' : ''; text = 'Rotonda' + ex2 + (road ? ' su ' + road : ''); }
    else if (t === 'exit roundabout' || t === 'exit rotary') text = 'Esci' + (road ? ' su ' + road : '');
    else if (t === 'merge') text = 'Immettiti' + (road ? ' su ' + road : '');
    else if (t === 'on ramp') text = 'Prendi la rampa' + (road ? ' per ' + road : '');
    else if (t === 'off ramp') text = 'Prendi l\'uscita' + (road ? ' per ' + road : '');
    else if (t === 'fork') { const fd2 = IT[m] ? 'Tieni la ' + IT[m] : 'Tieni la destra'; text = fd2 + (road ? ' su ' + road : ''); }
    else if (t === 'turn') { if (m === 'uturn') text = 'Inversione a U'; else if (m === 'straight') text = road ? 'Prosegui su ' + road : 'Prosegui dritto'; else { const td = IT[m] || ''; text = 'Svolta ' + td + (road ? ' su ' + road : ''); } }
    else if (t === 'new name') text = road ? 'Su ' + road : 'Prosegui';
    else if (t === 'continue') text = road ? 'Continua su ' + road : 'Continua';
    else text = road ? road : 'Prosegui';

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  // Helper functions for projecting route vectors matching class Nav perfectly
  const ptSeg = (pLa: number, pLo: number, aLa: number, aLo: number, bLa: number, bLo: number) => {
    const x = pLo, y = pLa, x1 = aLo, y1 = aLa, x2 = bLo, y2 = bLa;
    const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D, len = C * C + D * D;
    const p = len ? dot / len : 0;
    let xx, yy;
    if (p < 0) { xx = x1; yy = y1; }
    else if (p > 1) { xx = x2; yy = y2; }
    else { xx = x1 + p * C; yy = y1 + p * D; }
    const dx = x - xx, dy = y - yy;
    return { dist: Math.sqrt(dx * dx + dy * dy) * 111320, lat: yy, lng: xx, t: p };
  };

  const clean = (c: any[]) => {
    const r: any[] = [];
    for (let i = 0; i < c.length; i++) {
      if (i === 0 || c[i][0] !== c[i - 1][0] || c[i][1] !== c[i - 1][1]) {
        r.push(c[i]);
      }
    }
    return r;
  };

  const projLine = (pos: { lat: number; lng: number }, line: any[]) => {
    let mn = Infinity;
    let best = null;
    const st = Math.max(0, nearIdxRef.current - 5);
    const en = Math.min(line.length, nearIdxRef.current + 40);

    for (let i = st; i < en - 1; i++) {
      const d = ptSeg(pos.lat, pos.lng, line[i][1], line[i][0], line[i + 1][1], line[i + 1][0]);
      if (d.dist < mn) {
        mn = d.dist;
        best = { point: [d.lng, d.lat] as [number, number], idx: i, t: d.t };
      }
    }
    if (mn > 50) {
      for (let i = 0; i < line.length - 1; i++) {
        const d = ptSeg(pos.lat, pos.lng, line[i][1], line[i][0], line[i + 1][1], line[i + 1][0]);
        if (d.dist < mn) {
          mn = d.dist;
          best = { point: [d.lng, d.lat] as [number, number], idx: i, t: d.t };
        }
      }
    }
    return best;
  };

  // Updates current step index and active/consumed path coordinates segments on map source
  const updateConsumedSegment = () => {
    if (!geoRef.current || !rposRef.current || !mapRef.current) return;
    const g = geoRef.current;
    const pos = rposRef.current;
    const best = projLine(pos, g);
    if (!best) return;

    const pp = best.point;
    const idx = best.idx;
    const t = best.t;

    // Split route geojson inside line-string coordinates
    let con = g.slice(0, idx + 1);
    if (t < 1 && con.length > 0) {
      con[con.length - 1] = pp;
    }
    const upc = [pp, ...g.slice(idx + 1)];

    const cleanCon = clean(con);
    const cleanUpc = clean(upc);

    const f: any[] = [];
    if (cleanCon.length >= 2) {
      f.push({
        type: 'Feature',
        properties: { consumed: true },
        geometry: { type: 'LineString', coordinates: cleanCon }
      });
    }
    if (cleanUpc.length >= 2) {
      f.push({
        type: 'Feature',
        properties: { consumed: false },
        geometry: { type: 'LineString', coordinates: cleanUpc }
      });
    }

    const src = mapRef.current.getSource('route') as any;
    if (src) {
      src.setData({ type: 'FeatureCollection', features: f });
    }

    // Remaining trace computation
    let rem = 0;
    for (let j = idx; j < g.length - 1; j++) {
      rem += dist(g[j][1], g[j][0], g[j + 1][1], g[j + 1][0]);
    }
    if (idx < g.length - 1) {
      const sd = dist(g[idx][1], g[idx][0], g[idx + 1][1], g[idx + 1][0]);
      rem -= sd * t;
    }

    updateHUD(rem, rem / Math.max(speedRef.current, 8));

    // Dynamic step progress index matching
    let cumTrav = 0;
    for (let i = 0; i < idx; i++) {
       cumTrav += dist(g[i][1], g[i][0], g[i+1][1], g[i+1][0]);
    }
    cumTrav += dist(g[idx][1], g[idx][0], pp[1], pp[0]);

    if (stepsRef.current.length > 0) {
      let currentStepIdx = siRef.current;
      for (let s = 0; s < stepsRef.current.length - 1; s++) {
        if ((stepsRef.current[s]._dfs || 0) < cumTrav - 30) {
          currentStepIdx = s + 1;
        } else {
          break;
        }
      }
      if (currentStepIdx !== siRef.current) {
         siRef.current = Math.min(currentStepIdx, stepsRef.current.length - 1);
         setCurrentStepIndex(siRef.current);
         speakInstructions(stepsRef.current[siRef.current]);
      }
    }

    // Check proximity to upcoming road hazards ahead of vehicle
    if (roadHazardsRef.current && roadHazardsRef.current.length > 0) {
      let closest: RoadHazard | null = null;
      let minDistance = Infinity;

      for (const hz of roadHazardsRef.current) {
        const dHz = dist(pp[1], pp[0], hz.lat, hz.lng);
        const threshold = hz.type === 'speed_camera' ? 650 : 250;
        if (dHz <= threshold && dHz < minDistance) {
          minDistance = dHz;
          closest = hz;
        }
      }

      if (closest && minDistance < Infinity) {
        setUpcomingHazard({ hazard: closest, distanceMeters: Math.round(minDistance) });
      } else {
        setUpcomingHazard(null);
      }
    }
  };

  // Re-routes calculation on major location deviances (> 35 meters threshold)
  const checkRouteDeviations = (pos: { lat: number; lng: number }) => {
    if (!geoRef.current || recalcCDRef.current) return;
    let mn = Infinity;
    const start = Math.max(0, nearIdxRef.current - 5);
    const end = Math.min(geoRef.current.length, start + 50);

    for (let i = start; i < end; i++) {
      const d = dist(pos.lat, pos.lng, geoRef.current[i][1], geoRef.current[i][0]);
      if (d < mn) mn = d;
    }
    if (mn > 50) {
      for (let i = 0; i < geoRef.current.length; i++) {
        const d = dist(pos.lat, pos.lng, geoRef.current[i][1], geoRef.current[i][0]);
        if (d < mn) mn = d;
      }
    }

    if (mn > 35) {
      devCntRef.current = (devCntRef.current || 0) + 1;
      if (devCntRef.current >= 2) {
        devCntRef.current = 0;
        recalcCDRef.current = true;
        
        // Reroute matching target coords
        if (destRef.current) {
          fetchRoute(pos, destRef.current);
        }
        setTimeout(() => {
          recalcCDRef.current = false;
        }, 15000);
      }
    } else {
      devCntRef.current = 0;
    }
  };

  // Pre-computes cumulative distances along a LineString to eliminate heavy per-frame trig calculations
  const precomputeLineDistances = (coords: [number, number][]) => {
    if (!coords || coords.length < 2) {
      return { dists: new Float64Array(0), totalDist: 0 };
    }
    const len = coords.length;
    const dists = new Float64Array(len);
    let total = 0;
    for (let i = 1; i < len; i++) {
      const p1 = coords[i - 1];
      const p2 = coords[i];
      const cosLat = Math.cos(((p1[1] + p2[1]) * Math.PI) / 720);
      const dx = (p2[0] - p1[0]) * cosLat;
      const dy = p2[1] - p1[1];
      total += Math.hypot(dx, dy);
      dists[i] = total;
    }
    return { dists, totalDist: total };
  };

  // Interpolate line coordinates using binary search over precalculated distances (O(log N))
  const interpolateLineFast = (
    coords: [number, number][],
    dists: Float64Array,
    totalDist: number,
    progress: number
  ): [number, number][] => {
    if (!coords || coords.length < 2) return coords || [];
    if (progress <= 0) return [coords[0], coords[0]];
    if (progress >= 1 || totalDist <= 0) return coords;

    const targetDist = progress * totalDist;
    // Binary search
    let low = 0;
    let high = dists.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (dists[mid] < targetDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(0, Math.min(coords.length - 2, low - 1));
    const dStart = dists[idx];
    const dEnd = dists[idx + 1];
    const span = dEnd - dStart;
    const frac = span > 0 ? (targetDist - dStart) / span : 0;

    const p1 = coords[idx];
    const p2 = coords[idx + 1] || p1;
    const tip: [number, number] = [
      p1[0] + (p2[0] - p1[0]) * frac,
      p1[1] + (p2[1] - p1[1]) * frac,
    ];

    // For extremely long routes (>800 pts), downsample earlier points to preserve 60fps rendering
    if (coords.length > 800) {
      const stepSize = Math.max(1, Math.floor(coords.length / 400));
      const sampled: [number, number][] = [];
      for (let i = 0; i <= idx; i += stepSize) {
        sampled.push(coords[i]);
      }
      if (sampled[sampled.length - 1] !== coords[idx]) {
        sampled.push(coords[idx]);
      }
      sampled.push(tip);
      return sampled;
    }

    return [...coords.slice(0, idx + 1), tip];
  };

  // Animation frame handler for route tracing across the road network (lag-free, hardware-accelerated)
  const animateRouteDrawing = useCallback((allRoutes: any[], selectedIndex: number, animDuration = 1200) => {
    if (!mapRef.current || !mapRef.current.getSource('routes-source')) return;

    if (routeAnimIdRef.current) {
      cancelAnimationFrame(routeAnimIdRef.current);
      routeAnimIdRef.current = null;
    }

    // Precalculate all route distance arrays ONCE before starting the animation loop
    const precomputed = allRoutes.map((r) => {
      const coords = r.geometry.coordinates as [number, number][];
      const { dists, totalDist } = precomputeLineDistances(coords);
      return { coords, dists, totalDist };
    });

    const maxPoints = Math.max(...allRoutes.map(r => r.geometry.coordinates?.length || 0));
    // For very long intercity routes, slightly adjust duration for smooth cinematic pacing
    const adjustedDuration = maxPoints > 2000 ? 1500 : animDuration;
    const minFrameInterval = maxPoints > 1000 ? 24 : 14; // Limit to ~40fps for massive lines to avoid worker queue lag

    const startTime = performance.now();
    let lastRenderTime = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / adjustedDuration);
      // Smooth cubic ease out
      const ease = 1 - Math.pow(1 - progress, 3);

      if (progress < 1 && (now - lastRenderTime < minFrameInterval)) {
        routeAnimIdRef.current = requestAnimationFrame(step);
        return;
      }
      lastRenderTime = now;

      const features = allRoutes.map((r, i) => {
        const item = precomputed[i];
        const drawnCoords = interpolateLineFast(item.coords, item.dists, item.totalDist, ease);
        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: drawnCoords
          },
          properties: {
            is_selected: i === selectedIndex,
            route_index: i
          }
        };
      });

      // Render unselected first, selected route last so it's always on top
      features.sort((a, b) => (a.properties.is_selected === b.properties.is_selected ? 0 : a.properties.is_selected ? 1 : -1));

      if (mapRef.current && mapRef.current.getSource('routes-source')) {
        (mapRef.current.getSource('routes-source') as any).setData({
          type: 'FeatureCollection',
          features
        });
      }

      if (progress < 1) {
        routeAnimIdRef.current = requestAnimationFrame(step);
      } else {
        routeAnimIdRef.current = null;
        // Final complete geometry at end of animation
        if (mapRef.current && mapRef.current.getSource('routes-source')) {
          const finalFeatures = allRoutes.map((r, i) => ({
            type: 'Feature',
            geometry: r.geometry,
            properties: {
              is_selected: i === selectedIndex,
              route_index: i
            }
          }));
          finalFeatures.sort((a, b) => (a.properties.is_selected === b.properties.is_selected ? 0 : a.properties.is_selected ? 1 : -1));
          (mapRef.current.getSource('routes-source') as any).setData({
            type: 'FeatureCollection',
            features: finalFeatures
          });
        }
      }
    };

    routeAnimIdRef.current = requestAnimationFrame(step);
  }, []);

  const applyRoute = useCallback((allRoutes: any[], index: number, shouldFitBounds = false, shouldAnimate = false) => {
      const route = allRoutes[index];
      if (!route) return;
      const coords = route.geometry.coordinates;
      geoRef.current = coords;

      const items: StepInfo[] = [];
      let dfs = 0;
      if (route.legs) {
        route.legs.forEach((leg: any) => {
          leg.steps.forEach((step: any) => {
            items.push({
              maneuver: step.maneuver,
              name: step.name || '',
              ref: step.ref || '',
              distance: step.distance || 0,
              duration: step.duration || 0,
              _dfs: dfs
            });
            dfs += step.distance || 0;
          });
        });
      }

      stepsRef.current = items;
      setSteps(items);
      siRef.current = 0;
      setCurrentStepIndex(0);
      nearIdxRef.current = 0;
      updateHUD(route.distance, route.duration);

      const reversedCoords: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]);
      routeStore.setRoute(reversedCoords);
      setTripInfo({
        time: route.duration,
        distance: route.distance,
      });

      if (shouldAnimate) {
        animateRouteDrawing(allRoutes, index, 1500);
      } else if (mapRef.current && mapRef.current.getSource('routes-source')) {
        const features = allRoutes.map((r, i) => ({
            type: 'Feature',
            geometry: r.geometry,
            properties: { 
                is_selected: i === index,
                route_index: i
            }
        }));
        // Draw selected route last so it's on top
        features.sort((a, b) => (a.properties.is_selected === b.properties.is_selected ? 0 : a.properties.is_selected ? 1 : -1));
        
        (mapRef.current.getSource('routes-source') as any).setData({
            type: 'FeatureCollection',
            features: features
        });
        if (mapRef.current.getLayer('vehicle-layer')) {
          mapRef.current.moveLayer('vehicle-layer');
        }
      }

      // Fetch and place real road hazard markers (autovelox, traffic signals, roadworks, detours) along the selected route
      fetchRoadHazardsForRoute(coords).then((hazards) => {
        setRoadHazards(hazards);
        roadHazardsRef.current = hazards;

        const cameras = hazards.filter(h => h.type === 'speed_camera').length;
        const signals = hazards.filter(h => h.type === 'traffic_signal').length;
        const roadworks = hazards.filter(h => h.type === 'roadworks').length;
        const dangers = hazards.filter(h => h.type === 'hazard').length;
        const detours = hazards.filter(h => h.type === 'detour').length;

        setHazardsSummary({
          cameras,
          signals,
          roadworks,
          hazards: dangers,
          congestion: detours,
        });

        // Place markers on the map
        hazardMarkersRef.current.forEach(m => m.remove());
        hazardMarkersRef.current = [];

        if (mapRef.current) {
          hazards.slice(0, 50).forEach(hz => {
            let el: HTMLElement;
            if (hz.type === 'speed_camera') {
              el = createSpeedCameraMarkerElement(hz, isNight);
            } else if (hz.type === 'traffic_signal') {
              el = createTrafficSignalMarkerElement(hz, isNight);
            } else if (hz.type === 'roadworks') {
              el = createRoadworksMarkerElement(hz, isNight);
            } else if (hz.type === 'detour') {
              el = createDetourMarkerElement(hz, isNight);
            } else if (hz.type === 'congestion') {
              el = createTrafficCongestionMarkerElement(hz, isNight);
            } else {
              el = createHazardMarkerElement(hz, isNight);
            }

            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([hz.lng, hz.lat])
              .addTo(mapRef.current!);
            hazardMarkersRef.current.push(m);
          });
        }
      }).catch((err) => {
        console.warn('Road hazards query warning:', err);
      });

      // Analyze and render colored traffic flow overlay along the route
      try {
        const trafficAnalysis = analyzeRouteTraffic(
          coords,
          selectedRoute.annotation?.speed,
          selectedRoute.hasMotorway
        );
        const trafficGeo = buildTrafficGeoJSON(trafficAnalysis.segments);
        if (mapRef.current && mapRef.current.getSource('traffic-source')) {
          (mapRef.current.getSource('traffic-source') as any).setData(trafficGeo);
        }
      } catch (err) {
        console.warn('Traffic layer update notice:', err);
      }

      if (shouldFitBounds && mapRef.current && !navingRef.current) {
        setIsRoutePreview(true);
        isRoutePreviewRef.current = true;
        followRef.current = false;
        setIsMapFollowing(false);
        flyingRef.current = true;

        if (recTimerRef.current) {
          clearTimeout(recTimerRef.current);
          recTimerRef.current = null;
        }
        
        // Compute bounding box containing all routes
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        allRoutes.forEach(r => {
            r.geometry.coordinates.forEach((c: any) => {
                if (c[1] < minLat) minLat = c[1];
                if (c[1] > maxLat) maxLat = c[1];
                if (c[0] < minLng) minLng = c[0];
                if (c[0] > maxLng) maxLng = c[0];
            });
        });

        const container = mapRef.current.getContainer();
        const cWidth = container?.clientWidth || 900;
        const cHeight = container?.clientHeight || 600;

        // Account for TripStatsHUD (w-[24.5rem] ~ 392px + 24px left margin = 416px) on the left
        const leftPadding = cWidth > 750 ? Math.min(430, Math.round(cWidth * 0.45)) : Math.max(60, Math.round(cWidth * 0.35));
        const topPadding = 110;
        const bottomPadding = 90;
        const rightPadding = 80;

        mapRef.current.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { 
            padding: { top: topPadding, bottom: bottomPadding, left: leftPadding, right: rightPadding }, 
            duration: 1100, 
            pitch: 0 
          }
        );

        mapRef.current.once('moveend', () => {
          flyingRef.current = false;
        });
      }
  }, [updateHUD, animateRouteDrawing, isNight]);

  // Fetch travel route vectors using TomTom, Mapbox, or OSRM services
  const fetchRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (!start || !end) return;
    const currentId = ++activeFetchIdRef.current;
    
    // 1. First attempt with TomTom Routing API (for real-time traffic speeds, accurate delay & lane guidance)
    const ttKey = getTomTomApiKey();
    if (ttKey) {
      try {
        const ttRoutes = await calculateTomTomRoute(start, end, ttKey);
        if (ttRoutes && ttRoutes.length > 0 && activeFetchIdRef.current === currentId) {
          routesRef.current = ttRoutes;
          setRoutes(ttRoutes);

          const fastest = ttRoutes[0];
          const fastestSteps = fastest.legs?.flatMap((l: any) => l.steps || []) || [];
          const fastestHasMotorway = fastest.hasMotorway || fastestSteps.some((s: any) => {
            const n = (s.name || '').toLowerCase();
            const ref = (s.ref || '').toLowerCase();
            return ref.startsWith('a') || ref.startsWith('e') || n.includes('autostrada') || n.includes('tangenziale') || n.includes('raccordo') || n.includes('gra');
          });

          const computedOptions: RouteOption[] = ttRoutes.map((r: any, idx: number) => {
            const steps = r.legs?.flatMap((l: any) => l.steps || []) || [];
            const hasMotorway = r.hasMotorway || steps.some((s: any) => {
              const n = (s.name || '').toLowerCase();
              const ref = (s.ref || '').toLowerCase();
              return ref.startsWith('a') || ref.startsWith('e') || n.includes('autostrada') || n.includes('tangenziale') || n.includes('raccordo') || n.includes('gra');
            });

            const hasFerry = r.hasFerry || steps.some((s: any) => {
              const n = (s.name || '').toLowerCase();
              const ref = (s.ref || '').toLowerCase();
              const mode = (s.mode || '').toLowerCase();
              const t = (s.maneuver?.type || '').toLowerCase();
              return mode === 'ferry' || t.includes('ferry') || n.includes('traghetto') || n.includes('ferry') || n.includes('imbarco') || ref.includes('ferry') || ref.includes('traghetto');
            });

            const timeDiffSec = r.duration - fastest.duration;
            const timeDiffMinutes = Math.max(0, Math.round(timeDiffSec / 60));
            const distDiffKm = Math.round(((r.distance - fastest.distance) / 1000) * 10) / 10;
            const summary = r.legs?.[0]?.summary || '';
            const significantRoad = steps.find((s: any) => (s.ref && s.ref.length > 1) || (s.name && s.name.length > 3))?.ref || summary.split(',')[0];

            let label = 'Percorso consigliato';
            let tag = '';
            let gainSummary = '';
            let whyChoose = '';
            let badgeType: 'fastest' | 'scenic' | 'toll_free' | 'shortest' | 'alternative' = 'alternative';

            const delayMin = Math.round((r.trafficInfo?.delaySeconds || 0) / 60);
            const liveTrafficAvailable = r.trafficInfo?.available;

            if (idx === 0) {
              badgeType = 'fastest';
              label = 'Più veloce';
              if (hasFerry) {
                tag = hasMotorway ? 'Autostrada + Traghetto' : 'Traghetto veicoli';
                whyChoose = 'Itinerario ottimale con imbarco traghetto veicoli.';
              } else if (liveTrafficAvailable) {
                if (delayMin > 1) {
                  tag = (hasMotorway ? 'Autostrada • ' : '') + `+${delayMin} min ritardo traffico`;
                  whyChoose = `Percorso più rapido TomTom, include ${delayMin} min di ritardo stimato per traffico.`;
                } else {
                  tag = (hasMotorway ? 'Autostrada • ' : '') + 'Traffico scorrevole';
                  whyChoose = 'Itinerario TomTom ottimale con traffico scorrevole e analisi in tempo reale.';
                }
              } else {
                tag = hasMotorway ? 'Autostrada' : (significantRoad ? `Via ${significantRoad}` : 'Arteria principale');
                whyChoose = 'Itinerario a scorrimento rapido per raggiungere la destinazione nel minor tempo.';
              }

              if (ttRoutes.length > 1) {
                const timeSaved = Math.round((ttRoutes[1].duration - fastest.duration) / 60);
                gainSummary = timeSaved > 0 ? `Risparmi ${timeSaved} min` : 'Percorso ottimale';
              } else {
                gainSummary = 'Percorso ottimale';
              }
            } else {
              if ((fastest.hasTollRoad || fastestHasMotorway) && !r.hasTollRoad && !hasMotorway) {
                badgeType = 'toll_free';
                label = `Senza pedaggio (+${timeDiffMinutes} min)`;
                tag = 'Zero pedaggi • Strade statali SS/SP';
                gainSummary = 'Nessun pedaggio';
                whyChoose = `Itinerario senza pedaggi (+${timeDiffMinutes} min): viabilità ordinaria senza costi autostradali.`;
              } else if (!hasMotorway && fastestHasMotorway) {
                badgeType = 'scenic';
                label = `Statale / Panoramico (+${timeDiffMinutes} min)`;
                tag = 'Strada Statale ordinaria';
                gainSummary = `+${timeDiffMinutes} min • Guida statale`;
                whyChoose = `Itinerario su viabilità statale ordinaria (+${timeDiffMinutes} min): alternativa alle autostrade a pedaggio.`;
              } else if (distDiffKm < -0.5) {
                badgeType = 'shortest';
                label = `Più breve (${Math.abs(distDiffKm)} km in meno)`;
                tag = 'Minor chilometraggio';
                gainSummary = `${Math.abs(distDiffKm)} km in meno`;
                whyChoose = `Itinerario chilometricamente più corto (${Math.abs(distDiffKm)} km in meno).`;
              } else {
                badgeType = 'alternative';
                label = significantRoad ? `Via ${significantRoad} (+${timeDiffMinutes} min)` : `Alternativa (+${timeDiffMinutes} min)`;
                tag = significantRoad ? `Via ${significantRoad}` : (hasMotorway ? 'Via Autostrada' : 'Percorso alternativo');
                gainSummary = distDiffKm < 0 ? `${Math.abs(distDiffKm)} km in meno` : `+${timeDiffMinutes} min`;
                whyChoose = `Variante TomTom (${significantRoad || 'alternativa'}) in caso di congestione sul percorso primario.`;
              }
            }

            return {
              index: idx,
              distance: r.distance,
              duration: r.duration,
              summary,
              hasMotorway,
              hasFerry,
              timeDiffMinutes,
              distDiffKm,
              label,
              tag,
              gainSummary,
              whyChoose,
              badgeType,
              geometry: r.geometry,
              steps
            };
          });

          setRouteOptions(computedOptions);
          setSelectedRouteIndex(0);
          selectedRouteIndexRef.current = 0;

          // Clear any active navigation route line before previewing routes
          if (mapRef.current && mapRef.current.getSource('route')) {
            (mapRef.current.getSource('route') as any).setData({
              type: 'FeatureCollection',
              features: []
            });
          }

          // Apply TomTom route with full hud updates, camera framing and hazard tracking
          applyRoute(ttRoutes, 0, true, true);
          return;
        }
      } catch (err) {
        console.warn('TomTom route failed, falling back to Mapbox/OSRM:', err);
      }
    }

    // 2. Fallback to Mapbox or OSRM
    const mapboxToken =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MAPBOX_TOKEN) ||
      (typeof process !== 'undefined' && process.env && process.env.VITE_MAPBOX_TOKEN) ||
      '';
    const distApproxKm = dist(start.lat, start.lng, end.lat, end.lng) / 1000;
    const alternativesParam = distApproxKm > 60 ? 'alternatives=true' : 'alternatives=2';

    let url = '';
    if (mapboxToken) {
      url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.lng},${start.lat};${end.lng},${end.lat}?alternatives=true&geometries=geojson&steps=true&overview=full&access_token=${mapboxToken}`;
    } else {
      url = `${OSRM_URL}${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true&annotations=false&${alternativesParam}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (activeFetchIdRef.current !== currentId) return; // Discard stale fetch promises

      if (!data.routes || !data.routes.length) throw new Error('Route empty');
      
      let rawRoutes: any[] = [...data.routes];

      // Sort routes by duration ascending: Route 0 is ALWAYS the fastest route
      rawRoutes.sort((a, b) => a.duration - b.duration);

      routesRef.current = rawRoutes;
      setRoutes(rawRoutes);

      const fastest = rawRoutes[0];
      const fastestSteps = fastest.legs?.flatMap((l: any) => l.steps || []) || [];
      const fastestHasMotorway = fastestSteps.some((s: any) => {
        const n = (s.name || '').toLowerCase();
        const ref = (s.ref || '').toLowerCase();
        return ref.startsWith('a') || ref.startsWith('e') || n.includes('autostrada') || n.includes('tangenziale') || n.includes('raccordo') || n.includes('gra');
      });

      const computedOptions: RouteOption[] = rawRoutes.map((r: any, idx: number) => {
        const steps = r.legs?.flatMap((l: any) => l.steps || []) || [];
        const hasMotorway = steps.some((s: any) => {
          const n = (s.name || '').toLowerCase();
          const ref = (s.ref || '').toLowerCase();
          return ref.startsWith('a') || ref.startsWith('e') || n.includes('autostrada') || n.includes('tangenziale') || n.includes('raccordo') || n.includes('gra');
        });

        const hasFerry = steps.some((s: any) => {
          const n = (s.name || '').toLowerCase();
          const ref = (s.ref || '').toLowerCase();
          const mode = (s.mode || '').toLowerCase();
          const t = (s.maneuver?.type || '').toLowerCase();
          return mode === 'ferry' || t.includes('ferry') || n.includes('traghetto') || n.includes('ferry') || n.includes('imbarco') || ref.includes('ferry') || ref.includes('traghetto');
        });

        const timeDiffSec = r.duration - fastest.duration;
        const timeDiffMinutes = Math.max(0, Math.round(timeDiffSec / 60));
        const distDiffKm = Math.round(((r.distance - fastest.distance) / 1000) * 10) / 10;
        const summary = r.legs?.[0]?.summary || '';
        const significantRoad = steps.find((s: any) => (s.ref && s.ref.length > 1) || (s.name && s.name.length > 3))?.ref || summary.split(',')[0];

        let label = 'Percorso consigliato';
        let tag = '';
        let gainSummary = '';
        let whyChoose = '';
        let badgeType: 'fastest' | 'scenic' | 'toll_free' | 'shortest' | 'alternative' = 'alternative';

        if (idx === 0) {
          badgeType = 'fastest';
          label = 'Più veloce';
          if (hasFerry) {
            tag = hasMotorway ? 'Autostrada + Traghetto auto' : 'Traghetto auto incluso';
            whyChoose = 'Itinerario ottimale con imbarco traghetto veicoli: include traversata marittima con vettura al seguito.';
          } else {
            tag = hasMotorway ? 'Autostrada • Massima velocità' : (significantRoad ? `Via ${significantRoad}` : 'Arteria principale');
            whyChoose = 'Itinerario a scorrimento rapido: consigliato per raggiungere la destinazione nel minor tempo possibile.';
          }
          if (rawRoutes.length > 1) {
            const timeSaved = Math.round((rawRoutes[1].duration - fastest.duration) / 60);
            gainSummary = timeSaved > 0 ? `Risparmi ${timeSaved} min` : 'Percorso ottimale';
          } else {
            gainSummary = 'Percorso ottimale';
          }
        } else {
          if (fastestHasMotorway && !hasMotorway) {
            badgeType = 'toll_free';
            label = `Senza pedaggio (+${timeDiffMinutes} min)`;
            tag = hasFerry ? 'Zero pedaggi • Con traghetto' : 'Zero pedaggi • Strade statali SS/SP';
            gainSummary = 'Nessun pedaggio';
            whyChoose = `Itinerario senza pedaggi (+${timeDiffMinutes} min): azzera i costi dei caselli autostradali viaggiando su viabilità statale ordinaria${hasFerry ? ' con imbarco traghetto' : ''}.`;
          } else if (timeDiffMinutes >= 3 && !hasMotorway) {
            badgeType = 'scenic';
            label = `Panoramico (+${timeDiffMinutes} min)`;
            tag = hasFerry ? 'Guida rilassante • Con traghetto' : 'Guida rilassante • Paesaggio';
            gainSummary = `+${timeDiffMinutes} min • Guida panoramica`;
            whyChoose = `Itinerario panoramico (+${timeDiffMinutes} min): consigliato per godersi il paesaggio e una guida rilassante${hasFerry ? ', include tratta in traghetto' : ''}.`;
          } else if (distDiffKm < -0.5) {
            badgeType = 'shortest';
            label = `Più breve (${Math.abs(distDiffKm)} km in meno)`;
            tag = hasFerry ? 'Minor km • Con traghetto' : 'Minor chilometraggio';
            gainSummary = `${Math.abs(distDiffKm)} km in meno`;
            whyChoose = `Itinerario più corto (${Math.abs(distDiffKm)} km in meno): riduce i chilometri totali${hasFerry ? ' tramite traghetto' : ''}.`;
          } else {
            badgeType = 'alternative';
            label = significantRoad ? `Via ${significantRoad} (+${timeDiffMinutes} min)` : `Alternativa (+${timeDiffMinutes} min)`;
            tag = significantRoad ? `Via ${significantRoad}${hasFerry ? ' • Traghetto' : ''}` : (hasMotorway ? 'Via Autostrada' : (hasFerry ? 'Traghetto auto' : 'Percorso alternativo'));
            gainSummary = distDiffKm < 0 ? `${Math.abs(distDiffKm)} km in meno` : `+${timeDiffMinutes} min`;
            whyChoose = significantRoad
              ? `Variante viaria via ${significantRoad} (+${timeDiffMinutes} min): variante di scorrimento utile in caso di traffico${hasFerry ? ' (include traghetto)' : ''}.`
              : `Percorso alternativo secondario (+${timeDiffMinutes} min): variante di scorrimento utile in caso di rallentamenti${hasFerry ? ' (include traghetto)' : ''}.`;
          }
        }

        return {
          index: idx,
          distance: r.distance,
          duration: r.duration,
          summary,
          hasMotorway,
          hasFerry,
          timeDiffMinutes,
          distDiffKm,
          label,
          tag,
          gainSummary,
          whyChoose,
          badgeType,
          geometry: r.geometry,
          steps
        };
      });

      setRouteOptions(computedOptions);
      setSelectedRouteIndex(0);
      selectedRouteIndexRef.current = 0;
      applyRoute(rawRoutes, 0, true, true);
    } catch (err) {
      console.warn('Routing error', err);
    }
  }, [updateHUD, applyRoute]);

  const handleSelectRouteAlternative = useCallback((index: number) => {
    if (!routesRef.current || !routesRef.current[index]) return;
    setSelectedRouteIndex(index);
    selectedRouteIndexRef.current = index;
    // Animate the route trace when selecting an alternative
    applyRoute(routesRef.current, index, false, true);
  }, [applyRoute]);

  const startTracking = useCallback(() => {
    isPendingStartRef.current = true;
    if (routeAnimIdRef.current) {
      cancelAnimationFrame(routeAnimIdRef.current);
      routeAnimIdRef.current = null;
    }
    startTrackTimerRef.current = setTimeout(() => {
      setNaving(true);
      navingRef.current = true;
      isRoutePreviewRef.current = false;
      setIsRoutePreview(false);
      isPendingStartRef.current = false;
      cmodeRef.current = 'heading-up';
      setCmode('heading-up');

      // Clear multi-route preview lines from map
      if (mapRef.current && mapRef.current.getSource('routes-source')) {
        (mapRef.current.getSource('routes-source') as any).setData({
          type: 'FeatureCollection',
          features: []
        });
      }

      // Populate active route line with selected route coords
      if (mapRef.current && mapRef.current.getSource('route') && geoRef.current) {
        (mapRef.current.getSource('route') as any).setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { consumed: false },
              geometry: { type: 'LineString', coordinates: geoRef.current }
            }
          ]
        });
        if (mapRef.current.getLayer('vehicle-layer')) {
          mapRef.current.moveLayer('vehicle-layer');
        }
      }

      followRef.current = true;
      setIsMapFollowing(true);
      if (smoothRecRef.current) smoothRecRef.current();
    }, 100);
  }, []);

  const setDest = useCallback((coords: { lat: number; lng: number }, name: string) => {
    destRef.current = coords;
    destinationNameRef.current = name;
    setDestinationName(name);

    // Stop auto-following and clear any recenter timers so camera will smoothly transition to the route
    followRef.current = false;
    setIsMapFollowing(false);
    isRoutePreviewRef.current = true;
    setIsRoutePreview(true);
    if (recTimerRef.current) {
      clearTimeout(recTimerRef.current);
      recTimerRef.current = null;
    }

    if (mapRef.current) {
      if (destMarkRef.current) {
        destMarkRef.current.remove();
        destMarkRef.current = null;
      }
      const el = createDestinationMarkerElement(name, isNight);
      destMarkRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([coords.lng, coords.lat])
        .addTo(mapRef.current);
    }
    
    // Use fallback coordinates (Milan) if GPS hasn't acquired a fix yet
    const fallbackStart = { lat: 45.4642, lng: 9.1900 };
    const start = tgtRef.current || rposRef.current || fallbackStart;
    
    if (start) {
      fetchRoute(start, coords);
    } else {
      pendDestRef.current = { coords, name };
    }
  }, [fetchRoute, isNight]);

  // Clears route visualization and resets mapping state
  const clearRoute = useCallback((isSoft = false) => {
    if (startTrackTimerRef.current) clearTimeout(startTrackTimerRef.current);
    if (routeAnimIdRef.current) {
      cancelAnimationFrame(routeAnimIdRef.current);
      routeAnimIdRef.current = null;
    }
    isPendingStartRef.current = false;
    activeFetchIdRef.current++;

    isRoutePreviewRef.current = false;
    setIsRoutePreview(false);

    destRef.current = null;
    destinationNameRef.current = '';
    geoRef.current = null;
    stepsRef.current = [];
    setSteps([]);
    setRouteOptions([]);
    setRoutes([]);
    routesRef.current = [];
    setNaving(false);
    navingRef.current = false;
    siRef.current = 0;
    setCurrentStepIndex(0);
    nearIdxRef.current = 0;

    routeStore.setRoute(null);
    setTripInfo(null);

    if (destMarkRef.current) {
      destMarkRef.current.remove();
      destMarkRef.current = null;
    }
    if (proxMarkRef.current) {
      proxMarkRef.current.remove();
      proxMarkRef.current = null;
    }

    hazardMarkersRef.current.forEach(m => m.remove());
    hazardMarkersRef.current = [];
    poiMarkersRef.current.forEach(m => m.remove());
    poiMarkersRef.current = [];
    setSelectedPOI(null);
    setRoadHazards([]);
    roadHazardsRef.current = [];
    setUpcomingHazard(null);
    setHazardsSummary({ cameras: 0, signals: 0, roadworks: 0, hazards: 0, congestion: 0 });

    if (stepFocusMarkerRef.current) {
      stepFocusMarkerRef.current.remove();
      stepFocusMarkerRef.current = null;
    }

    if (mapRef.current && mapRef.current.getSource('route')) {
      (mapRef.current.getSource('route') as any).setData({
        type: 'FeatureCollection',
        features: []
      });
    }

    if (mapRef.current && mapRef.current.getSource('routes-source')) {
      (mapRef.current.getSource('routes-source') as any).setData({
        type: 'FeatureCollection',
        features: []
      });
    }

    if (mapRef.current && mapRef.current.getSource('traffic-source')) {
      (mapRef.current.getSource('traffic-source') as any).setData({
        type: 'FeatureCollection',
        features: []
      });
    }

    setRoutes([]);
    setRouteOptions([]);
    routesRef.current = [];
    setSelectedRouteIndex(0);
    selectedRouteIndexRef.current = 0;

    if (!isSoft) {
      if (rposRef.current && mapRef.current) {
        
        // Restore mode to what it was
        cmodeRef.current = prevCmodeRef.current;
        setCmode(prevCmodeRef.current);

        if (smoothRecRef.current) {
          smoothRecRef.current();
        } else {
          flyingRef.current = true;
          mapRef.current.easeTo({
            center: [rposRef.current.lng, rposRef.current.lat],
            zoom: cmodeRef.current === 'heading-up' ? 16 : 14,
            bearing: cmodeRef.current === 'heading-up' ? cbearRef.current : 0,
            duration: 1600,
            essential: true,
            easing: (t) => 1 - Math.pow(1 - t, 3.5)
          });
          mapRef.current.once('moveend', () => {
            flyingRef.current = false;
            followRef.current = true;
            setIsMapFollowing(true);
          });
        }
      } else {
        followRef.current = true;
        setIsMapFollowing(true);
      }
    }
  }, []);

  // Recenter map camera on active vehicle location Ref point
  const smoothRec = useCallback(() => {
    if (!rposRef.current || !mapRef.current) return;

    if (recTimerRef.current) {
      clearTimeout(recTimerRef.current);
      recTimerRef.current = null;
    }

    const isWeather = isWeatherActiveRef.current;
    if (isWeather) {
      // Keep weather radar active; restrict maxZoom to radar overview level
      if (mapRef.current) {
        mapRef.current.setMaxZoom(7.5);
      }
    } else if (mapRef.current) {
      mapRef.current.setMaxZoom(20);
    }

    const flightId = ++flightSeqRef.current;
    flyingRef.current = true;
    followRef.current = false;
    setIsMapFollowing(true);

    // If the map was rotated away from north-up during user exploration, restore the previous mode (e.g. north-up)
    if (savedModeRef.current) {
      cmodeRef.current = savedModeRef.current;
      setCmode(savedModeRef.current);
    }

    const tb = cmodeRef.current === 'heading-up' ? cbearRef.current : 0;
    // Always preserve 3D mode (pitch 45°) if 3D is active, even when weather radar is visible
    const tp = is3DRef.current ? 45 : 0;
    const tll: [number, number] = [rposRef.current.lng, rposRef.current.lat];
    // For weather radar, zoom to radar overview level (7.0) so radar remains visible without zooming in excessively
    const tz = isWeather ? 7.0 : 16.0;

    ccamPitchRef.current = tp;
    ccamBearRef.current = tb;

    // Stop any conflicting animation
    mapRef.current.stop();

    // Calculate distance and zoom difference to determine whether the camera is close
    const curCenter = mapRef.current.getCenter();
    const curZoom = mapRef.current.getZoom();
    const dLat = (curCenter.lat - tll[1]) * 111320;
    const dLng = (curCenter.lng - tll[0]) * 111320 * Math.cos((curCenter.lat * Math.PI) / 180);
    const distMeters = Math.hypot(dLat, dLng);
    const zoomDiff = Math.abs(curZoom - tz);

    // Smooth dynamic ease-out curve: elegant initial movement that decelerates with velvet precision
    const smoothEaseOut = (t: number) => {
      return 1 - Math.pow(1 - t, 3.5);
    };

    if (distMeters < 3500 && zoomDiff < 4) {
      // Normal close-range recenter: slightly slower (~1350ms) with dynamic ease-out landing
      mapRef.current.easeTo({
        center: tll,
        zoom: tz,
        bearing: tb,
        pitch: tp,
        duration: 1350,
        easing: smoothEaseOut,
        essential: true
      });
    } else {
      // Long-range recenter: smooth cruising flyTo with dynamic ease-out arrival
      mapRef.current.flyTo({
        center: tll,
        zoom: tz,
        bearing: tb,
        pitch: tp,
        speed: 0.85,
        curve: 1.3,
        essential: true,
        easing: smoothEaseOut
      });
    }

    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    flyTimerRef.current = setTimeout(() => {
      if (flightSeqRef.current === flightId) {
        flyingRef.current = false;
        followRef.current = true;
        if (mapRef.current) {
          ccamPitchRef.current = mapRef.current.getPitch();
          ccamBearRef.current = mapRef.current.getBearing();
        }
      }
    }, 6000);

    mapRef.current.once('moveend', () => {
      if (flightSeqRef.current === flightId) {
        if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
        flyingRef.current = false;
        followRef.current = true;
        if (mapRef.current) {
          ccamPitchRef.current = mapRef.current.getPitch();
          ccamBearRef.current = mapRef.current.getBearing();
        }
      }
    });
  }, []);

  const handleRecenter = useCallback(() => {
    if (isRoutePreview) {
      if (mapRef.current && geoRef.current && geoRef.current.length > 0) {
        const bounds = geoRef.current.reduce(
          (b: maplibregl.LngLatBounds, c: [number, number]) => b.extend(c),
          new maplibregl.LngLatBounds(geoRef.current[0], geoRef.current[0])
        );
        const container = mapRef.current.getContainer();
        const cWidth = container?.clientWidth || 900;
        const leftPadding = cWidth > 750 ? Math.min(430, Math.round(cWidth * 0.45)) : Math.max(60, Math.round(cWidth * 0.35));
        mapRef.current.fitBounds(bounds, {
          padding: { top: 110, bottom: 90, left: leftPadding, right: 80 },
          animate: true,
          duration: 800,
          easing: (t) => 1 - Math.pow(1 - t, 3.5)
        });
        followRef.current = false;
        setIsMapFollowing(false);
      }
    } else {
      smoothRec();
    }
  }, [isRoutePreview, smoothRec]);

  // Compass interaction triggers - switches orientation (North-up vs Heading-up, or resets to North when rotated)
  const handleToggleCompass = useCallback(() => {
    if (!mapRef.current) return;

    const curBearing = mapRef.current.getBearing();
    const isRotated = Math.abs(curBearing) > 1.5;

    // If map was rotated away from North, return directly to North-up
    let newMode: 'north-up' | 'heading-up' = 'north-up';
    let targetBearing = 0;

    if (isRotated) {
      newMode = 'north-up';
      targetBearing = 0;
    } else {
      newMode = cmodeRef.current === 'heading-up' ? 'north-up' : 'heading-up';
      targetBearing = newMode === 'heading-up' ? cbearRef.current : 0;
    }

    cmodeRef.current = newMode;
    setCmode(newMode);
    ccamBearRef.current = targetBearing;

    mapRef.current.easeTo({
      bearing: targetBearing,
      duration: 450,
      essential: true,
      easing: (t) => 1 - Math.pow(1 - t, 3)
    });

    if (!followRef.current && !flyingRef.current) {
      if (recTimerRef.current) clearTimeout(recTimerRef.current);
      recTimerRef.current = setTimeout(() => {
        if (isWeatherActiveRef.current || isRoutePreviewRef.current) return;
        if (smoothRecRef.current) smoothRecRef.current();
      }, 10000);
    }
  }, []);

  // Independent 3D perspective toggle (45° tilt vs 0° flat overhead 2D)
  const handleToggle3D = useCallback(() => {
    if (!mapRef.current) return;

    const next3D = !is3DRef.current;
    is3DRef.current = next3D;
    setIs3D(next3D);

    const targetPitch = next3D ? 45 : 0;

    if (!followRef.current && !flyingRef.current) {
      if (recTimerRef.current) clearTimeout(recTimerRef.current);
      recTimerRef.current = setTimeout(() => {
        if (isWeatherActiveRef.current || isRoutePreviewRef.current) return;
        if (smoothRecRef.current) smoothRecRef.current();
      }, 10000);
    }

    if (flyingRef.current) {
      // Smoothly update camera pitch in-flight without restarting flyTo or speeding up camera movement
      ccamPitchRef.current = targetPitch;
      mapRef.current.easeTo({
        pitch: targetPitch,
        duration: 400,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 3)
      });
    } else if (!followRef.current) {
      ccamPitchRef.current = targetPitch;
      mapRef.current.easeTo({
        pitch: targetPitch,
        duration: 400,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 3)
      });
    }
  }, []);

  // Satellite layer toggle layout styling updater
  const handleToggleSatellite = useCallback(() => {
    if (!mapRef.current) return;
    const newSat = !isSatellite;
    setIsSatellite(newSat);

    if (newSat) {
      mapRef.current.setMaxZoom(19);
      if (mapRef.current.getZoom() > 19) {
         mapRef.current.easeTo({ zoom: 19, duration: 600 });
      }
      mapRef.current.setStyle(buildMapStyle(isNight ? 'satellite-night' : 'satellite'));
    } else {
      mapRef.current.setMaxZoom(20);
      mapRef.current.setStyle(buildMapStyle(isNight ? 'dark' : 'light'));
    }

    mapRef.current.once('style.load', () => {
       try {
         mapRef.current?.setProjection({ type: 'globe' } as any);
       } catch (e) {}
       // Redraw active pathways geoRef coordinate trace layers
       if (geoRef.current && mapRef.current?.getSource('route')) {
         (mapRef.current.getSource('route') as any).setData({
           type: 'FeatureCollection',
           features: [
             {
               type: 'Feature',
               properties: { consumed: false },
               geometry: { type: 'LineString', coordinates: geoRef.current }
             }
           ]
         });
       }
    });
  }, [isSatellite, isNight]);

  // Weather radar timeline layer triggers
  const handleToggleWeather = useCallback(() => {
    if (isWeatherActive) {
      // Turning OFF
      setIsWeatherActive(false);
      isWeatherActiveRef.current = false;
      
      if (mapRef.current) {
        mapRef.current.setMaxZoom(20);
      }
      
      // Clear opacity on weather layers wl-A and wl-B
      ['A', 'B'].forEach((s) => {
        if (mapRef.current && mapRef.current.getLayer(`wl-${s}`)) {
          mapRef.current.setPaintProperty(`wl-${s}`, 'raster-opacity', 0);
        }
      });
      
      if (isRoutePreview) {
        if (mapRef.current && geoRef.current && geoRef.current.length > 0) {
          const bounds = geoRef.current.reduce(
            (b: maplibregl.LngLatBounds, c: [number, number]) => b.extend(c),
            new maplibregl.LngLatBounds(geoRef.current[0], geoRef.current[0])
          );
          const container = mapRef.current.getContainer();
          const cWidth = container?.clientWidth || 900;
          const leftPadding = cWidth > 750 ? Math.min(430, Math.round(cWidth * 0.45)) : Math.max(60, Math.round(cWidth * 0.35));
          mapRef.current.fitBounds(bounds, {
            padding: { top: 110, bottom: 90, left: leftPadding, right: 80 },
            animate: true,
            duration: 800
          });
          followRef.current = false;
          setIsMapFollowing(false);
        }
      } else {
        smoothRec();
      }
    } else {
      // Turning ON
      if (mapRef.current) {
        const currentZoom = mapRef.current.getZoom();
        
        if (currentZoom > 7.2) {
          if (!isRoutePreview) {
            followRef.current = false;
            setIsMapFollowing(false);
          }
          
          // Esegui prima lo zoom morbido senza toccare il MaxZoom per evitare scatti
          mapRef.current.easeTo({ zoom: 7.2, duration: 2500 });
          
          // Attendi che lo zoom finisca prima di limitare la vista e accendere il radar
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.setMaxZoom(7.2);
            }
            setIsWeatherActive(true);
            isWeatherActiveRef.current = true;
          }, 2500);
          
        } else {
          // Eravamo già distanti, attiviamo tutto subito
          mapRef.current.setMaxZoom(7.2);
          setIsWeatherActive(true);
          isWeatherActiveRef.current = true;
        }
      } else {
        setIsWeatherActive(true);
        isWeatherActiveRef.current = true;
      }
    }
  }, [isWeatherActive, smoothRec, isRoutePreview]);

  // Handles timeline framework caching and rendering transitions matching original HTML
  const handleWeatherFrameChange = useCallback((frame: WeatherFrame, index: number, isFuture: boolean) => {
    if (!mapRef.current || !frame || !frame.path) return;
    const ns = weatherSlotRef.current === 'A' ? 'B' : 'A';
    const sourceId = `w-${ns}`;
    const layerId = `wl-${ns}`;
    const currentLayerId = `wl-${weatherSlotRef.current}`;

    const src = mapRef.current.getSource(sourceId) as any;
    if (src) {
      // Use webp for broader compatibility and smooth transition
      const rawUrl = globalRadarService.getTileUrl(frame.path, "{x}" as any, "{y}" as any, "{z}" as any);
      const tileUrl = rawUrl ? rawUrl.replace("{x}", "{x}").replace("{y}", "{y}").replace("{z}", "{z}") : '';
      if (tileUrl) {
        src.setTiles([tileUrl]);
      }
    }

    // Smooth atomic cross-fade after short buffer time for tiles to load in memory
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.setPaintProperty(layerId, 'raster-opacity', 0.55);
        mapRef.current.setPaintProperty(currentLayerId, 'raster-opacity', 0);
        weatherSlotRef.current = ns;
      }
    }, 150);
  }, []);

  const lastNavTargetRef = useRef<LocationData | null>(null);

  // Synchronizes changes in NavigationTarget from NavigateTool or context triggers
  useEffect(() => {
    const prev = lastNavTargetRef.current;
    if (
      (!prev && !navigationTarget) ||
      (prev && navigationTarget && prev.lat === navigationTarget.lat && prev.lng === navigationTarget.lng && prev.name === navigationTarget.name)
    ) {
      return;
    }
    lastNavTargetRef.current = navigationTarget;

    if (navigationTarget) {
      setDest({ lat: navigationTarget.lat, lng: navigationTarget.lng }, navigationTarget.name);
    } else {
      clearRoute(false);
    }
  }, [navigationTarget, setDest, clearRoute]);

  // Reverse geocodes the vehicle position to track current street persistently
  useEffect(() => {
    if (!rposRef.current) {
      return;
    }

    const updateStreet = async () => {
      const now = Date.now();
      if (now - lastGeocodeTimeRef.current < 8000) return; // rate limit 8s
      lastGeocodeTimeRef.current = now;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${rposRef.current.lat}&lon=${rposRef.current.lng}&zoom=18&addressdetails=1`
        ).catch(() => null);
        if (res && res.ok) {
          try {
            const d = await res.json();
            const road = d.address?.road;
            const suburb = d.address?.suburb;
            const streetText = road || suburb;
            if (streetText) {
              setCurrentStreet(streetText);
            }
          } catch (e) {
            // Ignore parse errors from rate limits
          }
        }
      } catch (e) {
        console.warn('[STREET] Reverse geocoding failed', e);
      }
    };

    updateStreet();
  }, [naving, currentStepIndex, rposRef.current?.lat, rposRef.current?.lng]);

  // Local state watcher matching geolocation stream with smooth spline integrations
  useEffect(() => {
    // Only listen to TelemetryStore updates so location is immediately synced
    const unsubscribe = TelemetryStore.subscribe(() => {
      const pos = TelemetryStore.position;
      const gs = TelemetryStore.speed || 0;
      const nb = TelemetryStore.bearing || 0;
      
      if (pos) {
        speedRef.current = gs;
        tbearRef.current = nb;
        tgtRef.current = { lat: pos.lat, lng: pos.lng };
        
        if (!rposRef.current) {
          rposRef.current = { lat: pos.lat, lng: pos.lng };
          mbearRef.current = nb;
          cbearRef.current = nb;
        }

        // Automatic center fitting zooming on startup
        if (!autoZoomedRef.current && mapRef.current) {
          autoZoomedRef.current = true;
          followRef.current = true;
          setIsMapFollowing(true);
          flyingRef.current = true;
          mapRef.current.flyTo({
            center: [pos.lng, pos.lat],
            zoom: 17,
            duration: 2500,
            speed: 0.8,
            essential: true
          });
          mapRef.current.once('moveend', () => {
            flyingRef.current = false;
          });
        }

        if (pendDestRef.current) {
          const pd = pendDestRef.current;
          pendDestRef.current = null;
          setDest(pd.coords, pd.name);
        }

        if (navingRef.current) {
          checkRouteDeviations({ lat: pos.lat, lng: pos.lng });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [setDest]);

  // Main high speed render clock loops running at 60fps for layout positioning
  useEffect(() => {
    let lt = performance.now();
    let animeId: number;

    const lp = (t: number) => {
      const dt = Math.min(t - lt, 100) / 1000;
      lt = t;
      
      if (rposRef.current && tgtRef.current) {
        const ideal = tgtRef.current;
        const dl = ideal.lat - rposRef.current.lat;
        const dn = ideal.lng - rposRef.current.lng;
        const dm = Math.sqrt(dl * dl + dn * dn) * 111320;
        
        // Zero asymptotic drift: when stationary or within precision threshold, lock position immediately
        if (speedRef.current < 0.3 && dm < 2.0) {
          rposRef.current.lat = ideal.lat;
          rposRef.current.lng = ideal.lng;
          mbearRef.current = tbearRef.current;
          cbearRef.current = tbearRef.current;
        } else if (dm > 0.05 || speedRef.current > 0.3) {
          const pa = 1 - Math.exp(-6 * dt);
          rposRef.current.lat += dl * pa;
          rposRef.current.lng += dn * pa;

          // Heading spline easing
          const tb = tbearRef.current;
          const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;
          
          const mdNom = ((tb - normalizeAngle(mbearRef.current) + 540) % 360) - 180;
          const mk = speedRef.current > 0.8 ? 4.5 : 0;
          if (mk > 0) {
            mbearRef.current = mbearRef.current + mdNom * (1 - Math.exp(-mk * dt));
          } else {
            mbearRef.current = mbearRef.current + mdNom;
          }

          const cdNom = ((tb - normalizeAngle(cbearRef.current) + 540) % 360) - 180;
          const ck = speedRef.current > 0.8 ? 2.0 : 0;
          if (ck > 0) {
            cbearRef.current = cbearRef.current + cdNom * (1 - Math.exp(-ck * dt));
          } else {
            cbearRef.current = cbearRef.current + cdNom;
          }
        }

        // Only update GeoJSON source when position or bearing has actually moved
        // Prevents triggering MapLibre WebGL source re-renders during pure map zooms/pans
        const dLng = Math.abs(rposRef.current.lng - lastSourceCoordRef.current.lng);
        const dLat = Math.abs(rposRef.current.lat - lastSourceCoordRef.current.lat);
        const dBearing = Math.abs(mbearRef.current - lastSourceCoordRef.current.bearing);

        if (dLng > 1e-7 || dLat > 1e-7 || dBearing > 0.4) {
          if (mapRef.current && mapRef.current.getSource('vehicle-source')) {
            const vehicleSource = mapRef.current.getSource('vehicle-source') as any;
            vehicleSource.setData({
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [rposRef.current.lng, rposRef.current.lat] },
                properties: { bearing: mbearRef.current }
              }]
            });
            lastSourceCoordRef.current = {
              lng: rposRef.current.lng,
              lat: rposRef.current.lat,
              bearing: mbearRef.current
            };
          }
        }

        if (mapRef.current && followRef.current && !isRoutePreviewRef.current && !interactRef.current && !flyingRef.current && !isWeatherActiveRef.current) {
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
          const targetFps = isMobile ? 30 : 60;
          const frameTime = 1000 / targetFps;
          
          // Continuous smooth camera pitch interpolation (exponential easing)
          const targetPitch = is3DRef.current ? 45 : 0;
          const pitchDiff = targetPitch - ccamPitchRef.current;
          if (Math.abs(pitchDiff) > 0.05) {
            ccamPitchRef.current += pitchDiff * (1 - Math.exp(-9.0 * dt));
          } else {
            ccamPitchRef.current = targetPitch;
          }

          // Continuous smooth camera bearing interpolation (shortest circular angle) when in heading-up mode
          if (cmodeRef.current === 'heading-up') {
            const targetBearing = cbearRef.current;
            const currentBearVal = mapRef.current.getBearing();
            const bearDiff = (((targetBearing - currentBearVal) % 360) + 540) % 360 - 180;
            if (Math.abs(bearDiff) > 0.1) {
              ccamBearRef.current = currentBearVal + bearDiff * (1 - Math.exp(-7.0 * dt));
            } else {
              ccamBearRef.current = targetBearing;
            }
          }

          if (!(mapRef.current as any)._lastMapUpdate || t - (mapRef.current as any)._lastMapUpdate >= frameTime) {
            mapRef.current.jumpTo({
              center: [rposRef.current.lng, rposRef.current.lat],
              bearing: ccamBearRef.current,
              pitch: ccamPitchRef.current,
              zoom: mapRef.current.getZoom()
            });
            (mapRef.current as any)._lastMapUpdate = t;
          }
        }

        if (navingRef.current && stepsRef.current.length && geoRef.current) {
          updateConsumedSegment();
        }
      }

      animeId = requestAnimationFrame(lp);
    };

    animeId = requestAnimationFrame(lp);
    return () => {
      cancelAnimationFrame(animeId);
    };
  }, []);

  // Refs to avoid stale closures in Map events
  const startTrackingRef = useRef(startTracking);
  const smoothRecRef = useRef(smoothRec);

  useEffect(() => {
    startTrackingRef.current = startTracking;
    smoothRecRef.current = smoothRec;
  });

  // Render WebGL maps frame layers when containers Mount (Persistent in background)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const th = isNight ? 'dark' : 'light';
    const initPos = TelemetryStore.position;
    const initLng = initPos ? initPos.lng : 12.4964;
    const initLat = initPos ? initPos.lat : 41.9028;
    const initZoom = initPos ? 17 : 14;
    const initBearing = TelemetryStore.bearing || 0;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildMapStyle(th),
      center: [initLng, initLat],
      zoom: initZoom,
      attributionControl: false,
      pitchWithRotate: true,
      touchPitch: true,
      maxPitch: 65,
      minPitch: 0,
      pitch: 0,
      fadeDuration: 400,
      minZoom: 1.8,
      bearingSnap: 0,
      dragRotate: true,
      touchZoomRotate: true,
      maxTileCacheSize: 1000,
      maxZoom: 20
    });

    mapRef.current = map;
    
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
    if (typeof (map as any).setBearingSnap === 'function') (map as any).setBearingSnap(0);

    // Trigger Resize observers on layouts modification
    const resObs = new ResizeObserver(() => {
      if (mapActiveRef.current) {
        map.resize();
      }
    });
    resObs.observe(mapContainerRef.current);

    // Creates virtual vehicle indicator with authentic 3D extruded volumetric depth
    const svgStr = `<svg viewBox="227 410 960 990" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="nav-arrow-shadow" x="-20%" y="-15%" width="140%" height="150%">
          <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000000" flood-opacity="0.48" />
        </filter>
        <linearGradient id="wall-grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#9B1C1E" />
          <stop offset="100%" stop-color="#5E0F11" />
        </linearGradient>
        <linearGradient id="wall-grad-right" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#B22225" />
          <stop offset="100%" stop-color="#6A1012" />
        </linearGradient>
        <linearGradient id="bezel-wall" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#E2E8F0" />
          <stop offset="100%" stop-color="#94A3B8" />
        </linearGradient>
        <linearGradient id="face-grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF5252" />
          <stop offset="100%" stop-color="#D92427" />
        </linearGradient>
        <linearGradient id="face-grad-right" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF7575" />
          <stop offset="100%" stop-color="#EE383B" />
        </linearGradient>
      </defs>
      <g filter="url(#nav-arrow-shadow)">
        <g transform="translate(0, 20)">
          <path fill="#718096" opacity="0.9" d="M639.979065,551.815125 C645.168152,540.088928 650.026184,528.629089 655.273071,517.350159 C668.813538,488.243103 708.591675,477.322784 735.566650,494.553101 C749.156494,503.233704 756.313721,515.993591 762.405273,530.085083 C787.421509,587.954773 812.641113,645.736633 837.759827,703.562134 C862.019897,759.411072 886.220703,815.285706 910.497864,871.127136 C934.243469,925.745850 958.087769,980.321533 981.824341,1034.944092 C1007.415466,1093.834229 1032.934204,1152.755859 1058.479614,1211.665894 C1065.145508,1227.038086 1072.164307,1242.270264 1078.359985,1257.829956 C1086.983032,1279.485596 1080.075684,1304.759277 1061.833496,1320.765991 C1044.998657,1335.537842 1018.689575,1338.636230 998.807922,1327.514404 C973.012146,1313.083984 947.494507,1298.156738 921.845398,1283.463745 C896.915344,1269.182495 871.943359,1254.974487 847.039307,1240.648193 C818.390015,1224.167480 789.808044,1207.569946 761.171631,1191.066895 C743.616943,1180.949951 726.045654,1170.860352 708.373291,1160.952148 C707.027161,1160.197388 704.456543,1160.359009 703.057556,1161.154419 C677.210327,1175.849976 651.469910,1190.733276 625.675842,1205.522827 C600.896851,1219.730347 576.053467,1233.825806 551.291382,1248.062500 C526.381775,1262.384155 501.560059,1276.858398 476.657715,1291.192383 C455.215363,1303.535034 433.836731,1315.996338 412.205383,1328.000488 C388.054901,1341.402466 353.937225,1332.084717 339.430542,1308.918579 C327.287811,1289.527344 327.550873,1270.051636 336.589294,1249.539062 C360.004272,1196.398804 382.947418,1143.050781 406.116211,1089.801880 C430.474152,1033.819946 454.903503,977.869019 479.249084,921.881653 C499.687012,874.880615 520.035400,827.840698 540.448792,780.828918 C568.990845,715.096863 597.555237,649.374451 626.113342,583.649353 C630.675232,573.150452 635.254150,562.658875 639.979065,551.815125z"/>
        </g>
        <path fill="url(#bezel-wall)" d="M412.205383,1328.000488 L412.205383,1348.000488 C433.836731,1335.996338 455.215363,1323.535034 476.657715,1311.192383 C501.560059,1296.858398 526.381775,1282.384155 551.291382,1268.062500 C576.053467,1253.825806 600.896851,1239.730347 625.675842,1225.522827 C651.469910,1210.733276 677.210327,1195.849976 703.057556,1181.154419 C704.456543,1180.359009 707.027161,1180.197388 708.373291,1180.952148 C726.045654,1190.860352 743.616943,1200.949951 761.171631,1211.066895 C789.808044,1227.569946 818.390015,1244.167480 847.039307,1260.648193 C871.943359,1274.974487 896.915344,1289.182495 921.845398,1303.463745 C947.494507,1318.156738 973.012146,1333.083984 998.807922,1347.514404 L998.807922,1327.514404 C973.012146,1313.083984 947.494507,1298.156738 921.845398,1283.463745 C896.915344,1269.182495 871.943359,1254.974487 847.039307,1240.648193 C818.390015,1224.167480 789.808044,1207.569946 761.171631,1191.066895 C743.616943,1180.949951 726.045654,1170.860352 708.373291,1160.952148 C707.027161,1160.197388 704.456543,1160.359009 703.057556,1161.154419 C677.210327,1175.849976 651.469910,1190.733276 625.675842,1205.522827 C600.896851,1219.730347 576.053467,1233.825806 551.291382,1248.062500 C526.381775,1262.384155 501.560059,1276.858398 476.657715,1291.192383 C455.215363,1303.535034 433.836731,1315.996338 412.205383,1328.000488 Z" />
        <path fill="#FFFFFF" d="M639.979065,551.815125 C645.168152,540.088928 650.026184,528.629089 655.273071,517.350159 C668.813538,488.243103 708.591675,477.322784 735.566650,494.553101 C749.156494,503.233704 756.313721,515.993591 762.405273,530.085083 C787.421509,587.954773 812.641113,645.736633 837.759827,703.562134 C862.019897,759.411072 886.220703,815.285706 910.497864,871.127136 C934.243469,925.745850 958.087769,980.321533 981.824341,1034.944092 C1007.415466,1093.834229 1032.934204,1152.755859 1058.479614,1211.665894 C1065.145508,1227.038086 1072.164307,1242.270264 1078.359985,1257.829956 C1086.983032,1279.485596 1080.075684,1304.759277 1061.833496,1320.765991 C1044.998657,1335.537842 1018.689575,1338.636230 998.807922,1327.514404 C973.012146,1313.083984 947.494507,1298.156738 921.845398,1283.463745 C896.915344,1269.182495 871.943359,1254.974487 847.039307,1240.648193 C818.390015,1224.167480 789.808044,1207.569946 761.171631,1191.066895 C743.616943,1180.949951 726.045654,1170.860352 708.373291,1160.952148 C707.027161,1160.197388 704.456543,1160.359009 703.057556,1161.154419 C677.210327,1175.849976 651.469910,1190.733276 625.675842,1205.522827 C600.896851,1219.730347 576.053467,1233.825806 551.291382,1248.062500 C526.381775,1262.384155 501.560059,1276.858398 476.657715,1291.192383 C455.215363,1303.535034 433.836731,1315.996338 412.205383,1328.000488 C388.054901,1341.402466 353.937225,1332.084717 339.430542,1308.918579 C327.287811,1289.527344 327.550873,1270.051636 336.589294,1249.539062 C360.004272,1196.398804 382.947418,1143.050781 406.116211,1089.801880 C430.474152,1033.819946 454.903503,977.869019 479.249084,921.881653 C499.687012,874.880615 520.035400,827.840698 540.448792,780.828918 C568.990845,715.096863 597.555237,649.374451 626.113342,583.649353 C630.675232,573.150452 635.254150,562.658875 639.979065,551.815125z"/>
        <path fill="url(#wall-grad-left)" d="M481.153290,1228.615234 L481.153290,1244.615234 C503.680634,1231.440674 526.323425,1218.463379 548.939514,1205.440918 C582.601135,1186.058105 616.268066,1166.684448 649.961304,1147.356812 C669.273499,1136.278809 688.642273,1125.299561 707.985596,1114.275757 L707.985596,1098.275757 C688.642273,1109.299561 669.273499,1120.278809 649.961304,1131.356812 C616.268066,1150.684448 582.601135,1170.058105 548.939514,1189.440918 C526.323425,1202.463379 503.680634,1215.440674 481.153290,1228.615234 Z" />
        <path fill="url(#wall-grad-right)" d="M708.263672,1098.452148 L708.263672,1114.452148 C734.360596,1129.440918 760.191284,1144.232910 785.995544,1159.070557 C833.427551,1186.344727 880.917236,1213.519775 928.216003,1241.023193 C940.130798,1247.951416 952.263794,1252.605469 966.153687,1249.567993 L966.153687,1233.567993 C952.263794,1236.605469 940.130798,1231.951416 928.216003,1225.023193 C880.917236,1197.519775 833.427551,1170.344727 785.995544,1143.070557 C760.191284,1128.232910 734.360596,1113.440918 708.263672,1098.452148 Z" />
        <path fill="url(#face-grad-left)" d="M707.985596,1098.275757 C688.642273,1109.299561 669.273499,1120.278809 649.961304,1131.356812 C616.268066,1150.684448 582.601135,1170.058105 548.939514,1189.440918 C526.323425,1202.463379 503.680634,1215.440674 481.153290,1228.615234 C464.812622,1238.171875 442.888977,1236.842773 429.660736,1225.171021 C413.332520,1210.763794 408.560883,1191.014648 416.835876,1171.967651 C458.874298,1075.205688 500.913940,978.444153 542.963440,881.686951 C583.817871,787.679565 624.699951,693.684204 665.529053,599.665771 C671.380615,586.191162 681.000549,576.917969 695.215637,572.960754 C698.969604,571.915771 703.108154,572.252441 707.527222,572.474731 C707.984741,748.088440 707.985168,923.182068 707.985596,1098.275757z"/>
        <path fill="url(#face-grad-right)" d="M708.263672,1098.452148 C707.985168,923.182068 707.984741,748.088440 707.981567,572.530945 C723.690674,570.855591 740.974609,582.015869 748.093933,598.283508 C762.495178,631.190430 776.757996,664.157898 791.081543,697.098694 C823.043579,770.604004 855.015137,844.105225 886.968018,917.614563 C899.828613,947.201050 912.631531,976.812622 925.493591,1006.398438 C949.338867,1061.248291 973.180847,1116.099487 997.079346,1170.926025 C1008.930359,1198.113892 994.624023,1227.342163 966.153687,1233.567993 C952.263794,1236.605469 940.130798,1231.951416 928.216003,1225.023193 C880.917236,1197.519775 833.427551,1170.344727 785.995544,1143.070557 C760.191284,1128.232910 734.360596,1113.440918 708.263672,1098.452148z"/>
      </g>
    </svg>`;
    const img = new Image(128, 128);
    img.onload = () => {
      if (mapRef.current && !mapRef.current.hasImage('vehicle-arrow')) {
        mapRef.current.addImage('vehicle-arrow', img);
      }
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    


    const addLayers = () => {
      // Find the first symbol or route layer to insert weather radar UNDER
      const styleLayers = map.getStyle()?.layers || [];
      const firstSymbolOrRouteLayer = styleLayers.find(l => 
        l.id.includes('route') || l.id.includes('label') || l.id.includes('symbol') || l.type === 'symbol'
      )?.id;

      // 1. Weather raster layers (background beneath routes, labels, and pins)
      ['A', 'B'].forEach((s) => {
        const si = `w-${s}`;
        const li = `wl-${s}`;
        if (!map.getSource(si)) {
          map.addSource(si, {
            type: 'raster',
            tiles: [],
            tileSize: 512,
            minzoom: 0,
            maxzoom: 7
          });
          map.addLayer({
            id: li,
            type: 'raster',
            source: si,
            paint: { 
              'raster-opacity': 0, 
              'raster-fade-duration': 400,
              'raster-resampling': 'linear'
            }
          }, firstSymbolOrRouteLayer);
        }
      });

      // 2. Multi-route preview layers
      if (!map.getSource('routes-source')) {
        map.addSource('routes-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // Alternative routes background casing
        map.addLayer({
          id: 'routes-alt-casing',
          type: 'line',
          source: 'routes-source',
          filter: ['==', ['get', 'is_selected'], false],
          paint: {
            'line-color': isNight ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)',
            'line-width': 7.5
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });

        // Alternative routes line
        map.addLayer({
          id: 'routes-alt',
          type: 'line',
          source: 'routes-source',
          filter: ['==', ['get', 'is_selected'], false],
          paint: {
            'line-color': isNight ? '#64748B' : '#94A3B8',
            'line-width': 5
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });

        // Selected route sharp casing
        map.addLayer({
          id: 'routes-selected-casing',
          type: 'line',
          source: 'routes-source',
          filter: ['==', ['get', 'is_selected'], true],
          paint: {
            'line-color': isNight ? '#0B1220' : '#FFFFFF',
            'line-width': 8.5
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });

        // Selected route solid core
        map.addLayer({
          id: 'routes-selected',
          type: 'line',
          source: 'routes-source',
          filter: ['==', ['get', 'is_selected'], true],
          paint: {
            'line-color': isNight ? '#3B82F6' : '#2563EB',
            'line-width': 6
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });
      }

      // 3. Active navigation route layers
      if (!map.getSource('route')) {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'r-casing',
          type: 'line',
          source: 'route',
          filter: ['==', ['get', 'consumed'], false],
          paint: {
            'line-color': isNight ? '#0B1220' : '#FFFFFF',
            'line-width': 8.5
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });

        map.addLayer({
          id: 'r-line',
          type: 'line',
          source: 'route',
          filter: ['==', ['get', 'consumed'], false],
          paint: {
            'line-color': isNight ? '#3B82F6' : '#2563EB',
            'line-width': 6
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });

        map.addLayer({
          id: 'r-cons',
          type: 'line',
          source: 'route',
          filter: ['==', ['get', 'consumed'], true],
          paint: {
            'line-color': isNight ? 'rgba(100,116,139,0.45)' : 'rgba(148,163,184,0.55)',
            'line-width': 5
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });
      }

      // 4. Live traffic congestion overlay layers (crisp automotive line without neon glow)
      if (!map.getSource('traffic-source')) {
        map.addSource('traffic-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'traffic-line',
          type: 'line',
          source: 'traffic-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 6.5,
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });
      }

      // 5. Vehicle location arrow layer added AFTER routes and traffic so it renders on top
      if (!map.getSource('vehicle-source')) {
        const curLng = rposRef.current?.lng ?? initLng;
        const curLat = rposRef.current?.lat ?? initLat;
        const curBearing = mbearRef.current || initBearing;

        map.addSource('vehicle-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [curLng, curLat] },
              properties: { bearing: curBearing }
            }]
          }
        });
        map.addLayer({
          id: 'vehicle-layer',
          type: 'symbol',
          source: 'vehicle-source',
          layout: {
            'icon-image': 'vehicle-arrow',
            'icon-size': 0.23,
            'icon-pitch-alignment': 'map',
            'icon-rotation-alignment': 'map',
            'icon-rotate': ['get', 'bearing'],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-opacity': 1
          }
        });
      }

      // Explicitly elevate vehicle layer to the top of the stack
      if (map.getLayer('vehicle-layer')) {
        map.moveLayer('vehicle-layer');
      }
    };

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' } as any);
      
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
      if (isMobile) {
        const layers = map.getStyle().layers;
        if (layers) {
          layers.forEach((layer) => {
            if (layer.type === 'fill-extrusion' || layer.id.includes('building') || layer.id.includes('3d')) {
              map.removeLayer(layer.id);
            }
          });
        }
      }

      addLayers();

      // Restore multi-route preview if active
      if (routesRef.current && routesRef.current.length > 0 && map.getSource('routes-source')) {
        const features = routesRef.current.map((r, i) => ({
          type: 'Feature',
          geometry: r.geometry,
          properties: {
            is_selected: i === selectedRouteIndexRef.current,
            route_index: i
          }
        }));
        features.sort((a, b) => (a.properties.is_selected === b.properties.is_selected ? 0 : a.properties.is_selected ? 1 : -1));
        (map.getSource('routes-source') as any).setData({
          type: 'FeatureCollection',
          features
        });
      }

      if (geoRef.current && map.getSource('route')) {
        (map.getSource('route') as any).setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { consumed: false },
              geometry: { type: 'LineString', coordinates: geoRef.current }
            }
          ]
        });
      }

      // Restore destination marker if active
      if (destRef.current) {
        if (destMarkRef.current) {
          destMarkRef.current.remove();
          destMarkRef.current = null;
        }
        const el = createDestinationMarkerElement(destinationNameRef.current, isNight);
        destMarkRef.current = new maplibregl.Marker({
          element: el,
          anchor: 'bottom',
        })
          .setLngLat([destRef.current.lng, destRef.current.lat])
          .addTo(map);
      }
    });

    // Allow user to click directly on an alternative route on map
    const handleAltClick = (e: any) => {
      if (pickingMapTypeRef.current) return;
      if (e.features && e.features[0]) {
        const routeIdx = e.features[0].properties?.route_index;
        if (typeof routeIdx === 'number') {
          handleSelectRouteAlternative(routeIdx);
        }
      }
    };

    const handleGeneralMapClick = async (e: maplibregl.MapMouseEvent) => {
      if (pickingMapTypeRef.current) {
        const targetType = pickingMapTypeRef.current;
        const lat = e.lngLat.lat;
        const lng = e.lngLat.lng;
        setPickingMapType(null);
        pickingMapTypeRef.current = null;

        try {
          const rev = await globalSearchService.reverseGeocode(lat, lng);
          const resolvedName = rev?.name || rev?.address || (targetType === 'home' ? 'Casa (Mappa)' : 'Lavoro (Mappa)');
          const newLoc: LocationData = {
            lat,
            lng,
            name: resolvedName,
          };
          if (targetType === 'home') {
            setHomeLocation(newLoc);
            setPointPickToast(`Posizione Casa impostata: ${resolvedName.split(',')[0]}`);
          } else {
            setWorkLocation(newLoc);
            setPointPickToast(`Posizione Lavoro impostata: ${resolvedName.split(',')[0]}`);
          }
        } catch {
          const newLoc: LocationData = {
            lat,
            lng,
            name: targetType === 'home' ? 'Casa (Mappa)' : 'Lavoro (Mappa)',
          };
          if (targetType === 'home') {
            setHomeLocation(newLoc);
            setPointPickToast('Posizione Casa salvata.');
          } else {
            setWorkLocation(newLoc);
            setPointPickToast('Posizione Lavoro salvata.');
          }
        }
        setTimeout(() => setPointPickToast(null), 4000);
      }
    };

    map.on('click', handleGeneralMapClick);
    map.on('click', 'routes-alt', handleAltClick);
    map.on('click', 'routes-alt-casing', handleAltClick);

    map.on('mouseenter', 'routes-alt', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'routes-alt', () => {
      map.getCanvas().style.cursor = '';
    });

    const handleStartInt = (e?: any) => {
      if (e && !e.originalEvent && e.type !== 'wheel') return;
      flyingRef.current = false;
      if (followRef.current) {
        savedModeRef.current = cmodeRef.current;
      }
      followRef.current = false;
      interactRef.current = true;
      setIsMapFollowing(false);
      window.dispatchEvent(new CustomEvent('map-user-interaction'));

      if (recTimerRef.current) {
        clearTimeout(recTimerRef.current);
        recTimerRef.current = null;
      }
      if (isPendingStartRef.current && startTrackTimerRef.current) {
         clearTimeout(startTrackTimerRef.current);
      }
    };

    const handleEndInt = (e?: any) => {
      if (e && !e.originalEvent && e.type !== 'wheel') return;
      interactRef.current = false;
      if (recTimerRef.current) {
        clearTimeout(recTimerRef.current);
        recTimerRef.current = null;
      }

      if (mapRef.current) {
        ccamPitchRef.current = mapRef.current.getPitch();
        ccamBearRef.current = mapRef.current.getBearing();
      }

      if (isPendingStartRef.current) {
         startTrackTimerRef.current = setTimeout(() => {
           if (startTrackingRef.current) startTrackingRef.current();
         }, 3000);
         return;
      }

      // During route preview, do not auto-recenter
      if (isRoutePreviewRef.current) {
        return;
      }

      // After 10 seconds of inactivity, automatically return to vehicle position and restore official 2D/3D perspective
      recTimerRef.current = setTimeout(() => {
        if (isWeatherActiveRef.current || isRoutePreviewRef.current) return;
        if (smoothRecRef.current) {
          smoothRecRef.current();
        }
      }, 10000);
    };

    ['dragstart', 'rotatestart', 'pitchstart', 'touchstart', 'mousedown'].forEach((e) => {
      map.on(e as any, handleStartInt);
    });
    ['dragend', 'rotateend', 'pitchend', 'touchend', 'mouseup'].forEach((e) => {
      map.on(e as any, handleEndInt);
    });

    let wheelDebounce: any = null;
    map.on('wheel', () => {
      handleStartInt();
      if (wheelDebounce) clearTimeout(wheelDebounce);
      wheelDebounce = setTimeout(() => {
        handleEndInt();
      }, 350);
    });

    map.on('zoom', () => {
      setCurrentZoom(Math.round(map.getZoom() * 10) / 10);
    });

    map.on('rotate', () => {
      const b = map.getBearing();
      setBearing(b);
      ccamBearRef.current = b;
      // When user rotates the map away from north, switch temporarily to heading-up (compass mode)
      if (interactRef.current && Math.abs(b) > 1.0) {
        if (cmodeRef.current !== 'heading-up') {
          cmodeRef.current = 'heading-up';
          setCmode('heading-up');
        }
      }
    });

    map.on('pitch', () => {
      const p = map.getPitch();
      setCurrentPitch(p);
      ccamPitchRef.current = p;
    });

    return () => {
      resObs.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (recTimerRef.current) clearTimeout(recTimerRef.current);
      if (startTrackTimerRef.current) clearTimeout(startTrackTimerRef.current);
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    };
  }, []);

  // Dynamics styling synchronization for theme changes (avoid map recreation)
  useEffect(() => {
    if (mapRef.current) {
      if (isSatellite) {
        mapRef.current.setStyle(buildMapStyle(isNight ? 'satellite-night' : 'satellite'));
      } else {
        mapRef.current.setStyle(buildMapStyle(isNight ? 'dark' : 'light'));
      }
    }
  }, [isNight, isSatellite]);

  // Handle live TomTom API key updates
  useEffect(() => {
    const handleKeyChange = () => {
      if (mapRef.current) {
        mapRef.current.setStyle(buildMapStyle(isSatellite ? (isNight ? 'satellite-night' : 'satellite') : (isNight ? 'dark' : 'light')));
      }
    };
    window.addEventListener('tomtom-key-updated', handleKeyChange);
    return () => window.removeEventListener('tomtom-key-updated', handleKeyChange);
  }, [isNight, isSatellite]);

  // Triggers map.resize() on visibility toggle
  useEffect(() => {
    if (mapActive && mapRef.current) {
      mapRef.current.resize();
    }
  }, [mapActive]);

  const handleColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';

  const selectPlaceFromPanel = (item: any) => {
    poiMarkersRef.current.forEach(m => m.remove());
    poiMarkersRef.current = [];
    setSelectedPOI(null);
    onSelectDestination({ lat: item.lat, lng: item.lng, name: item.name });
  };

  const handleCategoryResults = useCallback((category: AutomotiveCategory | null, results: LocationInfo[]) => {
    // Clear existing POI markers
    poiMarkersRef.current.forEach(m => m.remove());
    poiMarkersRef.current = [];

    if (!category || !results || results.length === 0) {
      setSelectedPOI(null);
      return;
    }

    if (!mapRef.current) return;

    // Create markers on the map
    results.slice(0, 15).forEach((poi) => {
      const el = createPOIMarkerElement(poi, isNight, () => {
        setSelectedPOI(poi);
        mapRef.current?.easeTo({
          center: [poi.lng, poi.lat],
          zoom: Math.max(mapRef.current.getZoom(), 14.5),
          duration: 600,
        });
      });

      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([poi.lng, poi.lat])
        .addTo(mapRef.current!);
      poiMarkersRef.current.push(m);
    });

    // Fit map bounds to encompass current position and the POIs
    try {
      const bounds = new maplibregl.LngLatBounds();
      if (rposRef.current) {
        bounds.extend([rposRef.current.lng, rposRef.current.lat]);
      }
      results.slice(0, 8).forEach(p => bounds.extend([p.lng, p.lat]));
      const container = mapRef.current.getContainer();
      const cWidth = container?.clientWidth || 900;
      const leftPadding = cWidth > 750 ? 390 : 120;
      mapRef.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 90, left: leftPadding, right: 90 },
        maxZoom: 15.5,
        duration: 800
      });
    } catch (e) {
      console.warn('Could not fit bounds for POIs', e);
    }
  }, [isNight]);

  const handleSelectPOIPreview = useCallback((poi: LocationInfo) => {
    setSelectedPOI(poi);
    mapRef.current?.easeTo({
      center: [poi.lng, poi.lat],
      zoom: 15,
      duration: 600,
    });
  }, []);

  return (
    <div 
        id="maps-app-panel"
        ref={panelRef}
        className="fixed top-0 right-0 w-2/3 text-white shadow-2xl z-[4000] flex spotify-app-panel pointer-events-auto touch-none"
        style={{ 
            willChange: 'transform',
            top: 0,
            bottom: `${(spotifyPlayerBottom) / 16}rem`
        }}
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby="maps-player-title"
        onClick={stopPropagation}
    >
        {/* Slide Close Drag handle bar */}
        <div
            className={`absolute top-1/2 -translate-y-1/2 -left-10 w-12 h-32 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-55 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            aria-label="Drag to close"
        >
            <div 
                className={`w-1.5 h-16 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 ${handleColorClass}`} 
            />
        </div>

        {/* Core WebGL Map container with Space Cosmos Starfield background */}
        <div 
          className="relative w-full h-full overflow-hidden bg-black"
          onPointerMove={() => window.dispatchEvent(new CustomEvent('map-user-interaction'))}
          onTouchStart={() => window.dispatchEvent(new CustomEvent('map-user-interaction'))}
          onPointerDown={() => window.dispatchEvent(new CustomEvent('map-user-interaction'))}
        >
            <h1 id="maps-player-title" className="sr-only">Maps Player</h1>
            
            {/* Cosmic Starfield Universe background (static micro stars behind globe and horizon) */}
            <CosmicStarfield isNight={isNight} />

            {/* Core WebGL Map container */}
            <div 
              ref={mapContainerRef} 
              style={{ backgroundColor: 'transparent' }}
              className="w-full h-full absolute inset-0 [&_.maplibregl-canvas]:transition-opacity [&_.maplibregl-canvas]:duration-300 [&_.maplibregl-canvas]:ease-in-out [&_.maplibregl-ctrl-logo]:!hidden [&_.maplibregl-ctrl-attrib]:!hidden" 
            />

            {/* Float Overlay Panels Top-Left */}
            {/* Searching card overlay display */}
            <SearchPanel 
              rpos={rposRef.current}
              onSelectDestination={selectPlaceFromPanel}
              homeLocation={homeLocation as LocationData}
              workLocation={workLocation as LocationData}
              setHomeLocation={setHomeLocation}
              setWorkLocation={setWorkLocation}
              isVisible={!naving}
              currentStreet={currentStreet}
              onCategoryResults={handleCategoryResults}
              onSelectPOIPreview={handleSelectPOIPreview}
              onOpenChange={setIsSearchOpen}
            />

            {/* Interactive POI Preview Card */}
            {selectedPOI && !naving && (
              <div className="absolute top-3 left-3 sm:top-5 sm:left-[24.5rem] z-[2000] w-[calc(100%-1.5rem)] sm:w-[21rem] max-w-[21rem] pointer-events-auto animate-slide-up">
                <POIPreviewCard
                  poi={selectedPOI}
                  onClose={() => setSelectedPOI(null)}
                  onSetDestination={(poi) => {
                    selectPlaceFromPanel(poi);
                  }}
                  isNavigating={naving}
                />
              </div>
            )}

            {/* Map Point Picker Top Floating Banner for Casa / Lavoro */}
            {pickingMapType && (
              <div
                id="map-point-picker-banner"
                className="absolute top-4 left-1/2 -translate-x-1/2 z-[2500] px-4 py-2.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto bg-neutral-900/90 text-white border-white/20"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping shrink-0" />
                <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                  Tocca la mappa per posizionare {pickingMapType === 'home' ? 'Casa' : 'Lavoro'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPickingMapType(null);
                    pickingMapTypeRef.current = null;
                  }}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 transition-colors cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            )}

            {/* Confirmation Toast */}
            {pointPickToast && (
              <div
                id="point-pick-toast"
                className="absolute top-16 left-1/2 -translate-x-1/2 z-[2500] px-4 py-2 rounded-xl backdrop-blur-xl border shadow-xl flex items-center gap-2 animate-in fade-in zoom-in duration-200 pointer-events-none bg-emerald-950/90 text-emerald-200 border-emerald-500/40 text-xs sm:text-sm font-medium"
              >
                <span>✓</span>
                <span>{pointPickToast}</span>
              </div>
            )}

            {/* Upper active navigation directions overlay */}
            <NavigationHUD 
              isActive={naving}
              destinationName={destinationName}
              steps={steps}
              currentStepIndex={currentStepIndex}
              remainingDistance={remainingDistanceRef.current}
              remainingTime={remainingTimeRef.current}
              vehiclePosition={rposRef.current}
              onSelectStep={handleFocusStep}
              onCancelNavigation={() => {
                clearRoute(false);
                handleCancelNavigation();
              }}
            />

            {/* Map Controls (Right floating panels & weather radar controllers) */}
            <MapControls 
              isNight={isNight}
              isNavigating={naving}
              isSearchOpen={isSearchOpen}
              cmode={cmode}
              is3D={is3D}
              bearing={bearing}
              isSatellite={isSatellite}
              isWeatherActive={isWeatherActive}
              isMapFollowing={isMapFollowing}
              onToggleCompass={handleToggleCompass}
              onToggle3D={handleToggle3D}
              onToggleSatellite={handleToggleSatellite}
              onToggleWeather={handleToggleWeather}
              onRecenter={handleRecenter}
              onWeatherFrameChange={handleWeatherFrameChange}
            />

            {/* Bottom-left stats indicator panel (TripStatsHUD.tsx) */}
            <TripStatsHUD 
              isActive={naving}
              isRoutePreview={isRoutePreview}
              destinationName={destinationName}
              remainingDistance={remainingDistanceRef.current}
              remainingTime={remainingTimeRef.current}
              routes={routeOptions}
              selectedRouteIndex={selectedRouteIndex}
              onSelectRoute={handleSelectRouteAlternative}
              onStartNavigation={startTracking}
              upcomingHazard={upcomingHazard}
              hazardsSummary={hazardsSummary}
              onCancelNavigation={() => {
                clearRoute(false);
                handleCancelNavigation();
              }}
            />

            {/* Bottom-right dynamic geocoded street info banner */}
            {(currentStreet || isWeatherActive) && (
              <div 
                id="street-box" 
                className={`absolute bottom-3.5 right-3.5 sm:bottom-6 sm:right-6 z-[1001] backdrop-blur-md border rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold shadow-lg select-none leading-none flex items-center gap-2.5 sm:gap-3 transition-colors ${isNight ? "bg-zinc-950/90 border-white/10 text-zinc-200" : "bg-white/90 border-black/10 text-zinc-800"}`}
              >
                {currentStreet && (
                  <>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    <span>{currentStreet}</span>
                  </>
                )}
                {isWeatherActive && (
                  <span className={`tabular-nums ${currentStreet ? 'border-l border-white/20 pl-2.5 sm:pl-3' : ''}`}>
                    Zoom: {currentZoom.toFixed(1)}
                  </span>
                )}
              </div>
            )}

            {/* Anchor container for floating overlay assets */}
            <div id="maps-anchored-container" className="absolute inset-0 z-[5000] pointer-events-none" style={{ pointerEvents: 'none' }}></div>
        </div>
    </div>
  );
});

export default React.memo(MapsContainer);
