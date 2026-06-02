
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VehicleProvider } from './context/VehicleContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { YouTubeMusicProvider } from './context/YouTubeMusicContext';
import { UIConfigProvider, useUIConfig } from './context/UIConfigContext';
import VehicleCanvas, { SceneConfig } from './components/VehicleCanvas';
import { ICONS } from './constants';
import SpotifyApp from './components/SpotifyPlayer';
import MusicPlayer from './components/MusicPlayer';
import MapsContainer from './components/MapsContainer';
import AppLauncher from './components/AppLauncher';
import TopStatusBar from './components/TopStatusBar';
import WeatherModal from './components/WeatherModal';
import MiniMap from './components/MiniMap';
import { TempUnit, RadioStation, NowPlayingState } from './types';
import { routeStore } from './components/routeStore';
import VehicleArrowIcon from './components/VehicleArrowIcon';
import DebugControls from './components/DebugControls';
import VolumeControl from './components/VolumeControl';
import { FiMinus } from 'react-icons/fi';
import TheaterApp from './components/Theater';
import RadioApp from './components/RadioApp';
import YouTubeMusicApp from './components/YouTubeMusicApp';
import { AnimatePresence, motion } from 'framer-motion';
import VirtualKeyboard from './components/VirtualKeyboard';
import { SpotifyItem as MediaItem } from './components/PlaylistItem';
import WebAppViewer from './components/WebAppViewer';
import NavigateTool, { formatTravelTime } from './components/NavigateTool';

import { isDemoMode, getYouTubeMockHomeData } from './lib/youtubeDemoFallback';

import { WeatherProvider, useWeather } from './context/WeatherContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import NavigationStatus from './components/NavigationStatus';

interface AppDefinition {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  colorClasses?: string;
}

const ALL_APPS: AppDefinition[] = [
  { id: 'spotify', icon: ICONS.spotify, label: 'Spotify', colorClasses: 'text-green-500 hover:text-green-400' },
  { id: 'youtube-music', icon: ICONS.youtube, label: 'YouTube Music', colorClasses: '' },
  { id: 'maps', icon: ICONS.maps, label: 'Maps' },
  { id: 'theater', icon: ICONS.theater, label: 'Theater' },
  { id: 'radio', icon: ICONS.radio, label: 'Radio', colorClasses: 'text-white' },
  { id: 'debug', icon: ICONS.settings, label: 'Debug', colorClasses: 'text-gray-400 hover:text-white' },
];

export const SPLIT_APPS_WITH_MAP_UNDER = ['spotify', 'youtube-music', 'radio', 'theater', 'debug'];

