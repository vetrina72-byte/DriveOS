import { useState, useEffect } from 'react';
import { TelemetryStore } from '../context/TelemetryStore';

export function useTelemetryData() {
  const [data, setData] = useState({
    position: TelemetryStore.position,
    bearing: TelemetryStore.bearing,
    simulatedRemainingDistance: TelemetryStore.simulatedRemainingDistance
  });

  useEffect(() => {
    return TelemetryStore.subscribe(() => {
      setData({
        position: TelemetryStore.position,
        bearing: TelemetryStore.bearing,
        simulatedRemainingDistance: TelemetryStore.simulatedRemainingDistance
      });
    });
  }, []);

  return data;
}
