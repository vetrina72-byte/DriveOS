import React, { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { routeStore } from './routeStore';
import VehicleArrowIcon from './VehicleArrowIcon';
import { useNavigation } from '../context/NavigationContext';
import { useWeather } from '../context/WeatherContext';
import { useTelemetryData } from '../hooks/useTelemetry';

// Patch difensiva completa per prevenire TypeError: Cannot read properties of undefined (reading 'replace')
const originalTemplate = L.Util.template;
L.Util.template = function (str: any, data: any) {
  if (typeof str !== 'string') {
    return '';
  }
  return originalTemplate ? originalTemplate(str, data) : '';
};

const originalTrim = L.Util.trim;
L.Util.trim = function (str: any) {
  if (typeof str !== 'string') return '';
  return originalTrim ? originalTrim(str) : String(str).trim();
};

const originalSetUrl = L.TileLayer.prototype.setUrl;
L.TileLayer.prototype.setUrl = function (url: string, noRedraw?: boolean) {
  if (!url || typeof url !== 'string') {
    return this;
  }
  return originalSetUrl.call(this, url, noRedraw);
};

const originalGetTileUrl = L.TileLayer.prototype.getTileUrl;
L.TileLayer.prototype.getTileUrl = function (coords: any) {
  if (!this._url || typeof this._url !== 'string') {
    return '';
  }
  try {
    return originalGetTileUrl.call(this, coords);
  } catch (e) {
    return '';
  }
};

// Function to create a leaflet icon from the React component - UPDATED
const createVehicleIcon = (bearing: number): L.DivIcon => {
  return L.divIcon({
    html: renderToStaticMarkup(<VehicleArrowIcon size={34} bearing={bearing} className="transition-transform duration-200 linear" />),
    className: 'vehicle-marker-icon', // custom class for transparent background
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

// Component to programmatically update map view without user interaction
const MapUpdater = ({ position, zoom, isVisible }: { position: { lat: number; lng: number }, zoom: number, isVisible: boolean }) => {
    const map = useMap();
    useEffect(() => {
        if (position && map) {
            // Smoothly pan to the new position and set zoom
            map.setView([position.lat, position.lng], zoom, {
                animate: true,
                duration: 0.5,
                noMoveStart: true // Prevents firing 'movestart' which could have side-effects
            });
        }
    }, [position, zoom, map]);

    useEffect(() => {
        if (isVisible && map) {
            const timer = setTimeout(() => {
                try {
                    map.invalidateSize();
                } catch (e) {}
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isVisible, map]);

    return null;
};

// Component to manage the route polyline and animated marker imperatively
const RouteManager = ({ useDarkTheme }: { useDarkTheme: boolean }) => {
    const map = useMap();
    const polylineRef = useRef<L.Polyline | null>(null);

    const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);

    useEffect(() => {
        const initialCoords = routeStore.getCoords();
        console.log('[DEBUG] minimap mounted, routeStore.coords length =', initialCoords?.length);
        if (initialCoords) {
             setRouteCoords(initialCoords);
        }

        const unsubscribe = routeStore.subscribe((coords) => {
            console.log('[DEBUG] minimap subscribe -> coords len =', coords?.length);
            setRouteCoords(coords);
        });

        return () => {
             unsubscribe();
        };
    }, []);

    // Effect for the route polyline
    useEffect(() => {
        if (!map) return;

        if (routeCoords && routeCoords.length > 0) {
            const pathOptions = {
                color: useDarkTheme ? '#60A5FA' : '#3B82F6',
                weight: 6,
                opacity: 0.85,
            };

            if (polylineRef.current) {
                polylineRef.current.setLatLngs(routeCoords);
                polylineRef.current.setStyle(pathOptions);
            } else {
                polylineRef.current = L.polyline(routeCoords, pathOptions).addTo(map);
            }
            console.log('[DEBUG] miniPolyline exists?', !!polylineRef.current);
        } 
        else {
            if (polylineRef.current) {
                map.removeLayer(polylineRef.current);
                polylineRef.current = null;
            }
        }
    }, [routeCoords, useDarkTheme, map]);

    return null;
};

const STADIA_API_KEY = 'a09f6dcb-e401-4de9-9609-c4ab6ae1da10';
const MAPTILER_API_KEY = 'T3ITqSa4x2w9qQOiIENK';

// Main MiniMap component
const MiniMap = ({ isVisible, top, right, size, zoom, fadeStart, fadeEnd, onClick, uiScale }: {
    isVisible: boolean;
    top: number;
    right: number;
    size: number;
    zoom: number;
    fadeStart: number;
    fadeEnd: number;
    onClick: (e: React.MouseEvent) => void;
    uiScale: number;
}) => {
  const { isNight, useDarkTheme } = useWeather();
  const { position, bearing } = useTelemetryData();
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
      if (markerRef.current) {
          markerRef.current.setIcon(createVehicleIcon(bearing));
      }
  }, [bearing]);

  const containerStyle = useMemo(() => {
    const maskImage = `radial-gradient(circle, rgba(0,0,0,1) ${fadeStart}%, rgba(0,0,0,0) ${fadeEnd}%)`;
    return {
      top: `${(top) / 16}rem`,
      right: `${(right) / 16}rem`,
      width: `${(size) / 16}rem`,
      height: `${(size) / 16}rem`,
      maskImage: maskImage,
      WebkitMaskImage: maskImage,
      '--minimap-scale': uiScale,
    } as React.CSSProperties;
  }, [top, right, size, fadeStart, fadeEnd, uiScale]);

  const fallbackPosition = useMemo(() => {
    try {
      const saved = localStorage.getItem('last_known_gps_position');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { lat: 41.9028, lng: 12.4964 };
  }, []);

  const activePosition = position || fallbackPosition;
  
  const defaultTile = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${STADIA_API_KEY}`;
  const tileUrl = (isNight 
    ? `https://api.maptiler.com/maps/darkmatter/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`
    : (useDarkTheme 
        ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${STADIA_API_KEY}`
        : `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key=${STADIA_API_KEY}`)) || defaultTile;

  const AnyMapContainer = MapContainer as any;
  const AnyMarker = Marker as any;
  const AnyTileLayer = TileLayer as any;

  return (
    <div 
      className={`minimap-container ${isVisible ? 'visible' : ''}`}
      style={containerStyle}
      onClick={onClick}
    >
      <AnyMapContainer
        center={[activePosition.lat, activePosition.lng]}
        zoom={zoom}
        className="minimap-leaflet"
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        keyboard={false}
      >
        <AnyTileLayer
          key={tileUrl}
          url={tileUrl}
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={19}
        />
        {activePosition && (
            // @ts-ignore
            <AnyMarker
              ref={markerRef}
              position={[activePosition.lat, activePosition.lng]}
              icon={createVehicleIcon(bearing)}
            />
        )}
        <RouteManager useDarkTheme={useDarkTheme} />
        {activePosition && <MapUpdater position={activePosition} zoom={zoom} isVisible={isVisible} />}
      </AnyMapContainer>
    </div>
  );
};

export default MiniMap;