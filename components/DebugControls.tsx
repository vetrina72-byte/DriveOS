
import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { FiX } from 'react-icons/fi';
import WeatherIcon, { ExtremeTemp } from './WeatherIcon';
import type { SceneConfig, HeadlightConfig } from './VehicleCanvas';
import type { SceneColors } from '../App';
import { initialSceneColors } from '../App';
import { useWeather } from '../context/WeatherContext';
import { useNavigation } from '../context/NavigationContext';

import { useUIConfig } from '../context/UIConfigContext';

interface DebugControlsProps {
  isOpen: boolean;
  onClose: () => void;
  isMapsLayered?: boolean;
  onDragProgress?: (progress: number | null) => void;
  isAppView?: boolean;
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
  cameraPos: { x: 5.40, y: 5.40, z: 4.75 },
  cameraTarget: { x: -6.50, y: 0.45, z: -0.70 },
  modelPos: { x: -6.50, y: -0.15, z: -0.70 }, 
  modelRot: { x: 0.01, y: -1.19, z: 0.01 },
  modelScale: 1.67,
};

const DEFAULT_HOME_CONFIG: SceneConfig = {
    cameraPos: { x: 8.30, y: 3.30, z: 8.80 }, 
    cameraTarget: { x: -1.30, y: -0.40, z: 0.05 }, 
    modelPos: { x: -1.40, y: -1.05, z: -0.65 },
    modelRot: { x: 0.01, y: -1.49, z: 0.00 },
    modelScale: 2.68,
};

