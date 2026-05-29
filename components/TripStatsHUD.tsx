import React from 'react';

interface TripStatsHUDProps {
  isActive: boolean;
  destinationName: string;
  remainingDistance: number; // in meters
  remainingTime: number; // in seconds
  onCancelNavigation: () => void;
}

export default function TripStatsHUD({
  isActive,
  destinationName,
  remainingDistance,
  remainingTime,
  onCancelNavigation,
}: TripStatsHUDProps) {
  if (!isActive) return null;

  // Formatting helpers
  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h} h ${m} min`;
    }
    return `${minutes} min`;
  };

  const computeETA = (seconds: number) => {
    const etaDate = new Date(Date.now() + seconds * 1000);
    const hrs = etaDate.getHours().toString().padStart(2, '0');
    const mins = etaDate.getMinutes().toString().padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  return (
    <div 
      id="nav-bottom"
      className="absolute bottom-6 left-6 z-[1003] w-[360px] max-w-[calc(100vw-48px)] bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-5 text-white animate-fade-in transition-all duration-500 pointer-events-auto"
    >
      <div className="flex justify-between items-baseline mb-1.5">
        <div id="nb-eta" className="text-3xl font-extrabold tracking-tight text-white">
          {computeETA(remainingTime)}
        </div>
        <div className="text-sm font-medium text-zinc-400">
          <span id="nb-min" className="text-zinc-200 font-semibold mr-2">
            {formatDuration(remainingTime)}
          </span>
          <span id="nb-km" className="text-zinc-200 font-semibold">
            {formatDistance(remainingDistance)}
          </span>
        </div>
      </div>
      <div id="nb-dest" className="text-sm font-medium text-zinc-500 truncate mb-4">
        {destinationName || 'Destinazione'}
      </div>
      <div className="flex gap-2.5">
        <button 
          id="nb-stop" 
          onClick={(e) => {
            e.stopPropagation();
            onCancelNavigation();
          }}
          className="flex-1 bg-zinc-800/80 border border-white/5 hover:bg-zinc-700/80 active:scale-95 text-red-500 font-bold text-sm py-3.5 rounded-xl cursor-pointer transition-all"
        >
          Esci
        </button>
      </div>
    </div>
  );
}
