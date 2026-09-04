import React, { createContext, useContext, useState, useMemo } from 'react';
import type { SceneConfig, HeadlightConfig } from '../components/VehicleCanvas';
import type { SceneColors } from '../App';
import { initialSceneColors } from '../App';

const DEFAULT_HOME_CONFIG: SceneConfig = {
    cameraPos: { x: 8.30, y: 3.30, z: 8.80 }, 
    cameraTarget: { x: -1.30, y: -0.40, z: 0.05 }, 
    modelPos: { x: -1.40, y: -1.05, z: 0.15 },
    modelRot: { x: 0.01, y: -1.49, z: 0.00 },
    modelScale: 2.68,
};

const DEFAULT_APP_OPEN_CONFIG: SceneConfig = {
  cameraPos: { x: 5.40, y: 5.40, z: 4.75 },
  cameraTarget: { x: -4.90, y: 0.45, z: -0.40 },
  modelPos: { x: -4.90, y: -0.15, z: -0.40 }, 
  modelRot: { x: 0.01, y: -1.19, z: 0.01 },
  modelScale: 1.57,
};

export const UIConfigContext = createContext<any>(null);

export function UIConfigProvider({ children }: { children: React.ReactNode }) {
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
  const [sceneTransitionSpeed, setSceneTransitionSpeed] = useState(1.10);
  
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
  const [carShadowWidth, setCarShadowWidth] = useState(20);
  const [carShadowLength, setCarShadowLength] = useState(20);
  const [carShadowOffsetY, setCarShadowOffsetY] = useState(0.02);
  const [carShadowOffsetX, setCarShadowOffsetX] = useState(0.0);
  const [carShadowOffsetZ, setCarShadowOffsetZ] = useState(0.0);
  const [dirLightPosX, setDirLightPosX] = useState(-0.30);
  const [dirLightPosY, setDirLightPosY] = useState(40.00);
  const [dirLightPosZ, setDirLightPosZ] = useState(7.70);
  const [dirLightIntensity, setDirLightIntensity] = useState(2.40);
  const [spotLightPosX, setSpotLightPosX] = useState(0.0);
  const [spotLightPosY, setSpotLightPosY] = useState(10.0);
  const [spotLightPosZ, setSpotLightPosZ] = useState(0.0);
  const [spotLightIntensity, setSpotLightIntensity] = useState(1.0);
  const [spotLightAngle, setSpotLightAngle] = useState(0.6);
  const [spotLightPenumbra, setSpotLightPenumbra] = useState(0.5);
  const [spotLightTemperature, setSpotLightTemperature] = useState(5500);
  const [carReflectionOffsetY, setCarReflectionOffsetY] = useState(0.0);
  const [carReflectionOpacity, setCarReflectionOpacity] = useState(1.08);
  const [carReflectionRoughness, setCarReflectionRoughness] = useState(0.00);
  const [carReflectionBlur, setCarReflectionBlur] = useState(0);
  const [carReflectionMixStrength, setCarReflectionMixStrength] = useState(0.1);
  const [carReflectionMetalness, setCarReflectionMetalness] = useState(0.00);
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
  const [playerControlsVerticalPosition, setPlayerControlsVerticalPosition] = useState(3.6);
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
  const [queuePopoverHeight, setQueuePopoverHeight] = useState(89);
  const [queuePopoverBottomOffset, setQueuePopoverBottomOffset] = useState(16);
  const [queuePopoverScale, setQueuePopoverScale] = useState(1.0);
  const [queuePopoverWidth, setQueuePopoverWidth] = useState(288);
  const [queuePopoverOffsetX, setQueuePopoverOffsetX] = useState(-29);

  const [dayPlayerButtonColor, setDayPlayerButtonColor] = useState('#454545');
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
  const [playButtonScale, setPlayButtonScale] = useState(0.87);
  const [skipButtonScale, setSkipButtonScale] = useState(1.29);

  const [virtualKeyboardKeySize, setVirtualKeyboardKeySize] = useState(41);
  const [virtualKeyboardHeight, setVirtualKeyboardHeight] = useState(38);
  const [virtualKeyboardPaddingX, setVirtualKeyboardPaddingX] = useState(69);
  const [virtualKeyboardKeyGapX, setVirtualKeyboardKeyGapX] = useState(2);
  const [virtualKeyboardKeyGapY, setVirtualKeyboardKeyGapY] = useState(2);
  const [virtualKeyboardKeyFontWeight, setVirtualKeyboardKeyFontWeight] = useState(600);

  const value = {
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
  };

  return <UIConfigContext.Provider value={value}>{children}</UIConfigContext.Provider>;
}

export function useUIConfig() {
  const context = useContext(UIConfigContext);
  if (context === null) {
    throw new Error('useUIConfig must be used within a UIConfigProvider');
  }
  return context;
}
