import React, { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { routeStore } from './routeStore';
import VehicleArrowIcon from './VehicleArrowIcon';
import { useNavigation } from '../context/NavigationContext';
import { useWeather } from '../context/WeatherContext';

// Patch difensiva per prevenire loop infiniti (TypeError: replace of undefined) nel caricamento tile (loadTile / Yg.url)
const originalTemplate = L.Util.template;
L.Util.template = function (str: any, data: any) {
  if (typeof str !== 'string') {
    return '';
  }
  return originalTemplate(str, data);
};

// Function to create a leaflet icon from the React component - UPDATED
const createVehicleIcon = (bearing: number): L.DivIcon => {
  return L.divIcon({
    html: renderToStaticMarkup(<VehicleArrowIcon size={52} bearing={bearing} className="transition-transform duration-200 linear" />),
    className: 'vehicle-marker-icon', // custom class for transparent background
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
};

// Component to programmatically update map view without user interaction
const MapUpdater = ({ position, zoom }: { position: { lat: number; lng: number }, zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        if (position) {
            // Smoothly pan to the new position and set zoom
            map.setView([position.lat, position.lng], zoom, {
                animate: true,
                duration: 1,
                noMoveStart: true // Prevents firing 'movestart' which could have side-effects
            });
        }
    }, [position, zoom, map]);
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
  const { currentPosition: position, bearing } = useNavigation();
  const { isNight, useDarkTheme } = useWeather();
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

  if (!position) {
      return null;
  }
  
  const tileUrl = isNight 
    ? `https://api.maptiler.com/maps/darkmatter/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`
    : (useDarkTheme 
        ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${STADIA_API_KEY}`
        : `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key=${STADIA_API_KEY}`);

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
        center={[position.lat, position.lng]}
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
        {position && (
            // @ts-ignore
            <AnyMarker
              ref={markerRef}
              position={[position.lat, position.lng]}
              icon={createVehicleIcon(bearing)}
            />
        )}
        <RouteManager useDarkTheme={useDarkTheme} />
        {position && <MapUpdater position={position} zoom={zoom} />}
      </AnyMapContainer>
    </div>
  );
};

export default MiniMap;