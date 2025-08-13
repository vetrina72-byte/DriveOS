

import React from 'react';
import { FiX, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import WeatherIcon, { ExtremeTemp, HOT_TEMP, COLD_TEMP } from './WeatherIcon';
import { ICONS } from '../constants';
import type { WeatherData, TempUnit } from '../types';

type WeatherStatus = 'idle' | 'locating' | 'fetching' | 'success' | 'error';

interface WeatherModalProps {
    isOpen: boolean;
    onClose: () => void;
    isNight: boolean;
    status: WeatherStatus;
    data: WeatherData | null;
    error: string | null;
    effectiveTime: Date;
    sunsetArrowYPosition: number;
    sunriseArrowYPosition: number;
    tempUnit: TempUnit;
}

const convertTemp = (celsius: number, unit: TempUnit): number => {
    if (isNaN(celsius)) return NaN;
    if (unit === 'F') return Math.round((celsius * 9 / 5) + 32);
    return Math.round(celsius);
};

const formatTempWithUnit = (temp: number, unit: TempUnit): string => {
    if (isNaN(temp)) return '--°';
    const symbol = '°';
    return `${temp}${symbol}`;
};

// This function processes weather data to create a 5-hour forecast,
// starting from the "effectiveTime" which may be overridden by the debug controls.
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

    // Find the hourly data for the current effective hour from the debug slider
    const nowHourlyData = data.hourly.find(h => new Date(h.dt * 1000).getHours() === nowHour);

    let nowTemp, nowCond;
    if (nowHourlyData) {
        nowTemp = nowHourlyData.temperature;
        nowCond = nowHourlyData.condition;
    } else {
        // Fallback to the real "current" data if the hourly data is not found for the selected time
        nowTemp = data.current.temperature;
        nowCond = data.current.condition;
    }
    
    const nowForecast = processForecast('Adesso', nowTemp, nowCond, nowDate);

    const nowTimestamp = nowDate.getTime();
    const startIndex = data.hourly.findIndex(forecast => (forecast.dt * 1000) > nowTimestamp);
    
    if (startIndex === -1) {
        const padded = [nowForecast];
        while(padded.length < 5) padded.push({ time: '--:--', temperature: NaN, condition: 'Cloudy', isNight: false, isHot: false, isCold: false });
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
            condition: 'Cloudy',
            isNight: false,
            isHot: false,
            isCold: false
        });
    }
    return allForecasts;
};


