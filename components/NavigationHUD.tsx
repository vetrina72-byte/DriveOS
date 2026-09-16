import React, { useState } from 'react';
import { useWeather } from "../context/WeatherContext";
import { ChevronDown, ChevronUp, X, MapPin } from 'lucide-react';
import { drawArrow, formatDist, buildInstr } from './MapEngineUtils';

interface StepInfo {
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
  name: string;
  ref?: string;
  distance: number;
  duration: number;
  _dfs?: number;
}

interface NavigationHUDProps {
  isActive: boolean;
  destinationName: string;
  steps: StepInfo[];
  currentStepIndex: number;
  remainingDistance: number;
  remainingTime: number;
  vehiclePosition: { lat: number; lng: number } | null;
  onSelectStep?: (location: [number, number], name?: string) => void;
  onCancelNavigation: () => void;
}

export default function NavigationHUD({
  isActive,
  destinationName,
  steps,
  currentStepIndex,
  remainingDistance,
  remainingTime,
  vehiclePosition,
  onSelectStep,
  onCancelNavigation,
}: NavigationHUDProps) {
  const { useDarkTheme: isNight } = useWeather();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);

  if (!isActive || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  if (!currentStep) return null;

  // Key for arrow
  const getStepKey = (step: StepInfo) => {
    if (!step || !step.maneuver) return 'straight';
    const t = (step.maneuver.type || '').toLowerCase();
    const m = (step.maneuver.modifier || '').toLowerCase();
    if (t === 'arrive') return 'arrive';
    if (t === 'depart') return 'depart';
    if (t === 'continue' || t === 'new name' || t === 'notification' || (t === 'turn' && m === 'straight')) return 'straight';
    if (t === 'on ramp' || t === 'off ramp') return m.includes('left') ? 'ramp-left' : 'ramp-right';
    if (t.includes('roundabout') || t.includes('rotary')) return m.includes('left') ? 'roundabout' : 'roundabout-right';
    if (t === 'merge') return m.includes('right') ? 'merge-right' : 'merge';
    if (m === 'uturn') return m.includes('right') ? 'uturn-right' : 'uturn';
    if (m.includes('keep') || t === 'fork') return m.includes('left') ? 'keep-left' : 'keep-right';
    if (m === 'sharp right') return 'sharp-right';
    if (m === 'right') return 'right';
    if (m === 'slight right') return 'slight-right';
    if (m === 'sharp left') return 'sharp-left';
    if (m === 'left') return 'left';
    if (m === 'slight left') return 'slight-left';
    return 'straight';
  };

  const currentArrowKey = getStepKey(currentStep);
  const currentInstruction = buildInstr(currentStep);

  // Compute distance to next step
  let distanceToNext = 0;
  if (vehiclePosition) {
    const loc = currentStep.maneuver.location;
    // dist in km, multiplied to m
    const la1 = vehiclePosition.lat;
    const lo1 = vehiclePosition.lng;
    const la2 = loc[1];
    const lo2 = loc[0];
    const R = 6371e3;
    const p1 = (la1 * Math.PI) / 180;
    const p2 = (la2 * Math.PI) / 180;
    const dp = ((la2 - la1) * Math.PI) / 180;
    const dl = ((lo2 - lo1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    distanceToNext = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  } else {
    distanceToNext = currentStep.distance;
  }

  // Compute ETA
  const eta = new Date(Date.now() + remainingTime * 1000);
  const etaString =
    eta.getHours().toString().padStart(2, '0') +
    ':' +
    eta.getMinutes().toString().padStart(2, '0');
  const durationMinutes = Math.round(remainingTime / 60);
  const durationString =
    durationMinutes < 60
      ? `${durationMinutes} min`
      : `${Math.floor(durationMinutes / 60)}h ${Math.round(durationMinutes % 60)}m`;

  return (
    <div className="absolute top-5 left-5 w-[21.25rem] max-w-[calc(100vw-50px)] flex flex-col gap-3 z-[1002] pointer-events-none">
      {/* Upper Panel direction steps HUD */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full backdrop-blur-md border rounded-2xl shadow-lg overflow-hidden cursor-pointer pointer-events-auto select-none transition-all duration-300 ${isNight ? "bg-neutral-900/85 border-white/10" : "bg-white/90 border-black/10"}`}
      >
        <div className="flex items-center gap-4 p-4">
          <div className="w-14 h-14 rounded-lg bg-emerald-500/15 text-emerald-550 flex items-center justify-center flex-shrink-0 animate-pulse">
            <svg 
              className={`w-10 h-10 fill-current ${isNight ? "text-white" : "text-zinc-900"}`} 
              viewBox="0 -960 960 960"
              dangerouslySetInnerHTML={{ __html: drawArrow(currentArrowKey) }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-2xl font-black tracking-tight ${isNight ? "text-white" : "text-zinc-900"}`}>
              {formatDist(distanceToNext)}
            </div>
            <div className={`text-[1rem] font-medium truncate leading-tight mt-0.5 ${isNight ? "text-zinc-300" : "text-zinc-600"}`}>
              {currentInstruction}
            </div>
          </div>
          <div className={`p-1 transition-colors ${isNight ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}>
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>

        {/* Steps Itinerary List expanded drawer */}
        {isExpanded && (
          <div className={`border-t max-h-[19rem] overflow-y-auto overflow-x-hidden divide-y scrollbar-thin ${isNight ? "border-white/10 divide-white/5 bg-zinc-950/70" : "border-black/10 divide-black/5 bg-zinc-50/95"}`}>
            <div className={`px-4 py-1.5 text-[10px] font-bold tracking-wider uppercase border-b ${isNight ? 'bg-zinc-900/90 text-zinc-400 border-white/5' : 'bg-zinc-100 text-zinc-500 border-black/5'}`}>
              Tocca una svolta per visualizzarla sulla mappa
            </div>
            {steps.map((step, idx) => {
              if (!step || !step.maneuver || step.maneuver.type === 'arrive') return null;
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const isSelected = idx === selectedStepIdx;
              const stepKey = getStepKey(step);
              const instrText = buildInstr(step);

              // Calculate cumulative distance for upcoming steps
              let stepDistanceLabel = '';
              if (!isDone) {
                let cumulative = 0;
                for (let s = currentStepIndex; s < idx; s++) {
                  if (steps[s]) cumulative += steps[s].distance;
                }
                stepDistanceLabel = formatDist(cumulative);
              }

              return (
                <div 
                  key={idx} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStepIdx(idx);
                    if (step.maneuver?.location) {
                      onSelectStep?.(step.maneuver.location, instrText);
                    }
                  }}
                  className={`flex items-center gap-3.5 p-3.5 cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? isNight ? 'bg-blue-600/25 border-l-4 border-blue-500' : 'bg-blue-100/80 border-l-4 border-blue-600'
                      : isCurrent
                        ? isNight ? 'bg-emerald-500/10' : 'bg-emerald-50'
                        : isNight ? 'hover:bg-white/5' : 'hover:bg-black/5'
                  } ${isDone ? 'opacity-40' : 'opacity-100'}`}
                  title="Clicca per visualizzare questo punto sulla mappa"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : isCurrent
                        ? 'bg-emerald-500 text-white'
                        : isNight ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"
                  }`}>
                    <svg 
                      className="w-5 h-5 fill-current" 
                      viewBox="0 -960 960 960"
                      dangerouslySetInnerHTML={{ __html: drawArrow(stepKey) }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {stepDistanceLabel && (
                      <div className={`text-[0.6875rem] font-bold space-x-1 uppercase mb-0.5 ${isNight ? "text-blue-400" : "text-blue-600"}`}>
                        fra {stepDistanceLabel}
                      </div>
                    )}
                    <div className={`text-[0.8125rem] font-medium truncate ${isNight ? "text-zinc-200" : "text-zinc-800"}`}>
                      {instrText}
                    </div>
                  </div>
                  <div className="text-[10px] opacity-40 font-mono">
                    #{idx + 1}
                  </div>
                </div>
              );
            })}

            {/* Final Destination Indicator inside List */}
            {(() => {
              const lastStep = steps[steps.length - 1];
              const destLoc = lastStep?.maneuver?.location;
              return (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStepIdx(steps.length);
                    if (destLoc) {
                      onSelectStep?.(destLoc, destinationName);
                    }
                  }}
                  className={`flex items-center gap-3.5 p-3.5 cursor-pointer transition-all duration-150 ${
                    selectedStepIdx === steps.length
                      ? isNight ? 'bg-red-500/25 border-l-4 border-red-500' : 'bg-red-100 border-l-4 border-red-600'
                      : isNight ? 'bg-zinc-950/40 hover:bg-white/5' : 'bg-black/5 hover:bg-black/10'
                  }`}
                  title="Clicca per visualizzare la destinazione finale"
                >
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">Arrivo</div>
                    <div className="text-[0.8125rem] font-bold truncate text-red-400">{destinationName}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

    </div>
  );
}
