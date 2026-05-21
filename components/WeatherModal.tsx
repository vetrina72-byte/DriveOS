import React from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';
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
                    <div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} />
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
                        <h2 id="weather-title" className="font-bold text-sm sm:text-base md:text-lg text-center">{data.locationName}</h2>
                        <div className="w-10"></div>
                    </header>
                    <div className="flex flex-col items-center text-center my-1 md:my-2">
                        <p className={`text-sm font-medium ${theme.textSecondary}`}>Adesso</p>
                        <div className="relative font-bold tracking-tight leading-none text-6xl sm:text-7xl md:text-8xl">
                            <span>{isNaN(mainTemp) ? '--' : mainTemp}</span>
                            <span className="absolute top-1 -right-2 text-2xl sm:top-1 sm:-right-3 sm:text-3xl md:text-4xl opacity-80">{mainUnitSymbol}</span>
                        </div>
                        <div className="flex flex-col items-center mt-1 md:mt-2">
                            <div className="relative inline-block">
                                <WeatherIcon 
                                    condition={nowData.condition} 
                                    isNight={nowData.isNight} 
                                    className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 ${nowData.isHot ? 'hot-sun' : ''}`}
                                    arrowYPosition={getArrowYPosition(nowData.condition)}
                                />
                                {(nowData.isHot || nowData.isCold) && (
                                    <ExtremeTemp
                                        type={nowData.isHot ? 'hot' : 'cold'}
                                        className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 absolute top-0 right-0"
                                        aria-label={nowData.isHot ? 'Hot temperature warning' : 'Cold temperature warning'}
                                    />
                                )}
                            </div>
                            <div className="flex flex-col items-center mt-1">
                                <p className="font-bold text-sm sm:text-base md:text-lg">{nowData.condition}</p>
                                <p className={`${theme.textSecondary} font-semibold text-xs sm:text-sm`}>
                                    <span className={theme.textAccent}>↑{highTempFormatted}</span>
                                    <span className="mx-1">↓{lowTempFormatted}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className={`flex justify-between border-t border-b ${theme.border} py-2 sm:py-3`}>
                        {hourlyForecast.map((hour, index) => {
                            const hourlyFormatted = formatTempWithUnit(convertTemp(hour.temperature, tempUnit), tempUnit);
                            return (
                                <div key={index} className="flex flex-col items-center gap-0.5 sm:gap-1 w-1/5">
                                    <span className={`text-[10px] sm:text-xs font-medium ${theme.textSecondary}`}>{hour.time}</span>
                                    <div className="relative inline-block">
                                        <WeatherIcon 
                                          condition={hour.condition} 
                                          isNight={hour.isNight} 
                                          className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 ${hour.isHot ? 'hot-sun' : ''}`} 
                                          arrowYPosition={getArrowYPosition(hour.condition)}
                                        />
                                         {(hour.isHot || hour.isCold) && (
                                            <ExtremeTemp 
                                                type={hour.isHot ? 'hot' : 'cold'}
                                                className="w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4 absolute -top-0.5 -right-0.5"
                                                aria-label={hour.isHot ? 'Hot temperature warning' : 'Cold temperature warning'}
                                            />
                                        )}
                                    </div>
                                    <span className="font-bold text-sm sm:text-base md:text-lg">{hourlyFormatted}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-col gap-y-0 pt-2 sm:pt-3">
                        <div className={`flex items-center justify-between py-1.5 md:py-2 border-b ${theme.border}`}>
                            <div className="flex items-center gap-3 sm:gap-4">
                                <ICONS.rainChance className={`w-4 h-4 ${theme.textSecondary}`} />
                                <span className={`${theme.textSecondary} font-medium text-[10px] sm:text-xs md:text-sm`}>Probabilità di pioggia</span>
                            </div>
                            <span className="font-bold text-xs sm:text-sm md:text-base">{data.details.chanceOfRain}%</span>
                        </div>
                        <div className={`flex items-center justify-between py-1.5 md:py-2 border-b ${theme.border}`}>
                            <div className="flex items-center gap-3 sm:gap-4">
                                <ICONS.humidity className={`w-4 h-4 ${theme.textSecondary}`} />
                                <span className={`${theme.textSecondary} font-medium text-[10px] sm:text-xs md:text-sm`}>Umidità</span>
                            </div>
                            <span className="font-bold text-xs sm:text-sm md:text-base">{data.details.humidity}%</span>
                        </div>
                        <div className={`flex items-center justify-between py-1.5 md:py-2`}>
                            <div className="flex items-center gap-3 sm:gap-4">
                                <ICONS.wind className={`w-4 h-4 ${theme.textSecondary}`} />
                                <span className={`${theme.textSecondary} font-medium text-[10px] sm:text-xs md:text-sm`}>Vento</span>
                            </div>
                            <span className="font-bold text-xs sm:text-sm md:text-base">{data.details.wind}</span>
                        </div>
                    </div>
                    <footer className={`text-center text-[9px] sm:text-[10px] ${theme.textSecondary} pt-1 sm:pt-2`}>
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
            className={`fixed inset-0 bg-black/40 backdrop-blur-md z-[9999] flex justify-center items-start pt-[15vh] transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div
                className={`w-11/12 max-w-[240px] sm:max-w-[288px] md:max-w-[336px] ${theme.bg} ${theme.textPrimary} rounded-2xl shadow-xl p-2 sm:p-3 md:p-4 flex flex-col gap-1 sm:gap-2 md:gap-3 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-12'}`}
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