import React, { useState } from 'react';
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
  onCancelNavigation,
}: NavigationHUDProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div className="w-full flex flex-col gap-3 relative z-30 pointer-events-none">
      {/* Upper Panel direction steps HUD */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden cursor-pointer pointer-events-auto select-none transition-all duration-300"
      >
        <div className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/15 text-emerald-550 flex items-center justify-center flex-shrink-0 animate-pulse">
            <svg 
              className="w-10 h-10 fill-current text-white" 
              viewBox="0 -960 960 960"
              dangerouslySetInnerHTML={{ __html: drawArrow(currentArrowKey) }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold text-white tracking-tight">
              {formatDist(distanceToNext)}
            </div>
            <div className="text-[14px] text-zinc-300 font-medium truncate leading-tight mt-0.5">
              {currentInstruction}
            </div>
          </div>
          <div className="text-zinc-400 p-1 hover:text-white transition-colors">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>

        {/* Steps Itinerary List expanded drawer */}
        {isExpanded && (
          <div className="border-t border-white/10 max-h-[290px] overflow-y-auto overflow-x-hidden divide-y divide-white/5 bg-zinc-950/40 scrollbar-thin">
            {steps.map((step, idx) => {
              if (!step || !step.maneuver || step.maneuver.type === 'arrive') return null;
              const isDone = idx < currentStepIndex;
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
                  className={`flex gap-4 p-3.5 transition-opacity ${
                    isDone ? 'opacity-35 line-through' : 'opacity-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <svg 
                      className="w-6 h-6 fill-current text-zinc-300" 
                      viewBox="0 -960 960 960"
                      dangerouslySetInnerHTML={{ __html: drawArrow(stepKey) }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {stepDistanceLabel && (
                      <div className="text-[11px] font-bold text-blue-400 space-x-1 uppercase mb-0.5">
                        fra {stepDistanceLabel}
                      </div>
                    )}
                    <div className="text-[13px] text-zinc-200 font-medium truncate">
                      {instrText}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Final Destination Indicator inside List */}
            <div className="flex gap-4 p-3.5 bg-zinc-950/20">
              <div className="w-8 h-8 rounded-full bg-red-950/30 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="text-[13px] text-red-400 font-bold">{destinationName}</div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