export default function WeatherModal({ isOpen, onClose, isNight, status, data, error, effectiveTime, sunsetArrowYPosition, sunriseArrowYPosition, tempUnit }: WeatherModalProps) {
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    const theme = {
        bg: isNight ? 'bg-zinc-800' : 'bg-white',
        textPrimary: isNight ? 'text-zinc-100' : 'text-zinc-700',
        textSecondary: isNight ? 'text-zinc-400' : 'text-zinc-500',
        textAccent: isNight ? 'text-zinc-200' : 'text-zinc-600',
        border: isNight ? 'border-zinc-700' : 'border-gray-200',
        buttonHover: isNight ? 'hover:bg-white/5' : 'hover:bg-black/5',
    };

    const getArrowYPosition = (condition: string) => {
        return condition.toLowerCase().includes('sunrise') ? sunriseArrowYPosition : sunsetArrowYPosition;
    };

    const renderContent = () => {
        if (status === 'locating' || status === 'fetching') {
            const message = status === 'locating' ? 'Sto cercando la tua posizione…' : 'Recupero dati meteo...';
            return (
                <div className="flex flex-col items-center justify-center h-96">
                    <FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} />
                    <p className={`mt-4 ${theme.textSecondary}`}>{message}</p>
                </div>
            );
        }

        if (status === 'error' && error) {
            return (
                <div className="flex flex-col items-center justify-center h-96 text-center px-4">
                    <FiAlertTriangle className="text-4xl text-red-500" />
                    <p id="weather-title" className="mt-4 font-semibold text-lg">Errore Meteo</p>
                    <p className={`mt-2 ${theme.textSecondary}`}>{error}</p>
                </div>
            );
        }

        if (status === 'success' && data) {
            const hourlyForecast = getHourlyForecastToDisplay(data, effectiveTime);
            const nowData = hourlyForecast[0];

            const mainTemp = convertTemp(nowData.temperature, tempUnit);
            const mainUnitSymbol = '°';

            const highTempFormatted = formatTempWithUnit(convertTemp(data.current.high, tempUnit), tempUnit);
            const lowTempFormatted = formatTempWithUnit(convertTemp(data.current.low, tempUnit), tempUnit);

            return (
                <>
                    <header className="flex justify-between items-center">
                        <button onClick={onClose} className={`p-2 ${theme.textSecondary} ${theme.buttonHover} rounded-full`}>
                            <FiX size={22} />
                        </button>
                        <h2 id="weather-title" className="font-bold text-base sm:text-lg md:text-xl text-center">{data.locationName}</h2>
                        <div className="w-10"></div>
                    </header>
                    <div className="flex flex-col items-center text-center my-1 md:my-2">
                        <p className={`text-sm font-medium ${theme.textSecondary}`}>Adesso</p>
                        <div className="relative font-bold tracking-tight leading-none text-7xl sm:text-8xl md:text-9xl">
                            <span>{isNaN(mainTemp) ? '--' : mainTemp}</span>
                            <span className="absolute top-1 -right-3 text-3xl sm:top-2 sm:-right-4 sm:text-4xl md:text-5xl opacity-80">{mainUnitSymbol}</span>
                        </div>
                        <div className="flex flex-col items-center mt-1 md:mt-2">
                            <div className="relative inline-block">
                                <WeatherIcon 
                                    condition={nowData.condition} 
                                    isNight={nowData.isNight} 
                                    className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 ${nowData.isHot ? 'hot-sun' : ''}`}
                                    arrowYPosition={getArrowYPosition(nowData.condition)}
                                />
                                {(nowData.isHot || nowData.isCold) && (
                                    <ExtremeTemp
                                        type={nowData.isHot ? 'hot' : 'cold'}
                                        className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 absolute top-0 right-0"
                                        aria-label={nowData.isHot ? 'Hot temperature warning' : 'Cold temperature warning'}
                                    />
                                )}
                            </div>
                            <div className="flex flex-col items-center mt-1">
                                <p className="font-bold text-base sm:text-lg md:text-xl">{nowData.condition}</p>
                                <p className={`${theme.textSecondary} font-semibold text-sm sm:text-base`}>
                                    <span className={theme.textAccent}>↑{highTempFormatted}</span>
                                    <span className="mx-1">↓{lowTempFormatted}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className={`flex justify-between border-t border-b ${theme.border} py-3 sm:py-4`}>
                        {hourlyForecast.map((hour, index) => {
                            const hourlyFormatted = formatTempWithUnit(convertTemp(hour.temperature, tempUnit), tempUnit);
                            return (
                                <div key={index} className="flex flex-col items-center gap-1 sm:gap-2 w-1/5">
                                    <span className={`text-xs sm:text-sm font-medium ${theme.textSecondary}`}>{hour.time}</span>
                                    <div className="relative inline-block">
                                        <WeatherIcon 
                                          condition={hour.condition} 
                                          isNight={hour.isNight} 
                                          className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 ${hour.isHot ? 'hot-sun' : ''}`} 
                                          arrowYPosition={getArrowYPosition(hour.condition)}
                                        />
                                         {(hour.isHot || hour.isCold) && (
                                            <ExtremeTemp 
                                                type={hour.isHot ? 'hot' : 'cold'}
                                                className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 absolute -top-0.5 -right-0.5"
                                                aria-label={hour.isHot ? 'Hot temperature warning' : 'Cold temperature warning'}
                                            />
                                        )}
                                    </div>
                                    <span className="font-bold text-base sm:text-lg md:text-xl">{hourlyFormatted}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-col gap-y-0 sm:gap-y-1 pt-3 sm:pt-4">
                        <div className={`flex items-center justify-between py-2 md:py-3 border-b ${theme.border}`}>
                            <div className="flex items-center gap-3 sm:gap-4">
                                <ICONS.rainChance className={`w-5 h-5 ${theme.textSecondary}`} />
                                <span className={`${theme.textSecondary} font-medium text-xs sm:text-sm md:text-base`}>Probabilità di pioggia</span>
                            </div>
                            <span className="font-bold text-sm sm:text-base md:text-lg">{data.details.chanceOfRain}%</span>
                        </div>
                        <div className={`flex items-center justify-between py-2 md:py-3 border-b ${theme.border}`}>
                            <div className="flex items-center gap-3 sm:gap-4">
                                <ICONS.humidity className={`w-5 h-5 ${theme.textSecondary}`} />
                                <span className={`${theme.textSecondary} font-medium text-xs sm:text-sm md:text-base`}>Umidità</span>
                            </div>
                            <span className="font-bold text-sm sm:text-base md:text-lg">{data.details.humidity}%</span>
                        </div>
                        <div className={`flex items-center justify-between py-2 md:py-3`}>
                            <div className="flex items-center gap-3 sm:gap-4">
                                <ICONS.wind className={`w-5 h-5 ${theme.textSecondary}`} />
                                <span className={`${theme.textSecondary} font-medium text-xs sm:text-sm md:text-base`}>Vento</span>
                            </div>
                            <span className="font-bold text-sm sm:text-base md:text-lg">{data.details.wind}</span>
                        </div>
                    </div>
                    <footer className={`text-center text-[10px] sm:text-xs ${theme.textSecondary} pt-2 sm:pt-4`}>
                       Ultimo aggiornamento alle {data.lastUpdated.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </footer>
                </>
            );
        }
        
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center px-4">
                <FiAlertTriangle className={`text-4xl ${theme.textSecondary}`} />
                <h2 id="weather-title" className="mt-4 font-semibold text-lg">Posizione non disponibile</h2>
                <p className={`mt-2 ${theme.textSecondary}`}>Le informazioni meteo appariranno qui non appena la posizione sarà rilevata.</p>
            </div>
        );
    };

    return (
        <div 
            className={`fixed inset-0 bg-black/40 backdrop-blur-md z-40 flex justify-center items-center transition-opacity duration-500 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div
                className={`w-11/12 max-w-xs sm:max-w-sm md:max-w-md ${theme.bg} ${theme.textPrimary} rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-12'}`}
                onClick={stopPropagation}
                role="dialog"
                aria-modal="true"
                aria-labelledby="weather-title"
            >
                {renderContent()}
            </div>
        </div>
    );
}