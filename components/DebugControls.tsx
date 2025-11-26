
import React from 'react';
import { FiX } from 'react-icons/fi';
import WeatherIcon, { ExtremeTemp } from './WeatherIcon';
import type { SceneConfig, HeadlightConfig } from './VehicleCanvas';
import type { SceneColors } from '../App';
import { initialSceneColors } from '../App';

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
  homeConfig: SceneConfig;
  setHomeConfig: React.Dispatch<React.SetStateAction<SceneConfig>>;
  sceneColors: SceneColors;
  setSceneColors: React.Dispatch<React.SetStateAction<SceneColors>>;
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
  playerFloatingHeight: number;
  setPlayerFloatingHeight: (height: number) => void;
  navigateToolWidth: number;
  setNavigateToolWidth: (width: number) => void;
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
  volumeSliderThumbOffsetY: number;
  setVolumeSliderThumbOffsetY: (offset: number) => void;
  volumeSliderPopupWidth: number;
  setVolumeSliderPopupWidth: (width: number) => void;
  volumeSliderPopupHeight: number;
  setVolumeSliderPopupHeight: (height: number) => void;
  volumeControlZIndex: number;
  setVolumeControlZIndex: (zIndex: number) => void;
  appLauncherWidth: number;
  setAppLauncherWidth: (width: number) => void;
  appLauncherHeight: number;
  setAppLauncherHeight: (height: number) => void;
  dayFogNear: number;
  setDayFogNear: (val: number) => void;
  dayFogFar: number;
  setDayFogFar: (val: number) => void;
  virtualKeyboardKeySize: number;
  setVirtualKeyboardKeySize: (size: number) => void;
  virtualKeyboardHeight: number;
  setVirtualKeyboardHeight: (height: number) => void;
  virtualKeyboardPaddingX: number;
  setVirtualKeyboardPaddingX: (padding: number) => void;
  virtualKeyboardKeyGapX: number;
  setVirtualKeyboardKeyGapX: (gap: number) => void;
  virtualKeyboardKeyGapY: number;
  setVirtualKeyboardKeyGapY: (gap: number) => void;
  virtualKeyboardKeyFontWeight: number;
  setVirtualKeyboardKeyFontWeight: (weight: number) => void;
  uiScale: number | null;
  setUiScale: (scale: number | null) => void;
  appBarWidth: number;
  setAppBarWidth: (width: number) => void;
  darkVolumeTrackBg: string;
  setDarkVolumeTrackBg: (color: string) => void;
  darkVolumeThumbBg: string;
  setDarkVolumeThumbBg: (color: string) => void;
  darkVolumeFillBg: string;
  setDarkVolumeFillBg: (color: string) => void;
  darkPlayerBg: string;
  setDarkPlayerBg: (color: string) => void;
  darkNavigateInputBg: string;
  setDarkNavigateInputBg: (color: string) => void;
  queuePopoverHeight: number;
  setQueuePopoverHeight: (height: number) => void;
  queuePopoverBottomOffset: number;
  setQueuePopoverBottomOffset: (offset: number) => void;
  queuePopoverScale: number;
  setQueuePopoverScale: (scale: number) => void;
  queuePopoverWidth: number;
  setQueuePopoverWidth: (width: number) => void;
  queuePopoverOffsetX: number;
  setQueuePopoverOffsetX: (offset: number) => void;
  spinnerSize: number;
  setSpinnerSize: (size: number) => void;
  spinnerShuffleGap: number;
  setSpinnerShuffleGap: (gap: number) => void;
  debugSpinner: boolean;
  setDebugSpinner: (debug: boolean) => void;
  spinnerTop: number | undefined;
  setSpinnerTop: (val: number | undefined) => void;
  spinnerRight: number | undefined;
  setSpinnerRight: (val: number | undefined) => void;
  spinnerBottom: number | undefined;
  setSpinnerBottom: (val: number | undefined) => void;
  spinnerLeft: number | undefined;
  setSpinnerLeft: (val: number | undefined) => void;
  homeDataQuotaExceeded: boolean;
  satelliteLabelBrightness: number;
  setSatelliteLabelBrightness: (val: number) => void;
  satelliteLabelOutlineWidth: number;
  setSatelliteLabelOutlineWidth: (val: number) => void;
  headlightConfig: HeadlightConfig;
  setHeadlightConfig: React.Dispatch<React.SetStateAction<HeadlightConfig>>;
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
  cameraTarget: { x: 0.10, y: 0.22, z: 0.65 },
  modelPos: { x: 1.05, y: -1.15, z: 1.40 },
  modelRot: { x: 0.01, y: 0.01, z: 0.01 },
  modelScale: 1.63,
};

