import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { routeStore } from '../components/routeStore';
import { TelemetryStore } from './TelemetryStore';

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
}

export interface TripInfo {
  time: number;
  distance: number;
}

interface NavigationContextType {
  
  
  throttledPosition: { lat: number; lng: number } | null;
  arrivalMessage: string | null;
  setArrivalMessage: (msg: string | null) => void;
  tripInfo: TripInfo | null;
  setTripInfo: (info: TripInfo | null) => void;
  homeLocation: LocationData | null;
  setHomeLocation: (loc: LocationData | null) => void;
  workLocation: LocationData | null;
  setWorkLocation: (loc: LocationData | null) => void;
  favoriteLocations: LocationData[];
  setFavoriteLocations: (locs: LocationData[]) => void;
  navigationTarget: LocationData | null;
  setNavigationTarget: (target: LocationData | null) => void;
  isNavigating: boolean;
  setIsNavigating: (val: boolean) => void;
  isRoutePreview: boolean;
  setIsRoutePreview: (val: boolean) => void;
  mapStyle: string;
  setMapStyle: (style: string) => void;
  
  isSimulating: boolean;
  startTripSimulation: () => void;
  stopTripSimulation: () => void;
  handleSelectDestination: (target: LocationData) => void;
  handleCancelNavigation: (message?: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
  onSelectDestination?: () => void;
  onMapInteraction?: () => void;
}

export function NavigationProvider({ children, onSelectDestination, onMapInteraction }: NavigationProviderProps) {
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [arrivalMessage, setArrivalMessage] = useState<string | null>(null);
  const arrivalTimeoutRef = useRef<number | null>(null);
  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [throttledPosition, setThrottledPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [homeLocation, setHomeLocation] = useState<LocationData | null>(null);
  const [workLocation, setWorkLocation] = useState<LocationData | null>(null);
  const [favoriteLocations, setFavoriteLocations] = useState<LocationData[]>([]);
  const [navigationTarget, setNavigationTarget] = useState<LocationData | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isRoutePreview, setIsRoutePreview] = useState(false);
  const [mapStyle, setMapStyle] = useState('dark');
  const [isSimulating, setIsSimulating] = useState(false);
  
  const simulationIntervalRef = useRef<number | null>(null);
  const lastThrottledTimeRef = useRef<number>(0);

  // Load locations from localStorage
  useEffect(() => {
    try {
      const storedHome = localStorage.getItem('home_location');
      if (storedHome) setHomeLocation(JSON.parse(storedHome));
      
      const storedWork = localStorage.getItem('work_location');
      if (storedWork) setWorkLocation(JSON.parse(storedWork));
      
      const storedFavorites = localStorage.getItem('favorite_locations');
      if (storedFavorites) setFavoriteLocations(JSON.parse(storedFavorites));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Set up geolocation watching
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          const newPos = { lat: latitude, lng: longitude };
          
          TelemetryStore.setPosition(newPos);
          
          if (heading !== null && heading !== undefined) {
            let prevBearing = TelemetryStore.bearing;
            let diff = heading - prevBearing;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            TelemetryStore.setBearing((prevBearing + diff * 0.3 + 360) % 360);
          }
          
          lastPositionRef.current = newPos;

          // Throttled update for global context
          const now = Date.now();
          if (now - lastThrottledTimeRef.current > 5000) {
            setThrottledPosition(newPos);
            lastThrottledTimeRef.current = now;
          }
        },
        (error) => console.warn(error.message),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const startTripSimulation = useCallback(() => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    if (!tripInfo) return;

    const totalDistKm = tripInfo.distance / 1000;
    let currentDist = totalDistKm;
    
    TelemetryStore.setSimulatedRemainingDistance(currentDist);
    setIsSimulating(true);

    simulationIntervalRef.current = window.setInterval(() => {
      currentDist -= totalDistKm / 100;
      if (currentDist <= 0) {
        currentDist = 0;
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }
        setIsSimulating(false);
      }
      TelemetryStore.setSimulatedRemainingDistance(currentDist);
    }, 200);
  }, [tripInfo]);

  const stopTripSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    TelemetryStore.setSimulatedRemainingDistance(null);
    setIsSimulating(false);
  }, []);

  const handleSelectDestination = useCallback((target: LocationData) => {
    setNavigationTarget(target);
    window.dispatchEvent(new CustomEvent('select-destination'));
    if (onSelectDestination) {
      onSelectDestination();
    }
  }, [onSelectDestination]);

  const handleCancelNavigation = useCallback((message?: string) => {
    setNavigationTarget(null);
    setTripInfo(null);
    setIsNavigating(false);
    setIsRoutePreview(false);
    routeStore.setRoute(null);
    stopTripSimulation();
    const mapsIframe = document.querySelector('iframe[title="Tesla Navigation"]');
    if (mapsIframe && (mapsIframe as HTMLIFrameElement).contentWindow) {
      (mapsIframe as HTMLIFrameElement).contentWindow.postMessage({ type: 'CLEAR_ROUTE_FROM_PARENT' }, '*');
    }
    if (message) {
      setArrivalMessage(message);
      if (arrivalTimeoutRef.current) clearTimeout(arrivalTimeoutRef.current);
      arrivalTimeoutRef.current = window.setTimeout(() => setArrivalMessage(null), 5000);
    }
  }, [stopTripSimulation]);

  // Handle cross-iframe messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ROUTE_CLEARED') {
        handleCancelNavigation();
      }
      if (event.data?.type === 'ROUTE_UPDATED' && event.data.payload) {
        const { geometry, info, target } = event.data.payload;
        const routeData: [number, number][] = geometry.map((coords: [number, number]) => [coords[1], coords[0]]);
        routeStore.setRoute(routeData);
        setTripInfo(info);
        if (target) {
          setNavigationTarget((prev) => (prev ? prev : target));
        }
      }
      if (event.data?.type === 'MAP_STYLE_CHANGED') {
        setMapStyle(event.data.payload.style);
      }
      if (event.data?.type === 'SAVE_LOCATION' && event.data.payload) {
        const { type, coords, name } = event.data.payload;
        const locationData = { lat: coords.lat, lng: coords.lng, name };
        if (type === 'home') {
          setHomeLocation(locationData);
          localStorage.setItem('home_location', JSON.stringify(locationData));
        } else if (type === 'work') {
          setWorkLocation(locationData);
          localStorage.setItem('work_location', JSON.stringify(locationData));
        }
      }
      if (event.data?.type === 'SAVE_FAVORITE' && event.data.payload) {
        const newFavorite = event.data.payload;
        setFavoriteLocations((prev) => {
          if (prev.some((f) => f.name === newFavorite.name)) return prev;
          const updatedFavorites = [newFavorite, ...prev];
          localStorage.setItem('favorite_locations', JSON.stringify(updatedFavorites));
          return updatedFavorites;
        });
      }
      if (event.data?.type === 'MAP_INTERACTION') {
        window.dispatchEvent(new CustomEvent('map-interaction'));
        if (onMapInteraction) {
          onMapInteraction();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleCancelNavigation, onMapInteraction]);

  return (
    <NavigationContext.Provider
      value={{
        throttledPosition,
        arrivalMessage,
        setArrivalMessage,
        tripInfo,
        setTripInfo,
        homeLocation,
        setHomeLocation,
        workLocation,
        setWorkLocation,
        favoriteLocations,
        setFavoriteLocations,
        navigationTarget,
        setNavigationTarget,
        isNavigating,
        setIsNavigating,
        isRoutePreview,
        setIsRoutePreview,
        mapStyle,
        setMapStyle,
        isSimulating,
        startTripSimulation,
        stopTripSimulation,
        handleSelectDestination,
        handleCancelNavigation,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
