import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { WeatherData, WeatherParams } from '../types';
import { HOT_TEMP, COLD_TEMP } from '../components/WeatherIcon';
import { TelemetryStore } from './TelemetryStore';

export type WeatherStatus = 'idle' | 'locating' | 'fetching' | 'success' | 'error';

export const weatherConfig: Record<string, WeatherParams> = {
  'Cielo sereno': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 50, fogFar: 150 },
  'Prevalentemente sereno': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 45, fogFar: 140 },
  'Parzialmente nuvoloso': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 35, fogFar: 120 },
  'Coperto': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 25, fogFar: 80 },
  'Pioggerella': { rainDensity: 0.2, rainSpeed: 5, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 20, fogFar: 60 },
  'Pioggia leggera': { rainDensity: 0.4, rainSpeed: 8, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 18, fogFar: 50 },
  'Pioggia': { rainDensity: 0.7, rainSpeed: 11, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 15, fogFar: 40 },
  'Pioggia forte': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 10, fogFar: 30 },
  'Rovescio': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 10, fogFar: 30 },
  'Temporale': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 8, fogFar: 25 },
  'Neve leggera': { rainDensity: 0, rainSpeed: 0, snowDensity: 0.4, snowSpeed: 1.5, hailDensity: 0, fogNear: 15, fogFar: 40 },
  'Neve': { rainDensity: 0, rainSpeed: 0, snowDensity: 0.7, snowSpeed: 3.0, hailDensity: 0, fogNear: 12, fogFar: 35 },
  'Neve forte': { rainDensity: 0, rainSpeed: 0, snowDensity: 1.0, snowSpeed: 6.0, hailDensity: 0, fogNear: 8, fogFar: 25 },
  'Grandine': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 1.0, fogNear: 12, fogFar: 35 },
  'Nebbia': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 1, fogFar: 20 },
  'Sunrise': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 130 },
  'Sunset': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 130 },
  'Cloudy Sunrise': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 30, fogFar: 100 },
  'Cloudy Sunset': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 30, fogFar: 100 },
  'Partly Cloudy Night': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 120 },
  'Default': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 0, fogFar: 63 },
};

const degToCompass = (num: number) => {
    const val = Math.floor((num / 45) + 0.5);
    const arr = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
    return arr[(val % 8)];
};

