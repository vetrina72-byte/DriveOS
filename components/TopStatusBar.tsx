import React, { useState, useEffect } from 'react';
import WeatherIcon, { ExtremeTemp } from './WeatherIcon';
import type { WeatherData, TempUnit } from '../types';

type TimeParts = {
  time: string;
  ampm: string | null;
};

export default function TopStatusBar({ 
  isNight, 
  onWeatherClick, 
  weatherData,
  weatherCondition,
  sunsetArrowYPosition,
  sunriseArrowYPosition,
  isHot,
  isCold,
  tempUnit,
  setTempUnit,
  scale,
  offsetY,
  mapStyle,
  isMapVisible,
}: { 
  isNight: boolean, 
  onWeatherClick: () => void, 
  weatherData: WeatherData | null,
  weatherCondition: string,
  sunsetArrowYPosition: number,
  sunriseArrowYPosition: number,
  isHot: boolean,
  isCold: boolean,
  tempUnit: TempUnit,
  setTempUnit: React.Dispatch<React.SetStateAction<TempUnit>>,
  scale: number,
  offsetY: number,
  mapStyle: string,
  isMapVisible: boolean,
}) {
  const [use24HourFormat, setUse24HourFormat] = useState(false);
  const [timeParts, setTimeParts] = useState<TimeParts>({ time: '', ampm: null });
  const [isTimeFlipping, setIsTimeFlipping] = useState(false);
  const [isTempFlipping, setIsTempFlipping] = useState(false);

  const formatTimeParts = (date: Date, is24Hour: boolean): TimeParts => {
    if (is24Hour) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return { time: `${hours}:${minutes}`, ampm: null };
    } else {
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // The hour '0' should be '12'
      return { time: `${hours.toString()}:${minutes}`, ampm };
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const update = () => setTimeParts(formatTimeParts(new Date(), use24HourFormat));
    
    update();

    const seconds = new Date().getSeconds();
    const firstDelay = (60 - seconds) * 1000;

    const timeoutId = setTimeout(() => {
      update();
      intervalId = setInterval(update, 60000);
    }, firstDelay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [use24HourFormat]);

  const toggleTimeFormat = () => {
    if (isTimeFlipping) return;

    setIsTimeFlipping(true);

    setTimeout(() => {
        setUse24HourFormat(prev => !prev);
    }, 250);

    setTimeout(() => {
        setIsTimeFlipping(false);
    }, 500);
  };

  const handleTempClick = () => {
    if (isTempFlipping) return;

    setIsTempFlipping(true);

    setTimeout(() => {
      setTempUnit(currentUnit => (currentUnit === 'C' ? 'F' : 'C'));
    }, 250);

    setTimeout(() => {
      setIsTempFlipping(false);
    }, 500);
  };

  const convertAndFormatTemp = (celsius: number | undefined, unit: TempUnit): string => {
    if (celsius === undefined || isNaN(celsius)) return '--°C';

    let temp: number;
    let unitSymbol: string;

    switch (unit) {
      case 'F':
        temp = Math.round((celsius * 9 / 5) + 32);
        unitSymbol = '°F';
        break;
      case 'C':
      default:
        temp = Math.round(celsius);
        unitSymbol = '°C';
        break;
    }
    return `${temp}${unitSymbol}`;
  };


  const isSunrise = weatherCondition.toLowerCase().includes('sunrise');
  const arrowYPosition = isSunrise ? sunriseArrowYPosition : sunsetArrowYPosition;

  const temperatureText = convertAndFormatTemp(weatherData?.current.temperature, tempUnit);
  
  const lowerCond = weatherCondition.toLowerCase();
  const isGloomyDay = !isNight && (lowerCond.includes('pioggia') || lowerCond.includes('temporale') || lowerCond.includes('rovescio'));
  const isSatellite = mapStyle === 'satellite';
  const isSatelliteAndVisible = isSatellite && isMapVisible;
  const textColor = (isNight || isGloomyDay || isSatelliteAndVisible) ? 'text-white' : 'text-gray-800';
  const shadowClass = isSatelliteAndVisible ? 'text-shadow' : '';

  return (
    <header 
      className="absolute top-2 left-0 right-0 h-16 flex justify-center items-start z-50"
      aria-label="Status Bar"
      style={{ transform: `translateY(${offsetY}px)` }}
    >
      <div
        className={`flex items-center text-lg font-medium transition-colors duration-300 pt-1.5 ${textColor} ${shadowClass} gap-3`}
        style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center top'
        }}
      >
         <button 
            onClick={toggleTimeFormat} 
            aria-label="Toggle time format" 
            className="px-2 hover:opacity-80 text-center"
          >
            <span className={`inline-flex w-full items-baseline justify-center ${isTimeFlipping ? 'time-slide-animation' : ''}`}>
              <span>{timeParts.time}</span>
              {timeParts.ampm && <span className="ml-1 text-sm">{timeParts.ampm}</span>}
            </span>
         </button>
         
         <div className="w-px h-5 bg-current opacity-30"></div>

         <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={onWeatherClick} className="flex items-center transition-opacity hover:opacity-80" aria-label="Open weather details">
              <div className="relative">
                <WeatherIcon 
                  condition={weatherCondition} 
                  isNight={isNight}
                  className={`w-9 h-9 ${isHot ? 'hot-sun' : ''}`} 
                  arrowYPosition={arrowYPosition}
                />
                {(isHot || isCold) && (
                    <ExtremeTemp 
                        type={isHot ? 'hot' : 'cold'}
                        className="w-4 h-4 absolute -top-1 -right-1"
                        aria-label={isHot ? 'Hot temperature warning' : 'Cold temperature warning'}
                    />
                )}
              </div>
            </button>
            <button onClick={handleTempClick} className="font-semibold transition-opacity hover:opacity-80" aria-label="Switch temperature unit">
              <span className={`inline-block w-14 text-left ${isTempFlipping ? 'time-slide-animation' : ''}`}>
                {temperatureText}
              </span>
            </button>
         </div>
      </div>
    </header>
  );
}
