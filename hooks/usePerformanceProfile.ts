import { useState, useEffect } from 'react';
import { performanceManager, PerformanceSettings } from '../lib/performanceProfile';

export function usePerformanceProfile(): PerformanceSettings {
  const [settings, setSettings] = useState<PerformanceSettings>(() => performanceManager.getSettings());

  useEffect(() => {
    const unsubscribe = performanceManager.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    return unsubscribe;
  }, []);

  return settings;
}
