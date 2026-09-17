const DEFAULT_COORDS = { lat: 41.9028, lng: 12.4964 }; // Roma, Italia

const getInitialPosition = (): { lat: number; lng: number } => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('last_known_gps_position');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
  }
  return DEFAULT_COORDS;
};

export const TelemetryStore = {
  position: getInitialPosition() as {lat: number, lng: number} | null,
  bearing: 0,
  speed: 0,
  simulatedRemainingDistance: null as number | null,
  gpsState: 'acquiring' as 'acquiring' | 'available' | 'unavailable' | 'error',
  
  listeners: new Set<() => void>(),
  
  _watchId: null as number | null,
  _started: false,
  _lastGpsTime: 0,
  _highAccuracyFailed: false,

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    if (!this._started) {
      this.startGps();
    }
    return () => {
      this.listeners.delete(listener);
    };
  },

  startGps() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.gpsState = 'unavailable';
      this.notify();
      return;
    }

    if (this._started && this._watchId !== null) return;
    this._started = true;
    this.gpsState = 'acquiring';
    this.notify();

    this._startWatcher(!this._highAccuracyFailed);
  },

  _startWatcher(highAccuracy: boolean) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }

    const handlePos = (pos: GeolocationPosition) => {
      const { latitude, longitude, heading, speed } = pos.coords;
      const newPos = { lat: latitude, lng: longitude };
      this.position = newPos;
      if (speed !== null && speed >= 0) this.speed = speed;
      
      this.gpsState = 'available';
      this._lastGpsTime = Date.now();

      try {
        localStorage.setItem('last_known_gps_position', JSON.stringify(newPos));
      } catch (e) {}
      
      if (heading !== null && heading !== undefined && !isNaN(heading)) {
        let prevBearing = this.bearing;
        let diff = heading - prevBearing;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        this.bearing = (prevBearing + diff * 0.3 + 360) % 360;
      }
      this.notify();
    };

    const handleError = (error: GeolocationPositionError) => {
      // If high accuracy timed out or is unavailable, smoothly fallback to standard accuracy
      if (highAccuracy && (error.code === 3 || error.code === 2)) {
        this._highAccuracyFailed = true;
        this.gpsState = 'unavailable';
        this.notify();
        // Retry with standard low-power/network accuracy
        setTimeout(() => {
          if (this._started) {
            this._startWatcher(false);
          }
        }, 1000);
        return;
      }

      // If standard accuracy also timed out or failed, maintain last known/default coordinates
      this.gpsState = error.code === 1 ? 'error' : 'unavailable';
      this.notify();
    };

    try {
      this._watchId = navigator.geolocation.watchPosition(
        handlePos, 
        handleError,
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 12000 : 20000,
          maximumAge: 15000
        }
      );
    } catch (e) {
      this.gpsState = 'unavailable';
      this.notify();
    }
  },

  stopGps() {
    if (this._watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    this._started = false;
  },

  setPosition(pos: {lat: number, lng: number}) {
    this.position = pos;
    this.notify();
  },

  setBearing(b: number) {
    this.bearing = b;
    this.notify();
  },

  setSimulatedRemainingDistance(dist: number | null) {
    this.simulatedRemainingDistance = dist;
    this.notify();
  },

  notify() {
    this.listeners.forEach(l => l());
  }
};
