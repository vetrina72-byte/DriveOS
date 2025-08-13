import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';

// Marker SVG as a React component
const VehicleMarkerIcon = ({ bearing }: { bearing: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="28"
    height="28"
    style={{ transform: `rotate(${bearing}deg)`, transition: 'transform 0.2s linear', transformOrigin: 'center' }}
  >
    <defs>
        <filter id="marker-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
    </defs>
    <path 
        d="M12 2L4.5 20.5L12 17L19.5 20.5L12 2Z" 
        fill="#EF4444" 
        stroke="#FFFFFF" 
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#marker-glow)"
    />
  </svg>
);

// Function to create a leaflet icon from the React component
const createVehicleIcon = (bearing: number): L.DivIcon => {
  return L.divIcon({
    html: renderToStaticMarkup(<VehicleMarkerIcon bearing={bearing} />),
    className: 'vehicle-marker-icon', // custom class for transparent background
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

const STADIA_API_KEY = 'a09f6dcb-e401-4de9-9609-c4ab6ae1da10';

// Main MiniMap component
const MiniMap = ({ isVisible, position, bearing, top, right, size, zoom, fadeStart, fadeEnd, isNight, onClick }: {
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
    onClick: (e: React.MouseEvent) => void;
}) => {
  const markerRef = useRef<L.Marker>(null);

  // Update the marker's icon (and thus rotation) whenever bearing changes
  useEffect(() => {
      if (markerRef.current) {
          markerRef.current.setIcon(createVehicleIcon(bearing));
      }
  }, [bearing]);

  const containerStyle = useMemo(() => {
    // The mask creates a soft-edged circle. It fades from fully opaque in the center
    // to fully transparent at the edge. The fadeStart and fadeEnd props control
    // where this transition happens.
    const maskImage = `radial-gradient(circle, rgba(0,0,0,1) ${fadeStart}%, rgba(0,0,0,0) ${fadeEnd}%)`;

    return {
      top: `${top}px`,
      right: `${right}px`,
      width: `${size}px`,
      height: `${size}px`,
      maskImage: maskImage,
      WebkitMaskImage: maskImage, // For Safari compatibility
    };
  }, [top, right, size, fadeStart, fadeEnd]);

  // Don't render anything if we don't have a position yet
  if (!position) {
      return null;
  }

  // Use CARTO "dark_all" for night and Stadia "alidade_smooth" for day.
  const lightThemeProps = {
    url: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`,
  };

  const darkThemeProps = {
    url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`,
    subdomains: 'abcd',
  };

  const themeProps = isNight ? darkThemeProps : lightThemeProps;

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
        {position && <MapUpdater position={position} zoom={zoom} />}
      </MapContainer>
    </div>
  );
};

export default MiniMap;
