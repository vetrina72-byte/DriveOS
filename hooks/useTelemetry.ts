import { useState, useEffect } from 'react';
import { TelemetryStore } from '../context/TelemetryStore';

export function useTelemetryData() {
  const [data, setData] = useState({
    position: TelemetryStore.position,
    bearing: TelemetryStore.bearing,
    simulatedRemainingDistance: TelemetryStore.simulatedRemainingDistance,
    gpsState: TelemetryStore.gpsState
  });

  useEffect(() => {
    return TelemetryStore.subscribe(() => {
      setData({
        position: TelemetryStore.position,
        bearing: TelemetryStore.bearing,
        simulatedRemainingDistance: TelemetryStore.simulatedRemainingDistance,
        gpsState: TelemetryStore.gpsState
      });
    });
  }, []);

  return data;
}
