import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { useWeather } from '../context/WeatherContext';
import { useTelemetryData } from '../hooks/useTelemetry';
import { ICONS } from '../constants';
import { routeStore } from './routeStore';
import { formatTravelTime } from './NavigateTool';
import VehicleArrowIcon from './VehicleArrowIcon';

function calculateGeoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2-lat1);
    const dLon = deg2rad(lon2-lon1); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

interface NavigationStatusProps {
  width: number;
  widgetBgColor: string;
}

export default function NavigationStatus({ width, widgetBgColor }: NavigationStatusProps) {
  const {
    navigationTarget: target,
    throttledPosition: currentPosition,
    handleCancelNavigation: onCancel,
    tripInfo,
  } = useNavigation();
  const { simulatedRemainingDistance } = useTelemetryData();

  const { useDarkTheme: isNight } = useWeather();

  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [remainingDistance, setRemainingDistance] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const routeRef = useRef<[number, number][] | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const arrowIndicatorRef = useRef<HTMLDivElement>(null);
  const isNewTrip = useRef(false);
  const ARROW_SIZE = 22;

  useEffect(() => {
    const unsubscribe = routeStore.subscribe(coords => {
      routeRef.current = coords;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (target && tripInfo) {
      const totalDistKm = tripInfo.distance / 1000;
      setTotalDistance(totalDistKm);
      setRemainingDistance(totalDistKm);
      setRemainingTime(tripInfo.time / 60); 
      isNewTrip.current = true;
    } else {
      setTotalDistance(null);
      setRemainingDistance(null);
      setRemainingTime(null);
    }
  }, [target, tripInfo]);

  useEffect(() => {
    if (!currentPosition || !routeRef.current || totalDistance === null) return;
    
    if (isNewTrip.current) {
      isNewTrip.current = false;
      return;
    }

    let minDistanceSq = Infinity;
    let closestIndex = 0;
    
    for (let i = 0; i < routeRef.current.length; i++) {
      const dLat = routeRef.current[i][0] - currentPosition.lat;
      const dLng = routeRef.current[i][1] - currentPosition.lng;
      const distSq = dLat * dLat + dLng * dLng;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestIndex = i;
      }
    }

    let remDist = 0;
    for (let i = closestIndex; i < routeRef.current.length - 1; i++) {
      remDist += calculateGeoDistance(routeRef.current[i][0], routeRef.current[i][1], routeRef.current[i+1][0], routeRef.current[i+1][1]);
    }
    
    setRemainingDistance(remDist);

    if (tripInfo?.time && totalDistance > 0) {
      const timeInMinutes = tripInfo.time / 60;
      const remainingTimeCalc = (remDist / totalDistance) * timeInMinutes;
      setRemainingTime(remainingTimeCalc);
    } else {
      setRemainingTime(null);
    }

    if (remDist < 0.05) { 
      onCancel('Sei arrivato a destinazione!');
    }

  }, [currentPosition, totalDistance, onCancel, tripInfo]);

  const { percent } = useMemo(() => {
    const track = trackRef.current;
    if (!track) {
      return { percent: 0 };
    }
    
    const effectiveRemaining = simulatedRemainingDistance ?? remainingDistance;
    const hasRouteData = totalDistance !== null && totalDistance > 0 && effectiveRemaining !== null;

    if (!hasRouteData) {
      return { percent: 0 };
    }

    const p = totalDistance > 0 ? 1 - (effectiveRemaining / totalDistance) : 0;
    const clampedP = Math.max(0, Math.min(1, p));
    
    return { percent: clampedP };
  }, [totalDistance, remainingDistance, simulatedRemainingDistance]);

  useEffect(() => {
    const arrow = arrowIndicatorRef.current;
    if (arrow) {
      arrow.style.opacity = '1';
    }
  }, [percent]);

  const theme = {
    bg: 'var(--player-bg)',
  };

  if (!target) return null;

  return (
    <div 
      className="relative backdrop-blur-md rounded-2xl border border-white/10 shadow-lg flex flex-col transition-all duration-300 ease-in-out flex-shrink-0"
      style={{ 
        width: `${(width) / 16}rem`,
        height: '7.0625rem',
        background: !isNight ? widgetBgColor : theme.bg
      }}
    >
      <div className="p-3 sm:p-4 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start gap-1.5">
          <div className="flex-grow min-w-0 pr-1">
            <p className={`font-semibold truncate text-sm sm:text-base ${isNight ? 'text-zinc-100' : 'text-zinc-800'}`}>{target.name}</p>
            <div className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
              <span>{formatTravelTime(remainingTime)}</span>
              <span className="text-[10px] sm:text-xs">&#9679;</span>
              <span>{remainingDistance?.toFixed(1) ?? '--'} km</span>
            </div>
          </div>
          <button onClick={() => onCancel('Navigazione terminata.')} className={`flex-shrink-0 flex items-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer select-none active:scale-95 ${isNight ? 'bg-red-800/50 hover:bg-red-800/80 text-red-200' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}>
            <ICONS.endTrip className="w-3.5 h-3.5 shrink-0" />
            <span>Termina</span>
          </button>
        </div>

        <div className="relative w-full h-10">
          <div 
            ref={trackRef} 
            className="absolute top-1/2 -translate-y-1/2 w-full h-2.5"
          >
            <div 
              className="w-full h-full rounded-full"
              style={{ backgroundColor: isNight ? 'rgba(90, 90, 100, 0.6)' : '#e5e7eb' }} 
            />
            <div 
              className="absolute top-0 left-0 h-full rounded-full bg-blue-500" 
              style={{ 
                width: `${percent * 100}%`
              }} 
            />
          </div>

          <div 
            ref={arrowIndicatorRef}
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-150 ease-out z-10"
            style={{ 
                left: `calc(${percent * 100}% - ${(ARROW_SIZE / 2) / 16}rem)`,
                width: `${(ARROW_SIZE) / 16}rem`,
                height: `${(ARROW_SIZE) / 16}rem`,
            }}
            aria-label="Vehicle position indicator"
          >
            <VehicleArrowIcon size={ARROW_SIZE} bearing={90} />
          </div>
        </div>
      </div>
    </div>
  );
}