const DockButton = ({ icon: Icon, onClick, label, colorClasses = 'text-gray-400 hover:text-white' }: { 
  icon: React.ComponentType<any>, 
  onClick: (e: React.MouseEvent) => void, 
  label: string, 
  colorClasses?: string 
}) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-24 h-full transition-all duration-200 ease-in-out hover:scale-110 ${colorClasses}`} aria-label={label}>
    <Icon className="w-8 h-8" />
  </button>
);

type WeatherStatus = 'idle' | 'locating' | 'fetching' | 'success' | 'error';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

export type SceneColors = {
  day: {
    [condition: string]: { sky: string; floor: string };
  };
  night: {
    [condition: string]: { sky: string; floor: string };
  };
};

export const initialSceneColors: SceneColors = {
  day: {
    'Cielo sereno': { sky: '#ffffff', floor: '#ffffff' },
    'Pioggia': { sky: '#595b5f', floor: '#8a8a8a' },
    'Temporale': { sky: '#454b59', floor: '#222222' },
    'Neve': { sky: '#ababab', floor: '#eeeeee' },
    'Grandine': { sky: '#a1a1aa', floor: '#d4d4d8' },
    'Nebbia': { sky: '#b0b8c0', floor: '#b0b8c0' },
  },
  night: {
    'Cielo sereno': { sky: '#000000', floor: '#000000' },
    'Pioggia': { sky: '#000000', floor: '#000000' },
    'Temporale': { sky: '#000000', floor: '#000000' },
    'Neve': { sky: '#000000', floor: '#000000' },
    'Grandine': { sky: '#000000', floor: '#000000' },
    'Nebbia': { sky: '#000000', floor: '#000000' },
  }
};

const DEFAULT_HOME_CONFIG: SceneConfig = {
    cameraPos: { x: 8.30, y: 3.30, z: 8.80 }, 
    cameraTarget: { x: -1.30, y: -0.40, z: 0.05 }, 
    modelPos: { x: -1.40, y: -1.05, z: 0.15 },
    modelRot: { x: 0.01, y: -1.49, z: 0.00 },
    modelScale: 2.68,
};

const ArrivalToast = () => {
    const { arrivalMessage } = useNavigation();
    return (
        <AnimatePresence>
            {arrivalMessage && (
                <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.9 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, y: 50, scale: 0.9 }} 
                    className="fixed left-1/2 -translate-x-1/2 z-50 bg-zinc-800/80 backdrop-blur-md text-white font-bold px-6 py-3 rounded-xl shadow-lg border border-white/10" 
                    style={{ bottom: '230px' }}
                >
                    {arrivalMessage}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const NavigationWidget = ({ 
    navigateToolRef, 
    navigateToolStyle, 
    navigateToolWidth, 
    widgetBgColor, 
    dayPlayerButtonColor, 
    nightPlayerButtonColor, 
    darkNavigateInputBg, 
    isHome 
}: { 
    navigateToolRef: React.RefObject<HTMLDivElement | null>;
    navigateToolStyle: React.CSSProperties;
    navigateToolWidth: number;
    widgetBgColor: string;
    dayPlayerButtonColor: string;
    nightPlayerButtonColor: string;
    darkNavigateInputBg: string;
    isHome: boolean;
}) => {
    const { navigationTarget } = useNavigation();
    const { useDarkTheme } = useWeather();
    return (
        <div ref={navigateToolRef} className="flex items-end" style={navigateToolStyle}>
            {navigationTarget ? (
                <NavigationStatus width={navigateToolWidth} widgetBgColor={widgetBgColor}/>
            ) : (
                <NavigateTool 
                    isNight={useDarkTheme} 
                    width={navigateToolWidth} 
                    widgetBgColor={widgetBgColor} 
                    dayPlayerButtonColor={dayPlayerButtonColor} 
                    nightPlayerButtonColor={nightPlayerButtonColor} 
                    darkNavigateInputBg={darkNavigateInputBg} 
                    isHome={isHome}
                />
            )}
        </div>
    );
};

function AppContent() {
  const { nowPlaying, setNowPlaying, pauseSpotify } = useAuth();
  const {
    isNight,
    useDarkTheme,
    effectiveWeatherCondition,
    targetWeatherParams,
  } = useWeather();

  const {
    topBarScale, topBarOffsetY, setTopBarOffsetY, mapsSearchPanelTop,
    miniMapTop, miniMapRight, miniMapSize, miniMapZoom, miniMapFadeStart, miniMapFadeEnd,
    uiScale, appBarWidth, minOrbitDistance, maxOrbitDistance,
    homeConfig, appOpenConfig, headlightConfig, sceneColors,
    nightAmbientIntensity, nightFrontLightIntensity, nightEnvironmentIntensity,
    dayFogNear, dayFogFar, nightFogNear, nightFogFar, carShadowOpacity, carShadowWidth, carShadowLength, carShadowOffsetY,
    carShadowOffsetX, carShadowOffsetZ,
    dirLightPosX, dirLightPosY, dirLightPosZ, dirLightIntensity,
    spotLightPosX, spotLightPosY, spotLightPosZ, spotLightIntensity,
    carReflectionOffsetY, carReflectionOpacity,
    carReflectionRoughness, carReflectionBlur, carReflectionMixStrength, carReflectionMetalness, forceManualFog, spotifyPlayerTop, spotifyPlayerBottom,
    playerDockedWidth, playerDockedLeft, playerDockedHeight,
    playerFloatingWidth, playerFloatingBottom, playerFloatingHeight, navigateToolWidth,
    playerControlsSize, playerControlsGap, playerControlsVerticalPosition,
    spinnerSize, spinnerShuffleGap, debugSpinner, spinnerTop, spinnerRight, spinnerBottom, spinnerLeft,
    appLauncherWidth, appLauncherHeight, queuePopoverHeight, queuePopoverBottomOffset, queuePopoverScale, queuePopoverWidth, queuePopoverOffsetX,
    dayPlayerButtonColor, nightPlayerButtonColor, widgetBgColor,
    darkVolumeTrackBg, darkVolumeThumbBg, darkVolumeFillBg, darkPlayerBg, darkNavigateInputBg,
    satelliteLabelBrightness, satelliteLabelOutlineWidth,
    progressBarHeight, progressBarVerticalOffset, playButtonScale, skipButtonScale,
    virtualKeyboardKeySize, virtualKeyboardHeight, virtualKeyboardPaddingX,
    virtualKeyboardKeyGapX, virtualKeyboardKeyGapY, virtualKeyboardKeyFontWeight,
    volumeIconSize, volumeSliderOffsetY, volumeSliderOffsetX, volumeControlMarginRight,
    volumeSliderWidth, volumeSliderThickness, volumeSliderThumbOffsetY,
    volumeSliderPopupWidth, volumeSliderPopupHeight, volumeControlZIndex,
    showRedPanel, redPanelLength, redPanelHeight, redPanelWidth, redPanelOffsetY, redPanelOffsetX, redPanelOpacity, redPanelColor, redPanelOrientation
  } = useUIConfig();

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isCanvasInteracting, setIsCanvasInteracting] = useState(false);
  const [dockApps, setDockApps] = useState<string[]>(['spotify', 'maps']);
  const [launcherApps, setLauncherApps] = useState<string[]>(['theater', 'radio', 'youtube-music', 'debug']);
  const [recentlyOpened, setRecentlyOpened] = useState<string[]>([]);
  
  const [favoriteStationUUIDs, setFavoriteStationUUIDs] = useState<string[]>([]);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState<HTMLElement | null>(null);
  const [webAppUrl, setWebAppUrl] = useState<string | null>(null);

  // --- MOVED UP ---
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [isMapsLayered, setIsMapsLayered] = useState(false);

  // --- DRAG INTERPOLATION STATE AS REF ---
  // Using a ref avoids re-rendering the entire App component on every drag frame.
  const dragProgressRef = useRef<number | null>(null);

  // --- REF FOR NAVIGATE TOOL ANIMATION ---
  const navigateToolRef = useRef<HTMLDivElement>(null);
  const navigateToolVisualState = useRef(activeApp !== null ? 0 : 1); // 0 = Hidden/Open App, 1 = Visible/Home

  // Stable callback to update the ref
  const handleDragProgress = useCallback((val: number | null) => {
    if (isSwitchingRef.current) return;
    dragProgressRef.current = val;
  }, []);

  const handleSpotifyDrag = useCallback((progress: number | null) => {
    if (isSwitchingRef.current) return;
    // If maps is layered, OR we are transitioning back to maps, ignore
    const isMapLayeredBehind = activeApp !== null && ['spotify', 'youtube-music', 'radio', 'theater', 'debug'].includes(activeApp);
    if ((isMapsLayered || activeApp === 'maps' || isMapLayeredBehind) && progress !== null) {
        return; 
    }
    dragProgressRef.current = progress;
  }, [isMapsLayered, activeApp]);

  // --- NAVIGATE TOOL ANIMATION LOOP ---
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
        // Target is 0 if app is open, 1 if home
        let target = activeApp !== null ? 0 : 1;
        
        // Override with drag progress if active
        // dragProgress: 0 (Open) -> 1 (Closed/Home)
        if (dragProgressRef.current !== null) {
            navigateToolVisualState.current = dragProgressRef.current;
        } else {
            // Lerp towards target
            const diff = target - navigateToolVisualState.current;
            if (Math.abs(diff) > 0.001) {
                navigateToolVisualState.current += diff * 0.25; // Speed up auto-animation
            } else {
                navigateToolVisualState.current = target;
            }
        }

        const current = Math.max(0, Math.min(1, navigateToolVisualState.current));
        
        if (navigateToolRef.current) {
            // THRESHOLD LOGIC: 
            // User requested "arrive before the player".
            // Player closes at 1.0. We want full visibility by 0.85.
            // Range [0.25, 0.85] -> Fades in and slides from Right to Left.
            
            const threshold = 0.25;
            const endPoint = 0.85; // Reach full visibility/position earlier
            
            let visibility = 0;
            
            if (current > threshold) {
                // Map [0.25, 0.85] to [0, 1]
                visibility = (current - threshold) / (endPoint - threshold);
                // Clamp to max 1.0 (so it stays fully visible from 0.85 to 1.0)
                visibility = Math.min(1, Math.max(0, visibility));
            }
            
            // Translate X: 0 (at visibility=1) to 50px (at visibility=0)
            const translateX = (1 - visibility) * 50; 
            
            navigateToolRef.current.style.opacity = `${visibility}`;
            navigateToolRef.current.style.transform = `translateX(${translateX}px)`;
            navigateToolRef.current.style.pointerEvents = visibility > 0.9 ? 'auto' : 'none';
        }

        animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [activeApp]); // Dependency on activeApp determines the resting target

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target.tagName === 'INPUT' && ['text', 'search', 'email', 'password', 'url', 'tel'].includes((target as HTMLInputElement).type)) ||
        target.tagName === 'TEXTAREA'
      ) {
        setKeyboardTarget(target);
        setIsKeyboardVisible(true);
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  useEffect(() => {
    if (!isKeyboardVisible) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#virtual-keyboard')) return;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      setIsKeyboardVisible(false);
      setKeyboardTarget(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isKeyboardVisible]);

  const handleKeyboardClose = useCallback(() => {
    if (keyboardTarget) keyboardTarget.blur();
    setIsKeyboardVisible(false);
    setKeyboardTarget(null);
  }, [keyboardTarget]);

  // --- NAVIGATION CUSTOM EVENT SUBSCRIBERS ---
  useEffect(() => {
    const handleSelectDestEvent = () => {
      setActiveApp('maps');
    };
    const handleMapInterEvent = () => {
      handleKeyboardClose();
    };

    window.addEventListener('select-destination', handleSelectDestEvent);
    window.addEventListener('map-interaction', handleMapInterEvent);
    return () => {
      window.removeEventListener('select-destination', handleSelectDestEvent);
      window.removeEventListener('map-interaction', handleMapInterEvent);
    };
  }, [handleKeyboardClose]);

  // --- CASCADING CLOSE LOGIC ---
  const handleCloseMaps = useCallback(() => {
    setActiveApp(null);
    setIsMapsLayered(false);
  }, []);

  // --- IMMEDIATE LAYERED APP CLOSE ON DRAG START ---
  const handleMapsInteractionStart = useCallback(() => {
    if (isMapsLayered) {
        setIsMapsLayered(false);
        setActiveApp('maps'); // Revert active app to Maps so it stays visible while being dragged
    }
  }, [isMapsLayered]);

  useEffect(() => {
    try {
        const storedFavorites = localStorage.getItem('radio_favorite_uuids');
        if (storedFavorites) setFavoriteStationUUIDs(JSON.parse(storedFavorites));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem('radio_favorite_uuids', JSON.stringify(favoriteStationUUIDs));
    } catch (e) { console.error(e); }
  }, [favoriteStationUUIDs]);

  const handleToggleFavorite = useCallback((station: RadioStation) => {
    setFavoriteStationUUIDs(prev => prev.includes(station.stationuuid) ? prev.filter(uuid => uuid !== station.stationuuid) : [...prev, station.stationuuid]);
  }, []);

  const moveAppToLauncher = (appId: string) => {
    setDockApps(prev => prev.filter(id => id !== appId));
    setLauncherApps(prev => [...prev, appId]);
  };

  const moveAppToDock = (appId: string) => {
    setLauncherApps(prev => prev.filter(id => id !== appId));
    setDockApps(prev => [...prev, appId]);
  };

  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  const [tempUnit, setTempUnit] = useState<TempUnit>('C');
  
  const handlePlayStation = (station: RadioStation, context: RadioStation[]) => {
      pauseSpotify();
      setNowPlaying(prev => ({ ...prev, source: 'radio', radioStation: station, radioContext: context, youtubeTrack: null, isLoading: true }));
  };
  
  const handleStationChange = (direction: 'next' | 'prev') => {
      if (nowPlaying?.source !== 'radio' || !nowPlaying.radioContext?.length) return;
      const { radioStation, radioContext } = nowPlaying;
      const currentIndex = radioContext.findIndex(s => s.stationuuid === radioStation!.stationuuid);
      if (currentIndex === -1) return;
      let nextIndex = direction === 'next' ? (currentIndex + 1) % radioContext.length : (currentIndex - 1 + radioContext.length) % radioContext.length;
      setNowPlaying(prev => ({ ...prev, radioStation: radioContext[nextIndex] }));
  };

  useEffect(() => {
    const root = document.documentElement;
    if (useDarkTheme) {
        root.style.setProperty('--volume-slider-track-bg', darkVolumeTrackBg); root.style.setProperty('--volume-slider-thumb-bg', darkVolumeThumbBg);
        root.style.setProperty('--volume-slider-fill-bg', darkVolumeFillBg); root.style.setProperty('--player-bg', darkPlayerBg);
    } else {
        root.style.removeProperty('--volume-slider-track-bg'); root.style.removeProperty('--volume-slider-thumb-bg');
        root.style.removeProperty('--volume-slider-fill-bg'); root.style.removeProperty('--player-bg');
    }
  }, [useDarkTheme, darkVolumeTrackBg, darkVolumeThumbBg, darkVolumeFillBg, darkPlayerBg]);

  const isSwitchingRef = useRef(false);
  const switchTimeoutRef = useRef<number | null>(null);

  const switchApp = useCallback((newApp: string) => {
      isSwitchingRef.current = true;
      if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
      switchTimeoutRef.current = window.setTimeout(() => {
          isSwitchingRef.current = false;
      }, 500);
      setActiveApp(newApp);
      setIsMapsLayered(false);
  }, []);

  const handleSubAppClose = useCallback(() => {
      setActiveApp('maps');
      setIsMapsLayered(false);
  }, []);

  const toggleApp = useCallback((appName: string) => {
    setIsAppLauncherOpen(false); setIsCustomizing(false);
    const willBeActive = activeApp !== appName; 
    if (willBeActive && !dockApps.includes(appName)) setRecentlyOpened(prev => [appName, ...prev.filter(id => id !== appName)]);
    
    // We generalize the map layering logic to all apps in SPLIT_APPS_WITH_MAP_UNDER
    if (SPLIT_APPS_WITH_MAP_UNDER.includes(appName) && activeApp === 'maps') { 
        setActiveApp(appName); 
        setIsMapsLayered(true); 
        return; 
    }
    if (SPLIT_APPS_WITH_MAP_UNDER.includes(appName) && activeApp === appName) { 
        setActiveApp(null); 
        setIsMapsLayered(false); 
        return; 
    }
    
    if (activeApp !== null && activeApp !== appName) {
        switchApp(appName);
    } else {
        setIsMapsLayered(false); 
        setActiveApp(prevApp => (prevApp === appName ? null : appName));
    }
  }, [activeApp, dockApps, isMapsLayered, switchApp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.altKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            if (activeApp === 'debug') {
                toggleApp('maps');
            } else {
                toggleApp('debug');
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleApp, activeApp]);

  const toggleLauncher = (e: React.MouseEvent) => { e.stopPropagation(); const newLauncherState = !isAppLauncherOpen; setIsAppLauncherOpen(newLauncherState); if (!newLauncherState) setIsCustomizing(false); };
  const isHomeScreenDocked = activeApp !== null || isAppLauncherOpen;
  
    // Refactored logic to handle animation in JS
    const navigateToolStyle = useMemo(() => {
        const baseStyle: React.CSSProperties = { 
            position: 'fixed', 
            zIndex: 1000, 
            bottom: `${playerFloatingBottom}px`, 
            // Removed transitions/transform/opacity from here to avoid fighting the animation loop
        };
        const homeLeft = `calc(50% + (${playerFloatingWidth}px / 2) + 8px - (${navigateToolWidth}px / 2))`;
        const launcherOpenLeft = `calc(100% - ${playerDockedLeft + 90}px - ${navigateToolWidth}px)`;
        
        if (isAppLauncherOpen) return { ...baseStyle, left: launcherOpenLeft, bottom: `${playerFloatingBottom}px` }; // Don't lift if launcher open (unlikely combo)
        
        // Default home position for normal/app closed states, applying lift if needed
        return { ...baseStyle, left: homeLeft, bottom: `${playerFloatingBottom}px` };
    }, [isAppLauncherOpen, playerFloatingBottom, playerDockedLeft, playerFloatingWidth, navigateToolWidth]);
  
  const recentAppsToShow = recentlyOpened.filter(id => !dockApps.includes(id)).slice(0, 2);

  const isMapLayeredBehind = activeApp !== null && SPLIT_APPS_WITH_MAP_UNDER.includes(activeApp);
  const shouldShowMap = activeApp === 'maps' || isMapsLayered || isMapLayeredBehind;

  return (
    <div id="main-app-container" className="absolute top-0 left-0 w-full h-full select-none overflow-hidden" onClick={() => { if (isAppLauncherOpen) { setIsAppLauncherOpen(false); setIsCustomizing(false); }}} data-theme={useDarkTheme ? 'dark' : 'light'}>
      <VehicleCanvas
        isAppOpen={activeApp !== null}
        isNight={isNight}
        minOrbitDistance={minOrbitDistance}
        maxOrbitDistance={maxOrbitDistance}
        appOpenConfig={appOpenConfig}
        homeConfig={homeConfig}
        sceneColors={sceneColors}
        nightAmbientIntensity={nightAmbientIntensity}
        nightFrontLightIntensity={nightFrontLightIntensity}
        nightEnvironmentIntensity={nightEnvironmentIntensity}
        onInteractionChange={setIsCanvasInteracting}
        effectiveWeatherCondition={effectiveWeatherCondition}
        dayFogNear={dayFogNear}
        dayFogFar={dayFogFar}
        nightFogNear={nightFogNear}
        nightFogFar={nightFogFar}
        targetWeatherParams={targetWeatherParams}
        uiScale={uiScale ?? 1.0}
        headlightConfig={headlightConfig}
        dragProgress={dragProgressRef}
        carShadowOpacity={carShadowOpacity}
        carShadowWidth={carShadowWidth}
        carShadowLength={carShadowLength}
        carShadowOffsetY={carShadowOffsetY}
        carShadowOffsetX={carShadowOffsetX}
        carShadowOffsetZ={carShadowOffsetZ}
        dirLightPosX={dirLightPosX}
        dirLightPosY={dirLightPosY}
        dirLightPosZ={dirLightPosZ}
        dirLightIntensity={dirLightIntensity}
        spotLightPosX={spotLightPosX}
        spotLightPosY={spotLightPosY}
        spotLightPosZ={spotLightPosZ}
        spotLightIntensity={spotLightIntensity}
        carReflectionOffsetY={carReflectionOffsetY}
        carReflectionOpacity={carReflectionOpacity}
        carReflectionRoughness={carReflectionRoughness}
        carReflectionBlur={carReflectionBlur}
        carReflectionMixStrength={carReflectionMixStrength}
        carReflectionMetalness={carReflectionMetalness}
        forceManualFog={forceManualFog}
        showRedPanel={showRedPanel}
        redPanelLength={redPanelLength}
        redPanelHeight={redPanelHeight}
        redPanelWidth={redPanelWidth}
        redPanelOffsetY={redPanelOffsetY}
        redPanelOffsetX={redPanelOffsetX}
        redPanelOpacity={redPanelOpacity}
        redPanelColor={redPanelColor}
        redPanelOrientation={redPanelOrientation}
      />
      <TopStatusBar tempUnit={tempUnit} setTempUnit={setTempUnit} scale={uiScale ?? 1.0} offsetY={topBarOffsetY} setTopBarOffsetY={setTopBarOffsetY} isMapVisible={shouldShowMap}/>
      <WeatherModal tempUnit={tempUnit}/>
      <MiniMap isVisible={activeApp === null && !isCanvasInteracting} top={miniMapTop} right={miniMapRight} size={miniMapSize} zoom={miniMapZoom} fadeStart={miniMapFadeStart} fadeEnd={miniMapFadeEnd} onClick={(e) => { e.stopPropagation(); toggleApp('maps'); }} uiScale={uiScale ?? 1.0}/>
      <div className="ui-scaler" style={uiScale ? { '--ui-scale': uiScale } as React.CSSProperties : {}}>
        <div id="scaled-portal-root" className="relative z-[9999]"></div>
        <MapsContainer 
            isOpen={shouldShowMap} 
            onClose={handleCloseMaps} 
            onInteractionStart={handleMapsInteractionStart} 
            onDragProgress={handleDragProgress}
        />
        <SpotifyApp isOpen={activeApp === 'spotify'} onClose={handleSubAppClose} isNight={useDarkTheme} spotifyPlayerTop={spotifyPlayerTop} spotifyPlayerBottom={spotifyPlayerBottom} isMapsLayered={isMapsLayered || isMapLayeredBehind} onDragProgress={handleSpotifyDrag} />
        <TheaterApp isOpen={activeApp === 'theater'} onClose={handleSubAppClose} isNight={useDarkTheme} spotifyPlayerTop={spotifyPlayerTop} spotifyPlayerBottom={spotifyPlayerBottom} onDragProgress={handleSpotifyDrag} isMapsLayered={isMapsLayered || isMapLayeredBehind} />
        <DebugControls
            isOpen={activeApp === 'debug'}
            onClose={handleSubAppClose}
            onDragProgress={handleSpotifyDrag}
            isMapsLayered={isMapsLayered || isMapLayeredBehind}
            isAppView={true}
        />
        <RadioApp isOpen={activeApp === 'radio'} onClose={handleSubAppClose} isNight={useDarkTheme} onPlayStation={handlePlayStation} spotifyPlayerTop={spotifyPlayerTop} spotifyPlayerBottom={spotifyPlayerBottom} favoriteStationUUIDs={favoriteStationUUIDs} onDragProgress={handleSpotifyDrag} isMapsLayered={isMapsLayered || isMapLayeredBehind} />
        <YouTubeMusicApp isOpen={activeApp === 'youtube-music'} onClose={handleSubAppClose} isNight={useDarkTheme} spotifyPlayerTop={spotifyPlayerTop} spotifyPlayerBottom={spotifyPlayerBottom} onDragProgress={handleSpotifyDrag} isMapsLayered={isMapsLayered || isMapLayeredBehind} />
        <ArrivalToast />
        {/* NAVIGATE TOOL CONTAINER */}
        <NavigationWidget 
            navigateToolRef={navigateToolRef}
            navigateToolStyle={navigateToolStyle}
            navigateToolWidth={navigateToolWidth}
            widgetBgColor={widgetBgColor}
            dayPlayerButtonColor={dayPlayerButtonColor}
            nightPlayerButtonColor={nightPlayerButtonColor}
            darkNavigateInputBg={darkNavigateInputBg}
            isHome={activeApp === null}
        />
        <MusicPlayer activeApp={activeApp} onStationChange={handleStationChange} isAnyAppOpen={isHomeScreenDocked} isNight={useDarkTheme} dockedConfig={{ width: playerDockedWidth, bottom: playerFloatingBottom, left: playerDockedLeft, height: playerDockedHeight }} floatingConfig={{ width: playerFloatingWidth, bottom: playerFloatingBottom, height: playerFloatingHeight, otherWidgetWidth: navigateToolWidth }} playerControlsSize={playerControlsSize} playerControlsGap={playerControlsGap} playerControlsVerticalPosition={playerControlsVerticalPosition} spinnerSize={spinnerSize} spinnerShuffleGap={spinnerShuffleGap} debugSpinner={debugSpinner} widgetBgColor={widgetBgColor} dayPlayerButtonColor={dayPlayerButtonColor} nightPlayerButtonColor={nightPlayerButtonColor} favoriteStationUUIDs={favoriteStationUUIDs} onToggleFavorite={handleToggleFavorite} queuePopoverHeight={queuePopoverHeight} queuePopoverBottomOffset={queuePopoverBottomOffset} queuePopoverScale={queuePopoverScale} queuePopoverWidth={queuePopoverWidth} queuePopoverOffsetX={queuePopoverOffsetX} spinnerTop={spinnerTop} spinnerRight={spinnerRight} spinnerBottom={spinnerBottom} spinnerLeft={spinnerLeft} dragProgress={dragProgressRef} progressBarHeight={progressBarHeight} progressBarVerticalOffset={progressBarVerticalOffset} playButtonScale={playButtonScale} skipButtonScale={skipButtonScale} />
        <AppLauncher isOpen={isAppLauncherOpen} width={appLauncherWidth} height={appLauncherHeight} apps={launcherApps.map(id => ALL_APPS.find(app => app.id === id)!)} isCustomizing={isCustomizing} onCustomizeClick={moveAppToDock} onAppLaunch={toggleApp} isNight={useDarkTheme}/>
        {isAppLauncherOpen && <button onClick={(e) => { e.stopPropagation(); setIsCustomizing(prev => !prev); }} className={`fixed left-1/2 -translate-x-1/2 z-[8000] px-6 py-2 rounded-full font-semibold transition-all duration-300 ease-out shadow-lg ${isCustomizing ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-800/80 hover:bg-zinc-700/90 text-gray-200 border border-white/20 backdrop-blur-sm'} ${isAppLauncherOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`} style={{ bottom: `calc(6rem + ${appLauncherHeight}px + 0.75rem)` }}>{isCustomizing ? 'Fine' : 'Personalizza'}</button>}
        <AnimatePresence>{isKeyboardVisible && <VirtualKeyboard isVisible={isKeyboardVisible} targetElement={keyboardTarget as HTMLInputElement | HTMLTextAreaElement | null} onClose={handleKeyboardClose} isNight={useDarkTheme} virtualKeyboardKeySize={virtualKeyboardKeySize} virtualKeyboardHeight={virtualKeyboardHeight} virtualKeyboardPaddingX={virtualKeyboardPaddingX} virtualKeyboardKeyGapX={virtualKeyboardKeyGapX} virtualKeyboardKeyGapY={virtualKeyboardKeyGapY} virtualKeyboardKeyFontWeight={virtualKeyboardKeyFontWeight}/>}</AnimatePresence>
        <footer className="fixed bottom-0 left-0 right-0 h-20 z-[4500]" aria-label="Application Dock">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full bg-black" style={{ width: `${appBarWidth}%` }}/>
            <div className="relative z-10 h-full flex justify-center items-center">
                <div className="flex justify-center items-center gap-4">
                    {dockApps.map(appId => { const app = ALL_APPS.find(a => a.id === appId); if (!app) return null; return ( <div key={app.id} className="relative flex flex-col items-center"> <button onClick={(e) => { e.stopPropagation(); if (isCustomizing) return; toggleApp(app.id); }} className={`flex flex-col items-center justify-center w-24 h-full transition-all duration-200 ease-in-out ${isCustomizing ? 'customizing-jiggle cursor-default' : 'hover:scale-110'} ${app.colorClasses ?? 'text-gray-400 hover:text-white'}`} aria-label={app.label}> <app.icon className="w-10 h-10" /> </button> {activeApp === app.id && !isCustomizing && <div className="absolute -bottom-2.5 w-6 h-1 bg-zinc-300 rounded-full transition-opacity" />} {isCustomizing && <button onClick={(e) => { e.stopPropagation(); moveAppToLauncher(app.id); }} className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center border-2 border-black transition-all duration-200 hover:scale-110 cursor-pointer" aria-label={`Sposta ${app.label} nel launcher`}> <FiMinus className="w-4 h-4 text-white" strokeWidth={3}/> </button>} </div> ); })}
                    <div className="relative flex flex-col items-center"><DockButton icon={ICONS.apps} onClick={toggleLauncher} label="Open App Launcher"/>{isAppLauncherOpen && !isCustomizing && <div className="absolute -bottom-2.5 w-6 h-1 bg-zinc-300 rounded-full transition-opacity" />}</div>
                    {recentAppsToShow.length > 0 && <> <div className="w-px h-8 bg-gray-600" /> {recentAppsToShow.map(appId => { const app = ALL_APPS.find(a => a.id === appId); if (!app) return null; return ( <div key={`recent-${app.id}`} className="relative flex flex-col items-center"> <button onClick={(e) => { e.stopPropagation(); toggleApp(app.id); }} className={`flex flex-col items-center justify-center w-24 h-full transition-all duration-200 ease-in-out hover:scale-110 ${app.colorClasses ?? 'text-gray-400 hover:text-white'}`} aria-label={app.label}> <app.icon className="w-8 h-8" /> </button> {activeApp === app.id && <div className="absolute -bottom-2.5 w-6 h-1 bg-zinc-300 rounded-full transition-opacity" />} </div> ); })} </>}
                </div>
                <div className="absolute top-0 right-0 h-full flex items-center" style={{ paddingRight: `${volumeControlMarginRight}px` }}><VolumeControl iconSize={volumeIconSize} volumeSliderOffsetY={volumeSliderOffsetY} volumeSliderOffsetX={volumeSliderOffsetX} volumeSliderWidth={volumeSliderWidth} volumeSliderThickness={volumeSliderThickness} volumeSliderPopupWidth={volumeSliderPopupWidth} volumeSliderPopupHeight={volumeSliderPopupHeight} zIndex={volumeControlZIndex} volumeSliderThumbOffsetY={volumeSliderThumbOffsetY}/></div>
            </div>
        </footer>
      </div>
       {webAppUrl && <WebAppViewer url={webAppUrl} onClose={() => setWebAppUrl(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <VehicleProvider>
      <AuthProvider>
        <WeatherProvider>
          <NavigationProvider>
            <YouTubeMusicProvider>
              <UIConfigProvider>
                <AppContent />
              </UIConfigProvider>
            </YouTubeMusicProvider>
          </NavigationProvider>
        </WeatherProvider>
      </AuthProvider>
    </VehicleProvider>
  );
}
