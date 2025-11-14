import React from 'react';
import { FiX } from 'react-icons/fi';
import WeatherIcon, { ExtremeTemp } from './WeatherIcon';
import type { SceneConfig } from './VehicleCanvas';
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
  // FIX: Add missing props for Music Player Queue Popover and Spinner.
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
  // FIX: Add missing homeDataQuotaExceeded prop to fix error in App.tsx
  homeDataQuotaExceeded: boolean;
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
  };
  
  const handleConditionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'Default') {
      setWeatherConditionOverride(null);
    } else {
      setWeatherConditionOverride(value);
    }
  };

  const handleColorChange = (time: 'day' | 'night', condition: string, property: 'sky' | 'floor', value: string) => {
    setSceneColors(prev => ({
        ...prev,
        [time]: {
            ...prev[time],
            [condition]: {
                ...(prev[time]?.[condition] || { sky: '#ffffff', floor: '#ffffff' }),
                [property]: value,
            },
        },
    }));
  };
  
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
                <input type="checkbox" checked={isEnabled} onChange={handleToggle} id={`toggle-${label.toLowerCase()}`} />
                <label htmlFor={`toggle-${label.toLowerCase()}`} className="font-medium text-zinc-300 capitalize">
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
        
        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">Global UI Scale</h3>
            <div>
              <label htmlFor="ui-scale-slider" className="block font-medium text-zinc-300 mb-2">
                UI Scale Override: {uiScale ? uiScale.toFixed(2) : 'Auto'}
              </label>
              <input
                id="ui-scale-slider"
                type="range"
                min="0.5"
                max="1.2"
                step="0.05"
                value={uiScale ?? 1.0}
                onChange={(e) => setUiScale(Number(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
              <button onClick={() => setUiScale(null)} className="text-xs text-blue-400 hover:underline mt-1">Reset to Auto (Media Query)</button>
            </div>
        </div>
        
        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">Footer Layout</h3>
            <div>
              <label htmlFor="app-bar-width-slider" className="block font-medium text-zinc-300 mb-2">
                App Bar Background Width: {appBarWidth}%
              </label>
              <input
                id="app-bar-width-slider"
                type="range"
                min="100"
                max="2000"
                step="50"
                value={appBarWidth}
                onChange={(e) => setAppBarWidth(Number(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
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
            onChange={(e) => setTopBarScale(Number(e.target.value))}
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
            onChange={(e) => setTopBarOffsetY(Number(e.target.value))}
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
            onChange={(e) => setMapsSearchPanelWidth(Number(e.target.value))}
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
            onChange={(e) => setMapsSearchPanelTop(Number(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
            <h3 className="text-md font-semibold text-zinc-200 mb-2">App Launcher Layout</h3>
            <div>
              <label htmlFor="app-launcher-width">Width: {appLauncherWidth}%</label>
              <input id="app-launcher-width" type="range" min="20" max="95" step="1" value={appLauncherWidth} onChange={(e) => setAppLauncherWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div className="mt-2">
              <label htmlFor="app-launcher-height">Height: {appLauncherHeight}px</label>
              <input id="app-launcher-height" type="range" min="50" max