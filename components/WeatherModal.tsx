import React from 'react';
import { FiX, FiAlertTriangle, FiMapPin, FiRefreshCw, FiSunrise, FiSunset, FiWind, FiDroplet } from 'react-icons/fi';
import WeatherIcon, { ExtremeTemp, HOT_TEMP, COLD_TEMP } from './WeatherIcon';
import { ICONS } from '../constants';
import type { WeatherData, TempUnit } from '../types';
import { useWeather } from '../context/WeatherContext';

interface WeatherModalProps {
    tempUnit: TempUnit;
    setTempUnit: React.Dispatch<React.SetStateAction<TempUnit>>;
}

const convertTemp = (celsius: number, unit: TempUnit): number => {
    if (isNaN(celsius)) return NaN;
    if (unit === 'F') return Math.round((celsius * 9 / 5) + 32);
    return Math.round(celsius);
};

const getHourlyForecastToDisplay = (data: WeatherData | null, effectiveTime: Date) => {
    if (!data) return [];
    
    let sunriseTime: Date | null = null;
    let sunsetTime: Date | null = null;
    if (data.details.sunrise && data.details.sunset) {
        const [sunriseH, sunriseM] = data.details.sunrise.split(':').map(Number);
        sunriseTime = new Date(effectiveTime);
        sunriseTime.setHours(sunriseH, sunriseM, 0, 0);

        const [sunsetH, sunsetM] = data.details.sunset.split(':').map(Number);
        sunsetTime = new Date(effectiveTime);
        sunsetTime.setHours(sunsetH, sunsetM, 0, 0);
    }

    const determineCondition = (originalCondition: string, date: Date): string => {
        const hour = date.getHours();
        const isCloudy = /nuvol|nebbia|coperto/i.test(originalCondition);

        if (sunriseTime && hour === sunriseTime.getHours()) {
            return isCloudy ? 'Cloudy Sunrise' : 'Sunrise';
        }
        if (sunsetTime && hour === sunsetTime.getHours()) {
            return isCloudy ? 'Cloudy Sunset' : 'Sunset';
        }
        return originalCondition;
    };
    
    const processForecast = (timeLabel: string, temp: number, originalCondition: string, date: Date) => {
        const isHourNight = sunriseTime && sunsetTime 
            ? (date.getTime() < sunriseTime.getTime() || date.getTime() >= sunsetTime.getTime())
            : (date.getHours() < 6 || date.getHours() >= 20);
        
        const finalCondition = determineCondition(originalCondition, date);
        const isHot = temp >= HOT_TEMP && !/nuvol|coperto|piogg|rovescio|nev|nebbia|temporale|grandin/i.test(finalCondition);
        const isCold = temp <= COLD_TEMP;

        return {
            time: timeLabel,
            temperature: temp,
            condition: finalCondition,
            isNight: isHourNight,
            isHot,
            isCold,
        };
    };

    const nowDate = effectiveTime;
    const nowHour = nowDate.getHours();

    const nowHourlyData = data.hourly.find(h => new Date(h.dt * 1000).getHours() === nowHour);

    let nowTemp, nowCond;
    if (nowHourlyData) {
        nowTemp = nowHourlyData.temperature;
        nowCond = nowHourlyData.condition;
    } else {
        nowTemp = data.current.temperature;
        nowCond = data.current.condition;
    }
    
    const nowForecast = processForecast('Ora', nowTemp, nowCond, nowDate);

    const nowTimestamp = nowDate.getTime();
    const startIndex = data.hourly.findIndex(forecast => (forecast.dt * 1000) > nowTimestamp);
    
    if (startIndex === -1) {
        const padded = [nowForecast];
        while(padded.length < 5) padded.push({ time: '--:--', temperature: NaN, condition: 'Parzialmente nuvoloso', isNight: false, isHot: false, isCold: false });
        return padded;
    }

    const nextFourHours = data.hourly.slice(startIndex, startIndex + 4);

    const futureForecasts = nextFourHours.map(forecast => {
        const forecastDate = new Date(forecast.dt * 1000);
        return processForecast(forecast.time, forecast.temperature, forecast.condition, forecastDate);
    });

    const allForecasts = [nowForecast, ...futureForecasts];
    while (allForecasts.length < 5) {
        allForecasts.push({
            time: '--:--',
            temperature: NaN,
            condition: 'Parzialmente nuvoloso',
            isNight: false,
            isHot: false,
            isCold: false
        });
    }
    return allForecasts;
};

