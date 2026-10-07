import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import type { SceneConfig, HeadlightConfig } from '../components/VehicleCanvas';
import type { SceneColors } from '../App';
import { initialSceneColors } from '../App';
import { performanceManager, PerformanceSettings, PerformanceTier } from '../lib/performanceProfile';

export const DEFAULT_HOME_CONFIG: SceneConfig = {
    cameraPos: { x: 8.30, y: 3.30, z: 8.80 }, 
    cameraTarget: { x: -1.30, y: -0.40, z: 0.05 }, 
    modelPos: { x: -1.40, y: -1.05, z: 0.15 },
    modelRot: { x: 0.01, y: -1.49, z: 0.00 },
    modelScale: 2.68,
};

export const DEFAULT_APP_OPEN_CONFIG: SceneConfig = {
  cameraPos: { x: 5.40, y: 5.40, z: 4.75 },
  cameraTarget: { x: -4.90, y: 0.45, z: 0.0 },
  modelPos: { x: -4.90, y: -0.15, z: 0.0 }, 
  modelRot: { x: 0.01, y: -1.19, z: 0.01 },
  modelScale: 1.51,
};

export const APP_TRANSITION_DURATION = 560; // 560ms elegant unified transition duration for App, Player and 3D Camera
export const APP_TRANSITION_SECONDS = 0.56; // 0.56s for Three.js / WebGL scene animations

export const UIConfigContext = createContext<any>(null);