const DEFAULT_HOME_CONFIG: SceneConfig = {
    cameraPos: { x: 8.30, y: 2.30, z: 8.80 },
    cameraTarget: { x: 0.95, y: 0.00, z: 0.65 },
    modelPos: { x: 14.25, y: -1.30, z: -1.40 },
    modelRot: { x: 0.00, y: 0.06, z: 0.00 },
    modelScale: 2.80,
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
  homeConfig,
  setHomeConfig,
  sceneColors,
  setSceneColors,
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
  playerFloatingHeight,
  setPlayerFloatingHeight,
  navigateToolWidth,
  setNavigateToolWidth,
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
  volumeSliderThumbOffsetY,
  setVolumeSliderThumbOffsetY,
  volumeSliderPopupWidth,
  setVolumeSliderPopupWidth,
  volumeSliderPopupHeight,
  setVolumeSliderPopupHeight,
  volumeControlZIndex,
  setVolumeControlZIndex,
  appLauncherWidth,
  setAppLauncherWidth,
  appLauncherHeight,
  setAppLauncherHeight,
  dayFogNear,
  setDayFogNear,
  dayFogFar,
  setDayFogFar,
  virtualKeyboardKeySize,
  setVirtualKeyboardKeySize,
  virtualKeyboardHeight,
  setVirtualKeyboardHeight,
  virtualKeyboardPaddingX,
  setVirtualKeyboardPaddingX,
  virtualKeyboardKeyGapX,
  setVirtualKeyboardKeyGapX,
  virtualKeyboardKeyGapY,
  setVirtualKeyboardKeyGapY,
  virtualKeyboardKeyFontWeight,
  setVirtualKeyboardKeyFontWeight,
  uiScale,
  setUiScale,
  appBarWidth,
  setAppBarWidth,
  darkVolumeTrackBg,
  setDarkVolumeTrackBg,
  darkVolumeThumbBg,
  setDarkVolumeThumbBg,
  darkVolumeFillBg,
  setDarkVolumeFillBg,
  darkPlayerBg,
  setDarkPlayerBg,
  darkNavigateInputBg,
  setDarkNavigateInputBg,
  queuePopoverHeight,
  setQueuePopoverHeight,
  queuePopoverBottomOffset,
  setQueuePopoverBottomOffset,
  queuePopoverScale,
  setQueuePopoverScale,
  queuePopoverWidth,
  setQueuePopoverWidth,
  queuePopoverOffsetX,
  setQueuePopoverOffsetX,
  spinnerSize,
  setSpinnerSize,
  spinnerShuffleGap,
  setSpinnerShuffleGap,
  debugSpinner,
  setDebugSpinner,
  spinnerTop,
  setSpinnerTop,
  spinnerRight,
  setSpinnerRight,
  spinnerBottom,
  setSpinnerBottom,
  spinnerLeft,
  setSpinnerLeft,
  homeDataQuotaExceeded,
  satelliteLabelBrightness,
  setSatelliteLabelBrightness,
  satelliteLabelOutlineWidth,
  setSatelliteLabelOutlineWidth,
  headlightConfig,
  setHeadlightConfig,
}: DebugControlsProps) {
  if (!isOpen) {
    return null;
  }
  
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
  
  const currentHour = timeOverride ? timeOverride.getHours() : new Date().getHours();

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hour = Number(e.target.value);
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
    setHomeConfig(DEFAULT_HOME_CONFIG);
    setSceneColors(initialSceneColors);
    setNightAmbientIntensity(0.25);
    setNightFrontLightIntensity(0.60);
    setNightEnvironmentIntensity(0.55);
    setSpotifyPlayerTop(50);
    setSpotifyPlayerBottom(80);
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
    setVolumeControlMarginRight(80);
    setVolumeSliderWidth(177);
    setVolumeSliderThickness(5.5);
    setVolumeSliderThumbOffsetY(2.3);
    setVolumeSliderPopupWidth(247);
    setVolumeSliderPopupHeight(40);
    setVolumeControlZIndex(5000);
    setDayFogNear(13);
    setDayFogFar(52);
    setAppLauncherWidth(30);
    setAppLauncherHeight(286);
    setVirtualKeyboardKeySize(41);
    setVirtualKeyboardHeight(38);
    setVirtualKeyboardPaddingX(69);
    setVirtualKeyboardKeyGapX(2);
    setVirtualKeyboardKeyGapY(2);
    setVirtualKeyboardKeyFontWeight(600);
    setUiScale(1.0);
    setAppBarWidth(500);
    setDarkPlayerBg('#212121');
    setDarkVolumeTrackBg('#4D4D4D');
    setDarkVolumeFillBg('#ffffff');
    setDarkVolumeThumbBg('#ffffff');
    setDarkNavigateInputBg('#2b2b2b');
    setQueuePopoverHeight(89);
    setQueuePopoverBottomOffset(16);
    setQueuePopoverScale(1.0);
    setQueuePopoverWidth(288);
    setQueuePopoverOffsetX(-29);
    setSpinnerSize(18);
    setSpinnerShuffleGap(6);
    setDebugSpinner(false);
    setSpinnerTop(22);
    setSpinnerRight(100);
    setSpinnerBottom(undefined);
    setSpinnerLeft(undefined);
    setSatelliteLabelBrightness(2.3);
    setSatelliteLabelOutlineWidth(1.2);
    setHeadlightConfig({ x: -4.85, y: 0.81, z: 1.55, angle: 3.10, intensity: 0.70, startWidth: 0.10, endWidth: 0.10, length: 20.00, startHeight: 0.13, endHeight: 0.01, fade: 7.40, separation: 0.90, circular: true });
  };
  
  const handleConditionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'Default') {
      setWeatherConditionOverride(null);
    } else {
      setWeatherConditionOverride(value);
    }
  };

  // Helper to toggle undefined vs defined for optional positioning props
  const PositionSlider = ({ label, value, setValue }: { label: string, value: number | undefined, setValue: (v: number | undefined) => void }) => {
    const isEnabled = value !== undefined;
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(Number(e.target.value));
    };
    const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setValue(0); // Default to 0 when enabled
        } else {
            setValue(undefined);
        }
    };

    return (
        <div className="mt-2">
            <div className="flex items-center gap-2">
                <input type="checkbox" checked={isEnabled} onChange={handleToggle} id={`toggle-${label.toLowerCase().replace(/\s/g, '-')}`} />
                <label htmlFor={`toggle-${label.toLowerCase().replace(/\s/g, '-')}`} className="font-medium text-zinc-300 capitalize">
                    {label}: {isEnabled ? `${value}px` : 'auto'}
                </label>
            </div>
            <input
                type="range"
                min="-100"
                max="200"
                step="1"
                value={value ?? 0}
                onChange={handleChange}
                disabled={!isEnabled}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
        </div>
    );
  };

  return (
    <div 
      id="debug-panel"
      className="absolute bottom-36 right-4 z-[50000] bg-zinc-900/90 text-white rounded-lg shadow-2xl p-4 w-96 backdrop-blur-sm max-h-[70vh] overflow-y-auto"
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
      
      <div className="space-y-6 text-sm">
        
        {/* --- SECTION: TIME & WEATHER --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Time & Weather</h3>
            
            <div>
                <label htmlFor="time-slider" className="block font-medium text-zinc-300 mb-2">
                    Time: {String(currentHour).padStart(2, '0')}:00
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
                    Condition
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

            <div className="p-2 bg-zinc-800 rounded-lg">
                <div className="relative w-full h-48 flex justify-center items-center">
                    <WeatherIcon 
                        condition={effectiveWeatherCondition}
                        isNight={isNight}
                        className={`w-32 h-32 ${isHot ? 'hot-sun' : ''}`}
                        arrowYPosition={
                            effectiveWeatherCondition.toLowerCase().includes('sunrise') 
                            ? sunriseArrowYPosition 
                            : sunsetArrowYPosition
                        }
                    />
                    {(isHot || isCold) && (
                        <ExtremeTemp 
                            type={isHot ? 'hot' : 'cold'}
                            className="w-8 h-8 absolute top-2 right-2"
                        />
                    )}
                </div>
            </div>
            {/* Trip Simulation */}
            {tripInfo && (
                <div className="flex gap-2">
                    <button 
                        onClick={isSimulating ? stopTripSimulation : startTripSimulation}
                        className={`flex-1 py-2 px-4 rounded font-bold ${isSimulating ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                    >
                        {isSimulating ? 'Stop Trip Sim' : 'Start Trip Sim'}
                    </button>
                </div>
            )}
        </div>

        {/* --- SECTION: MAPS & SATELLITE --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Maps & Satellite</h3>
            
            <div>
              <label className="block font-medium text-zinc-300">Satellite Label Brightness: {satelliteLabelBrightness.toFixed(1)}</label>
              <input type="range" min="1" max="10" step="0.1" value={satelliteLabelBrightness} onChange={(e) => setSatelliteLabelBrightness(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300">Satellite Outline Width: {satelliteLabelOutlineWidth.toFixed(1)}px</label>
              <input type="range" min="0" max="5" step="0.1" value={satelliteLabelOutlineWidth} onChange={(e) => setSatelliteLabelOutlineWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            
            <div><label className="block font-medium text-zinc-300">MiniMap Top: {miniMapTop}px</label><input type="range" min="-200" max="200" value={miniMapTop} onChange={(e) => setMiniMapTop(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">MiniMap Right: {miniMapRight}px</label><input type="range" min="-200" max="200" value={miniMapRight} onChange={(e) => setMiniMapRight(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">MiniMap Size: {miniMapSize}px</label><input type="range" min="200" max="800" value={miniMapSize} onChange={(e) => setMiniMapSize(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">MiniMap Zoom: {miniMapZoom}</label><input type="range" min="10" max="20" step="0.1" value={miniMapZoom} onChange={(e) => setMiniMapZoom(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <div><label className="block font-medium text-zinc-300">Fade Start: {miniMapFadeStart}%</label><input type="range" min="0" max="100" value={miniMapFadeStart} onChange={(e) => setMiniMapFadeStart(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Fade End: {miniMapFadeEnd}%</label><input type="range" min="0" max="100" value={miniMapFadeEnd} onChange={(e) => setMiniMapFadeEnd(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
        </div>

        {/* --- SECTION: 3D SCENE --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">3D Scene & Lights</h3>
            
            <div><label className="block font-medium text-zinc-300">Min Orbit Dist: {minOrbitDistance}m</label><input type="range" min="1" max="20" step="0.1" value={minOrbitDistance} onChange={(e) => setMinOrbitDistance(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Max Orbit Dist: {maxOrbitDistance}m</label><input type="range" min="5" max="50" step="0.1" value={maxOrbitDistance} onChange={(e) => setMaxOrbitDistance(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <div><label className="block font-medium text-zinc-300">Night Ambient: {nightAmbientIntensity.toFixed(2)}</label><input type="range" min="0" max="2" step="0.05" value={nightAmbientIntensity} onChange={(e) => setNightAmbientIntensity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Night Front Light: {nightFrontLightIntensity.toFixed(2)}</label><input type="range" min="0" max="5" step="0.05" value={nightFrontLightIntensity} onChange={(e) => setNightFrontLightIntensity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Night Env: {nightEnvironmentIntensity.toFixed(2)}</label><input type="range" min="0" max="5" step="0.05" value={nightEnvironmentIntensity} onChange={(e) => setNightEnvironmentIntensity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <div><label className="block font-medium text-zinc-300">Day Fog Near: {dayFogNear}m</label><input type="range" min="0" max="100" value={dayFogNear} onChange={(e) => setDayFogNear(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Day Fog Far: {dayFogFar}m</label><input type="range" min="0" max="200" value={dayFogFar} onChange={(e) => setDayFogFar(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            {/* Headlight Configuration */}
            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Headlight Configuration</h4>
             <div>
              <label className="flex items-center gap-2 font-medium text-zinc-300">
                <input type="checkbox" checked={headlightConfig.circular} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, circular: e.target.checked }))} />
                Circular Beams
              </label>
            </div>
            <div><label className="block font-medium text-zinc-300">X (Horizontal): {headlightConfig.x.toFixed(2)}</label><input type="range" min="-20" max="20" step="0.05" value={headlightConfig.x} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, x: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y (Height): {headlightConfig.y.toFixed(2)}</label><input type="range" min="0" max="10" step="0.01" value={headlightConfig.y} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, y: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z (Depth): {headlightConfig.z.toFixed(2)}</label><input type="range" min="-50" max="50" step="0.05" value={headlightConfig.z} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, z: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Angle: {headlightConfig.angle.toFixed(2)}</label><input type="range" min="0" max={Math.PI * 2} step="0.05" value={headlightConfig.angle} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, angle: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Separation: {headlightConfig.separation.toFixed(2)}</label><input type="range" min="0" max="3" step="0.05" value={headlightConfig.separation} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, separation: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Start Width: {headlightConfig.startWidth.toFixed(2)}</label><input type="range" min="0.1" max="3" step="0.05" value={headlightConfig.startWidth} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, startWidth: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">End Width: {headlightConfig.endWidth.toFixed(2)}</label><input type="range" min="0.1" max="5" step="0.05" value={headlightConfig.endWidth} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, endWidth: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Intensity: {headlightConfig.intensity.toFixed(2)}</label><input type="range" min="0" max="5" step="0.05" value={headlightConfig.intensity} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, intensity: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Length: {headlightConfig.length.toFixed(2)}</label><input type="range" min="1" max="20" step="0.5" value={headlightConfig.length} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, length: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Fade: {headlightConfig.fade.toFixed(2)}</label><input type="range" min="0.1" max="10" step="0.1" value={headlightConfig.fade} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, fade: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Start Height: {headlightConfig.startHeight.toFixed(2)}</label><input type="range" min="0.01" max="0.5" step="0.01" value={headlightConfig.startHeight} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, startHeight: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">End Height: {headlightConfig.endHeight.toFixed(2)}</label><input type="range" min="0.01" max="0.5" step="0.01" value={headlightConfig.endHeight} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, endHeight: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

        </div>

        {/* --- SECTION: MODEL PLACEMENT (APP OPEN) --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Model Placement (App Open)</h3>
            
            <div><label className="block font-medium text-zinc-300">Scale: {appOpenConfig.modelScale.toFixed(2)}</label><input type="range" min="0.1" max="5" step="0.01" value={appOpenConfig.modelScale} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, modelScale: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Position</h4>
            <div><label className="block font-medium text-zinc-300">X: {appOpenConfig.modelPos.x.toFixed(2)}</label><input type="range" min="-50" max="50" step="0.05" value={appOpenConfig.modelPos.x} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, modelPos: { ...prev.modelPos, x: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y: {appOpenConfig.modelPos.y.toFixed(2)}</label><input type="range" min="-50" max="50" step="0.05" value={appOpenConfig.modelPos.y} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, modelPos: { ...prev.modelPos, y: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z: {appOpenConfig.modelPos.z.toFixed(2)}</label><input type="range" min="-50" max="50" step="0.05" value={appOpenConfig.modelPos.z} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, modelPos: { ...prev.modelPos, z: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Rotation</h4>
            <div><label className="block font-medium text-zinc-300">X: {appOpenConfig.modelRot.x.toFixed(2)}</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={appOpenConfig.modelRot.x} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, modelRot: { ...prev.modelRot, x: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y: {appOpenConfig.modelRot.y.toFixed(2)}</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={appOpenConfig.modelRot.y} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, modelRot: { ...prev.modelRot, y: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z: {appOpenConfig.modelRot.z.toFixed(2)}</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={appOpenConfig.modelRot.z} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, modelRot: { ...prev.modelRot, z: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Camera Position</h4>
            <div><label className="block font-medium text-zinc-300">X: {appOpenConfig.cameraPos.x.toFixed(2)}</label><input type="range" min="-20" max="20" step="0.05" value={appOpenConfig.cameraPos.x} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, cameraPos: { ...prev.cameraPos, x: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y: {appOpenConfig.cameraPos.y.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.05" value={appOpenConfig.cameraPos.y} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, cameraPos: { ...prev.cameraPos, y: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z: {appOpenConfig.cameraPos.z.toFixed(2)}</label><input type="range" min="-20" max="20" step="0.05" value={appOpenConfig.cameraPos.z} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, cameraPos: { ...prev.cameraPos, z: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Camera Target</h4>
            <div><label className="block font-medium text-zinc-300">X: {appOpenConfig.cameraTarget.x.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.05" value={appOpenConfig.cameraTarget.x} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, cameraTarget: { ...prev.cameraTarget, x: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y: {appOpenConfig.cameraTarget.y.toFixed(2)}</label><input type="range" min="-5" max="5" step="0.05" value={appOpenConfig.cameraTarget.y} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, cameraTarget: { ...prev.cameraTarget, y: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z: {appOpenConfig.cameraTarget.z.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.05" value={appOpenConfig.cameraTarget.z} onChange={(e) => setAppOpenConfig(prev => ({ ...prev, cameraTarget: { ...prev.cameraTarget, z: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
        </div>

        {/* --- SECTION: MODEL PLACEMENT (HOME / APP CLOSED) --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Model Placement (Home)</h3>
            
            <div><label className="block font-medium text-zinc-300">Scale: {homeConfig.modelScale.toFixed(2)}</label><input type="range" min="0.1" max="5" step="0.01" value={homeConfig.modelScale} onChange={(e) => setHomeConfig(prev => ({ ...prev, modelScale: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Position</h4>
            <div><label className="block font-medium text-zinc-300">X: {homeConfig.modelPos.x.toFixed(2)}</label><input type="range" min="-50" max="50" step="0.05" value={homeConfig.modelPos.x} onChange={(e) => setHomeConfig(prev => ({ ...prev, modelPos: { ...prev.modelPos, x: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y: {homeConfig.modelPos.y.toFixed(2)}</label><input type="range" min="-50" max="50" step="0.05" value={homeConfig.modelPos.y} onChange={(e) => setHomeConfig(prev => ({ ...prev, modelPos: { ...prev.modelPos, y: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z: {homeConfig.modelPos.z.toFixed(2)}</label><input type="range" min="-50" max="50" step="0.05" value={homeConfig.modelPos.z} onChange={(e) => setHomeConfig(prev => ({ ...prev, modelPos: { ...prev.modelPos, z: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Rotation</h4>
            <div><label className="block font-medium text-zinc-300">X: {homeConfig.modelRot.x.toFixed(2)}</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={homeConfig.modelRot.x} onChange={(e) => setHomeConfig(prev => ({ ...prev, modelRot: { ...prev.modelRot, x: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y: {homeConfig.modelRot.y.toFixed(2)}</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={homeConfig.modelRot.y} onChange={(e) => setHomeConfig(prev => ({ ...prev, modelRot: { ...prev.modelRot, y: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z: {homeConfig.modelRot.z.toFixed(2)}</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={homeConfig.modelRot.z} onChange={(e) => setHomeConfig(prev => ({ ...prev, modelRot: { ...prev.modelRot, z: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Camera Position</h4>
            <div><label className="block font-medium text-zinc-300">X: {homeConfig.cameraPos.x.toFixed(2)}</label><input type="range" min="-20" max="20" step="0.05" value={homeConfig.cameraPos.x} onChange={(e) => setHomeConfig(prev => ({ ...prev, cameraPos: { ...prev.cameraPos, x: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y: {homeConfig.cameraPos.y.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.05" value={homeConfig.cameraPos.y} onChange={(e) => setHomeConfig(prev => ({ ...prev, cameraPos: { ...prev.cameraPos, y: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z: {homeConfig.cameraPos.z.toFixed(2)}</label><input type="range" min="-20" max="20" step="0.05" value={homeConfig.cameraPos.z} onChange={(e) => setHomeConfig(prev => ({ ...prev, cameraPos: { ...prev.cameraPos, z: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Camera Target</h4>
            <div><label className="block font-medium text-zinc-300">X: {homeConfig.cameraTarget.x.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.05" value={homeConfig.cameraTarget.x} onChange={(e) => setHomeConfig(prev => ({ ...prev, cameraTarget: { ...prev.cameraTarget, x: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y: {homeConfig.cameraTarget.y.toFixed(2)}</label><input type="range" min="-5" max="5" step="0.05" value={homeConfig.cameraTarget.y} onChange={(e) => setHomeConfig(prev => ({ ...prev, cameraTarget: { ...prev.cameraTarget, y: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z: {homeConfig.cameraTarget.z.toFixed(2)}</label><input type="range" min="-10" max="10" step="0.05" value={homeConfig.cameraTarget.z} onChange={(e) => setHomeConfig(prev => ({ ...prev, cameraTarget: { ...prev.cameraTarget, z: Number(e.target.value) } }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
        </div>

        {/* --- SECTION: PLAYER LAYOUT --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Player & Widgets Layout</h3>
            
            <div><label className="block font-medium text-zinc-300">Navigate Tool Width: {navigateToolWidth}px</label><input type="range" min="200" max="600" value={navigateToolWidth} onChange={(e) => setNavigateToolWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Docked Player</h4>
            <div><label className="block font-medium text-zinc-300">Width: {playerDockedWidth}px</label><input type="range" min="200" max="800" value={playerDockedWidth} onChange={(e) => setPlayerDockedWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Left: {playerDockedLeft}px</label><input type="range" min="0" max="200" value={playerDockedLeft} onChange={(e) => setPlayerDockedLeft(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Height: {playerDockedHeight}px</label><input type="range" min="50" max="200" value={playerDockedHeight} onChange={(e) => setPlayerDockedHeight(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Floating Player</h4>
            <div><label className="block font-medium text-zinc-300">Width: {playerFloatingWidth}px</label><input type="range" min="200" max="800" value={playerFloatingWidth} onChange={(e) => setPlayerFloatingWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Bottom: {playerFloatingBottom}px</label><input type="range" min="0" max="200" value={playerFloatingBottom} onChange={(e) => setPlayerFloatingBottom(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Height: {playerFloatingHeight}px</label><input type="range" min="50" max="200" value={playerFloatingHeight} onChange={(e) => setPlayerFloatingHeight(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Expanded Player (Spotify App)</h4>
            <div><label className="block font-medium text-zinc-300">Top: {spotifyPlayerTop}px</label><input type="range" min="0" max="200" value={spotifyPlayerTop} onChange={(e) => setSpotifyPlayerTop(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Bottom: {spotifyPlayerBottom}px</label><input type="range" min="0" max="200" value={spotifyPlayerBottom} onChange={(e) => setSpotifyPlayerBottom(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
        </div>

        {/* --- SECTION: PLAYER CONTROLS & COLORS --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Controls & Colors</h3>
            
            <div><label className="block font-medium text-zinc-300">Button Size: {playerControlsSize}px</label><input type="range" min="10" max="40" value={playerControlsSize} onChange={(e) => setPlayerControlsSize(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Button Gap: {playerControlsGap}px</label><input type="range" min="0" max="200" value={playerControlsGap} onChange={(e) => setPlayerControlsGap(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Vertical Pos: {playerControlsVerticalPosition}px</label><input type="range" min="-20" max="20" value={playerControlsVerticalPosition} onChange={(e) => setPlayerControlsVerticalPosition(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <div><label className="block font-medium text-zinc-300">Day Button Color</label><input type="color" value={dayPlayerButtonColor} onChange={(e) => setDayPlayerButtonColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Night Button Color</label><input type="color" value={nightPlayerButtonColor} onChange={(e) => setNightPlayerButtonColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Widget BG (Light Mode)</label><input type="color" value={widgetBgHex} onChange={(e) => setWidgetBgHex(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Dark Player BG</label><input type="color" value={darkPlayerBg} onChange={(e) => setDarkPlayerBg(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Dark Navigate Input BG</label><input type="color" value={darkNavigateInputBg} onChange={(e) => setDarkNavigateInputBg(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
        </div>

        {/* --- SECTION: VOLUME CONTROL --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Volume Control</h3>
            <div><label className="block font-medium text-zinc-300">Icon Size: {volumeIconSize}px</label><input type="range" min="10" max="50" value={volumeIconSize} onChange={(e) => setVolumeIconSize(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Slider Offset Y: {volumeSliderOffsetY}px</label><input type="range" min="-100" max="100" value={volumeSliderOffsetY} onChange={(e) => setVolumeSliderOffsetY(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Slider Offset X: {volumeSliderOffsetX}px</label><input type="range" min="-300" max="100" value={volumeSliderOffsetX} onChange={(e) => setVolumeSliderOffsetX(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Control Margin Right: {volumeControlMarginRight}px</label><input type="range" min="0" max="200" value={volumeControlMarginRight} onChange={(e) => setVolumeControlMarginRight(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Slider Width: {volumeSliderWidth}px</label><input type="range" min="50" max="300" value={volumeSliderWidth} onChange={(e) => setVolumeSliderWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Slider Thickness: {volumeSliderThickness}px</label><input type="range" min="1" max="20" value={volumeSliderThickness} onChange={(e) => setVolumeSliderThickness(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Popup Width: {volumeSliderPopupWidth}px</label><input type="range" min="50" max="400" value={volumeSliderPopupWidth} onChange={(e) => setVolumeSliderPopupWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Popup Height: {volumeSliderPopupHeight}px</label><input type="range" min="20" max="100" value={volumeSliderPopupHeight} onChange={(e) => setVolumeSliderPopupHeight(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Dark Track BG</label><input type="color" value={darkVolumeTrackBg} onChange={(e) => setDarkVolumeTrackBg(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Dark Fill BG</label><input type="color" value={darkVolumeFillBg} onChange={(e) => setDarkVolumeFillBg(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Dark Thumb BG</label><input type="color" value={darkVolumeThumbBg} onChange={(e) => setDarkVolumeThumbBg(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
        </div>

        {/* --- SECTION: GLOBAL UI & KEYBOARD --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Global UI & Keyboard</h3>
            
            <div>
              <label className="block font-medium text-zinc-300 mb-2">Global UI Scale: {uiScale ? uiScale.toFixed(2) : 'Auto'}</label>
              <input type="range" min="0.5" max="1.2" step="0.05" value={uiScale ?? 1.0} onChange={(e) => setUiScale(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
              <button onClick={() => setUiScale(null)} className="text-xs text-blue-400 hover:underline mt-1">Reset to Auto</button>
            </div>
            
            <div><label className="block font-medium text-zinc-300">App Bar Width: {appBarWidth}%</label><input type="range" min="100" max="2000" step="50" value={appBarWidth} onChange={(e) => setAppBarWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <div><label className="block font-medium text-zinc-300">Keyboard Height: {virtualKeyboardHeight}vh</label><input type="range" min="20" max="60" value={virtualKeyboardHeight} onChange={(e) => setVirtualKeyboardHeight(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Key Size: {virtualKeyboardKeySize}px</label><input type="range" min="20" max="60" value={virtualKeyboardKeySize} onChange={(e) => setVirtualKeyboardKeySize(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Padding X: {virtualKeyboardPaddingX}px</label><input type="range" min="0" max="200" value={virtualKeyboardPaddingX} onChange={(e) => setVirtualKeyboardPaddingX(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Key Gap X: {virtualKeyboardKeyGapX}px</label><input type="range" min="0" max="20" value={virtualKeyboardKeyGapX} onChange={(e) => setVirtualKeyboardKeyGapX(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Key Gap Y: {virtualKeyboardKeyGapY}px</label><input type="range" min="0" max="20" value={virtualKeyboardKeyGapY} onChange={(e) => setVirtualKeyboardKeyGapY(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
        </div>

        {/* --- SECTION: SPINNER & QUEUE POPOVER --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">Spinner & Queue Popover</h3>
            
            <div>
              <label className="flex items-center gap-2 font-medium text-zinc-300">
                <input type="checkbox" checked={debugSpinner} onChange={(e) => setDebugSpinner(e.target.checked)} />
                Force Show Spinner
              </label>
            </div>
            <div><label className="block font-medium text-zinc-300">Spinner Size: {spinnerSize}px</label><input type="range" min="10" max="100" value={spinnerSize} onChange={(e) => setSpinnerSize(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <PositionSlider label="Spinner Top" value={spinnerTop} setValue={setSpinnerTop} />
            <PositionSlider label="Spinner Right" value={spinnerRight} setValue={setSpinnerRight} />
            <PositionSlider label="Spinner Bottom" value={spinnerBottom} setValue={setSpinnerBottom} />
            <PositionSlider label="Spinner Left" value={spinnerLeft} setValue={setSpinnerLeft} />

            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Queue Popover</h4>
            <div><label className="block font-medium text-zinc-300">Height: {queuePopoverHeight}px</label><input type="range" min="50" max="300" value={queuePopoverHeight} onChange={(e) => setQueuePopoverHeight(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Bottom Offset: {queuePopoverBottomOffset}px</label><input type="range" min="-50" max="100" value={queuePopoverBottomOffset} onChange={(e) => setQueuePopoverBottomOffset(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Width: {queuePopoverWidth}px</label><input type="range" min="100" max="500" value={queuePopoverWidth} onChange={(e) => setQueuePopoverWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Offset X: {queuePopoverOffsetX}px</label><input type="range" min="-100" max="100" value={queuePopoverOffsetX} onChange={(e) => setQueuePopoverOffsetX(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
        </div>

        {/* --- SECTION: APP LAUNCHER --- */}
        <div className="space-y-4">
            <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-700 pb-1">App Launcher</h3>
            <div><label className="block font-medium text-zinc-300">Width: {appLauncherWidth}%</label><input type="range" min="20" max="100" value={appLauncherWidth} onChange={(e) => setAppLauncherWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Height: {appLauncherHeight}px</label><input type="range" min="50" max="800" value={appLauncherHeight} onChange={(e) => setAppLauncherHeight(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
        </div>

        <button 
          onClick={handleReset} 
          className="w-full mt-4 p-2 bg-blue-600 hover:bg-blue-500 rounded-md font-semibold text-white shadow-lg transition-colors"
        >
          Reset All to Defaults
        </button>
      </div>
    </div>
  );
}
