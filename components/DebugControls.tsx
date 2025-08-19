import React from 'react';
import { FiX } from 'react-icons/fi';
import WeatherIcon, { ExtremeTemp } from './WeatherIcon';
import type { SceneConfig } from './VehicleCanvas';

interface DebugControlsProps {
  isOpen: boolean;
  onClose: () => void;
  timeOverride: Date | null;
  setTimeOverride: (date: Date | null) => void;
  sunsetArrowYPosition: number;
  setSunsetArrowYPosition: (y: number) => void;
  sunriseArrowYPosition: number;
  setSunriseArrowYPosition: (y: number) => void;
  weatherConditionOverride: string | null;
  setWeatherConditionOverride: (condition: string | null) => void;
  effectiveWeatherCondition: string;
  isNight: boolean;
  isHot: boolean;
  isCold: boolean;
  topBarScale: number;
  setTopBarScale: (scale: number) => void;
  topBarOffsetY: number;
  setTopBarOffsetY: (offset: number) => void;
  mapsSearchPanelWidth: number;
  setMapsSearchPanelWidth: (width: number) => void;
  mapsSearchPanelTop: number;
  setMapsSearchPanelTop: (top: number) => void;
  miniMapTop: number;
  setMiniMapTop: (top: number) => void;
  miniMapRight: number;
  setMiniMapRight: (right: number) => void;
  miniMapSize: number;
  setMiniMapSize: (size: number) => void;
  miniMapZoom: number;
  setMiniMapZoom: (zoom: number) => void;
  miniMapFadeStart: number;
  setMiniMapFadeStart: (fade: number) => void;
  miniMapFadeEnd: number;
  setMiniMapFadeEnd: (fade: number) => void;
  minOrbitDistance: number;
  setMinOrbitDistance: (distance: number) => void;
  maxOrbitDistance: number;
  setMaxOrbitDistance: (distance: number) => void;
  appOpenConfig: SceneConfig;
  setAppOpenConfig: React.Dispatch<React.SetStateAction<SceneConfig>>;
  nightFloorDarkness: number;
  setNightFloorDarkness: (darkness: number) => void;
  spotifyPlayerTop: number;
  setSpotifyPlayerTop: (top: number) => void;
  spotifyPlayerBottom: number;
  setSpotifyPlayerBottom: (bottom: number) => void;
  playerDockedWidth: number;
  setPlayerDockedWidth: (width: number) => void;
  playerDockedLeft: number;
  setPlayerDockedLeft: (left: number) => void;
  playerDockedHeight: number;
  setPlayerDockedHeight: (height: number) => void;
  playerFloatingWidth: number;
  setPlayerFloatingWidth: (width: number) => void;
  playerFloatingBottom: number;
  setPlayerFloatingBottom: (bottom: number) => void;
  playerPlaceholderWidth: number;
  setPlayerPlaceholderWidth: (width: number) => void;
  playerFloatingHeight: number;
  setPlayerFloatingHeight: (height: number) => void;
  nightAmbientIntensity: number;
  setNightAmbientIntensity: (intensity: number) => void;
  nightFrontLightIntensity: number;
  setNightFrontLightIntensity: (intensity: number) => void;
  nightEnvironmentIntensity: number;
  setNightEnvironmentIntensity: (intensity: number) => void;
  tripInfo: { time: number, distance: number } | null;
  startTripSimulation: () => void;
  stopTripSimulation: () => void;
  isSimulating: boolean;
  navigateToolWidth: number;
  setNavigateToolWidth: (width: number) => void;
  playerControlsSize: number;
  setPlayerControlsSize: (size: number) => void;
  playerControlsGap: number;
  setPlayerControlsGap: (gap: number) => void;
  playerControlsVerticalPosition: number;
  setPlayerControlsVerticalPosition: (pos: number) => void;
  dayPlayerButtonColor: string;
  setDayPlayerButtonColor: (color: string) => void;
  nightPlayerButtonColor: string;
  setNightPlayerButtonColor: (color: string) => void;
  widgetBgHex: string;
  setWidgetBgHex: (color: string) => void;
  volumeIconSize: number;
  setVolumeIconSize: (size: number) => void;
  volumeSliderOffsetY: number;
  setVolumeSliderOffsetY: (offset: number) => void;
  volumeSliderOffsetX: number;
  setVolumeSliderOffsetX: (offset: number) => void;
  volumeControlMarginRight: number;
  setVolumeControlMarginRight: (margin: number) => void;
  volumeSliderWidth: number;
  setVolumeSliderWidth: (width: number) => void;
  volumeSliderThickness: number;
  setVolumeSliderThickness: (thickness: number) => void;
  volumeSliderPopupWidth: number;
  setVolumeSliderPopupWidth: (width: number) => void;
  volumeSliderPopupHeight: number;
  setVolumeSliderPopupHeight: (height: number) => void;
}

