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
      const svgStr = `<svg viewBox="227 429 960 960" xmlns="http://www.w3.org/2000/svg"><path fill="#FDFCFC" d="M639.979065,551.815125 C645.168152,540.088928 650.026184,528.629089 655.273071,517.350159 C668.813538,488.243103 708.591675,477.322784 735.566650,494.553101 C749.156494,503.233704 756.313721,515.993591 762.405273,530.085083 C787.421509,587.954773 812.641113,645.736633 837.759827,703.562134 C862.019897,759.411072 886.220703,815.285706 910.497864,871.127136 C934.243469,925.745850 958.087769,980.321533 981.824341,1034.944092 C1007.415466,1093.834229 1032.934204,1152.755859 1058.479614,1211.665894 C1065.145508,1227.038086 1072.164307,1242.270264 1078.359985,1257.829956 C1086.983032,1279.485596 1080.075684,1304.759277 1061.833496,1320.765991 C1044.998657,1335.537842 1018.689575,1338.636230 998.807922,1327.514404 C973.012146,1313.083984 947.494507,1298.156738 921.845398,1283.463745 C896.915344,1269.182495 871.943359,1254.974487 847.039307,1240.648193 C818.390015,1224.167480 789.808044,1207.569946 761.171631,1191.066895 C743.616943,1180.949951 726.045654,1170.860352 708.373291,1160.952148 C707.027161,1160.197388 704.456543,1160.359009 703.057556,1161.154419 C677.210327,1175.849976 651.469910,1190.733276 625.675842,1205.522827 C600.896851,1219.730347 576.053467,1233.825806 551.291382,1248.062500 C526.381775,1262.384155 501.560059,1276.858398 476.657715,1291.192383 C455.215363,1303.535034 433.836731,1315.996338 412.205383,1328.000488 C388.054901,1341.402466 353.937225,1332.084717 339.430542,1308.918579 C327.287811,1289.527344 327.550873,1270.051636 336.589294,1249.539062 C360.004272,1196.398804 382.947418,1143.050781 406.116211,1089.801880 C430.474152,1033.819946 454.903503,977.869019 479.249084,921.881653 C499.687012,874.880615 520.035400,827.840698 540.448792,780.828918 C568.990845,715.096863 597.555237,649.374451 626.113342,583.649353 C630.675232,573.150452 635.254150,562.658875 639.979065,551.815125z"/><path fill="#F53C3F" d="M707.985596,1098.275757 C688.642273,1109.299561 669.273499,1120.278809 649.961304,1131.356812 C616.268066,1150.684448 582.601135,1170.058105 548.939514,1189.440918 C526.323425,1202.463379 503.680634,1215.440674 481.153290,1228.615234 C464.812622,1238.171875 442.888977,1236.842773 429.660736,1225.171021 C413.332520,1210.763794 408.560883,1191.014648 416.835876,1171.967651 C458.874298,1075.205688 500.913940,978.444153 542.963440,881.686951 C583.817871,787.679565 624.699951,693.684204 665.529053,599.665771 C671.380615,586.191162 681.000549,576.917969 695.215637,572.960754 C698.969604,571.915771 703.108154,572.252441 707.527222,572.474731 C707.984741,748.088440 707.985168,923.182068 707.985596,1098.275757z"/><path fill="#F56568" d="M708.263672,1098.452148 C707.985168,923.182068 707.984741,748.088440 707.981567,572.530945 C723.690674,570.855591 740.974609,582.015869 748.093933,598.283508 C762.495178,631.190430 776.757996,664.157898 791.081543,697.098694 C823.043579,770.604004 855.015137,844.105225 886.968018,917.614563 C899.828613,947.201050 912.631531,976.812622 925.493591,1006.398438 C949.338867,1061.248291 973.180847,1116.099487 997.079346,1170.926025 C1008.930359,1198.113892 994.624023,1227.342163 966.153687,1233.567993 C952.263794,1236.605469 940.130798,1231.951416 928.216003,1225.023193 C880.917236,1197.519775 833.427551,1170.344727 785.995544,1143.070557 C760.191284,1128.232910 734.360596,1113.440918 708.263672,1098.452148z"/></svg>`;
      const img = new Image(128, 128);
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
          'icon-size': 0.207,
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

  // Update vehicle position, bearing, and camera smoothly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
  }, [activePosition.lat, activePosition.lng, bearing]);

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

  const [isInteracting, setIsInteracting] = React.useState(false);

  useEffect(() => {
    const handleCanvasInteracting = (e: any) => {
      setIsInteracting(Boolean(e.detail));
    };
    window.addEventListener('canvas-interacting', handleCanvasInteracting, { passive: true });
    return () => window.removeEventListener('canvas-interacting', handleCanvasInteracting);
  }, []);

  const effectivelyVisible = isVisible && !isInteracting;

  // Resize when visibility toggles
  useEffect(() => {
    if (effectivelyVisible && mapRef.current) {
      mapRef.current.resize();
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
