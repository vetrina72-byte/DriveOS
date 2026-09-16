import re

with open("components/MapsContainer.tsx", "r") as f:
    content = f.read()

funcs = """
  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  const isRoutePreviewRef = useRef(false);
  const startTrackTimerRef = useRef<any>(null);
  const isPendingStartRef = useRef(false);

  const startTracking = useCallback(() => {
    isPendingStartRef.current = true;
    startTrackTimerRef.current = setTimeout(() => {
      setNaving(true);
      navingRef.current = true;
      isRoutePreviewRef.current = false;
      setIsRoutePreview(false);
      isPendingStartRef.current = false;
      cmodeRef.current = 'heading-up';
      setCmode('heading-up');
    }, 100);
  }, []);

  const setDest = useCallback((coords: { lat: number; lng: number }, name: string) => {
    destRef.current = coords;
    setDestinationName(name);
    if (mapRef.current && destMarkRef.current) {
        destMarkRef.current.setLngLat([coords.lng, coords.lat]);
    }
    const start = tgtRef.current || rposRef.current;
    if (start) {
      fetchRoute(start, coords);
    } else {
      pendDestRef.current = { coords, name };
    }
  }, [fetchRoute]);
"""

# Insert right before `clearRoute`
content = content.replace("  // Clears route visualization and resets mapping state", funcs + "\n  // Clears route visualization and resets mapping state")

with open("components/MapsContainer.tsx", "w") as f:
    f.write(content)
