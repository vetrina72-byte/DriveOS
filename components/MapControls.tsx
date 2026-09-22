import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { globalRadarService, WeatherFrame } from "../services/RadarService";

interface MapControlsProps {
  isNight?: boolean;
  isNavigating?: boolean;
  isSearchOpen?: boolean;
  cmode: 'north-up' | 'heading-up';
  is3D?: boolean;
  bearing: number;
  isSatellite: boolean;
  isWeatherActive: boolean;
  isMapFollowing: boolean;
  radarOpacity?: number;
  onToggleCompass: () => void;
  onToggle3D?: () => void;
  onToggleSatellite: () => void;
  onToggleWeather: () => void;
  onRecenter: () => void;
  onWeatherFrameChange?: (frame: WeatherFrame, index: number, isFuture: boolean) => void;
  onOpacityChange?: (opacity: number) => void;
}

export default function MapControls({
  isNight = true,
  isNavigating = false,
  isSearchOpen = false,
  cmode,
  is3D = false,
  bearing,
  isSatellite,
  isWeatherActive,
  isMapFollowing,
  radarOpacity = 0.6,
  onToggleCompass,
  onToggle3D,
  onToggleSatellite,
  onToggleWeather,
  onRecenter,
  onWeatherFrameChange,
  onOpacityChange,
}: MapControlsProps) {
  const [isControlsHovered, setIsControlsHovered] = useState(false);
  const [userInteracting, setUserInteracting] = useState(false);
  const interactTimerRef = useRef<NodeJS.Timeout | null>(null);

  const registerInteraction = (durationMs = 4000) => {
    setUserInteracting(true);
    if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
    interactTimerRef.current = setTimeout(() => {
      setUserInteracting(false);
    }, durationMs);
  };

  useEffect(() => {
    const handleInteract = () => {
      registerInteraction(4000);
    };
    window.addEventListener('map-user-interaction', handleInteract);
    return () => {
      window.removeEventListener('map-user-interaction', handleInteract);
      if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
    };
  }, []);

  // When camera returns to follow mode (centered on vehicle), immediately reset interaction state to close buttons
  useEffect(() => {
    if (isMapFollowing) {
      setUserInteracting(false);
      if (interactTimerRef.current) {
        clearTimeout(interactTimerRef.current);
        interactTimerRef.current = null;
      }
    }
  }, [isMapFollowing]);

  // Secondary buttons are open when user explores map away from position (!isMapFollowing)
  // or explicitly hovers/taps the compass control area
  const showSecondary = !isMapFollowing || isControlsHovered || (userInteracting && isMapFollowing);
  const isRotatedFromNorth = Math.abs(bearing) > 2;

  // Weather timeline states
  const [wTs, setWTs] = useState<WeatherFrame[]>([]);
  const [wFr, setWFr] = useState<number>(-1);
  const [wPlay, setWPlay] = useState<boolean>(false);
  const [wNow, setWNow] = useState<number>(-1);
  const [currentTimeLabel, setCurrentTimeLabel] = useState<string>('');
  const [isFutureFrame, setIsFutureFrame] = useState<boolean>(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Continuous unwrapped angle for compass dial to avoid 360° flips across 0/180 boundaries
  const unwrappedAngleRef = useRef(-bearing);
  const prevBearingRef = useRef(bearing);

  if (bearing !== prevBearingRef.current) {
    const rawDiff = -bearing - unwrappedAngleRef.current;
    const normalizedDiff = ((rawDiff % 360) + 540) % 360 - 180;
    unwrappedAngleRef.current += normalizedDiff;
    prevBearingRef.current = bearing;
  }
  const dialAngle = unwrappedAngleRef.current;

  // Clean play timers on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, []);

  // Fetch Rainviewer maps json when radar is toggled on
  useEffect(() => {
    if (isWeatherActive) {
      const fetchRadar = async () => {
        try {
          const { past, nowcast } = await globalRadarService.fetchFrames();
          let frames = [...past, ...nowcast];
          if (frames.length === 0) {
            console.warn("Nessun fotogramma radar disponibile.");
            return;
          }
          setWTs(frames);
          setWNow(past.length > 0 ? past.length - 1 : 0);
          const initialIdx = past.length > 0 ? past.length - 1 : 0;
          setWFr(initialIdx);
          updateFrameInfo(frames, initialIdx, past.length);
          startPlayback(frames, initialIdx, past.length);
        } catch (e) {
          console.error('[WEATHER] Failed to load radar config', e);
        }
      };
      fetchRadar();
    } else {
      stopPlayback();
      setWTs([]);
      setWFr(-1);
    }
  }, [isWeatherActive]);

  const updateFrameInfo = (frames: WeatherFrame[], index: number, boundaryIdx: number) => {
    const frame = frames[index];
    if (!frame) return;
    const date = new Date(frame.time * 1000);
    const isFut = index >= boundaryIdx;
    setIsFutureFrame(isFut);
    setCurrentTimeLabel(
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    );
    if (onWeatherFrameChange) {
      onWeatherFrameChange(frame, index, isFut);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (wPlay) {
      stopPlayback();
    }
    const idx = parseInt(e.target.value);
    setWFr(idx);
    updateFrameInfo(wTs, idx, wNow);
  };

  const startPlayback = (frames: WeatherFrame[], starIndex: number, boundaryIn: number) => {
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    setWPlay(true);
    let nextIdx = starIndex;
    playIntervalRef.current = setInterval(() => {
      nextIdx = (nextIdx + 1) % frames.length;
      setWFr(nextIdx);
      updateFrameInfo(frames, nextIdx, boundaryIn);
    }, 1500);
  };

  const stopPlayback = () => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setWPlay(false);
  };

  const togglePlayback = () => {
    if (wPlay) {
      stopPlayback();
    } else if (wTs.length > 0) {
      startPlayback(wTs, wFr, wNow);
    }
  };

  const currentPercentage = wTs.length > 1 ? (wFr / (wTs.length - 1)) * 100 : 0;

  // Build the dynamic items list with their state and callbacks
  const dynamicButtons: Array<{
    id: string;
    key: string;
    title: string;
    icon: React.ReactNode;
    isActive: boolean;
    isVisible: boolean;
    onClick: () => void;
  }> = [
    {
      id: 'btn-recenter',
      key: 'recenter',
      title: 'Ricentra la visuale',
      isVisible: !isMapFollowing,
      isActive: false,
      onClick: () => {
        setIsControlsHovered(false);
        setUserInteracting(false);
        onRecenter();
      },
      icon: (
        <svg className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 fill-current ${isNight ? "text-[#f0f0f0]" : "text-zinc-800"}`} viewBox="0 -960 960 960">
          <path d="M439-57v-34q-139-15-235.5-111.5T93-437H59q-17.3 0-29.15-11.79Q18-460.58 18-477.79T29.85-507Q41.7-519 59-519h34q15-139 111.5-235.5T439-865v-34q0-17.3 11.79-29.15 11.79-11.85 29-11.85T509-928.15q12 11.85 12 29.15v34q138 14 234.5 110.5T867-519h34q17.3 0 29.15 11.79 11.85 11.79 11.85 29T930.15-449Q918.3-437 901-437h-34q-14 138-110.5 234.5T521-91v34q0 17.3-11.79 29.15Q497.42-16 480.21-16T451-27.85Q439-39.7 439-57Zm249.5-212.33q86.5-86.33 86.5-208.5T688.67-686.5Q602.34-773 480.17-773T271.5-686.67Q185-600.34 185-478.17t86.33 208.67q86.33 86.5 208.5 86.5t208.67-86.33Z" />
        </svg>
      )
    },
    ...(onToggle3D ? [{
      id: 'btn-view3d',
      key: 'view3d',
      title: is3D ? "Vista 3D attiva (inclinata) • Clicca per passare alla vista 2D" : "Vista 2D attiva (piana) • Clicca per attivare la vista prospettica 3D",
      isVisible: is3D || showSecondary,
      isActive: is3D,
      onClick: () => {
        registerInteraction(3500);
        onToggle3D();
      },
      icon: is3D ? (
        <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ) : (
        <svg className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 fill-none stroke-current ${isNight ? "text-[#f0f0f0]" : "text-zinc-800"}`} viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      )
    }] : []),
    {
      id: 'btn-mapmode',
      key: 'satellite',
      title: 'Satellite / Mappa Stradale',
      isVisible: isSatellite || showSecondary,
      isActive: isSatellite,
      onClick: () => {
        registerInteraction(3500);
        onToggleSatellite();
      },
      icon: (
        <svg className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 fill-current ${isSatellite ? "text-white" : (isNight ? "text-[#f0f0f0]" : "text-zinc-800")}`} viewBox="0 -960 960 960">
          <path d="M480.4-55q-88.87 0-166.12-33.08-77.25-33.09-135.18-91.02-57.93-57.93-91.02-135.12Q55-391.41 55-480.36q0-88.96 33.08-166.29 33.09-77.32 90.86-134.81 57.77-57.48 135.03-91.01Q391.24-906 480.28-906t166.49 33.45q77.44 33.46 134.85 90.81t90.89 134.87Q906-569.34 906-480.27q0 89.01-33.53 166.25t-91.01 134.86q-57.49 57.62-134.83 90.89Q569.28-55 480.4-55Zm-.4-94q125.38 0 216.19-80T805-427q0 2 .5 4.25t.5 2.75q-12 14-28.89 22T740-390h-75q-36.71 0-62.86-26.24Q576-442.48 576-479.33V-524H398v-82.58q0-37.78 26.24-63.6T487.33-696H532v-22q0-21.34 15-48.67Q562-794 582-795q-24.02-6.55-49.57-11.27-25.56-4.73-52.07-4.73Q342-811 245.5-714.69T149-480q0 4 .5 7.5t.5 7.5h104q74 0 126 52t52 125.47V-243H299v48q40 21 85.83 33.5Q430.65-149 480-149Z" />
        </svg>
      )
    },
    {
      id: 'btn-weather',
      key: 'weather',
      title: 'Radar Meteo',
      isVisible: isWeatherActive || showSecondary,
      isActive: isWeatherActive,
      onClick: () => {
        registerInteraction(3500);
        onToggleWeather();
      },
      icon: (
        <svg className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 fill-current ${isWeatherActive ? 'text-white' : (isNight ? 'text-[#f0f0f0]' : 'text-zinc-800')}`} viewBox="0 -960 960 960">
          <path d="M457-13.64Q440-30.27 440-53q0-11.65 4.5-21.82Q449-85 457-93l26-23q6-6 14.27-6 8.28 0 15.73 6l26 23q7 8 11.5 18.13 4.5 10.12 4.5 21.72Q555-30 538.5-13.5T498 3q-24 0-41-16.64ZM325-101q-12-11.64-12-27.32T325-156l76-76q11-11 27-11t27 11.5q11 11.5 11 27T455-177l-77 77q-11.91 11-26.95 10.5Q336-90 325-101Zm292-47-37-38q-7-7.18-7-17.09t7-16.91l37-38q7.18-7 17.09-7t16.91 7l38 38q7 7.18 7 17.09T689-186l-38 38q-7.18 7-17.09 7T617-148Zm-332-38-38 38q-7.18 7-17.09 7T213-148l-38-38q-7-7.18-7-17.09t7-16.91l38-38q7.18-7 17.09-7t16.91 7l38 38q7 7.18 7 17.09T285-186Zm5-148q-93.52 0-160.26-67T63-561q0-84 58-150t145-75q35.36-56 90.74-89.5Q412.13-909 479.81-909 573-909 638-851t84 144q82 8 128.5 61.47T897-521.49Q897-444 842.75-389 788.5-334 710-334H290Zm0-95h420q38.52 0 65.76-27Q803-483 803-521q0-39-27.24-66T710-614h-77v-47q0-64.47-44.26-108.74Q544.47-814 480-814q-45.63 0-83.98 24.81Q357.68-764.38 340-723l-12.57 29H289q-55.48 2.09-93.74 40.32Q157-615.44 157-561q0 54.07 39 93.04Q235-429 290-429Zm190-192Z"/>
        </svg>
      )
    }
  ];

  const visibleButtons = dynamicButtons.filter(b => b.isVisible);
  const shouldRenderStack = visibleButtons.length > 0;

  return (
    <>
      {/* Floating control buttons Column on the right */}
      <div 
        id="map-ctrls" 
        onMouseEnter={() => setIsControlsHovered(true)}
        onMouseLeave={() => {
          setIsControlsHovered(false);
          setUserInteracting(false);
        }}
        className="absolute top-3.5 right-3.5 sm:top-6 sm:right-6 z-[1001] flex flex-col gap-2.5 sm:gap-3.5 items-end pointer-events-none"
      >
        
        {/* Compass (#btn-compass) - permanently visible */}
        <div className="pointer-events-auto">
          <button
            id="btn-compass"
            onClick={(e) => {
              e.stopPropagation();
              registerInteraction(4500);
              onToggleCompass();
            }}
            className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl shadow-lg relative overflow-hidden flex items-center justify-center cursor-pointer pointer-events-auto transition-transform duration-200 active:scale-95 select-none touch-none border backdrop-blur-md ${isNight ? "bg-neutral-900/85 border-white/10" : "bg-white/90 border-black/10"}`}
            title={cmode === 'heading-up' || isRotatedFromNorth ? 'Reimposta Nord in alto' : 'Visualizza direzione di marcia in alto'}
          >
            {cmode === 'north-up' ? (
              /* Standalone static north-up state */
              <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none select-none">
                <div 
                  className="w-0 h-0 border-l-[0.35rem] sm:border-l-[0.4375rem] border-l-transparent border-r-[0.35rem] sm:border-r-[0.4375rem] border-r-transparent border-b-[0.8rem] sm:border-b-[1rem] border-b-[#c00] mb-0.5"
                />
                <div className={`font-extrabold text-[1.1rem] sm:text-[1.375rem] leading-none select-none ${isNight ? "text-white" : "text-[#222]"}`}>
                  N
                </div>
              </div>
            ) : (
              /* Standalone active heading-up state */
              <div className={`w-full h-full relative pointer-events-none select-none ${isNight ? "bg-white/5" : "bg-[#f5f5f5]"}`}>
                <div className="absolute inset-0 w-full h-full [mask-image:linear-gradient(to_bottom,black_50%,transparent_95%)] [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_95%)] z-10">
                  <div 
                    className="absolute top-1/2 left-1/2 w-full h-full transition-transform duration-150 ease-out"
                    style={{ 
                      transform: `translate(-50%, -50%) rotate(${dialAngle}deg)` 
                    }}
                  >
                    <div className="absolute inset-0 w-full h-full text-center text-[0.625rem] font-bold text-[#777]">
                      <div className="absolute inset-0 rotate-[0deg] text-center text-xs font-black text-[#c00] pt-1"><span>N</span></div>
                      <div className="absolute inset-0 rotate-[45deg] text-center pt-1 font-bold"><span>NE</span></div>
                      <div className={`absolute inset-0 rotate-[90deg] text-center pt-1 font-extrabold ${isNight ? "text-white/80" : "text-[#333]"}`}><span>E</span></div>
                      <div className="absolute inset-0 rotate-[135deg] text-center pt-1 font-bold"><span>SE</span></div>
                      <div className={`absolute inset-0 rotate-[180deg] text-center pt-1 font-extrabold ${isNight ? "text-white/80" : "text-[#333]"}`}><span>S</span></div>
                      <div className="absolute inset-0 rotate-[225deg] text-center pt-1 font-bold"><span>SW</span></div>
                      <div className={`absolute inset-0 rotate-[270deg] text-center pt-1 font-extrabold ${isNight ? "text-white/80" : "text-[#333]"}`}><span>W</span></div>
                      <div className="absolute inset-0 rotate-[315deg] text-center pt-1 font-bold"><span>NW</span></div>
                    </div>
                  </div>
                </div>
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[62%] w-0 h-0 border-l-[0.4rem] sm:border-l-[0.5rem] border-l-transparent border-r-[0.4rem] sm:border-r-[0.5rem] border-r-transparent border-b-[0.9rem] sm:border-b-[1.125rem] z-20 ${isNight ? "border-b-white" : "border-b-[#111]"}`} />
              </div>
            )}
          </button>
        </div>

        {/* Cascading Secondary Buttons with spatial layout adaptation and spring physics */}
        <div id="dyn-ctrl" className="flex flex-col gap-2.5 sm:gap-3.5 items-end pointer-events-none">
          <AnimatePresence mode="popLayout">
            {shouldRenderStack && visibleButtons.map((btn) => (
              <motion.div
                key={btn.key}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.8 }}
                transition={{
                  layout: { type: "spring", stiffness: 380, damping: 28 },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
                }}
                className="pointer-events-auto origin-top"
              >
                <button
                  id={btn.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    btn.onClick();
                  }}
                  className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl border flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-95 shadow-lg backdrop-blur-md p-0 select-none touch-none ${
                    btn.isActive
                      ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/25'
                      : (isNight ? 'border-white/10 bg-neutral-900/85 hover:bg-neutral-800/85 text-[#f0f0f0]' : 'border-black/10 bg-white/90 hover:bg-zinc-100 text-zinc-800')
                  }`}
                  title={btn.title}
                >
                  {btn.icon}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Weather play timeline controller hud (#tl-ctrl) */}
      {isWeatherActive && wTs.length > 0 && (
        <div 
          id="tl-ctrl"
          className="absolute bottom-3.5 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] w-[94%] sm:w-[22rem] max-w-[22rem] pointer-events-auto select-none touch-none"
        >
          <div className={`backdrop-blur-md border px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4 shadow-lg transition-colors ${isNight ? "bg-neutral-900/85 border-white/10" : "bg-white/90 border-black/10"}`}>
            <button 
              id="tl-pp" 
              onClick={(e) => {
                e.stopPropagation();
                togglePlayback();
              }}
              className="w-10 h-10 flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer hover:bg-blue-500 transition-colors"
            >
              {wPlay ? (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><rect x="14" y="5" width="3" height="14" rx="1" /><rect x="7" y="5" width="3" height="14" rx="1" /></svg>
              ) : (
                <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" /></svg>
              )}
            </button>
            <div className="flex-grow flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline px-0.5">
                <span className={`text-[10px] font-semibold tracking-widest uppercase ${isNight ? "text-white/50" : "text-zinc-500"}`}>Storico Radar</span>
                <span className={`text-[13px] font-bold tracking-wide tabular-nums ${isNight ? "text-white" : "text-zinc-800"}`}>
                  {currentTimeLabel}
                </span>
              </div>
              <div className={`relative w-full h-1.5 rounded-full overflow-hidden cursor-pointer group mt-0.5 ${isNight ? "bg-white/10" : "bg-black/10"}`}>
                <div 
                  className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300 ease-linear"
                  style={{ width: `${currentPercentage}%` }}
                />
                <input 
                  type="range" 
                  min="0" 
                  max={wTs.length > 1 ? wTs.length - 1 : 1}
                  value={wFr}
                  onChange={handleSliderChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>

              {/* Adjustable Transparency Control */}
              <div className="flex justify-between items-center mt-1 pt-1 border-t border-black/5 dark:border-white/10">
                <span className={`text-[10px] font-semibold ${isNight ? "text-white/50" : "text-zinc-500"}`}>Opacità Radar</span>
                <div className="flex items-center gap-1.5">
                  <input 
                    type="range" 
                    min="20" 
                    max="100" 
                    step="5"
                    value={Math.round(radarOpacity * 100)}
                    onChange={(e) => onOpacityChange?.(parseInt(e.target.value, 10) / 100)}
                    className="w-16 h-1 rounded-lg appearance-none bg-zinc-300 dark:bg-zinc-700 accent-blue-600 cursor-pointer"
                    title="Regola la trasparenza del radar"
                  />
                  <span className={`text-[10px] font-bold tabular-nums w-7 text-right ${isNight ? "text-white/80" : "text-zinc-700"}`}>
                    {Math.round(radarOpacity * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
