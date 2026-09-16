import re

with open("components/MapsContainer.tsx", "r") as f:
    content = f.read()

# Add VITE_MAPBOX_TOKEN usage
imports = """import { globalSearchService } from '../services/SearchService';"""
# wait, it's already using some things. Let's just use `import.meta.env.VITE_MAPBOX_TOKEN` directly.

fetch_route_new = """  // Fetch travel route vectors using Mapbox or OSM open API OSRM services
  const fetchRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (!start || !end) return;
    const currentId = activeFetchIdRef.current;
    
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    let url = '';
    if (mapboxToken) {
        url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.lng},${start.lat};${end.lng},${end.lat}?alternatives=true&geometries=geojson&steps=true&overview=full&access_token=${mapboxToken}`;
    } else {
        url = `${OSRM_URL}${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true&annotations=false&alternatives=true`;
    }
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (activeFetchIdRef.current !== currentId) return; // Discard stale fetch promises

      if (!data.routes || !data.routes.length) throw new Error('Route empty');
      
      setRoutes(data.routes);
      setSelectedRouteIndex(0);
      applyRoute(data.routes, 0);

    } else {
      devCntRef.current = 0;
    }
  }, [updateHUD]); // Will manually adjust dependencies later if needed

  const applyRoute = useCallback((allRoutes: any[], index: number) => {
      const route = allRoutes[index];
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

      if (mapRef.current && mapRef.current.getSource('routes-source')) {
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
      }

      if (mapRef.current && !navingRef.current && !isRoutePreviewRef.current) {
        setIsRoutePreview(true);
        isRoutePreviewRef.current = true;
        
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
        mapRef.current.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: { top: 80, bottom: 250, left: 40, right: 40 }, duration: 1000, pitch: 0 }
        );
      }
  }, [updateHUD]);
"""

# Now we need to replace the fetchRoute definition.
start_idx = content.find("  const fetchRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {")
end_idx = content.find("  // Clears route visualization and resets mapping state", start_idx)

content = content[:start_idx] + fetch_route_new + "\n" + content[end_idx:]

with open("components/MapsContainer.tsx", "w") as f:
    f.write(content)