export function UIConfigProvider({ children }: { children: React.ReactNode }) {
  // Performance Profile state
  const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings>(() => performanceManager.getSettings());
  const [performanceTier, setPerformanceTierState] = useState<PerformanceTier>(() => performanceManager.getTier());

  useEffect(() => {
    const unsubscribe = performanceManager.subscribe((newSettings) => {
      setPerformanceSettings(newSettings);
      setPerformanceTierState(newSettings.tier);
    });
    return unsubscribe;
  }, []);

  const setPerformanceTier = useCallback((tier: PerformanceTier) => {
    performanceManager.setTier(tier);
  }, []);

  const [topBarScale, setTopBarScale] = useState(1.0);
  const [layeredAppTopOffset, setLayeredAppTopOffset] = useState(18);
  const [topBarOffsetY, setTopBarOffsetY] = useState(-7);
  const [mapsSearchPanelTop, setMapsSearchPanelTop] = useState(61);
  const [miniMapTop, setMiniMapTop] = useState(-57);
  const [miniMapRight, setMiniMapRight] = useState(-86);
  const [miniMapSize, setMiniMapSize] = useState(456);
  const [miniMapZoom, setMiniMapZoom] = useState(17);
  const [miniMapFadeStart, setMiniMapFadeStart] = useState(0);
  const [miniMapFadeEnd, setMiniMapFadeEnd] = useState(69);
  const [uiScale, setUiScale] = useState<number | null>(1.0);
  const [appBarWidth, setAppBarWidth] = useState(500);

  const [minOrbitDistance, setMinOrbitDistance] = useState(9.5);
  const [maxOrbitDistance, setMaxOrbitDistance] = useState(18);
  const [sceneTransitionSpeed, setSceneTransitionSpeed] = useState(APP_TRANSITION_SECONDS);
  
  const [enable3DModel, setEnable3DModelState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('driveos_enable_3d_model');
        if (stored !== null) return JSON.parse(stored);
      } catch {}
    }
    return true;
  });

  const setEnable3DModel = useCallback((val: boolean) => {
    setEnable3DModelState(val);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('driveos_enable_3d_model', JSON.stringify(val));
      } catch {}
    }
  }, []);

  // --- 3D PERFORMANCE LAB STATE & METRICS ---
  const [perfReflector, setPerfReflector] = useState<boolean>(true);
  const [perfShadows, setPerfShadows] = useState<'high' | 'low' | 'off'>('high');
  const [perfWeatherParticles, setPerfWeatherParticles] = useState<'high' | 'low' | 'off'>('high');
  const [perfVolumetricHeadlights, setPerfVolumetricHeadlights] = useState<boolean>(true);
  const [perfEnvironment, setPerfEnvironment] = useState<'high' | 'low' | 'off'>('high');
  const [perfAntialiasing, setPerfAntialiasing] = useState<boolean>(true);
  const [perfDPR, setPerfDPR] = useState<'auto' | '1.0' | '0.9' | '0.8' | '0.7'>('auto');
  const [perfTargetFps, setPerfTargetFps] = useState<60 | 30>(60);
  const [perfProfilePreset, setPerfProfilePreset] = useState<'high' | 'medium' | 'low' | 'custom'>('high');

  const [perfMetrics, setPerfMetrics] = useState({
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  });

  const applyPerformancePreset = useCallback((preset: 'high' | 'medium' | 'low') => {
    setPerfProfilePreset(preset);
    if (preset === 'high') {
      setEnable3DModel(true);
      setPerfReflector(true);
      setPerfShadows('high');
      setPerfWeatherParticles('high');
      setPerfVolumetricHeadlights(true);
      setPerfEnvironment('high');
      setPerfAntialiasing(true);
      setPerfDPR('auto');
      setPerfTargetFps(60);
    } else if (preset === 'medium') {
      setEnable3DModel(true);
      setPerfReflector(false);
      setPerfShadows('low');
      setPerfWeatherParticles('low');
      setPerfVolumetricHeadlights(true);
      setPerfEnvironment('low');
      setPerfAntialiasing(true);
      setPerfDPR('1.0');
      setPerfTargetFps(60);
    } else if (preset === 'low') {
      setEnable3DModel(true);
      setPerfReflector(false);
      setPerfShadows('low');
      setPerfWeatherParticles('off');
      setPerfVolumetricHeadlights(false);
      setPerfEnvironment('low');
      setPerfAntialiasing(false);
      setPerfDPR('1.0');
      setPerfTargetFps(60);
    }
  }, [setEnable3DModel]);
  
  const [homeConfig, setHomeConfig] = useState<SceneConfig>(DEFAULT_HOME_CONFIG);
  const [appOpenConfig, setAppOpenConfig] = useState<SceneConfig>(DEFAULT_APP_OPEN_CONFIG);

  const [headlightConfig, setHeadlightConfig] = useState<HeadlightConfig>({
      x: -0.05, y: 0.77, z: -1.55, angle: 0.06, yaw: 0.01, assemblyYaw: -1.588,
      intensity: 0.75, startWidth: 0.30, endWidth: 0.10, length: 7.00,
      startHeight: 0.03, endHeight: 0.01, fade: 7.40, separation: 1.25,
      circular: true, linked: true, 
  });

  const [sceneColors, setSceneColors] = useState<SceneColors>(initialSceneColors);
  const [nightAmbientIntensity, setNightAmbientIntensity] = useState(0.20);
  const [nightFrontLightIntensity, setNightFrontLightIntensity] = useState(0.50);
  const [nightEnvironmentIntensity, setNightEnvironmentIntensity] = useState(1.55);
  const [dayFogNear, setDayFogNear] = useState(0);
  const [dayFogFar, setDayFogFar] = useState(63);
  const [nightFogNear, setNightFogNear] = useState(0);
  const [nightFogFar, setNightFogFar] = useState(63);

  const [carShadowOpacity, setCarShadowOpacity] = useState(0.40);
  const [aoMapIntensity, setAoMapIntensity] = useState(1.0);
  const [carShadowWidth, setCarShadowWidth] = useState(3.2);
  const [carShadowLength, setCarShadowLength] = useState(5.8);
  const [carShadowOffsetY, setCarShadowOffsetY] = useState(0.02);
  const [carShadowOffsetX, setCarShadowOffsetX] = useState(0.0);
  const [carShadowOffsetZ, setCarShadowOffsetZ] = useState(0.0);
  const [dirLightPosX, setDirLightPosX] = useState(0.0);
  const [dirLightPosY, setDirLightPosY] = useState(40.00);
  const [dirLightPosZ, setDirLightPosZ] = useState(0.0);
  const [dirLightIntensity, setDirLightIntensity] = useState(2.40);
  const [spotLightPosX, setSpotLightPosX] = useState(0.0);
  const [spotLightPosY, setSpotLightPosY] = useState(10.0);
  const [spotLightPosZ, setSpotLightPosZ] = useState(0.0);
  const [spotLightIntensity, setSpotLightIntensity] = useState(1.0);
  const [spotLightAngle, setSpotLightAngle] = useState(0.6);
  const [spotLightPenumbra, setSpotLightPenumbra] = useState(0.5);
  const [spotLightTemperature, setSpotLightTemperature] = useState(5500);

  // Single combined reflection state to eliminate 5 individual setState cascades
  const [reflectionState, setReflectionState] = useState({
    offsetY: 0.0,
    opacity: 1.08,
    roughness: 0.00,
    blur: 0,
    mixStrength: 0.1,
    metalness: 0.00,
  });

  const carReflectionOffsetY = reflectionState.offsetY;
  const carReflectionOpacity = reflectionState.opacity;
  const carReflectionRoughness = reflectionState.roughness;
  const carReflectionBlur = reflectionState.blur;
  const carReflectionMixStrength = reflectionState.mixStrength;
  const carReflectionMetalness = reflectionState.metalness;

  const setCarReflectionOffsetY = useCallback((val: number) => setReflectionState(p => ({ ...p, offsetY: val })), []);
  const setCarReflectionOpacity = useCallback((val: number) => setReflectionState(p => ({ ...p, opacity: val })), []);
  const setCarReflectionRoughness = useCallback((val: number) => setReflectionState(p => ({ ...p, roughness: val })), []);
  const setCarReflectionBlur = useCallback((val: number) => setReflectionState(p => ({ ...p, blur: val })), []);
  const setCarReflectionMixStrength = useCallback((val: number) => setReflectionState(p => ({ ...p, mixStrength: val })), []);
  const setCarReflectionMetalness = useCallback((val: number) => setReflectionState(p => ({ ...p, metalness: val })), []);

  const setDayNightReflection = useCallback((isNight: boolean) => {
    if (isNight) {
      setReflectionState(prev => ({
        ...prev,
        opacity: 0.00,
        roughness: 0.70,
        blur: 0,
        mixStrength: 25.0,
        metalness: 0.00
      }));
    } else {
      setReflectionState(prev => ({
        ...prev,
        opacity: 1.08,
        roughness: 0.00,
        blur: 0,
        mixStrength: 0.1,
        metalness: 0.00
      }));
    }
  }, []);

  const [forceManualFog, setForceManualFog] = useState(false);

  const [showRedPanel, setShowRedPanel] = useState(true);
  const [redPanelLength, setRedPanelLength] = useState(10.0);
  const [redPanelHeight, setRedPanelHeight] = useState(5.0);
  const [redPanelWidth, setRedPanelWidth] = useState(4.3);
  const [redPanelOffsetY, setRedPanelOffsetY] = useState(2.70);
  const [redPanelOffsetX, setRedPanelOffsetX] = useState(-0.40);
  const [redPanelOpacity, setRedPanelOpacity] = useState(0.0);
  const [redPanelColor, setRedPanelColor] = useState('#ff0000');
  const [redPanelOrientation, setRedPanelOrientation] = useState<'longitudinal' | 'transverse' | 'horizontal'>('transverse');

  const [spotifyPlayerTop, setSpotifyPlayerTop] = useState(50);
  const [spotifyPlayerBottom, setSpotifyPlayerBottom] = useState(80);
  const [playerDockedWidth, setPlayerDockedWidth] = useState(519);
  const [playerDockedLeft, setPlayerDockedLeft] = useState(66);
  const [playerDockedHeight, setPlayerDockedHeight] = useState(113);
  const [playerFloatingWidth, setPlayerFloatingWidth] = useState(520);
  const [playerFloatingBottom, setPlayerFloatingBottom] = useState(98);
  const [playerFloatingHeight, setPlayerFloatingHeight] = useState(113);
  const [navigateToolWidth, setNavigateToolWidth] = useState(340);
  const [playerControlsSize, setPlayerControlsSize] = useState(18);
  const [playerControlsGap, setPlayerControlsGap] = useState(100);
  const [playerControlsVerticalPosition, setPlayerControlsVerticalPosition] = useState(4.2);
  const [spinnerSize, setSpinnerSize] = useState(18);
  const [spinnerShuffleGap, setSpinnerShuffleGap] = useState(6);
  const [debugSpinner, setDebugSpinner] = useState(false);
  const [spinnerTop, setSpinnerTop] = useState<number | undefined>(22);
  const [spinnerRight, setSpinnerRight] = useState<number | undefined>(100);
  const [spinnerBottom, setSpinnerBottom] = useState<number | undefined>(undefined);
  const [spinnerLeft, setSpinnerLeft] = useState<number | undefined>(undefined);
  
  const [volumeIconSize, setVolumeIconSize] = useState(30);
  const [volumeSliderOffsetY, setVolumeSliderOffsetY] = useState(36);
  const [volumeSliderOffsetX, setVolumeSliderOffsetX] = useState(-128);
  const [volumeControlMarginRight, setVolumeControlMarginRight] = useState(80);
  const [volumeSliderWidth, setVolumeSliderWidth] = useState(177);
  const [volumeSliderThickness, setVolumeSliderThickness] = useState(5.5);
  const [volumeSliderThumbOffsetY, setVolumeSliderThumbOffsetY] = useState(2.3);
  const [volumeSliderPopupWidth, setVolumeSliderPopupWidth] = useState(247);
  const [volumeSliderPopupHeight, setVolumeSliderPopupHeight] = useState(40);
  const [volumeControlZIndex, setVolumeControlZIndex] = useState(5000);

  const [appLauncherWidth, setAppLauncherWidth] = useState(30);
  const [appLauncherHeight, setAppLauncherHeight] = useState(286);
  const [queuePopoverHeight, setQueuePopoverHeight] = useState(65);
  const [queuePopoverBottomOffset, setQueuePopoverBottomOffset] = useState(16);
  const [queuePopoverScale, setQueuePopoverScale] = useState(0.85);
  const [queuePopoverWidth, setQueuePopoverWidth] = useState(200);
  const [queuePopoverOffsetX, setQueuePopoverOffsetX] = useState(-29);

  const [dayPlayerButtonColor, setDayPlayerButtonColor] = useState('#555555');
  const [nightPlayerButtonColor, setNightPlayerButtonColor] = useState('#ffffff');
  const [widgetBgHex, setWidgetBgHex] = useState('#ffffff');
  
  const widgetBgColor = useMemo(() => {
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };
    const rgb = hexToRgb(widgetBgHex);
    return rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : 'rgb(255, 255, 255)';
  }, [widgetBgHex]);
  
  const [darkVolumeTrackBg, setDarkVolumeTrackBg] = useState('#4D4D4D');
  const [darkVolumeThumbBg, setDarkVolumeThumbBg] = useState('#ffffff');
  const [darkVolumeFillBg, setDarkVolumeFillBg] = useState('#ffffff');
  const [darkPlayerBg, setDarkPlayerBg] = useState('#212121');
  const [darkNavigateInputBg, setDarkNavigateInputBg] = useState('#2b2b2b');

  const [satelliteLabelBrightness, setSatelliteLabelBrightness] = useState(2.3);
  const [satelliteLabelOutlineWidth, setSatelliteLabelOutlineWidth] = useState(1.2);

  const [progressBarHeight, setProgressBarHeight] = useState(5.4);
  const [progressBarVerticalOffset, setProgressBarVerticalOffset] = useState(12.9);
  const [playButtonScale, setPlayButtonScale] = useState(0.90);
  const [skipButtonScale, setSkipButtonScale] = useState(0.90);

  const [virtualKeyboardKeySize, setVirtualKeyboardKeySize] = useState(41);
  const [virtualKeyboardHeight, setVirtualKeyboardHeight] = useState(38);
  const [virtualKeyboardPaddingX, setVirtualKeyboardPaddingX] = useState(69);
  const [virtualKeyboardKeyGapX, setVirtualKeyboardKeyGapX] = useState(2);
  const [virtualKeyboardKeyGapY, setVirtualKeyboardKeyGapY] = useState(2);
  const [virtualKeyboardKeyFontWeight, setVirtualKeyboardKeyFontWeight] = useState(600);

  const [isSimulatingResize, setIsSimulatingResize] = useState(false);
  const [simulatedWindowWidth, setSimulatedWindowWidth] = useState(1024);
  const [simulatedWindowHeight, setSimulatedWindowHeight] = useState(768);
  const [compactLayoutThreshold, setCompactLayoutThreshold] = useState(420);
  const [forcePlayerLayout, setForcePlayerLayout] = useState<'auto' | 'compact' | 'wide'>('auto');
  const [resizeModelScaleFactor, setResizeModelScaleFactor] = useState(1.0);
  const [resizeModelOffsetX, setResizeModelOffsetX] = useState(0.0);
  const [resizeModelOffsetY, setResizeModelOffsetY] = useState(0.0);
  const [resizeModelOffsetZ, setResizeModelOffsetZ] = useState(0.0);
  const [resizeCameraOffsetX, setResizeCameraOffsetX] = useState(0.0);
  const [resizeCameraOffsetY, setResizeCameraOffsetY] = useState(0.0);
  const [resizeCameraOffsetZ, setResizeCameraOffsetZ] = useState(0.0);

  // Memoize the entire context value to protect consumers from unnecessary re-renders
  const value = useMemo(() => ({
    performanceSettings,
    performanceTier,
    setPerformanceTier,
    isSimulatingResize, setIsSimulatingResize,
    simulatedWindowWidth, setSimulatedWindowWidth,
    simulatedWindowHeight, setSimulatedWindowHeight,
    compactLayoutThreshold, setCompactLayoutThreshold,
    forcePlayerLayout, setForcePlayerLayout,
    resizeModelScaleFactor, setResizeModelScaleFactor,
    resizeModelOffsetX, setResizeModelOffsetX,
    resizeModelOffsetY, setResizeModelOffsetY,
    resizeModelOffsetZ, setResizeModelOffsetZ,
    resizeCameraOffsetX, setResizeCameraOffsetX,
    resizeCameraOffsetY, setResizeCameraOffsetY,
    resizeCameraOffsetZ, setResizeCameraOffsetZ,
    topBarScale, setTopBarScale,
    topBarOffsetY, setTopBarOffsetY,
    mapsSearchPanelTop, setMapsSearchPanelTop,
    miniMapTop, setMiniMapTop,
    miniMapRight, setMiniMapRight,
    miniMapSize, setMiniMapSize,
    miniMapZoom, setMiniMapZoom,
    miniMapFadeStart, setMiniMapFadeStart,
    miniMapFadeEnd, setMiniMapFadeEnd,
    uiScale, setUiScale,
    appBarWidth, setAppBarWidth,
    minOrbitDistance, setMinOrbitDistance,
    maxOrbitDistance, setMaxOrbitDistance,
    sceneTransitionSpeed, setSceneTransitionSpeed,
    homeConfig, setHomeConfig,
    appOpenConfig, setAppOpenConfig,
    headlightConfig, setHeadlightConfig,
    sceneColors, setSceneColors,
    nightAmbientIntensity, setNightAmbientIntensity,
    nightFrontLightIntensity, setNightFrontLightIntensity,
    nightEnvironmentIntensity, setNightEnvironmentIntensity,
    dayFogNear, setDayFogNear,
    dayFogFar, setDayFogFar,
    nightFogNear, setNightFogNear,
    nightFogFar, setNightFogFar,
    carShadowOpacity, setCarShadowOpacity,
    aoMapIntensity, setAoMapIntensity,
    carShadowWidth, setCarShadowWidth,
    carShadowLength, setCarShadowLength,
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
    spotLightAngle, setSpotLightAngle,
    spotLightPenumbra, setSpotLightPenumbra,
    spotLightTemperature, setSpotLightTemperature,
    carReflectionOffsetY, setCarReflectionOffsetY,
    carReflectionOpacity, setCarReflectionOpacity,
    carReflectionRoughness, setCarReflectionRoughness,
    carReflectionBlur, setCarReflectionBlur,
    carReflectionMixStrength, setCarReflectionMixStrength,
    carReflectionMetalness, setCarReflectionMetalness,
    setDayNightReflection,
    forceManualFog, setForceManualFog,
    spotifyPlayerTop, setSpotifyPlayerTop,
    spotifyPlayerBottom, setSpotifyPlayerBottom,
    playerDockedWidth, setPlayerDockedWidth,
    playerDockedLeft, setPlayerDockedLeft,
    playerDockedHeight, setPlayerDockedHeight,
    playerFloatingWidth, setPlayerFloatingWidth,
    playerFloatingBottom, setPlayerFloatingBottom,
    playerFloatingHeight, setPlayerFloatingHeight,
    navigateToolWidth, setNavigateToolWidth,
    playerControlsSize, setPlayerControlsSize,
    playerControlsGap, setPlayerControlsGap,
    playerControlsVerticalPosition, setPlayerControlsVerticalPosition,
    spinnerSize, setSpinnerSize,
    spinnerShuffleGap, setSpinnerShuffleGap,
    debugSpinner, setDebugSpinner,
    spinnerTop, setSpinnerTop,
    spinnerRight, setSpinnerRight,
    spinnerBottom, setSpinnerBottom,
    spinnerLeft, setSpinnerLeft,
    volumeIconSize, setVolumeIconSize,
    volumeSliderOffsetY, setVolumeSliderOffsetY,
    volumeSliderOffsetX, setVolumeSliderOffsetX,
    volumeControlMarginRight, setVolumeControlMarginRight,
    volumeSliderWidth, setVolumeSliderWidth,
    volumeSliderThickness, setVolumeSliderThickness,
    volumeSliderThumbOffsetY, setVolumeSliderThumbOffsetY,
    volumeSliderPopupWidth, setVolumeSliderPopupWidth,
    volumeSliderPopupHeight, setVolumeSliderPopupHeight,
    volumeControlZIndex, setVolumeControlZIndex,
    appLauncherWidth, setAppLauncherWidth,
    appLauncherHeight, setAppLauncherHeight,
    queuePopoverHeight, setQueuePopoverHeight,
    queuePopoverBottomOffset, setQueuePopoverBottomOffset,
    queuePopoverScale, setQueuePopoverScale,
    queuePopoverWidth, setQueuePopoverWidth,
    queuePopoverOffsetX, setQueuePopoverOffsetX,
    dayPlayerButtonColor, setDayPlayerButtonColor,
    nightPlayerButtonColor, setNightPlayerButtonColor,
    widgetBgHex, setWidgetBgHex,
    widgetBgColor,
    darkVolumeTrackBg, setDarkVolumeTrackBg,
    darkVolumeThumbBg, setDarkVolumeThumbBg,
    darkVolumeFillBg, setDarkVolumeFillBg,
    darkPlayerBg, setDarkPlayerBg,
    darkNavigateInputBg, setDarkNavigateInputBg,
    satelliteLabelBrightness, setSatelliteLabelBrightness,
    satelliteLabelOutlineWidth, setSatelliteLabelOutlineWidth,
    progressBarHeight, setProgressBarHeight,
    progressBarVerticalOffset, setProgressBarVerticalOffset,
    playButtonScale, setPlayButtonScale,
    skipButtonScale, setSkipButtonScale,
    virtualKeyboardKeySize, setVirtualKeyboardKeySize,
    virtualKeyboardHeight, setVirtualKeyboardHeight,
    virtualKeyboardPaddingX, setVirtualKeyboardPaddingX,
    virtualKeyboardKeyGapX, setVirtualKeyboardKeyGapX,
    virtualKeyboardKeyGapY, setVirtualKeyboardKeyGapY,
    virtualKeyboardKeyFontWeight, setVirtualKeyboardKeyFontWeight,
    showRedPanel, setShowRedPanel,
    redPanelLength, setRedPanelLength,
    redPanelHeight, setRedPanelHeight,
    redPanelWidth, setRedPanelWidth,
    redPanelOffsetY, setRedPanelOffsetY,
    redPanelOffsetX, setRedPanelOffsetX,
    redPanelOpacity, setRedPanelOpacity,
    redPanelColor, setRedPanelColor,
    redPanelOrientation, setRedPanelOrientation,
    layeredAppTopOffset, setLayeredAppTopOffset,
    enable3DModel, setEnable3DModel,
    perfReflector, setPerfReflector,
    perfShadows, setPerfShadows,
    perfWeatherParticles, setPerfWeatherParticles,
    perfVolumetricHeadlights, setPerfVolumetricHeadlights,
    perfEnvironment, setPerfEnvironment,
    perfAntialiasing, setPerfAntialiasing,
    perfDPR, setPerfDPR,
    perfTargetFps, setPerfTargetFps,
    perfProfilePreset, setPerfProfilePreset,
    applyPerformancePreset,
    perfMetrics, setPerfMetrics,
  }), [
    performanceSettings,
    performanceTier,
    setPerformanceTier,
    isSimulatingResize,
    simulatedWindowWidth,
    simulatedWindowHeight,
    compactLayoutThreshold,
    forcePlayerLayout,
    resizeModelScaleFactor,
    resizeModelOffsetX,
    resizeModelOffsetY,
    resizeModelOffsetZ,
    resizeCameraOffsetX,
    resizeCameraOffsetY,
    resizeCameraOffsetZ,
    topBarScale,
    topBarOffsetY,
    mapsSearchPanelTop,
    miniMapTop,
    miniMapRight,
    miniMapSize,
    miniMapZoom,
    miniMapFadeStart,
    miniMapFadeEnd,
    uiScale,
    appBarWidth,
    minOrbitDistance,
    maxOrbitDistance,
    sceneTransitionSpeed,
    homeConfig,
    appOpenConfig,
    headlightConfig,
    sceneColors,
    nightAmbientIntensity,
    nightFrontLightIntensity,
    nightEnvironmentIntensity,
    dayFogNear,
    dayFogFar,
    nightFogNear,
    nightFogFar,
    carShadowOpacity,
    aoMapIntensity,
    carShadowWidth,
    carShadowLength,
    carShadowOffsetY,
    carShadowOffsetX,
    carShadowOffsetZ,
    dirLightPosX,
    dirLightPosY,
    dirLightPosZ,
    dirLightIntensity,
    spotLightPosX,
    spotLightPosY,
    spotLightPosZ,
    spotLightIntensity,
    spotLightAngle,
    spotLightPenumbra,
    spotLightTemperature,
    carReflectionOffsetY,
    carReflectionOpacity,
    carReflectionRoughness,
    carReflectionBlur,
    carReflectionMixStrength,
    carReflectionMetalness,
    setCarReflectionOffsetY,
    setCarReflectionOpacity,
    setCarReflectionRoughness,
    setCarReflectionBlur,
    setCarReflectionMixStrength,
    setCarReflectionMetalness,
    setDayNightReflection,
    forceManualFog,
    spotifyPlayerTop,
    spotifyPlayerBottom,
    playerDockedWidth,
    playerDockedLeft,
    playerDockedHeight,
    playerFloatingWidth,
    playerFloatingBottom,
    playerFloatingHeight,
    navigateToolWidth,
    playerControlsSize,
    playerControlsGap,
    playerControlsVerticalPosition,
    spinnerSize,
    spinnerShuffleGap,
    debugSpinner,
    spinnerTop,
    spinnerRight,
    spinnerBottom,
    spinnerLeft,
    volumeIconSize,
    volumeSliderOffsetY,
    volumeSliderOffsetX,
    volumeControlMarginRight,
    volumeSliderWidth,
    volumeSliderThickness,
    volumeSliderThumbOffsetY,
    volumeSliderPopupWidth,
    volumeSliderPopupHeight,
    volumeControlZIndex,
    appLauncherWidth,
    appLauncherHeight,
    queuePopoverHeight,
    queuePopoverBottomOffset,
    queuePopoverScale,
    queuePopoverWidth,
    queuePopoverOffsetX,
    dayPlayerButtonColor,
    nightPlayerButtonColor,
    widgetBgHex,
    widgetBgColor,
    darkVolumeTrackBg,
    darkVolumeThumbBg,
    darkVolumeFillBg,
    darkPlayerBg,
    darkNavigateInputBg,
    satelliteLabelBrightness,
    satelliteLabelOutlineWidth,
    progressBarHeight,
    progressBarVerticalOffset,
    playButtonScale,
    skipButtonScale,
    virtualKeyboardKeySize,
    virtualKeyboardHeight,
    virtualKeyboardPaddingX,
    virtualKeyboardKeyGapX,
    virtualKeyboardKeyGapY,
    virtualKeyboardKeyFontWeight,
    showRedPanel,
    redPanelLength,
    redPanelHeight,
    redPanelWidth,
    redPanelOffsetY,
    redPanelOffsetX,
    redPanelOpacity,
    redPanelColor,
    redPanelOrientation,
    layeredAppTopOffset,
    enable3DModel,
    setEnable3DModel,
    perfReflector,
    perfShadows,
    perfWeatherParticles,
    perfVolumetricHeadlights,
    perfEnvironment,
    perfAntialiasing,
    perfDPR,
    perfTargetFps,
    perfProfilePreset,
    applyPerformancePreset,
    perfMetrics,
  ]);

  return <UIConfigContext.Provider value={value}>{children}</UIConfigContext.Provider>;
}

export function useUIConfig() {
  const context = useContext(UIConfigContext);
  if (context === null) {
    throw new Error('useUIConfig must be used within a UIConfigProvider');
  }
  return context;
}
