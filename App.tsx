



import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VehicleProvider } from './context/VehicleContext';
import VehicleCanvas, { SceneConfig } from './components/VehicleCanvas';
import { ICONS } from './constants';
import SpotifyPlayer from './components/SpotifyPlayer';
import MapsContainer from './components/MapsContainer';
import AppLauncher from './components/AppLauncher';
import TopStatusBar from './components/TopStatusBar';
import WeatherModal from './components/WeatherModal';
import DebugControls from './components/DebugControls';
import MiniMap from './components/MiniMap';
import { WeatherData, TempUnit } from './types';
import { HOT_TEMP, COLD_TEMP } from './components/WeatherIcon';
import SpotifyCallback from './components/SpotifyCallback';

const DockButton = ({ icon: Icon, onClick, label, colorClasses = 'text-gray-400 hover:text-white' }: { 
  icon: React.ComponentType<any>, 
  onClick: (e: React.MouseEvent) => void, 
  label: string, 
  colorClasses?: string 
}) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-24 h-full transition-colors ${colorClasses}`} aria-label={label}>
    <Icon className="w-8 h-8" />
  </button>
);

// Helper Functions for weather data processing
const degToCompass = (num: number) => {
    const val = Math.floor((num / 45) + 0.5);
    const arr = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
    return arr[(val % 8)];
};
const timestampToHHMM = (ts: number) => {
    const date = new Date(ts * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const wmoCodeToCondition = (code: number): string => {
    const mapping: { [key: number]: string } = {
        0: 'Cielo sereno',
        1: 'Prevalentemente sereno',
        2: 'Parzialmente nuvoloso',
        3: 'Coperto',
        45: 'Nebbia',
        48: 'Nebbia',
        51: 'Pioggerella',
        53: 'Pioggerella',
        55: 'Pioggerella',
        56: 'Pioggerella gelata',
        57: 'Pioggerella gelata',
        61: 'Pioggia leggera',
        63: 'Pioggia',
        65: 'Pioggia forte',
        66: 'Pioggia gelata',
        67: 'Pioggia gelata',
        71: 'Neve leggera',
        73: 'Neve',
        75: 'Neve forte',
        77: 'Grandine',
        80: 'Rovescio',
        81: 'Rovescio',
        82: 'Rovescio',
        85: 'Rovescio di neve',
        86: 'Rovescio di neve',
        95: 'Temporale',
        96: 'Temporale con grandine',
        99: 'Temporale con grandine',
    };
    return mapping[code] ?? 'Nuvoloso';
};


type WeatherStatus = 'idle' | 'locating' | 'fetching' | 'success' | 'error';

const initialAppOpenConfig: SceneConfig = {
  cameraPos: { x: 1.38, y: 1.31, z: 3.78 },
  cameraTarget: { x: 0.60, y: 0.00, z: 0.65 },
  modelPos: { x: -4.76, y: -1.00, z: 1.47 },
  modelRot: { x: 0, y: -0.09, z: 0.0 },
  modelScale: 0.74,
};

export default function App() {
  // Simple routing based on URL path for the Spotify callback
  if (window.location.pathname === '/spotify-callback') {
    return <SpotifyCallback />;
  }

  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  const [isWeatherModalOpen, setWeatherModalOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('idle');
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugTimeOverride, setDebugTimeOverride] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sunsetArrowYPosition, setSunsetArrowYPosition] = useState(1);
  const [sunriseArrowYPosition, setSunriseArrowYPosition] = useState(5);
  const [debugWeatherCondition, setDebugWeatherCondition] = useState<string | null>(null);
  const [tempUnit, setTempUnit] = useState<TempUnit>('C');
  const [topBarScale, setTopBarScale] = useState(1.20);
  const [topBarOffsetY, setTopBarOffsetY] = useState(-7);
  const [mapsSearchPanelWidth, setMapsSearchPanelWidth] = useState(401);
  const [mapsSearchPanelTop, setMapsSearchPanelTop] = useState(61);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [bearing, setBearing] = useState(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const [miniMapTop, setMiniMapTop] = useState(-57);
  const [miniMapRight, setMiniMapRight] = useState(-86);
  const [miniMapSize, setMiniMapSize] = useState(456);
  const [miniMapZoom, setMiniMapZoom] = useState(17);
  const [miniMapFadeStart, setMiniMapFadeStart] = useState(0);
  const [miniMapFadeEnd, setMiniMapFadeEnd] = useState(69);

  const [minOrbitDistance, setMinOrbitDistance] = useState(9.5);
  const [maxOrbitDistance, setMaxOrbitDistance] = useState(18);

  const [appOpenConfig, setAppOpenConfig] = useState<SceneConfig>(initialAppOpenConfig);
  const [nightFloorDarkness, setNightFloorDarkness] = useState(-12);
  const [spotifyPlayerTop, setSpotifyPlayerTop] = useState(50);
  const [spotifyPlayerBottom, setSpotifyPlayerBottom] = useState(70);


  useEffect(() => {
    // This effect ensures the app's time updates every minute when not in debug mode.
    const intervalId = setInterval(() => {
        setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
      const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          const newPos = { lat: latitude, lng: longitude };
          
          setCurrentPosition(newPos);

          if (heading !== null && heading !== undefined) {
              setBearing(prevBearing => {
                  let diff = heading - prevBearing;
                  if (diff > 180) diff -= 360;
                  if (diff < -180) diff += 360;
                  return (prevBearing + diff * 0.3 + 360) % 360;
              });
          } else if (lastPositionRef.current && (Math.abs(lastPositionRef.current.lat - newPos.lat) > 0.00001 || Math.abs(lastPositionRef.current.lng - newPos.lng) > 0.00001)) {
              const newBearing = calculateBearing(lastPositionRef.current.lat, lastPositionRef.current.lng, newPos.lat, newPos.lng);
              setBearing(prevBearing => {
                  let diff = newBearing - prevBearing;
                  if (diff > 180) diff -= 360;
                  if (diff < -180) diff += 360;
                  return (prevBearing + diff * 0.3 + 360) % 360;
              });
          }
          lastPositionRef.current = newPos;
        },
        (error) => {
          console.warn("Geolocation watch error:", error.message);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
      
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const effectiveTime = useMemo(() => debugTimeOverride || currentTime, [debugTimeOverride, currentTime]);

  const { isNight, effectiveWeatherCondition, isHot, isCold } = useMemo(() => {
    const now = effectiveTime;
    let night: boolean;
    let condition: string;

    if (weatherData?.details?.sunrise && weatherData?.details?.sunset) {
        const sunriseDate = new Date(now.getTime());
        const sunsetDate = new Date(now.getTime());
        const [sr_h, sr_m] = weatherData.details.sunrise.split(':').map(Number);
        const [ss_h, ss_m] = weatherData.details.sunset.split(':').map(Number);
        sunriseDate.setHours(sr_h, sr_m, 0, 0);
        sunsetDate.setHours(ss_h, ss_m, 0, 0);

        night = now.getTime() < sunriseDate.getTime() || now.getTime() >= sunsetDate.getTime();

        const isCloudy = /nuvol|nebbia|coperto/i.test(weatherData.current.condition);
        
        if (now.getHours() === sunriseDate.getHours()) {
            condition = isCloudy ? 'Cloudy Sunrise' : 'Sunrise';
        } else if (now.getHours() === sunsetDate.getHours()) {
            condition = isCloudy ? 'Cloudy Sunset' : 'Sunset';
        } else {
            condition = weatherData.current.condition;
        }

    } else {
        // Fallback logic if no weather data is available
        const hour = now.getHours();
        const month = now.getMonth();
        const isSummer = month >= 3 && month <= 8;
        const sunriseHour = isSummer ? 6 : 7;
        const sunsetHour = isSummer ? 20 : 17;

        night = hour < sunriseHour || hour >= sunsetHour;
        condition = 'Nuvoloso'; // Fallback condition
    }
    
    const finalCondition = debugWeatherCondition || condition;

    const nowHourlyData = weatherData?.hourly.find(h => new Date(h.dt * 1000).getHours() === now.getHours());
    const currentTemp = nowHourlyData?.temperature ?? weatherData?.current.temperature ?? 20;

    const hot = currentTemp >= HOT_TEMP && !/nuvol|coperto|piogg|rovescio|nev|nebbia|temporale|grandin/i.test(finalCondition);
    const cold = currentTemp <= COLD_TEMP;

    return { 
        isNight: night, 
        effectiveWeatherCondition: finalCondition,
        isHot: hot,
        isCold: cold
    };
  }, [effectiveTime, weatherData, debugWeatherCondition]);

  const fetchWeatherData = useCallback(async (latitude: number, longitude: number) => {
      setWeatherStatus('fetching');
      setWeatherError(null);
      try {
          const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;
          const locationApiUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`;

          const [weatherResponse, locationResponse] = await Promise.all([
              fetch(weatherApiUrl),
              fetch(locationApiUrl)
          ]);

          if (!weatherResponse.ok) throw new Error('Failed to fetch weather data from Open-Meteo');
          if (!locationResponse.ok) throw new Error('Failed to fetch location data from Nominatim');

          const weatherApiData = await weatherResponse.json();
          const locationData = await locationResponse.json();
          
          if (weatherApiData.error) {
              throw new Error(`Open-Meteo Error: ${weatherApiData.reason}`);
          }

          const locationName = locationData.address?.city || locationData.address?.town || locationData.address?.village || locationData.address?.county || 'Current Location';

          const mappedData: Omit<WeatherData, 'lastUpdated'> = {
              locationName,
              current: {
                  temperature: Math.round(weatherApiData.current.temperature_2m),
                  condition: wmoCodeToCondition(weatherApiData.current.weather_code),
                  high: Math.round(weatherApiData.daily.temperature_2m_max[0]),
                  low: Math.round(weatherApiData.daily.temperature_2m_min[0]),
              },
              hourly: weatherApiData.hourly.time.map((isoTime: string, index: number) => ({
                  time: new Date(isoTime).getHours().toString().padStart(2, '0') + ':00',
                  dt: new Date(isoTime).getTime() / 1000,
                  temperature: Math.round(weatherApiData.hourly.temperature_2m[index]),
                  condition: wmoCodeToCondition(weatherApiData.hourly.weather_code[index]),
              })),
              details: {
                  chanceOfRain: Math.round(weatherApiData.current.precipitation_probability ?? 0),
                  humidity: Math.round(weatherApiData.current.relative_humidity_2m),
                  wind: `${Math.round(weatherApiData.current.wind_speed_10m)} km/h ${degToCompass(weatherApiData.current.wind_direction_10m)}`,
                  sunrise: timestampToHHMM(new Date(weatherApiData.daily.sunrise[0]).getTime() / 1000),
                  sunset: timestampToHHMM(new Date(weatherApiData.daily.sunset[0]).getTime() / 1000),
              }
          };
          
          setWeatherData({ ...mappedData, lastUpdated: new Date() });
          setWeatherStatus('success');

      } catch (error: any) {
          console.error("Error fetching weather data:", error);
          setWeatherError(error.message || "Impossibile recuperare i dati. Riprova più tardi.");
          setWeatherData(null);
          setWeatherStatus('error');
      }
  }, []);

  const requestWeather = useCallback(() => {
    setWeatherData(null); // Clear old data to prevent showing stale location
    setWeatherError(null);
    setWeatherStatus('locating');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (position.coords.accuracy > 1500) { // More than 1.5km is too inaccurate
                    console.warn(`Geolocation accuracy is poor: ${position.coords.accuracy}m. Required < 1500m.`);
                    setWeatherError("La posizione rilevata è troppo imprecisa. Prova a migliorare il segnale GPS o la connessione di rete.");
                    setWeatherStatus('error');
                    return;
                }
                fetchWeatherData(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.error("Geolocation error details:", `Code ${error.code}: ${error.message}`);
                
                let userMessage = "Impossibile ottenere la posizione.";
                switch (error.code) {
                    case 1: // PERMISSION_DENIED
                        userMessage = "Permesso di geolocalizzazione negato. Abilitalo nelle impostazioni del browser e ricarica.";
                        break;
                    case 2: // POSITION_UNAVAILABLE
                        userMessage = "Informazioni sulla posizione non disponibili. Controlla il segnale GPS o la connessione di rete.";
                        break;
                    case 3: // TIMEOUT
                        userMessage = "Timeout nel recupero della posizione. Riprova più tardi.";
                        break;
                }
                
                // Use the clear, translated message. Avoids showing technical details from `error.message`.
                setWeatherError(userMessage);
                setWeatherStatus('error');
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    } else {
        setWeatherError("La geolocalizzazione non è supportata da questo browser.");
        setWeatherStatus('error');
    }
  }, [fetchWeatherData]);

  // Fetch weather automatically on initial load and then periodically
  useEffect(() => {
    requestWeather(); // Initial fetch
    const intervalId = setInterval(requestWeather, 15 * 60 * 1000); // Refresh every 15 mins
    return () => clearInterval(intervalId);
  }, [requestWeather]);

  const handleWeatherClick = () => {
    setWeatherModalOpen(true);
    // Allow manual refresh if data is old, errored, or never loaded
    if (weatherStatus !== 'locating' && weatherStatus !== 'fetching') {
       if (!weatherData || (new Date().getTime() - weatherData.lastUpdated.getTime()) > 300000) { // 5 minutes cache
          requestWeather();
       }
    }
  };
  
  const toggleApp = (appName: string) => {
    setActiveApp(prevApp => (prevApp === appName ? null : appName));
    setIsAppLauncherOpen(false); // Ensure launcher is closed if an app is toggled from the dock
  };

  const toggleLauncher = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent this click from being caught by the wrapper
    setIsAppLauncherOpen(prev => !prev);
  };
  
  const handleWrapperClick = () => {
    if (isAppLauncherOpen) setIsAppLauncherOpen(false);
    if (isDebugOpen) setIsDebugOpen(false);
  };

  const isUIOverlayActive = activeApp !== null;
  const isOverlayVisible = isWeatherModalOpen || isUIOverlayActive;

  return (
    <VehicleProvider>
      <div 
        className="relative w-screen h-screen bg-black select-none overflow-hidden"
        onClick={handleWrapperClick}
      >
        <VehicleCanvas 
            isAppOpen={isUIOverlayActive} 
            isNight={isNight}
            minOrbitDistance={minOrbitDistance}
            maxOrbitDistance={maxOrbitDistance}
            appOpenConfig={appOpenConfig}
            nightFloorDarkness={nightFloorDarkness}
        />

        <MiniMap 
            isVisible={!isUIOverlayActive} 
            position={currentPosition} 
            bearing={bearing}
            isNight={isNight}
            top={miniMapTop}
            right={miniMapRight}
            size={miniMapSize}
            zoom={miniMapZoom}
            fadeStart={miniMapFadeStart}
            fadeEnd={miniMapFadeEnd}
            onClick={(e) => { e.stopPropagation(); toggleApp('maps'); }}
        />

        <TopStatusBar 
          isNight={isNight} 
          onWeatherClick={handleWeatherClick}
          weatherData={weatherData}
          weatherCondition={effectiveWeatherCondition}
          sunsetArrowYPosition={sunsetArrowYPosition}
          sunriseArrowYPosition={sunriseArrowYPosition}
          isHot={isHot}
          isCold={isCold}
          tempUnit={tempUnit}
          setTempUnit={setTempUnit}
          scale={topBarScale}
          offsetY={topBarOffsetY}
        />

        <WeatherModal 
            isOpen={isWeatherModalOpen}
            onClose={() => setWeatherModalOpen(false)}
            isNight={isNight}
            status={weatherStatus}
            data={weatherData}
            error={weatherError}
            effectiveTime={effectiveTime}
            sunsetArrowYPosition={sunsetArrowYPosition}
            sunriseArrowYPosition={sunriseArrowYPosition}
            tempUnit={tempUnit}
        />

        <SpotifyPlayer 
            isOpen={activeApp === 'spotify'} 
            onClose={() => setActiveApp(null)} 
            spotifyPlayerTop={spotifyPlayerTop}
            spotifyPlayerBottom={spotifyPlayerBottom}
        />
        
        <MapsContainer 
            isOpen={activeApp === 'maps'}
            onClose={() => setActiveApp(null)}
            isNight={isNight}
            searchPanelWidth={mapsSearchPanelWidth}
            searchPanelTop={mapsSearchPanelTop}
        />

        <AppLauncher
            isOpen={isAppLauncherOpen}
        />

        <button
          onClick={(e) => { e.stopPropagation(); setIsDebugOpen(p => !p); }}
          className="absolute bottom-24 right-4 z-50 p-3 bg-gray-800/80 rounded-full text-white hover:bg-gray-700 transition"
          aria-label="Toggle Debug Panel"
        >
          <ICONS.settings className="w-8 h-8" />
        </button>

        <DebugControls 
            isOpen={isDebugOpen}
            onClose={() => setIsDebugOpen(false)}
            timeOverride={debugTimeOverride}
            setTimeOverride={setDebugTimeOverride}
            sunsetArrowYPosition={sunsetArrowYPosition}
            setSunsetArrowYPosition={setSunsetArrowYPosition}
            sunriseArrowYPosition={sunriseArrowYPosition}
            setSunriseArrowYPosition={setSunriseArrowYPosition}
            weatherConditionOverride={debugWeatherCondition}
            setWeatherConditionOverride={setDebugWeatherCondition}
            effectiveWeatherCondition={effectiveWeatherCondition}
            isNight={isNight}
            isHot={isHot}
            isCold={isCold}
            topBarScale={topBarScale}
            setTopBarScale={setTopBarScale}
            topBarOffsetY={topBarOffsetY}
            setTopBarOffsetY={setTopBarOffsetY}
            mapsSearchPanelWidth={mapsSearchPanelWidth}
            setMapsSearchPanelWidth={setMapsSearchPanelWidth}
            mapsSearchPanelTop={mapsSearchPanelTop}
            setMapsSearchPanelTop={setMapsSearchPanelTop}
            miniMapTop={miniMapTop}
            setMiniMapTop={setMiniMapTop}
            miniMapRight={miniMapRight}
            setMiniMapRight={setMiniMapRight}
            miniMapSize={miniMapSize}
            setMiniMapSize={setMiniMapSize}
            miniMapZoom={miniMapZoom}
            setMiniMapZoom={setMiniMapZoom}
            miniMapFadeStart={miniMapFadeStart}
            setMiniMapFadeStart={setMiniMapFadeStart}
            miniMapFadeEnd={miniMapFadeEnd}
            setMiniMapFadeEnd={setMiniMapFadeEnd}
            minOrbitDistance={minOrbitDistance}
            setMinOrbitDistance={setMinOrbitDistance}
            maxOrbitDistance={maxOrbitDistance}
            setMaxOrbitDistance={setMaxOrbitDistance}
            appOpenConfig={appOpenConfig}
            setAppOpenConfig={setAppOpenConfig}
            nightFloorDarkness={nightFloorDarkness}
            setNightFloorDarkness={setNightFloorDarkness}
            spotifyPlayerTop={spotifyPlayerTop}
            setSpotifyPlayerTop={setSpotifyPlayerTop}
            spotifyPlayerBottom={spotifyPlayerBottom}
            setSpotifyPlayerBottom={setSpotifyPlayerBottom}
        />
        
        <footer 
          className="absolute bottom-0 left-0 right-0 h-20 bg-black z-30 flex justify-center items-center"
          aria-label="Application Dock"
        >
          <DockButton 
            icon={ICONS.spotify} 
            onClick={(e) => { e.stopPropagation(); toggleApp('spotify'); }} 
            label="Open Spotify"
            colorClasses="text-green-500 hover:text-green-400"
          />
          <DockButton 
            icon={ICONS.maps} 
            onClick={(e) => { e.stopPropagation(); toggleApp('maps'); }}
            label="Open Maps"
          />
          <DockButton 
            icon={ICONS.apps} 
            onClick={toggleLauncher}
            label="Open App Launcher"
          />
        </footer>
      </div>
    </VehicleProvider>
  );
}