export default function WeatherModal({ tempUnit, setTempUnit }: WeatherModalProps) {
    const {
        isWeatherModalOpen: isOpen,
        setWeatherModalOpen,
        useDarkTheme: isNight,
        weatherStatus: status,
        weatherData: data,
        weatherError: error,
        effectiveTime,
        sunsetArrowYPosition,
        sunriseArrowYPosition,
        requestWeather,
    } = useWeather();

    const onClose = () => setWeatherModalOpen(false);
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    const theme = {
        bg: isNight ? 'bg-zinc-900' : 'bg-white',
        textPrimary: isNight ? 'text-zinc-100' : 'text-zinc-900',
        textSecondary: isNight ? 'text-zinc-400' : 'text-zinc-500',
        border: isNight ? 'border-zinc-800' : 'border-gray-200',
        cardBg: isNight ? 'bg-zinc-800/80 border border-zinc-700/60' : 'bg-gray-50 border border-gray-200/80',
        cardHover: isNight ? 'hover:bg-zinc-800' : 'hover:bg-gray-100',
        buttonHover: isNight ? 'hover:bg-zinc-800' : 'hover:bg-gray-100',
    };

    const getArrowYPosition = (condition: string) => {
        return condition.toLowerCase().includes('sunrise') ? sunriseArrowYPosition : sunsetArrowYPosition;
    };

    const renderContent = () => {
        if (status === 'locating' || status === 'fetching') {
            const message = status === 'locating' ? 'Rilevamento posizione mappa in corso…' : 'Aggiornamento meteo per la posizione attuale…';
            return (
                <div className="flex flex-col items-center justify-center py-12 text-center min-h-[220px]">
                    <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className={`mt-4 font-medium text-xs sm:text-sm ${theme.textSecondary}`}>{message}</p>
                </div>
            );
        }

        if (status === 'error' && error) {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4 min-h-[220px]">
                    <FiAlertTriangle className="text-3xl text-amber-500 mb-2" />
                    <p id="weather-title" className="font-bold text-sm sm:text-base">Impossibile caricare il meteo</p>
                    <p className={`mt-1 text-xs ${theme.textSecondary}`}>{error}</p>
                    <button 
                        onClick={requestWeather}
                        className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                        <FiRefreshCw className="w-3.5 h-3.5" />
                        Riprova
                    </button>
                </div>
            );
        }

        if (status === 'success' && data) {
            const hourlyForecast = getHourlyForecastToDisplay(data, effectiveTime);
            const nowData = hourlyForecast[0];

            const mainTemp = convertTemp(nowData.temperature, tempUnit);
            const highTemp = convertTemp(data.current.high, tempUnit);
            const lowTemp = convertTemp(data.current.low, tempUnit);

            const minTemp = data.current.low;
            const maxTemp = data.current.high;
            const currentTemp = nowData.temperature;
            const positionPercent = minTemp === maxTemp ? 50 : Math.min(Math.max(((currentTemp - minTemp) / (maxTemp - minTemp)) * 100, 0), 100);

            return (
                <>
                    {/* Header Bar */}
                    <header className={`flex items-center justify-between pb-3 mb-4 border-b ${theme.border}`}>
                        <div className="flex items-center gap-2 truncate">
                            <FiMapPin className="text-amber-500 flex-shrink-0 w-4 h-4" />
                            <h2 id="weather-title" className="font-bold text-sm sm:text-base tracking-tight truncate">
                                {data.locationName}
                            </h2>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Unit Switcher */}
                            <div className={`flex items-center p-0.5 rounded-lg ${isNight ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-100 border border-gray-200'}`}>
                                <button
                                    onClick={() => setTempUnit('C')}
                                    className={`px-2 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer ${tempUnit === 'C' ? 'bg-amber-500 text-white shadow-xs' : `${theme.textSecondary}`}`}
                                >
                                    °C
                                </button>
                                <button
                                    onClick={() => setTempUnit('F')}
                                    className={`px-2 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer ${tempUnit === 'F' ? 'bg-amber-500 text-white shadow-xs' : `${theme.textSecondary}`}`}
                                >
                                    °F
                                </button>
                            </div>

                            <button 
                                onClick={requestWeather}
                                className={`p-1.5 rounded-lg ${theme.textSecondary} ${theme.buttonHover} transition-colors cursor-pointer`}
                                title="Aggiorna meteo"
                            >
                                <FiRefreshCw className="w-3.5 h-3.5" />
                            </button>

                            <button 
                                onClick={onClose} 
                                className={`p-2 rounded-xl ${theme.textSecondary} ${theme.buttonHover} transition-colors cursor-pointer mr-0 sm:mr-1`}
                                aria-label="Chiudi"
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                    </header>

                    {/* Main Layout Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
                        
                        {/* LEFT COLUMN: Main Current Weather Panel */}
                        <div className={`sm:col-span-5 md:col-span-4 flex flex-col justify-between p-4 sm:p-5 squircle-card rounded-2xl ${theme.cardBg}`}>
                            <div className="flex flex-col items-center justify-center text-center my-auto py-2">
                                <div className="relative flex items-center justify-center mb-1">
                                    <WeatherIcon 
                                        condition={nowData.condition} 
                                        isNight={nowData.isNight} 
                                        className={`w-16 h-16 sm:w-20 sm:h-20 ${nowData.isHot ? 'hot-sun' : ''}`}
                                        arrowYPosition={getArrowYPosition(nowData.condition)}
                                    />
                                    {(nowData.isHot || nowData.isCold) && (
                                        <ExtremeTemp
                                            type={nowData.isHot ? 'hot' : 'cold'}
                                            className="w-5 h-5 absolute top-0 right-0"
                                        />
                                    )}
                                </div>

                                <div className="flex items-baseline justify-center mt-1">
                                    <span className="font-extrabold text-4xl sm:text-5xl tracking-tighter leading-none">
                                        {isNaN(mainTemp) ? '--' : mainTemp}
                                    </span>
                                    <span className="text-xl sm:text-2xl font-bold ml-1 text-amber-500">
                                        °{tempUnit}
                                    </span>
                                </div>
                                <p className="font-bold text-xs sm:text-sm mt-1.5 capitalize tracking-tight text-amber-600 dark:text-amber-400">
                                    {nowData.condition}
                                </p>
                            </div>

                            {/* Clear Min/Max Temperature Range Indicator */}
                            <div className="w-full pt-2.5 mt-2 border-t border-gray-200/60 dark:border-zinc-700/60">
                                <div className="w-full mb-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                    <span className="text-[0.68rem] font-bold uppercase tracking-wider text-center text-zinc-500 dark:text-zinc-400" style={{ textAlign: 'center', lineHeight: '1.2' }}>
                                        Escursione termica
                                    </span>
                                </div>
                                <div className="flex items-center justify-between w-full px-0.5 mb-1.5 text-xs font-semibold">
                                    <span className={theme.textSecondary}>Min: <strong className="font-extrabold text-blue-500">{isNaN(lowTemp) ? '--°' : `${lowTemp}°`}</strong></span>
                                    <span className={theme.textSecondary}>Max: <strong className="font-extrabold text-red-500">{isNaN(highTemp) ? '--°' : `${highTemp}°`}</strong></span>
                                </div>
                                <div className="relative w-full h-2 rounded-full bg-gradient-to-r from-blue-400 via-amber-400 to-red-500 opacity-80">
                                    <div 
                                        className="absolute top-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md border-2 border-amber-600 transition-all duration-300 transform -translate-y-1/2 -translate-x-1/2"
                                        style={{ left: `${positionPercent}%` }}
                                        title={`Temperatura attuale: ${isNaN(mainTemp) ? '--' : mainTemp}°${tempUnit}`}
                                    />
                                </div>
                            </div>

                            {/* Perfectly Centered Radar Map Button */}
                            <button
                                onClick={() => {
                                    onClose();
                                    window.dispatchEvent(new CustomEvent('open-weather-radar'));
                                }}
                                className="w-full mt-3 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs text-center"
                            >
                                <FiMapPin className="w-3.5 h-3.5" />
                                <span>Mappa Radar Meteo</span>
                            </button>
                        </div>

                        {/* RIGHT COLUMN: 5-Hour Forecast & Atmospheric Metrics */}
                        <div className="sm:col-span-7 md:col-span-8 flex flex-col gap-3 justify-between">
                            {/* 5-Hour Forecast Strip */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5 px-1">
                                    <span className={`text-[0.7rem] font-bold uppercase tracking-wider ${theme.textSecondary}`}>
                                        Previsione Prossime Ore
                                    </span>
                                </div>
                                <div className={`grid grid-cols-5 gap-1.5 p-2 rounded-2xl ${theme.cardBg}`}>
                                    {hourlyForecast.map((hour, index) => {
                                        const hourlyVal = convertTemp(hour.temperature, tempUnit);
                                        return (
                                            <div 
                                                key={index} 
                                                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center transition-colors ${
                                                    index === 0 
                                                        ? 'bg-amber-500/10 border border-amber-500/30' 
                                                        : ''
                                                }`}
                                            >
                                                <span className={`text-[0.68rem] font-bold ${index === 0 ? 'text-amber-500' : theme.textSecondary}`}>
                                                    {hour.time}
                                                </span>
                                                <div className="relative my-0.5">
                                                    <WeatherIcon 
                                                        condition={hour.condition} 
                                                        isNight={hour.isNight} 
                                                        className="w-7 h-7 sm:w-8 sm:h-8" 
                                                        arrowYPosition={getArrowYPosition(hour.condition)}
                                                    />
                                                </div>
                                                <span className="font-extrabold text-xs">
                                                    {isNaN(hourlyVal) ? '--°' : `${hourlyVal}°`}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Weather Details Grid */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5 px-1">
                                    <span className={`text-[0.7rem] font-bold uppercase tracking-wider ${theme.textSecondary}`}>
                                        Condizioni Atmosferiche
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={`flex items-center p-2.5 rounded-xl ${theme.cardBg}`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 flex-shrink-0">
                                                <ICONS.rainChance className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[0.65rem] font-bold ${theme.textSecondary}`}>Pioggia</span>
                                                <span className="font-extrabold text-xs sm:text-sm">{data.details.chanceOfRain}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`flex items-center p-2.5 rounded-xl ${theme.cardBg}`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500 flex-shrink-0">
                                                <ICONS.humidity className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[0.65rem] font-bold ${theme.textSecondary}`}>Umidità</span>
                                                <span className="font-extrabold text-xs sm:text-sm">{data.details.humidity}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`flex items-center p-2.5 rounded-xl ${theme.cardBg}`}>
                                        <div className="flex items-center gap-2.5 truncate">
                                            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500 flex-shrink-0">
                                                <ICONS.wind className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className={`text-[0.65rem] font-bold ${theme.textSecondary}`}>Vento</span>
                                                <span className="font-extrabold text-xs sm:text-sm truncate">{data.details.wind}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`flex items-center p-2.5 rounded-xl ${theme.cardBg}`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 flex-shrink-0">
                                                <FiSunrise className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[0.65rem] font-bold ${theme.textSecondary}`}>Alba / Tramonto</span>
                                                <span className="font-extrabold text-xs">{data.details.sunrise} - {data.details.sunset}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer Sync Information */}
                    <footer className={`flex items-center justify-between pt-2.5 mt-3 border-t ${theme.border} text-[0.65rem] ${theme.textSecondary}`}>
                        <span className="font-medium">
                            Sincronizzato con la posizione della mappa
                        </span>
                        <span>WeatherAPI.com • Aggiornato alle {data.lastUpdated.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                    </footer>
                </>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4 min-h-[220px]">
                <FiAlertTriangle className={`text-3xl ${theme.textSecondary} mb-2`} />
                <h2 id="weather-title" className="font-bold text-sm sm:text-base">Posizione non disponibile</h2>
                <p className={`mt-1 text-xs ${theme.textSecondary}`}>In attesa della posizione dalla mappa per mostrare il meteo aggiornato.</p>
                <button 
                    onClick={requestWeather}
                    className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                    <FiRefreshCw className="w-3.5 h-3.5" />
                    Sincronizza posizione
                </button>
            </div>
        );
    };

    return (
        <div 
            className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-6 transition-all duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div 
                className={`w-full max-w-lg sm:max-w-2xl md:max-w-3xl ${theme.bg} ${theme.textPrimary} squircle-modal rounded-3xl shadow-2xl p-6 sm:p-8 my-auto flex flex-col border ${theme.border} transition-all duration-300 transform ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}
                onClick={stopPropagation}
                role="dialog"
                aria-modal="true"
                aria-labelledby="weather-title"
            >
                {/* Centered Top Handle Bar */}
                <div className="w-full mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <div className="w-12 h-1 rounded-full bg-gray-300 dark:bg-zinc-700" />
                </div>
                {renderContent()}
            </div>
        </div>
    );
}
