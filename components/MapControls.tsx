import React, { useState, useEffect, useRef } from 'react';

interface WeatherFrame {
  time: number;
  path: string;
}

interface MapControlsProps {
  cmode: 'north-up' | 'heading-up';
  bearing: number;
  isSatellite: boolean;
  isWeatherActive: boolean;
  isMapFollowing: boolean;
  onToggleCompass: () => void;
  onToggleSatellite: () => void;
  onToggleWeather: () => void;
  onRecenter: () => void;
  onWeatherFrameChange?: (frame: WeatherFrame, index: number, isFuture: boolean) => void;
}

export default function MapControls({
  cmode,
  bearing,
  isSatellite,
  isWeatherActive,
  isMapFollowing,
  onToggleCompass,
  onToggleSatellite,
  onToggleWeather,
  onRecenter,
  onWeatherFrameChange,
}: MapControlsProps) {
  // Weather timeline states
  const [wTs, setWTs] = useState<WeatherFrame[]>([]);
  const [wFr, setWFr] = useState<number>(-1);
  const [wPlay, setWPlay] = useState<boolean>(false);
  const [wNow, setWNow] = useState<number>(-1);
  const [currentTimeLabel, setCurrentTimeLabel] = useState<string>('');
  const [isFutureFrame, setIsFutureFrame] = useState<boolean>(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
          const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
          if (!res.ok) throw new Error();
          const d = await res.json();
          const past = (d.radar?.past || []).map((p: any) => ({ time: p.time, path: p.path }));
          const fut = (d.radar?.nowcast || []).map((f: any) => ({ time: f.time, path: f.path }));
          const merged = [...past, ...fut];
          
          setWTs(merged);
          setWNow(past.length);
          
          // Start near the boundary between historical and forecast
          const initialIdx = past.length > 0 ? past.length - 1 : 0;
          setWFr(initialIdx);
          updateFrameInfo(merged, initialIdx, past.length);
          
          // Enable autoplayer
          startPlayback(merged, initialIdx, past.length);
        } catch (e) {
          console.error('[WEATHER] Failed to load RainViewer config', e);
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
    }, 750);
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

  const boundaryPercentage = wTs.length > 0 && wNow > 0 ? (wNow / wTs.length) * 100 : 50;

  const sliderBackgroundStyle = {
    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${boundaryPercentage}%, #ef4444 ${boundaryPercentage}%, #ef4444 100%)`
  };

  return (
    <>
      {/* Floating control buttons Column on the right */}
      <div id="map-ctrls" className="absolute top-6 right-6 z-10 flex flex-col gap-4 items-end pointer-events-none">
        
        {/* Bussola 3D (#btn-compass) */}
        <button
          id="btn-compass"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompass();
          }}
          className="w-16 h-16 rounded-2xl border-none shadow-[0_8px_20px_rgba(0,0,0,0.4)] relative overflow-hidden flex items-center justify-center cursor-pointer pointer-events-auto transition-transform active:scale-[0.92] select-none touch-none"
          style={{ background: '#eee' }}
          title={cmode === 'heading-up' ? 'Visualizza Nord in alto' : 'Visualizza direzione di marcia in alto'}
        >
          {cmode === 'north-up' ? (
            /* Standalone static north-up state: cn-up */
            <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none select-none">
              <div 
                className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[16px] border-b-[#c00] mb-0.5"
              />
              <div className="font-extrabold text-[22px] text-[#222] leading-none select-none">
                N
              </div>
            </div>
          ) : (
            /* Standalone active heading-up state: ch-up */
            <div className="w-full h-full relative bg-[#f5f5f5] pointer-events-none select-none">
              <div className="absolute inset-0 w-full h-full [mask-image:linear-gradient(to_bottom,black_50%,transparent_95%)] [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_95%)] z-10">
                <div 
                  className="absolute top-1/2 left-1/2 w-full h-full transition-transform duration-100 ease-linear"
                  style={{ 
                    transform: `translate(-50%, -50%) rotate(${-bearing}deg)` 
                  }}
                >
                  <div className="absolute inset-0 w-full h-full text-center text-[10px] font-bold text-[#777]">
                    {/* Cardinal letters aligned nicely around the circle */}
                    <div className="absolute inset-0 rotate-[0deg] text-center text-xs font-black text-[#c00] pt-1"><span>N</span></div>
                    <div className="absolute inset-0 rotate-[45deg] text-center pt-1 font-bold"><span>NE</span></div>
                    <div className="absolute inset-0 rotate-[90deg] text-center pt-1 font-extrabold text-[#333]"><span>E</span></div>
                    <div className="absolute inset-0 rotate-[135deg] text-center pt-1 font-bold"><span>SE</span></div>
                    <div className="absolute inset-0 rotate-[180deg] text-center pt-1 font-extrabold text-[#333]"><span>S</span></div>
                    <div className="absolute inset-0 rotate-[225deg] text-center pt-1 font-bold"><span>SW</span></div>
                    <div className="absolute inset-0 rotate-[270deg] text-center pt-1 font-extrabold text-[#333]"><span>W</span></div>
                    <div className="absolute inset-0 rotate-[315deg] text-center pt-1 font-bold"><span>NW</span></div>
                  </div>
                </div>
              </div>
              {/* Carr: Static needle pointer pointing outwards at the top center */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[62%] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[18px] border-b-[#111] z-20" />
            </div>
          )}
        </button>

        {/* Dynamic Controls wrapper that displays/toggles elements containing other buttons */}
        <div id="dyn-ctrl" className="flex flex-col gap-4 pointer-events-auto opacity-100 transform translate-x-0 transition-all select-none duration-300">
          
          {/* Recenter button (#btn-recenter) - hidden if maps following is active */}
          {!isMapFollowing && (
            <button
              id="btn-recenter"
              onClick={(e) => {
                e.stopPropagation();
                onRecenter();
              }}
              className="w-16 h-16 rounded-2xl border border-white/12 bg-zinc-900/95 hover:bg-zinc-800/90 text-[#f0f0f0] flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-[15px] p-0 select-none touch-none"
              title="Ricentra la visuale"
            >
              <svg className="w-8 h-8 fill-current text-[#f0f0f0]" viewBox="0 -960 960 960">
                <path d="M439-57v-34q-139-15-235.5-111.5T93-437H59q-17.3 0-29.15-11.79Q18-460.58 18-477.79T29.85-507Q41.7-519 59-519h34q15-139 111.5-235.5T439-865v-34q0-17.3 11.79-29.15 11.79-11.85 29-11.85T509-928.15q12 11.85 12 29.15v34q138 14 234.5 110.5T867-519h34q17.3 0 29.15 11.79 11.85 11.79 11.85 29T930.15-449Q918.3-437 901-437h-34q-14 138-110.5 234.5T521-91v34q0 17.3-11.79 29.15Q497.42-16 480.21-16T451-27.85Q439-39.7 439-57Zm249.5-212.33q86.5-86.33 86.5-208.5T688.67-686.5Q602.34-773 480.17-773T271.5-686.67Q185-600.34 185-478.17t86.33 208.67q86.33 86.5 208.5 86.5t208.67-86.33Z" />
              </svg>
            </button>
          )}

          {/* Change layer mode (#btn-mapmode) */}
          <button
            id="btn-mapmode"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSatellite();
            }}
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-[15px] p-0 select-none touch-none ${
              isSatellite
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-white/12 bg-zinc-900/95 hover:bg-zinc-800/90 text-[#f0f0f0]'
            }`}
            title="Satellite / Mappa Stradale"
          >
            <svg className={`w-8 h-8 fill-current ${isSatellite ? 'text-white' : 'text-[#f0f0f0]'}`} viewBox="0 -960 960 960">
              <path d="M480.4-55q-88.87 0-166.12-33.08-77.25-33.09-135.18-91.02-57.93-57.93-91.02-135.12Q55-391.41 55-480.36q0-88.96 33.08-166.29 33.09-77.32 90.86-134.81 57.77-57.48 135.03-91.01Q391.24-906 480.28-906t166.49 33.45q77.44 33.46 134.85 90.81t90.89 134.87Q906-569.34 906-480.27q0 89.01-33.53 166.25t-91.01 134.86q-57.49 57.62-134.83 90.89Q569.28-55 480.4-55Zm-.4-94q125.38 0 216.19-80T805-427q0 2 .5 4.25t.5 2.75q-12 14-28.89 22T740-390h-75q-36.71 0-62.86-26.24Q576-442.48 576-479.33V-524H398v-82.58q0-37.78 26.24-63.6T487.33-696H532v-22q0-21.34 15-48.67Q562-794 582-795q-24.02-6.55-49.57-11.27-25.56-4.73-52.07-4.73Q342-811 245.5-714.69T149-480q0 4 .5 7.5t.5 7.5h104q74 0 126 52t52 125.47V-243H299v48q40 21 85.83 33.5Q430.65-149 480-149Z" />
            </svg>
          </button>

          {/* Toggle Weather (#btn-weather) */}
          <button
            id="btn-weather"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWeather();
            }}
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-[15px] p-0 select-none touch-none ${
              isWeatherActive
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-white/12 bg-zinc-900/95 hover:bg-zinc-800/90 text-[#f0f0f0]'
            }`}
            title="Radar Meteo"
          >
            <svg className={`w-8 h-8 fill-current ${isWeatherActive ? 'text-white' : 'text-[#f0f0f0]'}`} viewBox="0 -960 960 960">
              <path d="M457-13.64Q440-30.27 440-53q0-11.65 4.5-21.82Q449-85 457-93l26-23q6-6 14.27-6 8.28 0 15.73 6l26 23q7 8 11.5 18.13 4.5 10.12 4.5 21.72Q555-30 538.5-13.5T498 3q-24 0-41-16.64ZM325-101q-12-11.64-12-27.32T325-156l76-76q11-11 27-11t27 11.5q11 11.5 11 27T455-177l-77 77q-11.91 11-26.95 10.5Q336-90 325-101Zm292-47-37-38q-7-7.18-7-17.09t7-16.91l37-38q7.18-7 17.09-7t16.91 7l38 38q7 7.18 7 17.09T689-186l-38 38q-7.18 7-17.09 7T617-148Zm-332-38-38 38q-7.18 7-17.09 7T213-148l-38-38q-7-7.18-7-17.09t7-16.91l38-38q7.18-7 17.09-7t16.91 7l38 38q7 7.18 7 17.09T285-186Zm5-148q-93.52 0-160.26-67T63-561q0-84 58-150t145-75q35.36-56 90.74-89.5Q412.13-909 479.81-909 573-909 638-851t84 144q82 8 128.5 61.47T897-521.49Q897-444 842.75-389 788.5-334 710-334H290Zm0-95h420q38.52 0 65.76-27Q803-483 803-521q0-39-27.24-66T710-614h-77v-47q0-64.47-44.26-108.74Q544.47-814 480-814q-45.63 0-83.98 24.81Q357.68-764.38 340-723l-12.57 29H289q-55.48 2.09-93.74 40.32Q157-615.44 157-561q0 54.07 39 93.04Q235-429 290-429Zm190-192Z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Weather play timeline controller hud (#tl-ctrl) */}
      {isWeatherActive && wTs.length > 0 && (
        <div 
          id="tl-ctrl"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-[340px] px-4 py-3.5 border border-white/10 rounded-[30px] flex flex-col pointer-events-auto select-none touch-none bg-zinc-950/95 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-3xl text-white outline-none"
        >
          <div className="flex items-center gap-4">
            <button 
              id="tl-pp" 
              onClick={(e) => {
                e.stopPropagation();
                togglePlayback();
              }}
              className="bg-none border-none text-white cursor-pointer hover:opacity-80 active:scale-95 transition-all p-1 flex-shrink-0"
            >
              {wPlay ? (
                /* Pause SVG from lucide-play */
                <svg className="w-6 h-6 fill-white text-white" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                /* Play SVG */
                <svg className="w-6 h-6 fill-white text-white translate-x-0.5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </button>
            <div className="flex-grow flex flex-col gap-0.5">
              <div id="tl-lbl" className="text-[13px] font-semibold text-zinc-100 leading-none flex justify-between items-center pr-1 select-none">
                <span>Radar Meteo</span>
                <span className="font-extrabold tracking-tight text-white">{currentTimeLabel}</span>
              </div>
              <input 
                type="range" 
                id="tl-slider" 
                min="0" 
                max={wTs.length - 1}
                value={wFr}
                onChange={handleSliderChange}
                className="w-full h-1.5 rounded-full appearance-none bg-zinc-800 outline-none cursor-pointer mt-1.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4.5 [&::-webkit-slider-thumb]:h-4.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:-translate-y-[30%]"
                style={sliderBackgroundStyle}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
