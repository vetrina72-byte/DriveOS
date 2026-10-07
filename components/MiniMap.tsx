import React, { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { routeStore } from './routeStore';
import { useWeather } from '../context/WeatherContext';
import { useTelemetryData } from '../hooks/useTelemetry';
import { buildMapStyle } from './MapEngineUtils';

interface MiniMapProps {
  isVisible: boolean;
  top: number;
  right: number;
  size: number;
  zoom: number;
  fadeStart: number;
  fadeEnd: number;
  onClick: (e: React.MouseEvent) => void;
  uiScale: number;
}

const MiniMap: React.FC<MiniMapProps> = ({
  isVisible,
  top,
  right,
  size,
  zoom = 15.5,
  fadeStart,
  fadeEnd,
  onClick,
  uiScale = 1.0,
}) => {
  const { useDarkTheme: isNight } = useWeather();
  const { position, bearing = 0 } = useTelemetryData();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isLoadedRef = useRef(false);

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
    return { lat: 37.986, lng: 13.696 }; // Termini Imerese default GPS
  }, []);

  const activePosition = position || fallbackPosition;

  const containerStyle = useMemo(() => {
    const maskImage = `radial-gradient(circle, rgba(0,0,0,1) ${fadeStart}%, rgba(0,0,0,0) ${fadeEnd}%)`;
    return {
      top: `${top / 16}rem`,
      right: `${right / 16}rem`,
      width: `${size / 16}rem`,
      height: `${size / 16}rem`,
      maskImage: maskImage,
      WebkitMaskImage: maskImage,
      '--minimap-scale': uiScale,
    } as React.CSSProperties;
  }, [top, right, size, fadeStart, fadeEnd, uiScale]);

  // Setup MapLibre layers for route and vehicle arrow
  const setupLayers = (map: maplibregl.Map) => {
    // Add vehicle arrow icon if not already added
    if (!map.hasImage('mini-vehicle-arrow')) {
      const svgStr = `<svg viewBox="0 0 136 157" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M67.2527 133.236C48.0527 142.429 35.7661 148.385 30.3927 151.105C24.0261 154.332 19.4794 155.969 16.7527 156.016C7.57275 156.176 -0.167252 149.065 0.00274828 139.505C0.049415 136.972 0.929414 133.932 2.64275 130.385C2.74275 130.179 19.7728 89.8788 53.7327 9.48549C55.9727 4.18549 62.0127 0.255494 68.0127 0.015494C72.7061 -0.171173 76.7961 1.32883 80.2827 4.5155C82.2294 6.28883 84.3127 10.1555 86.5327 16.1155C86.7327 16.6622 101.709 53.0122 131.463 125.165C134.573 132.695 136.853 136.385 135.643 142.335C133.973 150.545 126.603 155.686 118.433 155.406C116.119 155.326 113.013 154.309 109.113 152.355C107.379 151.495 94.0027 145.119 68.9827 133.225C68.7107 133.098 68.4141 133.032 68.1146 133.034C67.8152 133.036 67.5207 133.104 67.2527 133.236ZM68.1628 123.925L88.3528 133.546C97.2594 137.846 106.299 142.145 115.473 146.445C120.783 148.935 127.443 146.005 127.953 139.965C128.059 138.719 127.489 136.579 126.243 133.546C117.516 112.299 108.786 91.1022 100.053 69.9555L80.5428 22.6755C79.5894 20.2888 78.6094 17.8855 77.6028 15.4655C76.4028 12.5855 75.3894 10.7855 74.5627 10.0655C71.2227 7.19549 66.1327 7.3655 62.8627 10.2155C61.9361 11.0155 60.9027 12.8388 59.7627 15.6855C59.1627 17.1988 42.4261 56.8355 9.55275 134.596C8.42608 137.256 7.89608 139.182 7.96275 140.376C8.19275 144.786 12.2027 148.045 16.4627 147.995C17.7227 147.982 19.7528 147.299 22.5528 145.945C37.7994 138.552 53.0028 131.212 68.1628 123.925Z" fill="white" /><path d="M80.5426 22.6756L68.5026 48.1156C68.3776 48.3788 68.3127 48.6691 68.3126 48.9656L68.1626 123.926C53.0026 131.212 37.7993 138.552 22.5526 145.946C19.7526 147.299 17.7226 147.982 16.4626 147.996C12.2026 148.046 8.19262 144.786 7.96262 140.376C7.89595 139.182 8.42596 137.256 9.55262 134.596C42.426 56.8356 59.1626 17.1989 59.7626 15.6856C60.9026 12.8389 61.936 11.0156 62.8626 10.2156C66.1326 7.36557 71.2226 7.19557 74.5626 10.0656C75.3893 10.7856 76.4026 12.5856 77.6026 15.4656C78.6093 17.8856 79.5893 20.2889 80.5426 22.6756Z" fill="#FF3A3A" /><path d="M100.053 69.9558C108.786 91.1024 117.516 112.299 126.242 133.546C127.489 136.579 128.059 138.719 127.952 139.966C127.442 146.005 120.783 148.936 115.473 146.446C106.299 142.146 97.2592 137.846 88.3525 133.546L68.1621 123.926L68.3125 48.9656C68.3126 48.6692 68.378 48.3791 68.5029 48.116L80.543 22.6755L100.053 69.9558Z" fill="#FF3A3A" /></svg>`;
      const img = new Image(136, 157);
      img.onload = () => {
        if (map && !map.hasImage('mini-vehicle-arrow')) {
          map.addImage('mini-vehicle-arrow', img);
        }
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    }

    // Active Route Polyline Layer
    if (!map.getSource('mini-route-source')) {
      const initialCoords = routeStore.getCoords() || [];
      const lineCoords = initialCoords.map(([lat, lng]) => [lng, lat]);

      map.addSource('mini-route-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: lineCoords
          },
          properties: {}
        }
      });

      map.addLayer({
        id: 'mini-route-casing',
        type: 'line',
        source: 'mini-route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#002B66',
          'line-width': 7,
          'line-opacity': 0.7
        }
      });

      map.addLayer({
        id: 'mini-route-line',
        type: 'line',
        source: 'mini-route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': isNight ? '#38BDF8' : '#2563EB',
          'line-width': 4.5,
          'line-opacity': 0.95
        }
      });
    }

    // Proportional Vehicle Indicator Layer
    if (!map.getSource('mini-vehicle-source')) {
      map.addSource('mini-vehicle-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [activePosition.lng, activePosition.lat]
            },
            properties: { bearing: bearing || 0 }
          }]
        }
      });

      map.addLayer({
        id: 'mini-vehicle-layer',
        type: 'symbol',
        source: 'mini-vehicle-source',
        layout: {
          'icon-image': 'mini-vehicle-arrow',
          'icon-size': 0.144,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'map',
          'icon-rotate': ['get', 'bearing'],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': 1,
          'icon-halo-color': 'rgba(0,0,0,0.5)',
          'icon-halo-width': 2,
          'icon-halo-blur': 1
        }
      });
    }
  };

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const styleUrl = buildMapStyle(isNight ? 'dark' : 'light');

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: [activePosition.lng, activePosition.lat],
      zoom: zoom,
      pitch: 0,
      bearing: bearing || 0,
      interactive: false,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      isLoadedRef.current = true;
      setupLayers(map);
    });

    map.on('style.load', () => {
      setupLayers(map);
    });

    return () => {
      isLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update theme style dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const styleUrl = buildMapStyle(isNight ? 'dark' : 'light');
    map.setStyle(styleUrl);
  }, [isNight]);

  const [isInteracting, setIsInteracting] = React.useState(false);

  useEffect(() => {
    const handleCanvasInteracting = (e: any) => {
      setIsInteracting(Boolean(e.detail));
    };
    window.addEventListener('canvas-interacting', handleCanvasInteracting, { passive: true });
    return () => window.removeEventListener('canvas-interacting', handleCanvasInteracting);
  }, []);

  const effectivelyVisible = isVisible && !isInteracting;

  // Update vehicle position, bearing, and camera smoothly only when visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !effectivelyVisible) return;

    // Update vehicle marker GeoJSON source
    const vehicleSource = map.getSource('mini-vehicle-source') as maplibregl.GeoJSONSource | undefined;
    if (vehicleSource) {
      vehicleSource.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [activePosition.lng, activePosition.lat]
          },
          properties: { bearing: bearing || 0 }
        }]
      });
    }

    // Ease camera smoothly to match position and rotation
    map.easeTo({
      center: [activePosition.lng, activePosition.lat],
      bearing: bearing || 0,
      duration: 350,
      easing: (t) => t
    });
  }, [activePosition.lat, activePosition.lng, bearing, effectivelyVisible]);

  // Sync route polyline from routeStore
  useEffect(() => {
    const unsubscribe = routeStore.subscribe((coords) => {
      const map = mapRef.current;
      if (!map) return;

      const routeSource = map.getSource('mini-route-source') as maplibregl.GeoJSONSource | undefined;
      if (routeSource) {
        const lineCoords = (coords || []).map(([lat, lng]) => [lng, lat]);
        routeSource.setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: lineCoords
          },
          properties: {}
        });
      }
    });

    return unsubscribe;
  }, []);

  // Resize and sync center when visibility toggles
  useEffect(() => {
    if (effectivelyVisible && mapRef.current) {
      mapRef.current.resize();
      mapRef.current.jumpTo({
        center: [activePosition.lng, activePosition.lat],
        bearing: bearing || 0
      });
    }
  }, [effectivelyVisible]);

  return (
    <div
      className={`minimap-container ${effectivelyVisible ? 'visible' : ''}`}
      style={containerStyle}
      onClick={onClick}
    >
      <div
        ref={mapContainerRef}
        className="w-full h-full [&_.maplibregl-ctrl-logo]:!hidden [&_.maplibregl-ctrl-attrib]:!hidden pointer-events-none"
      />
    </div>
  );
};

export default React.memo(MiniMap);