const format12hTo24h = (time12h: string): string => {
    if (!time12h) return '--:--';
    const match = time12h.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return time12h;
    let [_, hoursStr, minutesStr, ampm] = match;
    let hours = parseInt(hoursStr, 10);
    if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutesStr}`;
};

const mapWeatherApiCondition = (text: string): string => {
    if (!text) return 'Parzialmente nuvoloso';
    const lower = text.toLowerCase();
    if (lower.includes('sereno') || lower.includes('sole') || lower.includes('clear') || lower.includes('sunny')) {
        return lower.includes('prevalentemente') ? 'Prevalentemente sereno' : 'Cielo sereno';
    }
    if (lower.includes('parzialmente') || lower.includes('partly')) return 'Parzialmente nuvoloso';
    if (lower.includes('coperto') || lower.includes('overcast')) return 'Coperto';
    if (lower.includes('nuvolo') || lower.includes('cloudy')) return 'Parzialmente nuvoloso';
    if (lower.includes('temporale') || lower.includes('thunder')) return 'Temporale';
    if (lower.includes('forte') && (lower.includes('pioggia') || lower.includes('rain'))) return 'Pioggia forte';
    if (lower.includes('leggera') || lower.includes('pioggerella') || lower.includes('drizzle') || lower.includes('light rain')) return 'Pioggia leggera';
    if (lower.includes('pioggia') || lower.includes('rain') || lower.includes('rovesc')) return 'Pioggia';
    if (lower.includes('neve') || lower.includes('snow') || lower.includes('blizzard')) return 'Neve';
    if (lower.includes('nebbia') || lower.includes('fog') || lower.includes('mist')) return 'Nebbia';
    return text;
};

const wmoCodeToCondition = (code: number, precip: number = 0, precipProb: number = 0): string => {
    // If WMO code indicates drizzle or rain, but measured precipitation is 0mm and probability is low, report clouds rather than false rain
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        if (precip <= 0.05 && precipProb < 35) {
            return (code >= 3 || precipProb > 20) ? 'Coperto' : 'Parzialmente nuvoloso';
        }
    }
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
        56: 'Pioggerella',
        57: 'Pioggerella',
        61: 'Pioggia leggera',
        63: 'Pioggia',
        65: 'Pioggia forte',
        66: 'Pioggia',
        67: 'Pioggia forte',
        71: 'Neve leggera',
        73: 'Neve',
        75: 'Neve forte',
        77: 'Grandine',
        80: 'Rovescio',
        81: 'Rovescio',
        82: 'Pioggia forte',
        85: 'Neve',
        86: 'Neve forte',
        95: 'Temporale',
        96: 'Temporale',
        99: 'Temporale',
    };
    return mapping[code] ?? 'Parzialmente nuvoloso';
};

const fetchLocationName = async (lat: number, lon: number): Promise<string> => {
    try {
        const bdcRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=it`
        );
        if (bdcRes.ok) {
            const bdcData = await bdcRes.json();
            const name = bdcData.city || bdcData.locality || bdcData.principalSubdivision;
            if (name) return name;
        }
    } catch (e) {}

    try {
        const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10`
        );
        if (nomRes.ok) {
            const nomData = await nomRes.json();
            const name = nomData.address?.city || nomData.address?.town || nomData.address?.village || nomData.address?.county;
            if (name) return name;
        }
    } catch (e) {}

    return 'Posizione attuale';
};

const fetchIpLocation = async (): Promise<{ lat: number; lon: number; city: string } | null> => {
    try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
            const data = await res.json();
            if (data.latitude && data.longitude) {
                return {
                    lat: data.latitude,
                    lon: data.longitude,
                    city: data.city || data.region || 'Posizione rilevata'
                };
            }
        }
    } catch (e) {}

    try {
        const res = await fetch('https://ip-api.com/json/?fields=status,country,city,lat,lon');
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success' && data.lat && data.lon) {
                return {
                    lat: data.lat,
                    lon: data.lon,
                    city: data.city || 'Posizione rilevata'
                };
            }
        }
    } catch (e) {}

    return null;
};

interface WeatherContextType {
  currentTime: Date;
  timeOverride: Date | null;
  setTimeOverride: (d: Date | null) => void;
  weatherConditionOverride: string | null;
  setWeatherConditionOverride: (cond: string | null) => void;
  sunsetArrowYPosition: number;
  setSunsetArrowYPosition: (y: number) => void;
  sunriseArrowYPosition: number;
  setSunriseArrowYPosition: (y: number) => void;
  isWeatherModalOpen: boolean;
  setWeatherModalOpen: (open: boolean) => void;
  weatherData: WeatherData | null;
  weatherError: string | null;
  weatherStatus: WeatherStatus;
  effectiveTime: Date;
  isNight: boolean;
  effectiveWeatherCondition: string;
  isHot: boolean;
  isCold: boolean;
  useDarkTheme: boolean;
  targetWeatherParams: WeatherParams;
  requestWeather: () => void;
  handleWeatherClick: () => void;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

export const WeatherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeOverride, setTimeOverride] = useState<Date | null>(null);
  const [weatherConditionOverride, setWeatherConditionOverride] = useState<string | null>(null);
  const [sunsetArrowYPosition, setSunsetArrowYPosition] = useState(1);
  const [sunriseArrowYPosition, setSunriseArrowYPosition] = useState(5);
  const [isWeatherModalOpen, setWeatherModalOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('idle');

  // Clock ticks every 60 seconds
  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const effectiveTime = useMemo(() => {
    return timeOverride || currentTime;
  }, [timeOverride, currentTime]);

  const { isNight, effectiveWeatherCondition, isHot, isCold } = useMemo(() => {
    const now = effectiveTime;
    let night = false;
    let condition = 'Cielo sereno';

    if (weatherData) {
      // Find closest hourly forecast item for effectiveTime
      const nowTimestamp = Math.floor(now.getTime() / 1000);
      const hourlyData = weatherData.hourly.find(h => Math.abs(h.dt - nowTimestamp) < 1800) 
        || weatherData.hourly.find(h => new Date(h.dt * 1000).getHours() === now.getHours()) 
        || weatherData.hourly[0];

      if (weatherData.details.sunrise && weatherData.details.sunset) {
        const [sr_h, sr_m] = weatherData.details.sunrise.split(':').map(Number);
        const [ss_h, ss_m] = weatherData.details.sunset.split(':').map(Number);
        const sunriseDate = new Date(now.getTime());
        const sunsetDate = new Date(now.getTime());
        sunriseDate.setHours(sr_h, sr_m, 0, 0);
        sunsetDate.setHours(ss_h, ss_m, 0, 0);
        
        night = now.getTime() < sunriseDate.getTime() || now.getTime() >= sunsetDate.getTime();
        
        const rawCond = (timeOverride === null) 
          ? weatherData.current.condition 
          : (hourlyData ? hourlyData.condition : weatherData.current.condition);
        const isCloudy = /nuvol|nebbia|coperto/i.test(rawCond);

        if (now.getHours() === sunriseDate.getHours()) {
          condition = isCloudy ? 'Cloudy Sunrise' : 'Sunrise';
        } else if (now.getHours() === sunsetDate.getHours()) {
          condition = isCloudy ? 'Cloudy Sunset' : 'Sunset';
        } else {
          condition = rawCond;
        }
      } else {
        const hour = now.getHours();
        night = hour < 6 || hour >= 20;
        condition = hourlyData ? hourlyData.condition : weatherData.current.condition;
      }
    } else {
      const hour = now.getHours();
      night = hour < 6 || hour >= 20;
      condition = 'Cielo sereno';
    }

    const finalCondition = weatherConditionOverride || condition;
    const currentTemp = weatherData?.hourly.find(h => new Date(h.dt * 1000).getHours() === now.getHours())?.temperature ?? weatherData?.current.temperature ?? 20;

    return {
      isNight: night,
      effectiveWeatherCondition: finalCondition,
      isHot: currentTemp >= HOT_TEMP && !/nuvol|coperto|piogg|rovescio|nev|nebbia|temporale|grandin/i.test(finalCondition),
      isCold: currentTemp <= COLD_TEMP
    };
  }, [effectiveTime, weatherData, weatherConditionOverride]);

  const useDarkTheme = useMemo(() => {
    return isNight;
  }, [isNight]);

  const targetWeatherParams = useMemo(() => {
    return weatherConfig[effectiveWeatherCondition] || weatherConfig['Default'];
  }, [effectiveWeatherCondition]);

  const fetchWeatherData = useCallback(async (latitude: number, longitude: number, overrideCityName?: string) => {
      setWeatherStatus('fetching');
      setWeatherError(null);
      try {
          const apiKey = (import.meta as any).env?.VITE_WEATHERAPI_KEY || (process as any).env?.VITE_WEATHERAPI_KEY || (process as any).env?.WEATHERAPI_KEY || '63e9f45688534b4ca8d120000242209';
          
          const weatherPromise = fetch(
              `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${latitude},${longitude}&days=2&aqi=no&alerts=no&lang=it`
          );
          
          const locationPromise = overrideCityName 
              ? Promise.resolve(overrideCityName) 
              : fetchLocationName(latitude, longitude);

          const [weatherResponse, reverseGeocodedCity] = await Promise.all([
              weatherPromise,
              locationPromise
          ]);

          if (!weatherResponse.ok) {
              throw new Error(`Meteo non disponibile (${weatherResponse.status})`);
          }

          const weatherApiData = await weatherResponse.json();
          if (weatherApiData.error) {
              throw new Error(`WeatherAPI Error: ${weatherApiData.error.message || 'Errore recupero dati'}`);
          }

          const currentObj = weatherApiData.current || {};
          const forecastDays = weatherApiData.forecast?.forecastday || [];
          const todayDay = forecastDays[0]?.day || {};
          const todayAstro = forecastDays[0]?.astro || {};

          const finalLocationName = overrideCityName || weatherApiData.location?.name || reverseGeocodedCity;

          try {
              localStorage.setItem('last_known_weather_loc', JSON.stringify({
                  lat: latitude,
                  lon: longitude,
                  name: finalLocationName
              }));
          } catch (e) {}

          const currentTemp = Math.round(currentObj.temp_c ?? 0);
          const minTemp = Math.round(todayDay.mintemp_c ?? currentTemp);
          const maxTemp = Math.round(todayDay.maxtemp_c ?? currentTemp);
          const rawConditionText = currentObj.condition?.text || 'Parzialmente nuvoloso';
          const mappedCondition = mapWeatherApiCondition(rawConditionText);

          let allHours: any[] = [];
          if (forecastDays[0]?.hour) {
              allHours = [...forecastDays[0].hour];
          }
          if (forecastDays[1]?.hour) {
              allHours = [...allHours, ...forecastDays[1].hour];
          }

          const hourlyMapped = allHours.map((h: any) => {
              const dtSeconds = h.time_epoch || Math.floor(new Date(h.time).getTime() / 1000);
              const hourDate = new Date(dtSeconds * 1000);
              const hoursStr = hourDate.getHours().toString().padStart(2, '0') + ':00';
              return {
                  time: hoursStr,
                  dt: dtSeconds,
                  temperature: Math.round(h.temp_c ?? 0),
                  condition: mapWeatherApiCondition(h.condition?.text || '')
              };
          });

          const currentRainProb = Math.round(
              todayDay.daily_chance_of_rain ?? (currentObj.precip_mm > 0 ? 80 : 0)
          );

          const mappedData: Omit<WeatherData, 'lastUpdated'> = {
              locationName: finalLocationName,
              current: {
                  temperature: currentTemp,
                  condition: mappedCondition,
                  high: maxTemp,
                  low: minTemp
              },
              hourly: hourlyMapped,
              details: {
                  chanceOfRain: currentRainProb,
                  humidity: Math.round(currentObj.humidity ?? 0),
                  wind: `${Math.round(currentObj.wind_kph ?? 0)} km/h ${currentObj.wind_dir || ''}`,
                  sunrise: format12hTo24h(todayAstro.sunrise),
                  sunset: format12hTo24h(todayAstro.sunset)
              }
          };

          setWeatherData({ ...mappedData, lastUpdated: new Date() });
          setWeatherStatus('success');
      } catch (error: any) {
          setWeatherError(error.message || "Impossibile recuperare i dati meteo.");
          setWeatherStatus('error');
      }
  }, []);

  const requestWeather = useCallback(() => {
    setWeatherError(null);

    const tryBrowserLocation = (timeoutMs = 1500) => {
        return new Promise<{ lat: number; lon: number } | null>((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            let resolved = false;
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(null);
                }
            }, timeoutMs);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                    }
                },
                () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        resolve(null);
                    }
                },
                { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600000 }
            );
        });
    };

    (async () => {
        // Priority 1: Map Telemetry position (direct position from the map engine)
        if (TelemetryStore.position) {
            await fetchWeatherData(TelemetryStore.position.lat, TelemetryStore.position.lng);
            return;
        }

        let hasCachedLoc = false;
        try {
            const saved = localStorage.getItem('last_known_weather_loc');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.lat && parsed.lon) {
                    hasCachedLoc = true;
                    fetchWeatherData(parsed.lat, parsed.lon, parsed.name);
                }
            }
        } catch (e) {}

        if (!hasCachedLoc) {
            setWeatherStatus('locating');
        }

        // Try GPS location (up to 3 seconds for real device accuracy)
        const gpsLoc = await tryBrowserLocation(3000);
        if (gpsLoc) {
            await fetchWeatherData(gpsLoc.lat, gpsLoc.lon);
            return;
        }

        // Fallback to IP geolocation if GPS is unavailable
        const ipLoc = await fetchIpLocation();
        if (ipLoc) {
            await fetchWeatherData(ipLoc.lat, ipLoc.lon, ipLoc.city);
            return;
        }

        if (!hasCachedLoc) {
            await fetchWeatherData(41.9028, 12.4964, 'Roma');
        }
    })();
  }, [fetchWeatherData]);

  // Sync automatically with Map's TelemetryStore position & custom map location events
  useEffect(() => {
    requestWeather();

    const unsubscribe = TelemetryStore.subscribe(() => {
      const pos = TelemetryStore.position;
      if (pos && pos.lat && pos.lng) {
        fetchWeatherData(pos.lat, pos.lng);
      }
    });

    const handleMapLocationEvent = (e: any) => {
      if (e.detail && typeof e.detail.lat === 'number' && typeof e.detail.lng === 'number') {
        fetchWeatherData(e.detail.lat, e.detail.lng, e.detail.name);
      }
    };

    window.addEventListener('update-weather-location', handleMapLocationEvent);
    const intervalId = setInterval(requestWeather, 15 * 60 * 1000);

    return () => {
      unsubscribe();
      window.removeEventListener('update-weather-location', handleMapLocationEvent);
      clearInterval(intervalId);
    };
  }, [requestWeather, fetchWeatherData]);

  const handleWeatherClick = useCallback(() => {
    setWeatherModalOpen(true);
    if (weatherStatus !== 'locating' && weatherStatus !== 'fetching') {
      if (!weatherData || (new Date().getTime() - weatherData.lastUpdated.getTime()) > 300000) {
        requestWeather();
      }
    }
  }, [weatherStatus, weatherData, requestWeather]);

  return (
    <WeatherContext.Provider
      value={{
        currentTime,
        timeOverride,
        setTimeOverride,
        weatherConditionOverride,
        setWeatherConditionOverride,
        sunsetArrowYPosition,
        setSunsetArrowYPosition,
        sunriseArrowYPosition,
        setSunriseArrowYPosition,
        isWeatherModalOpen,
        setWeatherModalOpen,
        weatherData,
        weatherError,
        weatherStatus,
        effectiveTime,
        isNight,
        effectiveWeatherCondition,
        isHot,
        isCold,
        useDarkTheme,
        targetWeatherParams,
        requestWeather,
        handleWeatherClick,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
};