export default function DebugControls({ 
  isOpen, 
  onClose,
  isAppView = false,
  onDragProgress,
  isMapsLayered,
}: DebugControlsProps) {
  const {
    topBarScale, setTopBarScale, topBarOffsetY, setTopBarOffsetY, mapsSearchPanelTop, setMapsSearchPanelTop,
    miniMapTop, setMiniMapTop, miniMapRight, setMiniMapRight, miniMapSize, setMiniMapSize,
    miniMapZoom, setMiniMapZoom, miniMapFadeStart, setMiniMapFadeStart, miniMapFadeEnd, setMiniMapFadeEnd,
    minOrbitDistance, setMinOrbitDistance, maxOrbitDistance, setMaxOrbitDistance, sceneTransitionSpeed, setSceneTransitionSpeed,
    appOpenConfig, setAppOpenConfig, homeConfig, setHomeConfig, sceneColors, setSceneColors,
    spotifyPlayerTop, setSpotifyPlayerTop, spotifyPlayerBottom, setSpotifyPlayerBottom,
    playerDockedWidth, setPlayerDockedWidth, playerDockedLeft, setPlayerDockedLeft,
    playerDockedHeight, setPlayerDockedHeight, playerFloatingWidth, setPlayerFloatingWidth,
    playerFloatingBottom, setPlayerFloatingBottom, playerFloatingHeight, setPlayerFloatingHeight,
    navigateToolWidth, setNavigateToolWidth, nightAmbientIntensity, setNightAmbientIntensity,
    nightFrontLightIntensity, setNightFrontLightIntensity, nightEnvironmentIntensity, setNightEnvironmentIntensity,
    playerControlsSize, setPlayerControlsSize, playerControlsGap, setPlayerControlsGap,
    playerControlsVerticalPosition, setPlayerControlsVerticalPosition,
    dayPlayerButtonColor, setDayPlayerButtonColor, nightPlayerButtonColor, setNightPlayerButtonColor,
    widgetBgHex, setWidgetBgHex, volumeIconSize, setVolumeIconSize, volumeSliderOffsetY, setVolumeSliderOffsetY,
    volumeSliderOffsetX, setVolumeSliderOffsetX, volumeControlMarginRight, setVolumeControlMarginRight,
    volumeSliderWidth, setVolumeSliderWidth, volumeSliderThickness, setVolumeSliderThickness,
    volumeSliderThumbOffsetY, setVolumeSliderThumbOffsetY, volumeSliderPopupWidth, setVolumeSliderPopupWidth,
    volumeSliderPopupHeight, setVolumeSliderPopupHeight, volumeControlZIndex, setVolumeControlZIndex,
    appLauncherWidth, setAppLauncherWidth, appLauncherHeight, setAppLauncherHeight,
    dayFogNear, setDayFogNear, dayFogFar, setDayFogFar,
    nightFogNear, setNightFogNear, nightFogFar, setNightFogFar,
    virtualKeyboardKeySize, setVirtualKeyboardKeySize, virtualKeyboardHeight, setVirtualKeyboardHeight,
    virtualKeyboardPaddingX, setVirtualKeyboardPaddingX, virtualKeyboardKeyGapX, setVirtualKeyboardKeyGapX,
    virtualKeyboardKeyGapY, setVirtualKeyboardKeyGapY, virtualKeyboardKeyFontWeight, setVirtualKeyboardKeyFontWeight,
    uiScale, setUiScale, appBarWidth, setAppBarWidth,
    darkVolumeTrackBg, setDarkVolumeTrackBg, darkVolumeThumbBg, setDarkVolumeThumbBg,
    darkVolumeFillBg, setDarkVolumeFillBg, darkPlayerBg, setDarkPlayerBg, darkNavigateInputBg, setDarkNavigateInputBg,
    queuePopoverHeight, setQueuePopoverHeight, queuePopoverBottomOffset, setQueuePopoverBottomOffset,
    queuePopoverScale, setQueuePopoverScale, queuePopoverWidth, setQueuePopoverWidth,
    queuePopoverOffsetX, setQueuePopoverOffsetX, spinnerSize, setSpinnerSize, spinnerShuffleGap, setSpinnerShuffleGap,
    debugSpinner, setDebugSpinner, spinnerTop, setSpinnerTop, spinnerRight, setSpinnerRight,
    spinnerBottom, setSpinnerBottom, spinnerLeft, setSpinnerLeft,
    satelliteLabelBrightness, setSatelliteLabelBrightness, satelliteLabelOutlineWidth, setSatelliteLabelOutlineWidth,
    headlightConfig, setHeadlightConfig, progressBarHeight, setProgressBarHeight,
    progressBarVerticalOffset, setProgressBarVerticalOffset, playButtonScale, setPlayButtonScale,
    skipButtonScale, setSkipButtonScale, carShadowOpacity, setCarShadowOpacity,
    aoMapIntensity, setAoMapIntensity,
    carShadowWidth, setCarShadowWidth, carShadowLength, setCarShadowLength,
    carShadowOffsetY, setCarShadowOffsetY,
    carShadowOffsetX, setCarShadowOffsetX,
    carShadowOffsetZ, setCarShadowOffsetZ,
    dirLightPosX, setDirLightPosX,
    dirLightPosY, setDirLightPosY,
    dirLightPosZ, setDirLightPosZ,
    dirLightIntensity, setDirLightIntensity,
    spotLightPosX, setSpotLightPosX,
    spotLightPosY, setSpotLightPosY,
    spotLightPosZ, setSpotLightPosZ,
    spotLightIntensity, setSpotLightIntensity,
    carReflectionOffsetY, setCarReflectionOffsetY,
    carReflectionOpacity, setCarReflectionOpacity,
    carReflectionRoughness, setCarReflectionRoughness,
    carReflectionBlur, setCarReflectionBlur,
    carReflectionMixStrength, setCarReflectionMixStrength,
    carReflectionMetalness, setCarReflectionMetalness,
    forceManualFog, setForceManualFog,
    showRedPanel, setShowRedPanel,
    redPanelLength, setRedPanelLength,
    redPanelHeight, setRedPanelHeight,
    redPanelWidth, setRedPanelWidth,
    redPanelOffsetY, setRedPanelOffsetY,
    redPanelOffsetX, setRedPanelOffsetX,
    redPanelOpacity, setRedPanelOpacity,
    redPanelColor, setRedPanelColor,
    redPanelOrientation, setRedPanelOrientation,
    layeredAppTopOffset, setLayeredAppTopOffset
  } = useUIConfig();
  const {
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
  } = useWeather();

  const {
    tripInfo,
    startTripSimulation,
    stopTripSimulation,
    isSimulating,
  } = useNavigation();

  const panelRef = useRef<HTMLDivElement>(null);

  // --- PHYSICS ENGINE (Unified) ---
  const [renderLayered, setRenderLayered] = useState(isMapsLayered);
  const isVerticalRef = useRef(isMapsLayered);

  useEffect(() => {
    if (isOpen) {
      setRenderLayered(!!isMapsLayered);
      isVerticalRef.current = !!isMapsLayered;
    }
  }, [isMapsLayered, isOpen]);

  const physics = useRef({
      currentPercent: isOpen ? 0 : 100, // 0 = open, 100 = closed
      targetPercent: isOpen ? 0 : 100,
      startPercent: isOpen ? 0 : 100,
      animStartTime: 0,
      isDragging: false,
      isInteracting: false, // NEW: Interaction sequence tracking
      dragStart: 0,
      dragStartPercent: 0,
      panelDimension: 0,
      animationId: 0
  });

  const ANIMATION_SPEED = 0.18; 
  const CLOSE_THRESHOLD_PERCENT = 25;

  const updateRef = useRef<() => void>(() => {});

  const startAnimation = useCallback(() => {
      if (!isAppView) return;
      if (!physics.current.animationId) {
          physics.current.animationId = requestAnimationFrame(() => {
              physics.current.animationId = 0;
              updateRef.current();
          });
      }
  }, [isAppView]);

  // --- PHYSICS LOOP ---
  useEffect(() => {
      if (!isAppView) return; // Only animate if it's an app view
      
      const update = () => {
          const state = physics.current;
          const panel = panelRef.current;

          // 1. Update Physics
          let isSettled = false;
          if (!state.isDragging) {
              if (state.animStartTime > 0) {
                  const elapsed = performance.now() - state.animStartTime;
                  const duration = (sceneTransitionSpeed || 1.10) * 1000; // ms
                  const t = Math.min(elapsed / duration, 1.0);
                  // power4.out easing
                  const easeT = 1 - Math.pow(1 - t, 4);
                  state.currentPercent = state.startPercent + (state.targetPercent - state.startPercent) * easeT;
                  if (t >= 1.0) {
                      state.currentPercent = state.targetPercent;
                      state.animStartTime = 0;
                      isSettled = true;
                  }
              } else {
                  state.currentPercent = state.targetPercent;
                  isSettled = true;
              }
          }

          // 2. Report Progress to 3D Scene (Seamless Handoff)
          if (state.isInteracting) {
              let visualProgress = state.currentPercent / 100;
              visualProgress = Math.max(0, Math.min(1, visualProgress));
              
              onDragProgress?.(visualProgress);

              // Check if settled
              if (!state.isDragging && (isSettled || Math.abs(state.targetPercent - state.currentPercent) < 0.5)) {
                  state.isInteracting = false;
                  onDragProgress?.(null);
              }
          }

          // 3. Render
          if (panel) {
              let visualPercent = state.currentPercent;
              if (!state.isDragging) {
                  if (visualPercent < 0.01) visualPercent = 0;
                  if (visualPercent > 99.9) visualPercent = 100;
              }
              if (isVerticalRef.current) {
                  panel.style.transform = `translateY(${visualPercent}%)`;
              } else {
                  panel.style.transform = `translateX(${visualPercent}%)`;
              }
          }

          // 4. Schedule next frame ONLY if active
          if (!isSettled || state.isDragging || state.isInteracting) {
              state.animationId = requestAnimationFrame(() => {
                  state.animationId = 0;
                  updateRef.current();
              });
          } else {
              state.animationId = 0;
          }
      };

      updateRef.current = update;
  });

  useEffect(() => {
      if (!isAppView) return;
      // Initial positioning render
      updateRef.current();
      return () => {
          if (physics.current.animationId) {
              cancelAnimationFrame(physics.current.animationId);
              physics.current.animationId = 0;
          }
          if (physics.current.isInteracting) {
              onDragProgress?.(null);
          }
      };
  }, [onDragProgress, isAppView]);

  // --- SYNC REACT PROP TO PHYSICS TARGET ---
  useEffect(() => {
      if (!isAppView) return;
      const state = physics.current;
      if (!state.isDragging) {
          const newTargetPercent = isOpen ? 0 : 100;
          if (state.targetPercent !== newTargetPercent || state.animStartTime === 0 || Math.abs(state.currentPercent - newTargetPercent) > 0.01) {
              state.startPercent = state.currentPercent;
              state.targetPercent = newTargetPercent;
              state.animStartTime = performance.now();
              startAnimation();
          }
      }
  }, [isOpen, isAppView, startAnimation]);

  // --- DRAG HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent) => {
      if (!isAppView || !panelRef.current) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      
      const state = physics.current;
      state.isDragging = true;
      state.isInteracting = true; // Start interaction sequence
      if (renderLayered) {
          state.dragStart = e.clientY;
          state.panelDimension = panelRef.current.offsetHeight || window.innerHeight;
      } else {
          state.dragStart = e.clientX;
          state.panelDimension = panelRef.current.offsetWidth || window.innerWidth * 0.66;
      }
      state.dragStartPercent = state.currentPercent;
      startAnimation();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isAppView) return;
      const state = physics.current;
      if (!state.isDragging) return;
      e.stopPropagation();

      const currentPos = renderLayered ? e.clientY : e.clientX;
      const deltaPx = currentPos - state.dragStart;
      const deltaPercent = (deltaPx / state.panelDimension) * 100;
      
      let newPercent = state.dragStartPercent + deltaPercent;
      if (newPercent < 0) newPercent = 0; // Prevent widening
      
      state.currentPercent = newPercent;
      startAnimation();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (!isAppView) return;
      e.stopPropagation();
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      const state = physics.current;
      if (!state.isDragging) return;

      state.isDragging = false;

      if (state.currentPercent > CLOSE_THRESHOLD_PERCENT) {
          state.startPercent = state.currentPercent;
          state.targetPercent = 100;
          state.animStartTime = performance.now();
          if (isOpen) onClose();
      } else {
          state.startPercent = state.currentPercent;
          state.targetPercent = 0;
          state.animStartTime = performance.now();
      }
      startAnimation();
  };

  if (!isOpen && !isAppView) {
    return null;
  }
  
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
  
  const handleColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';

  const handleContainerClass = renderLayered
      ? `absolute -top-12 left-0 right-0 h-12 flex items-end justify-center pb-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`
      : `absolute top-0 bottom-0 -left-12 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`;

  const handlePillClass = renderLayered
      ? `w-16 h-1.5 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-x-110 ${handleColorClass}`
      : `w-1.5 h-16 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 ${handleColorClass}`;

  const containerClass = isAppView 
    ? `spotify-app-panel shadow-2xl flex flex-col ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} ${renderLayered ? 'absolute left-0 right-0 w-full border-t border-zinc-800' : 'fixed w-[85%] sm:w-[75%] md:w-1/2 lg:w-[65%] xl:w-[60%] right-0 border-l border-zinc-800'}`
    : "absolute bottom-36 right-4 z-[50000] bg-zinc-900/90 text-white rounded-lg shadow-2xl p-4 w-96 backdrop-blur-sm max-h-[70vh] overflow-y-auto";

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
    setLayeredAppTopOffset(18);
    setTopBarOffsetY(-7);
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
    setNightFogNear(15);
    setNightFogFar(800);
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
    setCarReflectionOffsetY(0.0);
    if (isNight) {
      setCarReflectionOpacity(0.00);
      setCarReflectionRoughness(0.70);
      setCarReflectionBlur(0);
      setCarReflectionMixStrength(25.0);
      setCarReflectionMetalness(0.00);
    } else {
      setCarReflectionOpacity(1.08);
      setCarReflectionRoughness(0.00);
      setCarReflectionBlur(0);
      setCarReflectionMixStrength(0.1);
      setCarReflectionMetalness(0.00);
    }
    setForceManualFog(false);
    setHeadlightConfig({ x: -0.05, y: 0.77, z: -1.55, angle: 0.06, yaw: 0.01, assemblyYaw: -1.588, intensity: 0.75, startWidth: 0.30, endWidth: 0.10, length: 7.00, startHeight: 0.03, endHeight: 0.01, fade: 7.40, separation: 1.25, circular: true, linked: true });
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
                <input type="checkbox" checked={isEnabled} onChange={handleToggle} id={`toggle-${label?.toLowerCase()?.replace(/\s/g, '-')}`} />
                <label htmlFor={`toggle-${label?.toLowerCase()?.replace(/\s/g, '-')}`} className="font-medium text-zinc-300 capitalize">
                    {label}: {isEnabled ? `${(value) / 16}rem` : 'auto'}
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

  const portalTarget = renderLayered ? document.getElementById('maps-anchored-container') : null;

  const mainContent = (
    <div 
      id="debug-panel"
      ref={panelRef}
      className={containerClass}
      style={isAppView ? {
          top: renderLayered ? `${layeredAppTopOffset}px` : `${(spotifyPlayerTop) / 16}rem`,
          bottom: renderLayered ? 0 : `${(spotifyPlayerBottom) / 16}rem`,
          willChange: 'transform',
          transform: renderLayered 
              ? `translateY(${physics.current.currentPercent}%)` 
              : `translateX(${physics.current.currentPercent}%)`
      } : undefined}
      onClick={stopPropagation}
      role="dialog"
      aria-modal="true"
      aria-labelledby="debug-panel-title"
    >
      {isAppView && (
        <div
            className={handleContainerClass}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            aria-label="Drag to close"
        >
            <div className={handlePillClass} />
        </div>
      )}
      <div className={isAppView ? "w-full h-full bg-zinc-900 text-white p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 content-start relative rounded-t-[2rem]" : "w-full"}>
        {!isAppView && (
        <div className="flex justify-between items-center mb-4">
          <h2 id="debug-panel-title" className="font-bold text-lg">Debug Controls</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-700 rounded-full">
            <FiX />
          </button>
        </div>
        )}

        {isAppView && (
          <div className="col-span-full flex justify-between items-center mb-6 border-b border-zinc-700 pb-4">
               <h1 className="text-3xl font-bold">Debug & Customization App</h1>
               <button onClick={onClose} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors">
                  Close App
               </button>
          </div>
        )}
        
        <div className={isAppView ? "col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "space-y-6 text-sm"}>

          {/* --- SECTION: MUSIC PLAYER CUSTOMIZATION --- */}
        <div className="space-y-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
            <h3 className="text-lg font-bold text-green-400 border-b border-zinc-700 pb-2 mb-4">Music Player Customization</h3>
            
            <div>
                <label className="block font-medium text-zinc-300 mb-1">Progress Bar Height: {progressBarHeight.toFixed(1)}px</label>
                <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    step="0.1" 
                    value={progressBarHeight} 
                    onChange={(e) => setProgressBarHeight(Number(e.target.value))} 
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500" 
                />
            </div>

            <div>
                <label className="block font-medium text-zinc-300 mb-1">Vertical Offset (Top Margin): {progressBarVerticalOffset.toFixed(1)}px</label>
                <input 
                    type="range" 
                    min="0" 
                    max="50" 
                    step="0.1" 
                    value={progressBarVerticalOffset} 
                    onChange={(e) => setProgressBarVerticalOffset(Number(e.target.value))} 
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500" 
                />
            </div>

            <div>
                <label className="block font-medium text-zinc-300 mb-1">Play Button Scale: {playButtonScale.toFixed(2)}x</label>
                <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.01" 
                    value={playButtonScale} 
                    onChange={(e) => setPlayButtonScale(Number(e.target.value))} 
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500" 
                />
            </div>

            <div>
                <label className="block font-medium text-zinc-300 mb-1">Skip Buttons Scale: {skipButtonScale.toFixed(2)}x</label>
                <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.01" 
                    value={skipButtonScale} 
                    onChange={(e) => setSkipButtonScale(Number(e.target.value))} 
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500" 
                />
            </div>

            <div>
                <label className="block font-medium text-zinc-300 mb-1">Controls Vertical Offset: {playerControlsVerticalPosition.toFixed(1)}px</label>
                <input 
                    type="range" 
                    min="-50" 
                    max="50" 
                    step="0.1" 
                    value={playerControlsVerticalPosition} 
                    onChange={(e) => setPlayerControlsVerticalPosition(Number(e.target.value))} 
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500" 
                />
            </div>
        </div>

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
              <label className="flex items-center gap-2 font-medium text-zinc-300">
                Offset App su Mappe (Top Offset) <span className="bg-emerald-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>: {layeredAppTopOffset}px
              </label>
              <input 
                type="range" 
                min="-100" 
                max="300" 
                value={layeredAppTopOffset} 
                onChange={(e) => setLayeredAppTopOffset(Number(e.target.value))} 
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" 
              />
            </div>
            
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
            
            <div><label className="block font-medium text-zinc-300">Transition Speed: {sceneTransitionSpeed.toFixed(2)}s</label><input type="range" min="0.1" max="3" step="0.05" value={sceneTransitionSpeed} onChange={(e) => setSceneTransitionSpeed(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Min Orbit Dist: {minOrbitDistance}m</label><input type="range" min="1" max="20" step="0.1" value={minOrbitDistance} onChange={(e) => setMinOrbitDistance(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Max Orbit Dist: {maxOrbitDistance}m</label><input type="range" min="5" max="50" step="0.1" value={maxOrbitDistance} onChange={(e) => setMaxOrbitDistance(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <div><label className="block font-medium text-zinc-300">Night Ambient: {nightAmbientIntensity.toFixed(2)}</label><input type="range" min="0" max="2" step="0.05" value={nightAmbientIntensity} onChange={(e) => setNightAmbientIntensity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Night Front Light: {nightFrontLightIntensity.toFixed(2)}</label><input type="range" min="0" max="5" step="0.05" value={nightFrontLightIntensity} onChange={(e) => setNightFrontLightIntensity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Night Env: {nightEnvironmentIntensity.toFixed(2)}</label><input type="range" min="0" max="5" step="0.05" value={nightEnvironmentIntensity} onChange={(e) => setNightEnvironmentIntensity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <div><label className="block font-medium text-zinc-300">Day Fog Near: {dayFogNear}m</label><input type="range" min="0" max="100" value={dayFogNear} onChange={(e) => setDayFogNear(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Day Fog Far: {dayFogFar}m</label><input type="range" min="0" max="200" value={dayFogFar} onChange={(e) => setDayFogFar(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            
            <div className="flex items-center justify-between bg-zinc-800/40 p-2 rounded border border-zinc-700/40 my-2">
              <label htmlFor="toggle-force-manual-fog" className="font-semibold text-zinc-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                Forza Nebbia Manuale <span className="bg-emerald-600 text-white text-[0.5625rem] px-1.5 py-0.5 rounded uppercase font-bold">New</span>:
              </label>
              <input 
                id="toggle-force-manual-fog"
                type="checkbox" 
                checked={forceManualFog} 
                onChange={(e) => setForceManualFog(e.target.checked)} 
                className="w-4 h-4 text-emerald-600 bg-zinc-700 border-zinc-600 rounded cursor-pointer focus:ring-zinc-600 focus:ring-offset-zinc-900"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 font-medium text-zinc-300">
                Night Fog Near <span className="bg-emerald-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>: {nightFogNear}m
              </label>
              <input type="range" min="0" max="100" value={nightFogNear} onChange={(e) => setNightFogNear(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="flex items-center gap-2 font-medium text-zinc-300">
                Night Fog Far <span className="bg-emerald-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>: {nightFogFar}m
              </label>
              <input type="range" min="0" max="2000" value={nightFogFar} onChange={(e) => setNightFogFar(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>

            {/* Headlight Configuration */}
            <h4 className="text-sm font-semibold text-zinc-400 mt-2">Headlight Configuration</h4>
             <div>
              <label className="flex items-center gap-2 font-medium text-zinc-300">
                <input type="checkbox" checked={headlightConfig.linked} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, linked: e.target.checked }))} />
                Linked to Model Rotation
              </label>
            </div>
             <div>
              <label className="flex items-center gap-2 font-medium text-zinc-300">
                <input type="checkbox" checked={headlightConfig.circular} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, circular: e.target.checked }))} />
                Circular Beams
              </label>
            </div>
            <div><label className="block font-medium text-zinc-300">X (Horizontal): {headlightConfig.x.toFixed(2)}</label><input type="range" min="-20" max="20" step="0.05" value={headlightConfig.x} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, x: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Y (Height): {headlightConfig.y.toFixed(2)}</label><input type="range" min="0" max="10" step="0.01" value={headlightConfig.y} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, y: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Z (Depth): {headlightConfig.z.toFixed(2)}</label><input type="range" min="-50" max="50" step="0.05" value={headlightConfig.z} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, z: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Angle (Pitch): {headlightConfig.angle.toFixed(2)}</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={headlightConfig.angle} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, angle: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Yaw (Lateral Tilt): {headlightConfig.yaw.toFixed(2)}</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={headlightConfig.yaw} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, yaw: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Assembly Yaw (360°): {((headlightConfig.assemblyYaw * 180) / Math.PI).toFixed(0)}°</label><input type="range" min={-Math.PI} max={Math.PI} step="0.05" value={headlightConfig.assemblyYaw} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, assemblyYaw: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Separation: {headlightConfig.separation.toFixed(2)}</label><input type="range" min="0" max="3" step="0.05" value={headlightConfig.separation} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, separation: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Start Width: {headlightConfig.startWidth.toFixed(2)}</label><input type="range" min="0.1" max="3" step="0.05" value={headlightConfig.startWidth} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, startWidth: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">End Width: {headlightConfig.endWidth.toFixed(2)}</label><input type="range" min="0.1" max="5" step="0.05" value={headlightConfig.endWidth} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, endWidth: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Intensity: {headlightConfig.intensity.toFixed(2)}</label><input type="range" min="0" max="5" step="0.05" value={headlightConfig.intensity} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, intensity: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Length: {headlightConfig.length.toFixed(2)}</label><input type="range" min="1" max="20" step="0.5" value={headlightConfig.length} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, length: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Fade: {headlightConfig.fade.toFixed(2)}</label><input type="range" min="0.1" max="10" step="0.1" value={headlightConfig.fade} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, fade: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">Start Height: {headlightConfig.startHeight.toFixed(2)}</label><input type="range" min="0.01" max="0.5" step="0.01" value={headlightConfig.startHeight} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, startHeight: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>
            <div><label className="block font-medium text-zinc-300">End Height: {headlightConfig.endHeight.toFixed(2)}</label><input type="range" min="0.01" max="0.5" step="0.01" value={headlightConfig.endHeight} onChange={(e) => setHeadlightConfig(prev => ({ ...prev, endHeight: Number(e.target.value) }))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" /></div>

            {/* Shadow Configuration */}
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mt-2 font-sans text-amber-500 uppercase tracking-wider">
              Ombra - Posizionamento e Dimensioni <span className="bg-blue-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>
            </h4>
            <div>
              <label className="block font-medium text-zinc-300">Opacità Ombra (Contact Shadow): {carShadowOpacity?.toFixed(2)}</label>
              <input type="range" min="0" max="1" step="0.05" value={carShadowOpacity ?? 0.8} onChange={(e) => setCarShadowOpacity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300">Intensità Ambient Occlusion (AO Map): {aoMapIntensity?.toFixed(2)}</label>
              <input type="range" min="0" max="3" step="0.05" value={aoMapIntensity ?? 1.00} onChange={(e) => setAoMapIntensity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300">Altezza Ombra Y (Offset Y): {carShadowOffsetY?.toFixed(3)}</label>
              <input type="range" min="-1" max="1" step="0.01" value={carShadowOffsetY ?? 0.02} onChange={(e) => setCarShadowOffsetY(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300">Posizione Ombra X (Offset X): {carShadowOffsetX?.toFixed(3)}</label>
              <input type="range" min="-15" max="15" step="0.05" value={carShadowOffsetX ?? 0.0} onChange={(e) => setCarShadowOffsetX(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300">Posizione Ombra Z (Offset Z): {carShadowOffsetZ?.toFixed(3)}</label>
              <input type="range" min="-15" max="15" step="0.05" value={carShadowOffsetZ ?? 0.0} onChange={(e) => setCarShadowOffsetZ(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300">Lunghezza Ombra: {carShadowLength?.toFixed(1)}</label>
              <input type="range" min="1" max="50" step="0.5" value={carShadowLength ?? 20} onChange={(e) => setCarShadowLength(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300">Larghezza Ombra: {carShadowWidth?.toFixed(1)}</label>
              <input type="range" min="1" max="50" step="0.5" value={carShadowWidth ?? 20} onChange={(e) => setCarShadowWidth(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
            </div>

            {/* Light Sources for Dynamic Shadows */}
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mt-4 border-t border-zinc-800 pt-3 font-sans text-amber-500 uppercase tracking-wider">
              Controllo Luci - Forma Ombra Proiettata <span className="bg-indigo-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>
            </h4>
            <p className="text-[0.6875rem] text-zinc-400 leading-tight">Posiziona le sorgenti luminose per modellare, inclinare e sfumare l'ombra dinamica dell'auto:</p>
            
            <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 space-y-3 mt-1">
              <span className="text-[0.75rem] font-bold text-zinc-300 block">💡 LUCE DIREZIONALE (Sole / Luce Principale)</span>
              <div>
                <label className="block font-medium text-xs text-zinc-400">Inclinazione Luce X (Direzione): {dirLightPosX?.toFixed(2)}</label>
                <input type="range" min="-30" max="30" step="0.1" value={dirLightPosX ?? -0.30} onChange={(e) => setDirLightPosX(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer" />
              </div>
              <div>
                <label className="block font-medium text-xs text-zinc-400 font-sans">Altezza Sorgente Y (Lunghezza / Sfumatura): {dirLightPosY?.toFixed(2)}</label>
                <input type="range" min="1" max="40" step="0.1" value={dirLightPosY ?? 40.00} onChange={(e) => setDirLightPosY(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer font-sans" />
              </div>
              <div>
                <label className="block font-medium text-xs text-zinc-400">Inclinazione Luce Z (Direzione): {dirLightPosZ?.toFixed(2)}</label>
                <input type="range" min="-30" max="30" step="0.1" value={dirLightPosZ ?? 7.70} onChange={(e) => setDirLightPosZ(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer" />
              </div>
              <div>
                <label className="block font-medium text-xs text-zinc-400">Moltiplicatore Intensità Luce: {dirLightIntensity?.toFixed(2)}</label>
                <input type="range" min="0" max="5" step="0.05" value={dirLightIntensity ?? 2.40} onChange={(e) => setDirLightIntensity(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer" />
              </div>
            </div>

            {/* Longitudinal Slice Panel Configuration */}
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mt-4 border-t border-zinc-800 pt-3 font-sans text-amber-500 uppercase tracking-wider">
              Pannello Rosso di Sezione <span className="bg-red-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>
            </h4>
            <p className="text-[0.6875rem] text-zinc-400 leading-tight">Visualizza e sposta un pannello olografico/taglio rosso semi-transparente attraverso la vettura (orientamento ruotato):</p>
            
            <div className="flex items-center justify-between py-1">
              <label className="text-zinc-300 font-medium text-xs">Mostra Pannello Rosso:</label>
              <input 
                type="checkbox" 
                checked={showRedPanel ?? true} 
                onChange={(e) => setShowRedPanel(e.target.checked)} 
                className="w-4 h-4 rounded text-red-500 focus:ring-opacity-0 focus:ring-0 bg-zinc-700 border-zinc-600 outline-none cursor-pointer"
              />
            </div>

            {showRedPanel && (
              <div className="space-y-3 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                <div>
                  <label className="block font-medium text-[0.6875rem] text-zinc-400 mb-1">Rotazione / Orientamento Sezione:</label>
                  <div className="grid grid-cols-3 gap-1 bg-zinc-800/80 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setRedPanelOrientation('horizontal')}
                      className={`text-[0.625rem] py-1 px-1 rounded transition text-center ${redPanelOrientation === 'horizontal' ? 'bg-red-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Orizzontale (90°)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRedPanelOrientation('longitudinal')}
                      className={`text-[0.625rem] py-1 px-1 rounded transition text-center ${redPanelOrientation === 'longitudinal' ? 'bg-red-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Verticale L.
                    </button>
                    <button
                      type="button"
                      onClick={() => setRedPanelOrientation('transverse')}
                      className={`text-[0.625rem] py-1 px-1 rounded transition text-center ${redPanelOrientation === 'transverse' ? 'bg-red-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Verticale T.
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-xs text-zinc-400">Spostamento Laterale X: {redPanelOffsetX?.toFixed(2)}</label>
                  <input type="range" min="-3" max="3" step="0.05" value={redPanelOffsetX ?? 0.0} onChange={(e) => setRedPanelOffsetX(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer" />
                </div>
                <div>
                  <label className="block font-medium text-xs text-zinc-400 font-sans">Altezza Centrale Offset Y: {redPanelOffsetY?.toFixed(2)}</label>
                  <input type="range" min="-1" max="3" step="0.05" value={redPanelOffsetY ?? 0.7} onChange={(e) => setRedPanelOffsetY(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer font-sans" />
                </div>
                <div>
                  <label className="block font-medium text-xs text-zinc-400">Lunghezza Pannello (Z): {redPanelLength?.toFixed(1)}</label>
                  <input type="range" min="1" max="10" step="0.1" value={redPanelLength ?? 4.8} onChange={(e) => setRedPanelLength(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer" />
                </div>
                {redPanelOrientation !== 'longitudinal' && (
                  <div>
                    <label className="block font-medium text-xs text-zinc-400 font-sans">Larghezza Pannello (X): {redPanelWidth?.toFixed(1)}</label>
                    <input type="range" min="0.1" max="5" step="0.1" value={redPanelWidth ?? 2.2} onChange={(e) => setRedPanelWidth(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer font-sans" />
                  </div>
                )}
                {redPanelOrientation !== 'horizontal' && (
                  <div>
                    <label className="block font-medium text-xs text-zinc-400 font-sans">Altezza Pannello (Y): {redPanelHeight?.toFixed(1)}</label>
                    <input type="range" min="0.1" max="5" step="0.1" value={redPanelHeight ?? 1.4} onChange={(e) => setRedPanelHeight(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer font-sans" />
                  </div>
                )}
                <div>
                  <label className="block font-medium text-xs text-zinc-400">Opacità Pannello: {redPanelOpacity?.toFixed(2)}</label>
                  <input type="range" min="0.05" max="1" step="0.05" value={redPanelOpacity ?? 0.45} onChange={(e) => setRedPanelOpacity(Number(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded appearance-none cursor-pointer" />
                </div>
                <div>
                  <label className="block font-medium text-xs text-zinc-400">Colore Taglio:</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={redPanelColor ?? '#ff0000'} onChange={(e) => setRedPanelColor(e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer bg-transparent" />
                    <span className="text-xs font-mono text-zinc-300">{redPanelColor ?? '#ff0000'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Reflection Floor Offset Configuration */}
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mt-2 font-sans">
              Distanza Riflesso (Pavimento) <span className="bg-emerald-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>
            </h4>
            <div><label className="block font-medium text-zinc-300">Valore Offset (Minore = Più vicino): {carReflectionOffsetY?.toFixed(3)}</label><input type="range" min="0.0" max="2.0" step="0.001" value={carReflectionOffsetY ?? 0.0} onChange={(e) => setCarReflectionOffsetY(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer font-sans" /></div>

            {/* Material Presets */}
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mt-4 border-t border-zinc-800 pt-3 font-sans">
              Preset Materiale Pavimento <span className="bg-amber-500 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">Presets</span>
            </h4>
            <p className="text-[0.6875rem] text-zinc-400 leading-tight">Seleziona un materiale per cambiare istantaneamente l'aspetto del pavimento:</p>
            <div className="grid grid-cols-2 gap-2 mt-2 select-none">
              <button
                type="button"
                id="preset-glass-btn"
                onClick={() => {
                  setCarReflectionRoughness(0.08);
                  setCarReflectionBlur(80);
                  setCarReflectionMixStrength(3.5);
                  setCarReflectionMetalness(0.05);
                  setCarReflectionOpacity(0.85);
                }}
                className="py-2 px-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 rounded font-medium transition-colors text-center active:scale-95"
              >
                💎 Vetro / Plexiglass
              </button>
              <button
                type="button"
                id="preset-asphalt-btn"
                onClick={() => {
                  setCarReflectionRoughness(0.38);
                  setCarReflectionBlur(450);
                  setCarReflectionMixStrength(2.5);
                  setCarReflectionMetalness(0.02);
                  setCarReflectionOpacity(0.55);
                }}
                className="py-2 px-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 rounded font-medium transition-colors text-center active:scale-95"
              >
                🏁 Asfalto Bagnato
              </button>
              <button
                type="button"
                id="preset-concrete-btn"
                onClick={() => {
                  setCarReflectionRoughness(0.68);
                  setCarReflectionBlur(900);
                  setCarReflectionMixStrength(1.2);
                  setCarReflectionMetalness(0.15);
                  setCarReflectionOpacity(0.25);
                }}
                className="py-2 px-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 rounded font-medium transition-colors text-center active:scale-95"
              >
                🪵 Cemento Opaco
              </button>
              <button
                type="button"
                id="preset-metal-btn"
                onClick={() => {
                  setCarReflectionRoughness(0.22);
                  setCarReflectionBlur(200);
                  setCarReflectionMixStrength(4.5);
                  setCarReflectionMetalness(0.85);
                  setCarReflectionOpacity(0.65);
                }}
                className="py-2 px-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 rounded font-medium transition-colors text-center active:scale-95"
              >
                ⚙️ Metallo Satinato
              </button>
            </div>

            {/* Reflection Opacity Configuration */}
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mt-4 border-t border-zinc-800 pt-3 font-sans">
              Opacità Riflesso <span className="bg-emerald-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>
            </h4>
            <div><label className="block font-medium text-zinc-300">Opacità del modello riflesso (0 - 5): {carReflectionOpacity?.toFixed(2)}</label><input type="range" min="0.0" max="5.0" step="0.01" value={carReflectionOpacity ?? 0.75} onChange={(e) => setCarReflectionOpacity(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer font-sans" /></div>

            {/* Advanced Reflection Material Properties */}
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mt-2 font-sans font-medium">
              Proprietà Avanzate Riflesso <span className="bg-emerald-600 text-white text-[0.625rem] px-1.5 py-0.5 rounded uppercase leading-none font-bold">New</span>
            </h4>
            <div>
              <label className="block font-medium text-zinc-300 font-sans">Rugosità Riflesso (Roughness: 0 = Specchio, 1 = Opaco): {carReflectionRoughness?.toFixed(2)}</label>
              <input type="range" min="0.0" max="1.0" step="0.01" value={carReflectionRoughness ?? 0.12} onChange={(e) => setCarReflectionRoughness(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer font-sans" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300 font-sans">Sfocatura Riflesso (Blur: 0 = Nitido, 2000 = Sfocato): {carReflectionBlur}</label>
              <input type="range" min="0" max="2000" step="10" value={carReflectionBlur ?? 100} onChange={(e) => setCarReflectionBlur(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer font-sans" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300 font-sans">Forza Miscelazione (Mix Strength: riflesso marcato): {carReflectionMixStrength?.toFixed(1)}</label>
              <input type="range" min="0.1" max="25.0" step="0.1" value={carReflectionMixStrength ?? 3.0} onChange={(e) => setCarReflectionMixStrength(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer font-sans" />
            </div>
            <div>
              <label className="block font-medium text-zinc-300 font-sans">Metallicità Pavimento (Metalness: riflettività metallic): {carReflectionMetalness?.toFixed(2)}</label>
              <input type="range" min="0.0" max="1.0" step="0.01" value={carReflectionMetalness ?? 0.1} onChange={(e) => setCarReflectionMetalness(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer font-sans" />
            </div>
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
    </div>
  );

  if (renderLayered && portalTarget) {
      return ReactDOM.createPortal(mainContent, portalTarget);
  }

  return mainContent;
}
