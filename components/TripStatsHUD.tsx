import React from 'react';
import { useWeather } from '../context/WeatherContext';
import { 
  Clock, 
  Navigation, 
  CheckCircle2, 
  Circle, 
  Zap, 
  ShieldCheck, 
  Milestone, 
  Camera, 
  Compass, 
  AlertTriangle,
  Info,
  Construction,
  GitFork,
  TrafficCone,
  Ship,
  Footprints
} from 'lucide-react';
import { RouteOption, RoadHazard } from '../types/maps';

interface TripStatsHUDProps {
  isActive: boolean;
  isRoutePreview?: boolean;
  destinationName: string;
  remainingDistance: number; // in meters
  remainingTime: number; // in seconds
  routes?: RouteOption[];
  selectedRouteIndex?: number;
  upcomingHazard?: { hazard: RoadHazard; distanceMeters: number } | null;
  hazardsSummary?: { cameras: number; signals: number; roadworks?: number; hazards?: number; congestion?: number };
  onSelectRoute?: (index: number) => void;
  onCancelNavigation: () => void;
  onStartNavigation?: () => void;
}

export default function TripStatsHUD({
  isActive,
  isRoutePreview,
  destinationName,
  remainingDistance,
  remainingTime,
  routes = [],
  selectedRouteIndex = 0,
  upcomingHazard,
  hazardsSummary,
  onSelectRoute,
  onCancelNavigation,
  onStartNavigation,
}: TripStatsHUDProps) {
  const { useDarkTheme: isNight } = useWeather();
  if (!isActive && !isRoutePreview) return null;

  // If in route preview, prefer the selected route's metrics
  const activeRoute = isRoutePreview && routes[selectedRouteIndex] ? routes[selectedRouteIndex] : null;
  const displayDist = activeRoute ? activeRoute.distance : remainingDistance;
  const displayTime = activeRoute ? activeRoute.duration : remainingTime;

  const formatDistance = (meters: number) => {
    if (meters == null || isNaN(meters)) return '0 m';
    if (meters >= 1000) {
      const km = (meters / 1000).toFixed(1).replace('.', ',');
      return `${km} km`;
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
      id="nav-bottom-hud"
      className={`absolute bottom-3 left-3 sm:bottom-6 sm:left-6 z-[1003] w-[calc(100%-1.5rem)] sm:w-[24.5rem] max-w-[24.5rem] backdrop-blur-md border rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-4 animate-fade-in transition-all duration-300 pointer-events-auto ${
        isNight
          ? 'bg-neutral-900/95 border-white/15 text-white shadow-black/60'
          : 'bg-white/95 border-zinc-300/80 text-zinc-900 shadow-slate-400/50'
      }`}
    >
      {/* Real-time Proximity Hazard Alert (Navigation Mode) */}
      {isActive && upcomingHazard && upcomingHazard.distanceMeters <= 700 && (
        <div className={`mb-3 p-2.5 rounded-xl border flex items-center gap-2.5 ${
          upcomingHazard.hazard.type === 'speed_camera'
            ? isNight 
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-200' 
              : 'bg-rose-50 border-rose-300 text-rose-900'
            : upcomingHazard.hazard.type === 'roadworks'
              ? isNight
                ? 'bg-amber-950/80 border-amber-500/40 text-amber-200'
                : 'bg-amber-50 border-amber-300 text-amber-900'
              : upcomingHazard.hazard.type === 'congestion'
                ? isNight
                  ? 'bg-red-950/80 border-red-500/40 text-red-200'
                  : 'bg-red-50 border-red-300 text-red-900'
                : isNight
                  ? 'bg-zinc-800/90 border-amber-500/40 text-amber-200'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
        }`}>
          {upcomingHazard.hazard.type === 'speed_camera' ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-600 text-white flex-shrink-0">
              <Camera className="w-4 h-4" />
            </div>
          ) : upcomingHazard.hazard.type === 'roadworks' ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-600 text-white flex-shrink-0">
              <Construction className="w-4 h-4" />
            </div>
          ) : upcomingHazard.hazard.type === 'congestion' ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white flex-shrink-0">
              <TrafficCone className="w-4 h-4" />
            </div>
          ) : upcomingHazard.hazard.type === 'detour' ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white flex-shrink-0">
              <GitFork className="w-4 h-4" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white flex-shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
              <span>
                {upcomingHazard.hazard.type === 'speed_camera'
                  ? `Autovelox tra ${Math.round(upcomingHazard.distanceMeters)}m`
                  : upcomingHazard.hazard.type === 'roadworks'
                    ? `Lavori in corso tra ${Math.round(upcomingHazard.distanceMeters)}m`
                    : upcomingHazard.hazard.type === 'congestion'
                      ? `Rallentamento traffico tra ${Math.round(upcomingHazard.distanceMeters)}m`
                      : upcomingHazard.hazard.type === 'detour'
                        ? `Deviazione tra ${Math.round(upcomingHazard.distanceMeters)}m`
                        : `Semaforo tra ${Math.round(upcomingHazard.distanceMeters)}m`}
              </span>
              {upcomingHazard.hazard.speedLimit && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-rose-700 font-extrabold border border-rose-500">
                  {upcomingHazard.hazard.speedLimit} km/h
                </span>
              )}
            </div>
            <div className="text-[11px] opacity-85 truncate">
              {upcomingHazard.hazard.description || (
                upcomingHazard.hazard.type === 'speed_camera'
                  ? 'Rilevatore velocità attivo sul tratto'
                  : upcomingHazard.hazard.type === 'roadworks'
                    ? 'Cantiere stradale • Restringimento di carreggiata'
                    : 'Impianto semaforico controllato'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Destination Name Header */}
      <div className="flex items-center justify-between mb-2.5 gap-2">
        <div
          id="nb-dest"
          className={`text-xs font-bold uppercase tracking-wider truncate flex-1 ${
            isNight ? 'text-zinc-300' : 'text-zinc-600'
          }`}
        >
          {destinationName || 'Destinazione'}
        </div>
        {isRoutePreview && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20 whitespace-nowrap">
            Opzioni percorso
          </span>
        )}
      </div>

      {/* Main Stats: Structured Clean Layout */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-inherit">
        {/* Left: Clock Icon + ETA + Duration */}
        <div className="flex items-start gap-2.5">
          <div
            className={`p-2 rounded-xl mt-0.5 ${
              isNight ? 'bg-zinc-800 text-blue-400' : 'bg-blue-50 text-blue-600'
            }`}
          >
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div
              id="nb-eta"
              className={`text-2xl font-black tracking-tight leading-none ${
                isNight ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {computeETA(displayTime)}
            </div>
            <div
              id="nb-min"
              className={`text-xs font-semibold mt-1 ${
                isNight ? 'text-zinc-300' : 'text-zinc-600'
              }`}
            >
              {formatDuration(displayTime)}
            </div>
          </div>
        </div>

        {/* Right: Road Icon + Distance */}
        <div className="flex items-center gap-2 pl-3 border-l border-inherit">
          <div
            className={`p-2 rounded-xl ${
              isNight ? 'bg-zinc-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <Navigation className="w-4 h-4 rotate-45" />
          </div>
          <div>
            <div
              id="nb-km"
              className={`text-lg font-extrabold tracking-tight ${
                isNight ? 'text-white' : 'text-zinc-900'
              }`}
            >
              {formatDistance(displayDist)}
            </div>
            <div
              className={`text-[11px] font-medium leading-tight ${
                isNight ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              distanza
            </div>
          </div>
        </div>
      </div>

      {/* Route hazards counter on current selected route */}
      {hazardsSummary && (hazardsSummary.cameras > 0 || hazardsSummary.signals > 0 || (hazardsSummary.roadworks ?? 0) > 0 || (hazardsSummary.hazards ?? 0) > 0) && (
        <div className={`mb-3 py-1.5 px-3 rounded-xl text-[11px] font-semibold flex items-center justify-between flex-wrap gap-1 ${
          isNight ? 'bg-zinc-800/60 text-zinc-300 border border-white/5' : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
        }`}>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Condizioni tratta:</span>
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {hazardsSummary.cameras > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-500 font-bold">
                <Camera className="w-3 h-3" />
                {hazardsSummary.cameras} {hazardsSummary.cameras === 1 ? 'Autovelox' : 'Autovelox'}
              </span>
            )}
            {hazardsSummary.signals > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-500 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                {hazardsSummary.signals} {hazardsSummary.signals === 1 ? 'Semaforo' : 'Semafori'}
              </span>
            )}
            {(hazardsSummary.roadworks ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                <Construction className="w-3 h-3" />
                {hazardsSummary.roadworks} {hazardsSummary.roadworks === 1 ? 'Cantiere' : 'Cantieri'}
              </span>
            )}
            {(hazardsSummary.hazards ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-orange-500 font-bold">
                <AlertTriangle className="w-3 h-3" />
                {hazardsSummary.hazards} Pericolo
              </span>
            )}
          </div>
        </div>
      )}

      {/* Last-Mile Pedestrian Access Notice */}
      {((isRoutePreview && activeRoute?.lastMileWalk?.isWalkingRequired) || (isActive && routes[selectedRouteIndex]?.lastMileWalk?.isWalkingRequired)) && (
        <div className={`mb-3 p-2.5 rounded-xl border flex items-start gap-2.5 ${
          isNight 
            ? 'bg-amber-950/70 border-amber-500/50 text-amber-200' 
            : 'bg-amber-50 border-amber-300 text-amber-900'
        }`}>
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 text-white flex-shrink-0 mt-0.5 shadow-sm">
            <Footprints className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span>Tratto finale a piedi</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-500/30">
                {routes[selectedRouteIndex]?.lastMileWalk?.distanceMeters || activeRoute?.lastMileWalk?.distanceMeters} m
              </span>
            </div>
            <div className="text-[11px] leading-snug mt-0.5 opacity-90">
              {routes[selectedRouteIndex]?.lastMileWalk?.warningMessage || activeRoute?.lastMileWalk?.warningMessage || 'Destinazione raggiungibile solo a piedi negli ultimi metri (strada non percorribile in auto).'}
            </div>
          </div>
        </div>
      )}

      {/* Alternative Routes Selection List (During Route Preview) */}
      {isRoutePreview && routes.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                isNight ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              Percorsi disponibili ({routes.length})
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">
              Tocca per visualizzare
            </span>
          </div>
          <div className="max-h-[16rem] overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
            {routes.map((rt) => {
              const isSelected = rt.index === selectedRouteIndex;
              const badgeType = rt.badgeType || (rt.index === 0 ? 'fastest' : 'alternative');
              const hasRealDelay = rt.trafficDelaySeconds && rt.trafficDelaySeconds > 60;
              const delayMins = hasRealDelay ? Math.round((rt.trafficDelaySeconds || 0) / 60) : 0;

              return (
                <button
                  key={`route-opt-${rt.index}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRoute?.(rt.index);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? isNight
                        ? 'bg-zinc-800/90 border-white/30 text-white shadow-sm'
                        : 'bg-zinc-100 border-zinc-400 text-zinc-900 shadow-sm'
                      : isNight
                      ? 'bg-zinc-900/40 border-white/5 text-zinc-300 hover:bg-zinc-800/60'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {/* Top line: Radio check, Duration, ETA & Distinct Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      )}
                      <span className={`text-[13px] font-black ${isSelected ? (isNight ? 'text-white' : 'text-zinc-950') : ''}`}>
                        {formatDuration(rt.duration)}
                      </span>
                      <span className="text-zinc-400 text-xs">•</span>
                      <span className={`text-xs font-semibold ${isNight ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        {formatDistance(rt.distance)}
                      </span>
                    </div>

                    {/* Distinct Route Typology Badge - Clean Apple-like monochrome */}
                    <div className="flex items-center gap-1">
                      {rt.hasFerry && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isNight ? 'bg-zinc-800 text-zinc-100 border border-white/15' : 'bg-zinc-200 text-zinc-900 border border-zinc-300'
                        }`}>
                          <Ship className="w-3 h-3 text-current" />
                          Traghetto
                        </span>
                      )}
                      {badgeType === 'fastest' ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isNight ? 'bg-zinc-800 text-zinc-100 border border-white/15' : 'bg-zinc-200 text-zinc-900 border border-zinc-300'
                        }`}>
                          <Zap className="w-3 h-3 text-current" />
                          Più veloce
                        </span>
                      ) : badgeType === 'shortest' ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isNight ? 'bg-zinc-800 text-zinc-100 border border-white/15' : 'bg-zinc-200 text-zinc-900 border border-zinc-300'
                        }`}>
                          <Milestone className="w-3 h-3 text-current" />
                          Più breve
                        </span>
                      ) : badgeType === 'toll_free' ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isNight ? 'bg-zinc-800 text-zinc-100 border border-white/15' : 'bg-zinc-200 text-zinc-900 border border-zinc-300'
                        }`}>
                          <ShieldCheck className="w-3 h-3 text-current" />
                          No pedaggi
                        </span>
                      ) : null}

                      {/* Walking indicator if route ends with pedestrian walk */}
                      {rt.lastMileWalk?.isWalkingRequired && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Footprints className="w-3 h-3 text-amber-500" />
                          +{rt.lastMileWalk.distanceMeters}m a piedi
                        </span>
                      )}

                      {/* Time delta relative to fastest */}
                      {rt.timeDiffMinutes > 0 && badgeType !== 'fastest' && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                          isNight ? 'bg-zinc-800/80 text-zinc-400' : 'bg-zinc-200/80 text-zinc-600'
                        }`}>
                          +{rt.timeDiffMinutes} min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Road Tag and Factual Traffic Condition */}
                  <div className="flex items-center justify-between text-[11px] font-medium pl-5">
                    <span className={`truncate ${isSelected ? (isNight ? 'text-zinc-200 font-semibold' : 'text-zinc-800 font-semibold') : (isNight ? 'text-zinc-400' : 'text-zinc-500')}`}>
                      {rt.tag || rt.label || 'Via principale'}
                    </span>

                    {hasRealDelay ? (
                      <span className="flex-shrink-0 text-[10px] font-bold text-amber-500 dark:text-amber-400">
                        +{delayMins} min traffico
                      </span>
                    ) : (
                      <span className="flex-shrink-0 text-[10px] font-medium opacity-70">
                        Traffico regolare
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isRoutePreview && onStartNavigation ? (
          <button
            id="nb-start"
            onClick={(e) => {
              e.stopPropagation();
              onStartNavigation();
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-sm py-3 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5"
          >
            <span>Inizia Viaggio</span>
          </button>
        ) : null}
        <button
          id="nb-stop"
          onClick={(e) => {
            e.stopPropagation();
            onCancelNavigation();
          }}
          className={`flex-1 border active:scale-[0.98] text-sm font-semibold py-3 rounded-xl cursor-pointer transition-all ${
            isNight
              ? 'bg-zinc-800/80 border-white/10 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950'
          }`}
        >
          {isRoutePreview ? 'Annulla' : 'Esci'}
        </button>
      </div>
    </div>
  );
}
