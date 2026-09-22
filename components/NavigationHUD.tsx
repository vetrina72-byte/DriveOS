import React, { useState } from 'react';
import { useWeather } from "../context/WeatherContext";
import { ChevronDown, ChevronUp, X, MapPin } from 'lucide-react';
import { drawArrow, formatDist, buildInstr, getKey } from './MapEngineUtils';

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

  const currentStep = steps[currentStepIndex] || steps[0];
  const isVisible = isActive && steps.length > 0 && !!currentStep;

  if (!currentStep) return null;

  // Key for arrow
  const getStepKey = (step: StepInfo) => {
    return getKey(step);
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
    <div
      className={`absolute top-3 left-3 sm:top-5 sm:left-5 w-[calc(100%-4.5rem)] sm:w-[21.25rem] max-w-[21.25rem] flex flex-col gap-2 sm:gap-3 z-[1002] transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 -translate-y-6 scale-95 pointer-events-none'
      }`}
    >
      {/* Upper Panel direction steps HUD */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full backdrop-blur-md border rounded-xl sm:rounded-2xl shadow-lg overflow-hidden cursor-pointer pointer-events-auto select-none transition-all duration-300 ${isNight ? "bg-neutral-900/85 border-white/10" : "bg-white/90 border-black/10"}`}
      >
        <div className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-4">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (currentStep?.maneuver?.location) {
                onSelectStep?.(currentStep.maneuver.location, currentInstruction);
              }
            }}
            title="Tocca per visualizzare la prossima svolta sulla mappa"
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 text-emerald-500 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer border border-emerald-500/30"
          >
            <svg 
              className={`w-7 h-7 sm:w-10 sm:h-10 fill-current ${isNight ? "text-emerald-400" : "text-emerald-600"}`} 
              viewBox="0 -960 960 960"
              dangerouslySetInnerHTML={{ __html: drawArrow(currentArrowKey) }}
            />
          </button>
          <div className="flex-1 min-w-0">
            <div className={`text-xl sm:text-2xl font-black tracking-tight ${isNight ? "text-white" : "text-zinc-900"}`}>
              {formatDist(distanceToNext)}
            </div>
            <div className={`text-xs sm:text-[1rem] font-medium truncate leading-tight mt-0.5 ${isNight ? "text-zinc-300" : "text-zinc-600"}`}>
              {currentInstruction}
            </div>
          </div>
          <div className={`p-1 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-400' : (isNight ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900')}`}>
            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Steps Itinerary List expanded drawer with CSS grid smooth animation */}
        <div
          className={`grid transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isExpanded
              ? 'grid-rows-[1fr] opacity-100 border-t'
              : 'grid-rows-[0fr] opacity-0 border-t-0'
          } ${isNight ? 'border-white/10' : 'border-black/10'}`}
        >
          <div className="overflow-hidden">
            <div className={`max-h-[14rem] sm:max-h-[19rem] overflow-y-auto overflow-x-hidden divide-y scrollbar-thin ${isNight ? "divide-white/5 bg-zinc-950/70" : "divide-black/5 bg-zinc-50/95"}`}>
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
          </div>
        </div>
      </div>

      {/* Re-center floating chip when user is inspecting steps */}
      {selectedStepIdx !== null && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedStepIdx(null);
            if (vehiclePosition) {
              onSelectStep?.([vehiclePosition.lng, vehiclePosition.lat], 'Posizione veicolo');
            }
          }}
          className={`self-start px-3.5 py-2 rounded-xl backdrop-blur-md shadow-xl border pointer-events-auto flex items-center gap-2 text-xs font-bold transition-all active:scale-95 animate-fadeIn ${
            isNight 
              ? 'bg-blue-600/90 text-white border-blue-400/30 hover:bg-blue-500' 
              : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span>Centra su veicolo</span>
        </button>
      )}
    </div>
  );
}
