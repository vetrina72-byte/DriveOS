import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { WeatherData, WeatherParams } from '../types';
import { HOT_TEMP, COLD_TEMP } from '../components/WeatherIcon';

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
  'Default': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 50, fogFar: 150 },
};

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
        0: 'Cielo sereno', 1: 'Prevalentemente sereno', 2: 'Parzialmente nuvoloso', 3: 'Coperto',
        45: 'Nebbia', 48: 'Nebbia', 51: 'Pioggerella', 53: 'Pioggerella', 55: 'Pioggerella',
        56: 'Pioggerella', 57: 'Pioggerella', 61: 'Pioggia leggera', 63: 'Pioggia', 65: 'Pioggia forte',
        66: 'Pioggia', 67: 'Pioggia', 71: 'Neve leggera', 73: 'Neve', 75: 'Neve forte', 77: 'Grandine',
        80: 'Rovescio', 81: 'Rovescio', 82: 'Rovescio', 85: 'Neve', 86: 'Neve', 95: 'Temporale',
        96: 'Temporale', 99: 'Temporale',
    };
    return mapping[code] ?? 'Parzialmente nuvoloso';
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
        const hour = now.getHours();
        const month = now.getMonth();
        night = hour < (month >= 3 && month <= 8 ? 6 : 7) || hour >= (month >= 3 && month <= 8 ? 20 : 17);
        condition = 'Nuvoloso';
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
    return isNight || /temporale|pioggia|rovescio|grandine|neve|nebbia/i.test(effectiveWeatherCondition.toLowerCase());
  }, [isNight, effectiveWeatherCondition]);

  const targetWeatherParams = useMemo(() => {
    return weatherConfig[effectiveWeatherCondition] || weatherConfig['Default'];
  }, [effectiveWeatherCondition]);

  const fetchWeatherData = useCallback(async (latitude: number, longitude: number) => {
      setWeatherStatus('fetching');
      setWeatherError(null);
      try {
          const [weatherResponse, locationResponse] = await Promise.all([
              fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`),
              fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`)
          ]);
          const weatherApiData = await weatherResponse.json();
          const locationData = await locationResponse.json();
          if (weatherApiData.error) throw new Error(`Open-Meteo Error: ${weatherApiData.reason}`);
          const locationName = locationData.address?.city || locationData.address?.town || locationData.address?.village || locationData.address?.county || 'Current Location';
          
          const mappedData: Omit<WeatherData, 'lastUpdated'> = {
              locationName,
              current: {
                  temperature: Math.round(weatherApiData.current.temperature_2m),
                  condition: wmoCodeToCondition(weatherApiData.current.weather_code),
                  high: Math.round(weatherApiData.daily.temperature_2m_max[0]),
                  low: Math.round(weatherApiData.daily.temperature_2m_min[0])
              },
              hourly: weatherApiData.hourly.time.map((isoTime: string, index: number) => ({
                  time: new Date(isoTime).getHours().toString().padStart(2, '0') + ':00',
                  dt: new Date(isoTime).getTime() / 1000,
                  temperature: Math.round(weatherApiData.hourly.temperature_2m[index]),
                  condition: wmoCodeToCondition(weatherApiData.hourly.weather_code[index])
              })),
              details: {
                  chanceOfRain: Math.round(weatherApiData.current.precipitation_probability ?? 0),
                  humidity: Math.round(weatherApiData.current.relative_humidity_2m),
                  wind: `${Math.round(weatherApiData.current.wind_speed_10m)} km/h ${degToCompass(weatherApiData.current.wind_direction_10m)}`,
                  sunrise: timestampToHHMM(new Date(weatherApiData.daily.sunrise[0]).getTime() / 1000),
                  sunset: timestampToHHMM(new Date(weatherApiData.daily.sunset[0]).getTime() / 1000)
              }
          };
          setWeatherData({ ...mappedData, lastUpdated: new Date() });
          setWeatherStatus('success');
      } catch (error: any) {
          setWeatherError(error.message || "Impossibile recuperare i dati.");
          setWeatherData(null);
          setWeatherStatus('error');
      }
  }, []);

  const requestWeather = useCallback(() => {
    setWeatherData(null);
    setWeatherError(null);
    setWeatherStatus('locating');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (position.coords.accuracy > 1500) {
                    setWeatherError("Posizione troppo imprecisa.");
                    setWeatherStatus('error');
                    return;
                }
                fetchWeatherData(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                setWeatherError("Impossibile ottenere la posizione.");
                setWeatherStatus('error');
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
        );
    } else {
        setWeatherError("Geolocalizzazione non supportata.");
        setWeatherStatus('error');
    }
  }, [fetchWeatherData]);

  useEffect(() => {
    requestWeather();
    const intervalId = setInterval(requestWeather, 15 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [requestWeather]);

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
