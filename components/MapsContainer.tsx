import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useNavigation, LocationData } from '../context/NavigationContext';
import { useWeather } from '../context/WeatherContext';
import { routeStore } from './routeStore';
import NavigateTool from './NavigateTool';

import SearchPanel from './SearchPanel';
import NavigationHUD from './NavigationHUD';
import TripStatsHUD from './TripStatsHUD';
import MapControls from './MapControls';
import { buildMapStyle, dist, bear, OSRM_URL } from './MapEngineUtils';
import { useUIConfig } from '../context/UIConfigContext';

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

interface WeatherFrame {
  time: number;
  path: string;
}

const MapsContainer = React.memo(({ 
    isOpen, 
    onClose,
    onDragProgress,
    onInteractionStart,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    onDragProgress?: (progress: number | null) => void;
    onInteractionStart?: () => void;
}) => {
  const {
    navigateToolWidth: width,
    widgetBgColor,
    dayPlayerButtonColor,
    nightPlayerButtonColor,
    darkNavigateInputBg,
  } = useUIConfig();

  const {
    navigationTarget,
    homeLocation,
    workLocation,
    handleSelectDestination: onSelectDestination,
    handleCancelNavigation,
  } = useNavigation();

  const { useDarkTheme: isNight } = useWeather();

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // MapLibre and marker references
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vmRef = useRef<maplibregl.Marker | null>(null);
  const destMarkRef = useRef<maplibregl.Marker | null>(null);
  const proxMarkRef = useRef<maplibregl.Marker | null>(null);

  // Dead reckoning, bearing, and geolocationsRefs
  const rposRef = useRef<{ lat: number; lng: number } | null>(null);
  const tgtRef = useRef<{ lat: number; lng: number } | null>(null);
  const tbearRef = useRef<number>(0);
  const cbearRef = useRef<number>(0);
  const mbearRef = useRef<number>(0);
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
  const [naving, setNaving] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [destinationName, setDestinationName] = useState('Destinazione');
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);

  const [cmode, setCmode] = useState<'north-up' | 'heading-up'>('north-up');
  const [bearing, setBearing] = useState(0);
  const [isSatellite, setIsSatellite] = useState(false);
  const [isWeatherActive, setIsWeatherActive] = useState(false);
  const [isMapFollowing, setIsMapFollowing] = useState(true);

  // Custom additions for authentic maps template
  const [currentStreet, setCurrentStreet] = useState<string>('');
  const lastGeocodeTimeRef = useRef<number>(0);

  const [toastText, setToastText] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(msg);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  }, []);

  // Sync ref values for render frame loops
  const cmodeRef = useRef<'north-up' | 'heading-up'>('north-up');
  const followRef = useRef<boolean>(true);
  const interactRef = useRef<boolean>(false);
  const flyingRef = useRef<boolean>(false);
  const isWeatherActiveRef = useRef<boolean>(false);
  const recTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTrackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPendingStartRef = useRef<boolean>(false);
  const activeFetchIdRef = useRef<number>(0);
  const autoZoomedRef = useRef<boolean>(false);
  const pendDestRef = useRef<{ coords: { lat: number; lng: number }; name: string } | null>(null);
  const savedModeRef = useRef<'north-up' | 'heading-up' | null>(null);
  const weatherSlotRef = useRef<'A' | 'B'>('A');

  // Physics animation variables for drawer slide sheet
  const physics = useRef({
      currentX: 100,
      targetX: 100,
      startX: 100,
      animStartTime: 0,
      isDragging: false,
      isInteracting: false,
      dragStartX: 0,
      dragStartCurrentX: 0,
      panelWidth: 0,
      animationId: 0
  });

  const ANIMATION_SPEED = 0.18; 
  const CLOSE_THRESHOLD_PERCENT = 25;

  // Global CSS bouncing animations
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
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Sync drawer slides positioning with isOpen state
  useEffect(() => {
    const state = physics.current;
    if (!state.isDragging) {
        const newTargetX = isOpen ? 0 : 100;
        if (state.targetX !== newTargetX || state.animStartTime === 0) {
            state.startX = state.currentX;
            state.targetX = newTargetX;
            state.animStartTime = performance.now();
        }
    }
  }, [isOpen]);

  // Drawer slide frame cycle animation
  useEffect(() => {
    const update = () => {
        const state = physics.current;
        const panel = panelRef.current;

        if (!state.isDragging) {
            if (state.animStartTime > 0) {
                const elapsed = performance.now() - state.animStartTime;
                const duration = 400; // ms
                const t = Math.min(elapsed / duration, 1.0);
                const easeT = 1 - Math.pow(1 - t, 4);
                state.currentX = state.startX + (state.targetX - state.startX) * easeT;
            } else {
                state.currentX = state.targetX;
            }
        }

        if (state.isInteracting) {
            let visualProgress = state.currentX / 100;
            visualProgress = Math.max(0, Math.min(1, visualProgress));
            
            onDragProgress?.(visualProgress);

            if (!state.isDragging && Math.abs(state.targetX - state.currentX) < 0.5) {
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

        state.animationId = requestAnimationFrame(update);
    };

    physics.current.animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(physics.current.animationId);
  }, [onDragProgress]);

  // Handle slide drag starts
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!panelRef.current) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    onInteractionStart?.();

    const state = physics.current;
    state.isDragging = true;
    state.isInteracting = true;
    state.dragStartX = e.clientX;
    state.dragStartCurrentX = state.currentX;
    state.panelWidth = panelRef.current.offsetWidth || window.innerWidth * 0.66;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = physics.current;
    if (!state.isDragging) return;
    e.stopPropagation();

    const deltaPx = e.clientX - state.dragStartX;
    const deltaPercent = (deltaPx / state.panelWidth) * 100;
    
    let newPercent = state.dragStartCurrentX + deltaPercent;
    if (newPercent < 0) newPercent = 0; 
    
    state.currentX = newPercent;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const state = physics.current;
    state.isDragging = false;

    if (state.currentX > CLOSE_THRESHOLD_PERCENT) {
        state.startX = state.currentX;
        state.targetX = 100;
        state.animStartTime = performance.now();
        if (isOpen) onClose();
    } else {
        state.startX = state.currentX;
        state.targetX = 0;
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

    setRemainingDistance(rem);
    setRemainingTime(rem / Math.max(speedRef.current, 8));

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

  // Fetch travel route vectors using OSM open API OSRM services
  const fetchRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (!start || !end) return;
    const currentId = activeFetchIdRef.current;
    const url = `${OSRM_URL}${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true&annotations=false`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (activeFetchIdRef.current !== currentId) return; // Discard stale fetch promises

      if (!data.routes || !data.routes.length) throw new Error('Route empty');
      const route = data.routes[0];
      const coords = route.geometry.coordinates;
      geoRef.current = coords;

      const items: StepInfo[] = [];
      let dfs = 0;
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

      stepsRef.current = items;
      setSteps(items);
      siRef.current = 0;
      setCurrentStepIndex(0);
      nearIdxRef.current = 0;
      setRemainingDistance(route.distance);
      setRemainingTime(route.duration);

      // Store route coordinate vectors for instrument panel Minimap rendering
      const reversedCoords: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]);
      routeStore.setRoute(reversedCoords);

      // Display tracing segments route line layers on map
      if (mapRef.current && mapRef.current.getSource('route')) {
        (mapRef.current.getSource('route') as any).setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { consumed: false },
              geometry: { type: 'LineString', coordinates: coords }
            }
          ]
        });
      }

      // Center layout viewing boundary wrapping route bounding box
      if (mapRef.current && coords.length > 0) {
        const bounds = coords.reduce(
          (b: maplibregl.LngLatBounds, c: [number, number]) => b.extend(c),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );
        mapRef.current.fitBounds(bounds, {
          padding: { top: 140, bottom: 180, left: 80, right: 80 }
        });
        followRef.current = false;
        setIsMapFollowing(false);
      }

      // Automatic tracking startup timers scheduler
      isPendingStartRef.current = true;
      if (startTrackTimerRef.current) clearTimeout(startTrackTimerRef.current);
      startTrackTimerRef.current = setTimeout(() => {
        startTracking();
      }, 5000);

    } catch (e) {
      console.error('[ROUTE] Navigation fetch error', e);
    }
  }, []);

  const destRef = useRef<{ lat: number; lng: number } | null>(null);

  const startTracking = useCallback(() => {
    if (!destRef.current) return;
    isPendingStartRef.current = false;
    setNaving(true);
    navingRef.current = true;

    cmodeRef.current = 'heading-up';
    setCmode('heading-up');
    followRef.current = true;
    setIsMapFollowing(true);

    smoothRec();
  }, []);

  // Sets active navigation itinerary target endpoint and adds pin markers
  const setDest = useCallback(async (coords: { lat: number; lng: number }, name: string) => {
    clearRoute(true);
    activeFetchIdRef.current++;
    destRef.current = coords;
    setDestinationName(name);

    if (destMarkRef.current) {
      destMarkRef.current.remove();
      destMarkRef.current = null;
    }

    const pinEl = document.createElement('div');
    pinEl.className = 'dest-pin';
    pinEl.style.width = '48px';
    pinEl.style.height = '64px';
    pinEl.style.pointerEvents = 'none';
    pinEl.style.filter = 'drop-shadow(0 6px 10px rgba(0,0,0,0.5))';
    pinEl.innerHTML = `<svg width="48" height="64" viewBox="0 0 24 24"><ellipse cx="12" cy="22.5" rx="5" ry="1.5" fill="rgba(0,0,0,.2)"/><g><path d="M12,2c-4.2,0-8,3.22-8,8.2c0,3.18,2.45,6.92,7.34,11.23c0.38,0.33,0.95,0.33,1.33,0C17.55,17.12,20,13.38,20,10.2 C20,5.22,16.2,2,12,2z M12,12c-1.1,0-2-0.9-2-2c0-1.1,0.9-2,2-2c1.1,0,2,0.9,2,2C14,11.1,13.1,12,12,12z" fill="#EF4444" stroke="#FFFFFF" stroke-width="1.2"/></g></svg>`;

    if (mapRef.current) {
      destMarkRef.current = new maplibregl.Marker({
        element: pinEl,
        anchor: 'bottom'
      }).setLngLat([coords.lng, coords.lat]).addTo(mapRef.current);
    }

    const start = tgtRef.current || rposRef.current;
    if (start) {
      fetchRoute(start, coords);
    } else {
      pendDestRef.current = { coords, name };
    }
  }, [fetchRoute]);

  // Clears route visualization and resets mapping state
  const clearRoute = useCallback((isSoft = false) => {
    if (startTrackTimerRef.current) clearTimeout(startTrackTimerRef.current);
    isPendingStartRef.current = false;
    activeFetchIdRef.current++;

    destRef.current = null;
    geoRef.current = null;
    stepsRef.current = [];
    setSteps([]);
    setNaving(false);
    navingRef.current = false;
    siRef.current = 0;
    setCurrentStepIndex(0);
    nearIdxRef.current = 0;

    routeStore.setRoute(null);

    if (destMarkRef.current) {
      destMarkRef.current.remove();
      destMarkRef.current = null;
    }
    if (proxMarkRef.current) {
      proxMarkRef.current.remove();
      proxMarkRef.current = null;
    }

    if (mapRef.current && mapRef.current.getSource('route')) {
      (mapRef.current.getSource('route') as any).setData({
        type: 'FeatureCollection',
        features: []
      });
    }

    if (!isSoft) {
      if (rposRef.current && mapRef.current) {
        flyingRef.current = true;
        mapRef.current.flyTo({
          center: [rposRef.current.lng, rposRef.current.lat],
          zoom: 14,
          bearing: 0,
          duration: 1800,
          essential: true,
          easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        });
        mapRef.current.once('moveend', () => {
          flyingRef.current = false;
          followRef.current = true;
          setIsMapFollowing(true);
          cmodeRef.current = 'north-up';
          setCmode('north-up');
        });
      } else {
        followRef.current = true;
        setIsMapFollowing(true);
      }
    }
  }, []);

  // Recenter map camera on active vehicle location Ref point
  const smoothRec = useCallback(() => {
    if (!rposRef.current || !mapRef.current) return;
    mapRef.current.stop();
    followRef.current = true;
    setIsMapFollowing(true);
    flyingRef.current = true;

    const tz = cmodeRef.current === 'heading-up' ? 16 : 14;
    const tb = cmodeRef.current === 'heading-up' ? cbearRef.current : 0;
    const tll: [number, number] = [rposRef.current.lng, rposRef.current.lat];
    const cc = mapRef.current.getCenter();
    const cZoom = mapRef.current.getZoom();

    const d = dist(cc.lat, cc.lng, tll[1], tll[0]);
    const zDiff = Math.abs(cZoom - tz);

    const useFlyTo = d > 2000 || zDiff > 2.5;
    const anim = useFlyTo ? mapRef.current.flyTo : mapRef.current.easeTo;
    const duration = useFlyTo ? Math.min(3500, Math.max(2000, d / 11)) : 1500;

    anim.call(mapRef.current, {
      center: tll,
      zoom: tz,
      bearing: tb,
      duration: duration,
      essential: true,
      easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    });

    mapRef.current.once('moveend', () => {
      flyingRef.current = false;
    });
    
    showToast('Tracking riattivato');
  }, [showToast]);

  // Compass interaction triggers
  const handleToggleCompass = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.stop();
    flyingRef.current = false;
    
    const newMode = cmodeRef.current === 'heading-up' ? 'north-up' : 'heading-up';
    cmodeRef.current = newMode;
    setCmode(newMode);
    smoothRec();
    
    showToast(newMode === 'heading-up' ? 'Heading Up attivato' : 'North Up attivato');
  }, [smoothRec, showToast]);

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
      mapRef.current.setStyle(buildMapStyle('satellite'));
    } else {
      mapRef.current.setMaxZoom(20);
      mapRef.current.setStyle(buildMapStyle(isNight ? 'dark' : 'light'));
    }

    mapRef.current.once('style.load', () => {
       mapRef.current?.setProjection({ type: 'globe' } as any);
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

    showToast(newSat ? 'Visuale Satellite attivata' : 'Visuale Stradale attivata');
  }, [isSatellite, isNight, showToast]);

  // Weather radar timeline layer triggers
  const handleToggleWeather = useCallback(() => {
    const newWeather = !isWeatherActive;
    setIsWeatherActive(newWeather);
    isWeatherActiveRef.current = newWeather;

    if (newWeather) {
      if (rposRef.current && mapRef.current) {
        followRef.current = false;
        setIsMapFollowing(false);
        mapRef.current.flyTo({
          center: [rposRef.current.lng, rposRef.current.lat],
          zoom: 6,
          duration: 2000,
          essential: true
        });
      }
    } else {
      // Clear opacity on weather layers wl-A and wl-B
      ['A', 'B'].forEach((s) => {
        if (mapRef.current && mapRef.current.getLayer(`wl-${s}`)) {
          mapRef.current.setPaintProperty(`wl-${s}`, 'raster-opacity', 0);
        }
      });
      smoothRec();
    }

    showToast(newWeather ? 'Radar Meteo abilitato' : 'Radar Meteo disattivato');
  }, [isWeatherActive, smoothRec, showToast]);

  // Handles timeline framework caching and rendering transitions matching original HTML
  const handleWeatherFrameChange = useCallback((frame: WeatherFrame, index: number, isFuture: boolean) => {
    if (!mapRef.current) return;
    const ns = weatherSlotRef.current === 'A' ? 'B' : 'A';
    const sourceId = `w-${ns}`;
    const layerId = `wl-${ns}`;
    const currentLayerId = `wl-${weatherSlotRef.current}`;

    const src = mapRef.current.getSource(sourceId) as any;
    if (src) {
      const tileUrl = `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.webp`;
      src.setTiles([tileUrl]);
    }

    // Set crossfade layers opacities
    mapRef.current.setPaintProperty(layerId, 'raster-opacity', 0.85);
    mapRef.current.setPaintProperty(currentLayerId, 'raster-opacity', 0);

    weatherSlotRef.current = ns;
  }, []);

  // Synchronizes changes in NavigationTarget from NavigateTool or context triggers
  useEffect(() => {
    if (isOpen) {
      if (navigationTarget) {
        setDest({ lat: navigationTarget.lat, lng: navigationTarget.lng }, navigationTarget.name);
      } else {
        clearRoute(false);
      }
    }
  }, [navigationTarget, isOpen, setDest, clearRoute]);

  // Reverse geocodes the vehicle position to track current street
  useEffect(() => {
    if (!naving || !rposRef.current) {
      setCurrentStreet('');
      return;
    }

    const updateStreet = async () => {
      const now = Date.now();
      if (now - lastGeocodeTimeRef.current < 15000) return; // rate limit 15s
      lastGeocodeTimeRef.current = now;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${rposRef.current.lat}&lon=${rposRef.current.lng}&zoom=18&addressdetails=1`
        );
        if (res.ok) {
          const d = await res.json();
          const road = d.address?.road;
          const suburb = d.address?.suburb;
          const streetText = road || suburb;
          if (streetText) {
            setCurrentStreet(streetText);
          }
        }
      } catch (e) {
        console.error('[STREET] Reverse geocoding failed', e);
      }
    };

    updateStreet();
  }, [naving, currentStepIndex]);

  // Local state watcher matching geolocation stream with smooth spline integrations
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const now = performance.now();
        const nla = p.coords.latitude;
        const nlo = p.coords.longitude;
        let gs = p.coords.speed;
        const gh = p.coords.heading;
        let df = 0;

        if (lastGpsPosRef.current) {
          df = dist(lastGpsPosRef.current.lat, lastGpsPosRef.current.lng, nla, nlo);
          const dts = (now - lastGpsPosRef.current.ts) / 1000;
          if ((gs === null || gs < 0) && dts > 0) {
            gs = df / dts;
          }
        }

        const spd = gs || 0;
        speedRef.current = spd;

        if (spd < 0.5 && df < 2 && tgtRef.current) {
          lastGpsPosRef.current = { lat: nla, lng: nlo, ts: now };
          return;
        }

        let nb = tbearRef.current;
        if (gh !== null && !isNaN(gh) && gh >= 0) {
          nb = gh;
        } else if (tgtRef.current && df > 1.5 && spd > 0.5) {
          nb = bear(tgtRef.current.lat, tgtRef.current.lng, nla, nlo);
        }

        tbearRef.current = nb;
        tgtRef.current = { lat: nla, lng: nlo };
        lastGpsPosRef.current = { lat: nla, lng: nlo, ts: now };

        // Lazy initialize coordinates
        if (!rposRef.current) {
          rposRef.current = { lat: nla, lng: nlo };
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
            center: [nlo, nla],
            zoom: 17,
            duration: 3500,
            speed: .6,
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
          checkRouteDeviations({ lat: nla, lng: nlo });
        }
      },
      (err) => console.warn('[GPS] Geolocation watches error', err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
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
        const pa = 1 - Math.exp(-4 * dt);
        const dl = ideal.lat - rposRef.current.lat;
        const dn = ideal.lng - rposRef.current.lng;
        const dm = Math.sqrt(dl * dl + dn * dn) * 111320;
        
        if (dm > 0.1 || speedRef.current > 0.3) {
          rposRef.current.lat += dl * pa;
          rposRef.current.lng += dn * pa;
        }

        // Heading spline easing matching Class Nav perfectly
        const tb = tbearRef.current;
        const mdNom = ((tb - mbearRef.current + 540) % 360) - 180;
        const mk = speedRef.current > 0.8 ? 3.5 : 0;
        if (mk > 0) {
          mbearRef.current = (mbearRef.current + mdNom * (1 - Math.exp(-mk * dt)) + 360) % 360;
        } else {
          mbearRef.current = tb;
        }

        const cdNom = ((tb - cbearRef.current + 540) % 360) - 180;
        const ck = speedRef.current > 0.8 ? 1.0 : 0;
        if (ck > 0) {
          cbearRef.current = (cbearRef.current + cdNom * (1 - Math.exp(-ck * dt)) + 360) % 360;
        } else {
          cbearRef.current = tb;
        }

        if (vmRef.current) {
          vmRef.current.setLngLat([rposRef.current.lng, rposRef.current.lat]);
          vmRef.current.setRotation(mbearRef.current);
        }

        if (mapRef.current && followRef.current && !interactRef.current && !flyingRef.current && !isWeatherActiveRef.current) {
          const b = cmodeRef.current === 'heading-up' ? cbearRef.current : 0;
          mapRef.current.jumpTo({
            center: [rposRef.current.lng, rposRef.current.lat],
            bearing: b,
            zoom: cmodeRef.current === 'heading-up' ? 17.2 : 14
          });
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

  // Render WebGL maps frame layers when containers Mount
  useEffect(() => {
    if (!mapContainerRef.current || !isOpen) return;

    const th = isNight ? 'dark' : 'light';
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildMapStyle(th),
      center: [12.4964, 41.9028],
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      minPitch: 0,
      fadeDuration: 300,
      minZoom: 1.8,
      bearingSnap: 0,
      dragRotate: true,
      touchZoomRotate: true,
      maxTileCacheSize: 300,
      maxZoom: 20
    });

    mapRef.current = map;

    // Trigger Resize observers on layouts modification
    const resObs = new ResizeObserver(() => map.resize());
    resObs.observe(mapContainerRef.current);

    // Creates virtual vehicle indicator
    const velEl = document.createElement('div');
    velEl.id = 'vm';
    velEl.style.width = '76px';
    velEl.style.height = '76px';
    velEl.style.pointerEvents = 'none';
    velEl.style.filter = 'drop-shadow(0 6px 12px rgba(0,0,0,.5))';
    velEl.innerHTML = `<svg viewBox="0 0 1414 2000" style="width:100%;height:100%;overflow:visible"><path fill="#FDFCFC" d="M639.979065,551.815125 C645.168152,540.088928 650.026184,528.629089 655.273071,517.350159 C668.813538,488.243103 708.591675,477.322784 735.566650,494.553101 C749.156494,503.233704 756.313721,515.993591 762.405273,530.085083 C787.421509,587.954773 812.641113,645.736633 837.759827,703.562134 C862.019897,759.411072 886.220703,815.285706 910.497864,871.127136 C934.243469,925.745850 958.087769,980.321533 981.824341,1034.944092 C1007.415466,1093.834229 1032.934204,1152.755859 1058.479614,1211.665894 C1065.145508,1227.038086 1072.164307,1242.270264 1078.359985,1257.829956 C1086.983032,1279.485596 1080.075684,1304.759277 1061.833496,1320.765991 C1044.998657,1335.537842 1018.689575,1338.636230 998.807922,1327.514404 C973.012146,1313.083984 947.494507,1298.156738 921.845398,1283.463745 C896.915344,1269.182495 871.943359,1254.974487 847.039307,1240.648193 C818.390015,1224.167480 789.808044,1207.569946 761.171631,1191.066895 C743.616943,1180.949951 726.045654,1170.860352 708.373291,1160.952148 C707.027161,1160.197388 704.456543,1160.359009 703.057556,1161.154419 C677.210327,1175.849976 651.469910,1190.733276 625.675842,1205.522827 C600.896851,1219.730347 576.053467,1233.825806 551.291382,1248.062500 C526.381775,1262.384155 501.560059,1276.858398 476.657715,1291.192383 C455.215363,1303.535034 433.836731,1315.996338 412.205383,1328.000488 C388.054901,1341.402466 353.937225,1332.084717 339.430542,1308.918579 C327.287811,1289.527344 327.550873,1270.051636 336.589294,1249.539062 C360.004272,1196.398804 382.947418,1143.050781 406.116211,1089.801880 C430.474152,1033.819946 454.903503,977.869019 479.249084,921.881653 C499.687012,874.880615 520.035400,827.840698 540.448792,780.828918 C568.990845,715.096863 597.555237,649.374451 626.113342,583.649353 C630.675232,573.150452 635.254150,562.658875 639.979065,551.815125z"/><path fill="#F53C3F" d="M707.985596,1098.275757 C688.642273,1109.299561 669.273499,1120.278809 649.961304,1131.356812 C616.268066,1150.684448 582.601135,1170.058105 548.939514,1189.440918 C526.323425,1202.463379 503.680634,1215.440674 481.153290,1228.615234 C464.812622,1238.171875 442.888977,1236.842773 429.660736,1225.171021 C413.332520,1210.763794 408.560883,1191.014648 416.835876,1171.967651 C458.874298,1075.205688 500.913940,978.444153 542.963440,881.686951 C583.817871,787.679565 624.699951,693.684204 665.529053,599.665771 C671.380615,586.191162 681.000549,576.917969 695.215637,572.960754 C698.969604,571.915771 703.108154,572.252441 707.527222,572.474731 C707.984741,748.088440 707.985168,923.182068 707.985596,1098.275757z"/><path fill="#F56568" d="M708.263672,1098.452148 C707.985168,923.182068 707.984741,748.088440 707.981567,572.530945 C723.690674,570.855591 740.974609,582.015869 748.093933,598.283508 C762.495178,631.190430 776.757996,664.157898 791.081543,697.098694 C823.043579,770.604004 855.015137,844.105225 886.968018,917.614563 C899.828613,947.201050 912.631531,976.812622 925.493591,1006.398438 C949.338867,1061.248291 973.180847,1116.099487 997.079346,1170.926025 C1008.930359,1198.113892 994.624023,1227.342163 966.153687,1233.567993 C952.263794,1236.605469 940.130798,1231.951416 928.216003,1225.023193 C880.917236,1197.519775 833.427551,1170.344727 785.995544,1143.070557 C760.191284,1128.232910 734.360596,1113.440918 708.263672,1098.452148z"/></svg>`;

    const vmObj = new maplibregl.Marker({
      element: velEl,
      anchor: 'center',
      pitchAlignment: 'map',
      rotationAlignment: 'map'
    }).setLngLat([12.4964, 41.9028]);
    vmRef.current = vmObj;

    map.on('load', () => {
      map.setProjection({ type: 'globe' } as any);

      // Add routing trace sources/layers
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'r-glow',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'consumed'], false],
        paint: {
          'line-color': 'rgba(59,130,246,.3)',
          'line-width': 14,
          'line-blur': 6
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });

      map.addLayer({
        id: 'r-line',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'consumed'], false],
        paint: {
          'line-color': '#3B82F6',
          'line-width': 7
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });

      map.addLayer({
        id: 'r-cons',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'consumed'], true],
        paint: {
          'line-color': 'rgba(100,105,115,.55)',
          'line-width': 7
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });

      // Add weather timeline layers wl-A and wl-B matching OSRM precisely
      ['A', 'B'].forEach((s) => {
        const si = `w-${s}`;
        const li = `wl-${s}`;
        map.addSource(si, {
          type: 'raster',
          tiles: [],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 24
        });
        map.addLayer({
          id: li,
          type: 'raster',
          source: si,
          paint: { 'raster-opacity': 0, 'raster-fade-duration': 400 }
        }, 'r-glow');
      });

      vmObj.addTo(map);
    });

    const handleStartInt = () => {
      flyingRef.current = false;
      if (followRef.current) {
        savedModeRef.current = cmodeRef.current;
      }
      followRef.current = false;
      interactRef.current = true;
      setIsMapFollowing(false);

      if (recTimerRef.current) clearTimeout(recTimerRef.current);
      if (isPendingStartRef.current && startTrackTimerRef.current) {
         clearTimeout(startTrackTimerRef.current);
      }

      if (cmodeRef.current === 'heading-up') {
        cmodeRef.current = 'north-up';
        setCmode('north-up');
        map.easeTo({
          bearing: 0,
          pitch: 0,
          duration: 500,
          easing: (t) => t * (2 - t)
        });
      }
    };

    const handleEndInt = () => {
      interactRef.current = false;
      if (recTimerRef.current) clearTimeout(recTimerRef.current);

      if (isPendingStartRef.current) {
         startTrackTimerRef.current = setTimeout(() => {
           startTracking();
         }, 3000);
         return;
      }

      recTimerRef.current = setTimeout(() => {
        if (isWeatherActiveRef.current) return;
        followRef.current = true;
        setIsMapFollowing(true);
        if (savedModeRef.current === 'heading-up') {
          cmodeRef.current = 'heading-up';
          setCmode('heading-up');
        } else {
          cmodeRef.current = 'north-up';
          setCmode('north-up');
        }
        smoothRec();
      }, 5000);
    };

    ['mousedown', 'touchstart', 'dragstart'].forEach((e) => {
      map.on(e, handleStartInt);
    });
    ['mouseup', 'touchend', 'dragend'].forEach((e) => {
      map.on(e, handleEndInt);
    });

    map.on('wheel', () => {
      handleStartInt();
      handleEndInt();
    });

    map.on('rotate', () => {
      setBearing(map.getBearing());
    });

    return () => {
      resObs.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (recTimerRef.current) clearTimeout(recTimerRef.current);
      if (startTrackTimerRef.current) clearTimeout(startTrackTimerRef.current);
    };
  }, [isOpen, isNight, smoothRec, startTracking]);

  const handleColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';

  const selectPlaceFromPanel = (item: any) => {
    setDest({ lat: item.lat, lng: item.lng }, item.name);
  };

  return (
    <div 
        ref={panelRef}
        className="fixed top-0 right-0 bottom-0 w-2/3 md:w-3/4 lg:w-2/3 text-white shadow-2xl z-[4000] flex spotify-app-panel"
        style={{ 
            willChange: 'transform',
            top: 0,
            bottom: 0
        }}
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby="maps-player-title"
        onClick={stopPropagation}
    >
        {/* Slide Close Drag handle bar */}
        <div
            className={`absolute top-0 bottom-0 -left-12 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-55 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`}
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

        {/* Core WebGL Map container */}
        <div className="relative w-full h-full overflow-hidden bg-[#050505]">
            <h1 id="maps-player-title" className="sr-only">Maps Player</h1>
            
            {/* Core WebGL Map container */}
            <div 
              ref={mapContainerRef} 
              className="w-full h-full absolute inset-0 [&_.maplibregl-canvas]:transition-opacity [&_.maplibregl-canvas]:duration-300 [&_.maplibregl-canvas]:ease-in-out [&_.maplibregl-ctrl-logo]:!hidden [&_.maplibregl-ctrl-attrib]:!hidden" 
            />

            {/* Float Overlay Panels Top-Left */}
            <div className="absolute top-5 left-5 z-[1002] w-[340px] max-w-[calc(100vw-50px)] flex flex-col gap-3 pointer-events-none">
                {/* Searching card overlay display */}
                <SearchPanel 
                  rpos={rposRef.current}
                  onSelectDestination={selectPlaceFromPanel}
                  homeLocation={homeLocation as LocationData}
                  workLocation={workLocation as LocationData}
                  isVisible={!naving}
                />

                {/* Upper active navigation directions overlay */}
                <NavigationHUD 
                  isActive={naving}
                  destinationName={destinationName}
                  steps={steps}
                  currentStepIndex={currentStepIndex}
                  remainingDistance={remainingDistance}
                  remainingTime={remainingTime}
                  vehiclePosition={rposRef.current}
                  onCancelNavigation={() => {
                    clearRoute(false);
                    handleCancelNavigation();
                    showToast('Navigazione terminata');
                  }}
                />
            </div>

            {/* Map Controls (Right floating panels & weather radar controllers) */}
            <MapControls 
              cmode={cmode}
              bearing={bearing}
              isSatellite={isSatellite}
              isWeatherActive={isWeatherActive}
              isMapFollowing={isMapFollowing}
              onToggleCompass={handleToggleCompass}
              onToggleSatellite={handleToggleSatellite}
              onToggleWeather={handleToggleWeather}
              onRecenter={smoothRec}
              onWeatherFrameChange={handleWeatherFrameChange}
            />

            {/* Bottom-left stats indicator panel (TripStatsHUD.tsx) */}
            <TripStatsHUD 
              isActive={naving}
              destinationName={destinationName}
              remainingDistance={remainingDistance}
              remainingTime={remainingTime}
              onCancelNavigation={() => {
                clearRoute(false);
                handleCancelNavigation();
                showToast('Navigazione terminata');
              }}
            />

            {/* Bottom-right dynamic geocoded street info banner */}
            {currentStreet && (
              <div 
                id="street-box" 
                className="absolute bottom-6 right-6 z-[1001] bg-zinc-950/92 backdrop-blur-2xl border border-white/10 rounded-xl px-4 py-2.5 text-xs font-semibold text-zinc-200 shadow-[0_4px_15px_rgba(0,0,0,0.5)] select-none leading-none flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                <span>{currentStreet}</span>
              </div>
            )}

            {/* Bottom-centered dynamic interactive notification toasts */}
            {toastVisible && (
              <div 
                id="toast" 
                className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[10000] bg-zinc-950/95 border border-white/10 text-white rounded-xl py-3 px-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-3xl flex items-center gap-2.5 max-w-[90%] font-medium text-xs md:text-sm tracking-tight pointer-events-none animate-slide-up duration-300"
              >
                <svg className="w-5 h-5 text-blue-400 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>{toastText}</span>
              </div>
            )}

            {/* Anchor container for floating overlay assets */}
            <div id="maps-anchored-container" className="absolute inset-0 z-50 pointer-events-none"></div>
        </div>
    </div>
  );
});

export default MapsContainer;