const WEATHER_CONDITIONS = [
    'Default',
    'Cielo sereno',
    'Prevalentemente sereno',
    'Parzialmente nuvoloso',
    'Coperto',
    'Nebbia',
    'Pioggerella',
    'Pioggia leggera',
    'Pioggia',
    'Pioggia forte',
    'Neve leggera',
    'Neve',
    'Neve forte',
    'Grandine',
    'Rovescio',
    'Temporale',
    'Sunrise',
    'Sunset',
    'Cloudy Sunrise',
    'Cloudy Sunset',
    'Partly Cloudy Night',
];

const DEFAULT_APP_OPEN_CONFIG: SceneConfig = {
  cameraPos: { x: 1.55, y: 1.74, z: 3.58 },
  cameraTarget: { x: 0.60, y: 0.22, z: 0.65 },
  modelPos: { x: -4.65, y: -1.00, z: 1.47 },
  modelRot: { x: 0, y: -0.09, z: 0.0 },
  modelScale: 0.78,
};

export default function DebugControls({ 
  isOpen, 
  onClose, 
  timeOverride, 
  setTimeOverride, 
  sunsetArrowYPosition, 
  setSunsetArrowYPosition, 
  sunriseArrowYPosition, 
  setSunriseArrowYPosition,
  weatherConditionOverride,
  setWeatherConditionOverride,
  effectiveWeatherCondition,
  isNight,
  isHot,
  isCold,
  topBarScale,
  setTopBarScale,
  topBarOffsetY,
  setTopBarOffsetY,
  mapsSearchPanelWidth,
  setMapsSearchPanelWidth,
  mapsSearchPanelTop,
  setMapsSearchPanelTop,
  miniMapTop,
  setMiniMapTop,
  miniMapRight,
  setMiniMapRight,
  miniMapSize,
  setMiniMapSize,
  miniMapZoom,
  setMiniMapZoom,
  miniMapFadeStart,
  setMiniMapFadeStart,
  miniMapFadeEnd,
  setMiniMapFadeEnd,
  minOrbitDistance,
  setMinOrbitDistance,
  maxOrbitDistance,
  setMaxOrbitDistance,
  appOpenConfig,
  setAppOpenConfig,
  nightFloorDarkness,
  setNightFloorDarkness,
  spotifyPlayerTop,
  setSpotifyPlayerTop,
  spotifyPlayerBottom,
  setSpotifyPlayerBottom,
  playerDockedWidth,
  setPlayerDockedWidth,
  playerDockedLeft,
  setPlayerDockedLeft,
  playerDockedHeight,
  setPlayerDockedHeight,
  playerFloatingWidth,
  setPlayerFloatingWidth,
  playerFloatingBottom,
  setPlayerFloatingBottom,
  playerPlaceholderWidth,
  setPlayerPlaceholderWidth,
  playerFloatingHeight,
  setPlayerFloatingHeight,
  nightAmbientIntensity,
  setNightAmbientIntensity,
  nightFrontLightIntensity,
  setNightFrontLightIntensity,
  nightEnvironmentIntensity,
  setNightEnvironmentIntensity,
  tripInfo,
  startTripSimulation,
  stopTripSimulation,
  isSimulating,
  navigateToolWidth,
  setNavigateToolWidth,
  playerControlsSize,
  setPlayerControlsSize,
  playerControlsGap,
  setPlayerControlsGap,
  playerControlsVerticalPosition,
  setPlayerControlsVerticalPosition,
  dayPlayerButtonColor,
  setDayPlayerButtonColor,
  nightPlayerButtonColor,
  setNightPlayerButtonColor,
  widgetBgHex,
  setWidgetBgHex,
  volumeIconSize,
  setVolumeIconSize,
  volumeSliderOffsetY,
  setVolumeSliderOffsetY,
  volumeSliderOffsetX,
  setVolumeSliderOffsetX,
  volumeControlMarginRight,
  setVolumeControlMarginRight,
  volumeSliderWidth,
  setVolumeSliderWidth,
  volumeSliderThickness,
  setVolumeSliderThickness,
  volumeSliderPopupWidth,
  setVolumeSliderPopupWidth,
  volumeSliderPopupHeight,
  setVolumeSliderPopupHeight,
}: DebugControlsProps) {
  if (!isOpen) {
    return null;
  }
  
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
  
  const currentHour = timeOverride ? timeOverride.getHours() : new Date().getHours();

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hour = parseInt(e.target.value, 10);
    const newDate = new Date();
    newDate.setHours(hour, 0, 0, 0);
    setTimeOverride(newDate);
  };

  const handleReset = () => {
    setTimeOverride(null);
    setWeatherConditionOverride(null);
    setTopBarScale(1.0);
    setTopBarOffsetY(-7);
    setMapsSearchPanelWidth(401);
    setMapsSearchPanelTop(61);
    setMiniMapTop(-57);
    setMiniMapRight(-86);
    setMiniMapSize(456);
    setMiniMapZoom(17);
    setMiniMapFadeStart(0);
    setMiniMapFadeEnd(69);
    setMinOrbitDistance(9.5);
    setMaxOrbitDistance(18);
    setAppOpenConfig(DEFAULT_APP_OPEN_CONFIG);
    setNightFloorDarkness(0);
    setNightAmbientIntensity(0.25);
    setNightFrontLightIntensity(0.60);
    setNightEnvironmentIntensity(0.55);
    setSpotifyPlayerTop(50);
    setSpotifyPlayerBottom(70);
    setPlayerDockedWidth(519);
    setPlayerDockedLeft(66);
    setPlayerDockedHeight(113);
    setPlayerFloatingWidth(520);
    setPlayerFloatingBottom(98);
    setPlayerFloatingHeight(113);
    setNavigateToolWidth(340);
    setPlayerControlsSize(18);
    setPlayerControlsGap(100);
    setPlayerControlsVerticalPosition(2);
    setDayPlayerButtonColor('#454545');
    setNightPlayerButtonColor('#ffffff');
    setWidgetBgHex('#ffffff');
    setVolumeIconSize(30);
    setVolumeSliderOffsetY(36);
    setVolumeSliderOffsetX(-128);
    setVolumeControlMarginRight(100);
    setVolumeSliderWidth(177);
    setVolumeSliderThickness(6);
    setVolumeSliderPopupWidth(247);
    setVolumeSliderPopupHeight(40);
  };
  
  const handleConditionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'Default') {
      setWeatherConditionOverride(null);
    } else {
      setWeatherConditionOverride(value);
    }
  };

  return (
    <div 
      id="debug-panel"
      className="absolute bottom-36 right-4 z-50 bg-zinc-900/90 text-white rounded-lg shadow-2xl p-4 w-96 backdrop-blur-sm max-h-[70vh] overflow-y-auto"
      onClick={stopPropagation}
      role="dialog"
      aria-modal="true"
      aria-labelledby="debug-panel-title"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 id="debug-panel-title" className="font-bold text-lg">Debug Controls</h2>
        <button onClick={onClose} className="p-1 hover:bg-zinc-700 rounded-full">
          <FiX />
        </button>
      </div>
      
      <div className="space-y-4 text-sm">
        <div>
          <label htmlFor="time-slider" className="block font-medium text-zinc-300 mb-2">
            Time of Day: {String(currentHour).padStart(2, '0')}:00
          </label>
          <input
            id="time-slider"
            type="range"
            min="0"
            max="23"
            step="1"
            value={currentHour}
            onChange={handleTimeChange}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
            <label htmlFor="weather-condition-override" className="block font-medium text-zinc-300 mb-2">
                Weather Condition Override
            </label>
            <select
                id="weather-condition-override"
                value={weatherConditionOverride || 'Default'}
                onChange={handleConditionChange}
                className="w-full p-2 bg-zinc-700 rounded-md border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {WEATHER_CONDITIONS.map(condition => (
                    <option key={condition} value={condition}>{condition}</option>
                ))}
            </select>
        </div>

        <div className="mt-4 p-2 bg-zinc-800 rounded-lg">
            <div className="relative w-48 h-48 mx-auto">
                <WeatherIcon 
                    condition={effectiveWeatherCondition}
                    isNight={isNight}
                    className={`w-full h-full ${isHot ? 'hot-sun' : ''}`}
                    arrowYPosition={
                        effectiveWeatherCondition.toLowerCase().includes('sunrise') 
                        ? sunriseArrowYPosition 
                        : sunsetArrowYPosition
                    }
                />
                 {(isHot || isCold) && (
                    <ExtremeTemp 
                        type={isHot ? 'hot' : 'cold'}
                        className="w-8 h-8 absolute -top-1 -right-1"
                        aria-label={isHot ? 'Hot temperature warning' : 'Cold temperature warning'}
                    />
                )}
            </div>
        </div>
        
        <div>
          <label htmlFor="topbar-scale-slider" className="block font-medium text-zinc-300 mb-2">
            Top Bar Scale: {topBarScale.toFixed(2)}
          </label>
          <input
            id="topbar-scale-slider"
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={topBarScale}
            onChange={(e) => setTopBarScale(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="topbar-offset-y-slider" className="block font-medium text-zinc-300 mb-2">
            Top Bar Vertical Offset: {topBarOffsetY}px
          </label>
          <input
            id="topbar-offset-y-slider"
            type="range"
            min="-50"
            max="100"
            step="1"
            value={topBarOffsetY}
            onChange={(e) => setTopBarOffsetY(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="maps-search-width-slider" className="block font-medium text-zinc-300 mb-2">
            Maps Search Width: {mapsSearchPanelWidth}px
          </label>
          <input
            id="maps-search-width-slider"
            type="range"
            min="300"
            max="500"
            step="1"
            value={mapsSearchPanelWidth}
            onChange={(e) => setMapsSearchPanelWidth(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="maps-search-top-slider" className="block font-medium text-zinc-300 mb-2">
            Maps Search Top Offset: {mapsSearchPanelTop}px
          </label>
          <input
            id="maps-search-top-slider"
            type="range"
            min="10"
            max="100"
            step="1"
            value={mapsSearchPanelTop}
            onChange={(e) => setMapsSearchPanelTop(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">MiniMap Controls</h3>
            <div>
              <label htmlFor="minimap-top-slider" className="block font-medium text-zinc-300 mb-2">
                Top Offset: {miniMapTop}px
              </label>
              <input
                id="minimap-top-slider"
                type="range"
                min="-200"
                max="600"
                step="1"
                value={miniMapTop}
                onChange={(e) => setMiniMapTop(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="mt-2">
              <label htmlFor="minimap-right-slider" className="block font-medium text-zinc-300 mb-2">
                Right Offset: {miniMapRight}px
              </label>
              <input
                id="minimap-right-slider"
                type="range"
                min="-200"
                max="1000"
                step="1"
                value={miniMapRight}
                onChange={(e) => setMiniMapRight(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
             <div className="mt-2">
              <label htmlFor="minimap-size-slider" className="block font-medium text-zinc-300 mb-2">
                Circle Size: {miniMapSize}px
              </label>
              <input
                id="minimap-size-slider"
                type="range"
                min="150"
                max="500"
                step="1"
                value={miniMapSize}
                onChange={(e) => setMiniMapSize(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="mt-2">
              <label htmlFor="minimap-zoom-slider" className="block font-medium text-zinc-300 mb-2">
                Livello Zoom: {miniMapZoom}
              </label>
              <input
                id="minimap-zoom-slider"
                type="range"
                min="14"
                max="20"
                step="1"
                value={miniMapZoom}
                onChange={(e) => setMiniMapZoom(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="mt-2">
              <label htmlFor="minimap-fade-start-slider" className="block font-medium text-zinc-300 mb-2">
                Fade Start: {miniMapFadeStart}%
              </label>
              <input
                id="minimap-fade-start-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value={miniMapFadeStart}
                onChange={(e) => setMiniMapFadeStart(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="mt-2">
              <label htmlFor="minimap-fade-end-slider" className="block font-medium text-zinc-300 mb-2">
                Fade End: {miniMapFadeEnd}%
              </label>
              <input
                id="minimap-fade-end-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value={miniMapFadeEnd}
                onChange={(e) => setMiniMapFadeEnd(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
        </div>
        
        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">Camera Orbit Controls</h3>
            <div>
              <label htmlFor="min-orbit-slider" className="block font-medium text-zinc-300 mb-2">
                Min Orbit Distance (Zoom In): {minOrbitDistance.toFixed(1)}
              </label>
              <input
                id="min-orbit-slider"
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={minOrbitDistance}
                onChange={(e) => setMinOrbitDistance(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="mt-2">
              <label htmlFor="max-orbit-slider" className="block font-medium text-zinc-300 mb-2">
                Max Orbit Distance (Zoom Out): {maxOrbitDistance}
              </label>
              <input
                id="max-orbit-slider"
                type="range"
                min="10"
                max="40"
                step="1"
                value={maxOrbitDistance}
                onChange={(e) => setMaxOrbitDistance(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">3D Scene Visuals (Night)</h3>
            <div>
              <label htmlFor="night-floor-darkness-slider" className="block font-medium text-zinc-300 mb-2">
                Floor Darkness: {nightFloorDarkness}
              </label>
              <input
                id="night-floor-darkness-slider"
                type="range"
                min="0"
                max="50"
                step="1"
                value={nightFloorDarkness}
                onChange={(e) => setNightFloorDarkness(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
             <div className="mt-2">
              <label htmlFor="night-ambient-slider" className="block font-medium text-zinc-300 mb-2">
                Ambient Light: {nightAmbientIntensity.toFixed(2)}
              </label>
              <input
                id="night-ambient-slider"
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={nightAmbientIntensity}
                onChange={(e) => setNightAmbientIntensity(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="mt-2">
              <label htmlFor="night-front-slider" className="block font-medium text-zinc-300 mb-2">
                Front Light: {nightFrontLightIntensity.toFixed(2)}
              </label>
              <input
                id="night-front-slider"
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={nightFrontLightIntensity}
                onChange={(e) => setNightFrontLightIntensity(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="mt-2">
              <label htmlFor="night-env-slider" className="block font-medium text-zinc-300 mb-2">
                Environment Light: {nightEnvironmentIntensity.toFixed(2)}
              </label>
              <input
                id="night-env-slider"
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={nightEnvironmentIntensity}
                onChange={(e) => setNightEnvironmentIntensity(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
        </div>
        
        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">Navigation Simulation</h3>
            <div className="flex gap-2">
                <button
                    onClick={startTripSimulation}
                    disabled={!tripInfo || isSimulating}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition-colors disabled:bg-zinc-600 disabled:cursor-not-allowed"
                >
                    Start Simulation
                </button>
                <button
                    onClick={stopTripSimulation}
                    disabled={!isSimulating}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md font-semibold transition-colors disabled:bg-zinc-600 disabled:cursor-not-allowed"
                >
                    Stop Simulation
                </button>
            </div>
            {!tripInfo && <p className="text-xs text-zinc-400 mt-2">Start a trip to enable simulation.</p>}
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">Spotify App Panel</h3>
            <div>
              <label htmlFor="spotify-top-slider" className="block font-medium text-zinc-300 mb-2">
                Top Offset: {spotifyPlayerTop}px
              </label>
              <input
                id="spotify-top-slider"
                type="range"
                min="0"
                max="200"
                step="1"
                value={spotifyPlayerTop}
                onChange={(e) => setSpotifyPlayerTop(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="mt-2">
              <label htmlFor="spotify-bottom-slider" className="block font-medium text-zinc-300 mb-2">
                Bottom Offset: {spotifyPlayerBottom}px
              </label>
              <input
                id="spotify-bottom-slider"
                type="range"
                min="0"
                max="300"
                step="1"
                value={spotifyPlayerBottom}
                onChange={(e) => setSpotifyPlayerBottom(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">Home Screen Widget Layout</h3>
            
            <div className="pl-2 border-l-2 border-zinc-600 mb-3 space-y-2">
                <h4 className="text-sm font-semibold text-zinc-300">Music Player (Docked)</h4>
                <div>
                  <label htmlFor="docked-width-slider">Width: {playerDockedWidth}px</label>
                  <input id="docked-width-slider" type="range" min="300" max="600" value={playerDockedWidth} onChange={(e) => setPlayerDockedWidth(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                  <label htmlFor="docked-height-slider">Height: {playerDockedHeight}px</label>
                  <input id="docked-height-slider" type="range" min="60" max="150" value={playerDockedHeight} onChange={(e) => setPlayerDockedHeight(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                  <label htmlFor="docked-left-slider">Left Offset: {playerDockedLeft}px</label>
                  <input id="docked-left-slider" type="range" min="0" max="100" value={playerDockedLeft} onChange={(e) => setPlayerDockedLeft(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
                </div>
            </div>

            <div className="pl-2 border-l-2 border-zinc-600 mb-3 space-y-2">
                <h4 className="text-sm font-semibold text-zinc-300">Music Player (Floating)</h4>
                <div>
                  <label htmlFor="floating-width-slider">Width: {playerFloatingWidth}px</label>
                  <input id="floating-width-slider" type="range" min="400" max="800" value={playerFloatingWidth} onChange={(e) => setPlayerFloatingWidth(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                  <label htmlFor="floating-height-slider">Height: {playerFloatingHeight}px</label>
                  <input id="floating-height-slider" type="range" min="60" max="150" value={playerFloatingHeight} onChange={(e) => setPlayerFloatingHeight(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                  <label htmlFor="floating-bottom-slider">Bottom Offset: {playerFloatingBottom}px</label>
                  <input id="floating-bottom-slider" type="range" min="20" max="200" value={playerFloatingBottom} onChange={(e) => setPlayerFloatingBottom(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
                </div>
            </div>

            <div className="pl-2 border-l-2 border-zinc-600 mb-3 space-y-2">
                <h4 className="text-sm font-semibold text-zinc-300">Navigation Tool (Floating)</h4>
                <div>
                  <label htmlFor="nav-tool-width-slider">Width: {navigateToolWidth}px</label>
                  <input id="nav-tool-width-slider" type="range" min="300" max="600" step="1" value={navigateToolWidth} onChange={(e) => setNavigateToolWidth(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
                </div>
            </div>
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">Volume Control Layout</h3>
            <div>
              <label htmlFor="volume-icon-size">Icon Size: {volumeIconSize}px</label>
              <input id="volume-icon-size" type="range" min="16" max="48" value={volumeIconSize} onChange={(e) => setVolumeIconSize(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
              <label htmlFor="volume-slider-offset">Slider Vertical Offset: {volumeSliderOffsetY}px</label>
              <input id="volume-slider-offset" type="range" min="0" max="50" value={volumeSliderOffsetY} onChange={(e) => setVolumeSliderOffsetY(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
             <div className="mt-2">
              <label htmlFor="volume-slider-offset-x">Slider Horizontal Offset: {volumeSliderOffsetX}px</label>
              <input id="volume-slider-offset-x" type="range" min="-200" max="200" value={volumeSliderOffsetX} onChange={(e) => setVolumeSliderOffsetX(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
              <label htmlFor="volume-control-margin">Control Right Margin: {volumeControlMarginRight}px</label>
              <input id="volume-control-margin" type="range" min="0" max="100" value={volumeControlMarginRight} onChange={(e) => setVolumeControlMarginRight(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
              <label htmlFor="volume-slider-width">Slider Length: {volumeSliderWidth}px</label>
              <input id="volume-slider-width" type="range" min="80" max="200" value={volumeSliderWidth} onChange={(e) => setVolumeSliderWidth(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
              <label htmlFor="volume-slider-thickness">Slider Thickness: {volumeSliderThickness}px</label>
              <input id="volume-slider-thickness" type="range" min="4" max="16" value={volumeSliderThickness} onChange={(e) => setVolumeSliderThickness(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
                <label htmlFor="volume-popup-width">Popup Width: {volumeSliderPopupWidth}px</label>
                <input id="volume-popup-width" type="range" min="100" max="300" value={volumeSliderPopupWidth} onChange={(e) => setVolumeSliderPopupWidth(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
                <label htmlFor="volume-popup-height">Popup Height: {volumeSliderPopupHeight}px</label>
                <input id="volume-popup-height" type="range" min="30" max="100" value={volumeSliderPopupHeight} onChange={(e) => setVolumeSliderPopupHeight(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">Music Player Layout</h3>
            <div>
              <label htmlFor="player-controls-size">Icon Size: {playerControlsSize}px</label>
              <input id="player-controls-size" type="range" min="16" max="48" value={playerControlsSize} onChange={(e) => setPlayerControlsSize(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
              <label htmlFor="player-controls-gap">Icon Gap: {playerControlsGap}px</label>
              <input id="player-controls-gap" type="range" min="8" max="120" value={playerControlsGap} onChange={(e) => setPlayerControlsGap(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
              <label htmlFor="player-controls-v-pos">Vertical Position: {playerControlsVerticalPosition}px</label>
              <input id="player-controls-v-pos" type="range" min="-50" max="50" value={playerControlsVerticalPosition} onChange={(e) => setPlayerControlsVerticalPosition(parseInt(e.target.value, 10))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">UI Colors</h3>
            <div className="flex items-center justify-between">
              <label htmlFor="player-button-color-day" className="font-medium text-zinc-300">Player Button Color (Day)</label>
              <input
                id="player-button-color-day"
                type="color"
                value={dayPlayerButtonColor}
                onChange={(e) => setDayPlayerButtonColor(e.target.value)}
                className="w-10 h-10 p-1 bg-zinc-700 rounded-md border border-zinc-600"
              />
            </div>
             <div className="flex items-center justify-between mt-2">
              <label htmlFor="player-button-color-night" className="font-medium text-zinc-300">Player Button Color (Night)</label>
              <input
                id="player-button-color-night"
                type="color"
                value={nightPlayerButtonColor}
                onChange={(e) => setNightPlayerButtonColor(e.target.value)}
                className="w-10 h-10 p-1 bg-zinc-700 rounded-md border border-zinc-600"
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <label htmlFor="widget-bg-color" className="font-medium text-zinc-300">Widget Background Color</label>
              <input
                id="widget-bg-color"
                type="color"
                value={widgetBgHex}
                onChange={(e) => setWidgetBgHex(e.target.value)}
                className="w-10 h-10 p-1 bg-zinc-700 rounded-md border border-zinc-600"
              />
            </div>
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700 space-y-2">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">App Open Scene Controls</h3>
            
            <div className="pl-2 border-l-2 border-zinc-600 mb-3 space-y-1">
              <h4 className="text-sm font-semibold text-zinc-300">Camera Position</h4>
              <label>X: {appOpenConfig.cameraPos.x.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.cameraPos.x} onChange={(e) => setAppOpenConfig(c => ({...c, cameraPos: {...c.cameraPos, x: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
              <label>Y: {appOpenConfig.cameraPos.y.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.cameraPos.y} onChange={(e) => setAppOpenConfig(c => ({...c, cameraPos: {...c.cameraPos, y: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
              <label>Z: {appOpenConfig.cameraPos.z.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.cameraPos.z} onChange={(e) => setAppOpenConfig(c => ({...c, cameraPos: {...c.cameraPos, z: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>

            <div className="pl-2 border-l-2 border-zinc-600 mb-3 space-y-1">
              <h4 className="text-sm font-semibold text-zinc-300">Camera Target</h4>
              <label>X: {appOpenConfig.cameraTarget.x.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.cameraTarget.x} onChange={(e) => setAppOpenConfig(c => ({...c, cameraTarget: {...c.cameraTarget, x: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
              <label>Y: {appOpenConfig.cameraTarget.y.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.cameraTarget.y} onChange={(e) => setAppOpenConfig(c => ({...c, cameraTarget: {...c.cameraTarget, y: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
              <label>Z: {appOpenConfig.cameraTarget.z.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.cameraTarget.z} onChange={(e) => setAppOpenConfig(c => ({...c, cameraTarget: {...c.cameraTarget, z: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>

            <div className="pl-2 border-l-2 border-zinc-600 mb-3 space-y-1">
              <h4 className="text-sm font-semibold text-zinc-300">Model Transform</h4>
              <label>Pos X: {appOpenConfig.modelPos.x.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.modelPos.x} onChange={(e) => setAppOpenConfig(c => ({...c, modelPos: {...c.modelPos, x: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
              <label>Pos Y: {appOpenConfig.modelPos.y.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.modelPos.y} onChange={(e) => setAppOpenConfig(c => ({...c, modelPos: {...c.modelPos, y: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
              <label>Pos Z: {appOpenConfig.modelPos.z.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.01" value={appOpenConfig.modelPos.z} onChange={(e) => setAppOpenConfig(c => ({...c, modelPos: {...c.modelPos, z: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
              <label>Rot Y: {appOpenConfig.modelRot.y.toFixed(2)}</label><input type="range" min="-3.14" max="3.14" step="0.01" value={appOpenConfig.modelRot.y} onChange={(e) => setAppOpenConfig(c => ({...c, modelRot: {...c.modelRot, y: parseFloat(e.target.value)}}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
              <label>Scale: {appOpenConfig.modelScale.toFixed(2)}</label><input type="range" min="0.1" max="2.0" step="0.01" value={appOpenConfig.modelScale} onChange={(e) => setAppOpenConfig(c => ({...c, modelScale: parseFloat(e.target.value)}))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
        </div>

        <button
          onClick={handleReset}
          className="w-full px-4 py-2 mt-4 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold transition-colors"
        >
          Reset All Overrides
        </button>
      </div>
    </div>
  );
}