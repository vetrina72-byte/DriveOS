import React, { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { routeStore } from './routeStore';
import VehicleArrowIcon from './VehicleArrowIcon';

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
const MiniMap = ({ isVisible, position, bearing, top, right, size, zoom, fadeStart, fadeEnd, isNight, useDarkTheme, onClick }: {
    isVisible: boolean;
    position: { lat: number; lng: number } | null;
    bearing: number;
    top: number;
    right: number;
    size: number;
    zoom: number;
    fadeStart: number;
    fadeEnd: number;
    isNight: boolean;
    useDarkTheme: boolean;
    onClick: (e: React.MouseEvent) => void;
}) => {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
      if (markerRef.current) {
          markerRef.current.setIcon(createVehicleIcon(bearing));
      }
  }, [bearing]);

  const containerStyle = useMemo(() => {
    const maskImage = `radial-gradient(circle, rgba(0,0,0,1) ${fadeStart}%, rgba(0,0,0,0) ${fadeEnd}%)`;
    return {
      top: `${top}px`,
      right: `${right}px`,
      width: `${size}px`,
      height: `${size}px`,
      maskImage: maskImage,
      WebkitMaskImage: maskImage,
    };
  }, [top, right, size, fadeStart, fadeEnd]);

  if (!position) {
      return null;
  }
  
  const nightThemeProps = {
    url: `https://api.maptiler.com/maps/darkmatter/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`,
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
  };

  const darkThemeProps = {
    url: `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`,
  };

  const lightThemeProps = {
    url: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`,
  };

  const themeProps = isNight ? nightThemeProps : (useDarkTheme ? darkThemeProps : lightThemeProps);

  return (
    <div 
      className={`minimap-container ${isVisible ? 'visible' : ''}`}
      style={containerStyle}
      onClick={onClick}
    >
      <MapContainer
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
        <TileLayer
            key={themeProps.url}
            {...themeProps}
        />
        {position && (
            <Marker
              ref={markerRef}
              position={[position.lat, position.lng]}
              icon={createVehicleIcon(bearing)}
            />
        )}
        <RouteManager useDarkTheme={useDarkTheme} />
        {position && <MapUpdater position={position} zoom={zoom} />}
      </MapContainer>
    </div>
  );
};

export default MiniMap;