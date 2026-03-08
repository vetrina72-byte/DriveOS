
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VehicleProvider } from './context/VehicleContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import VehicleCanvas, { SceneConfig } from './components/VehicleCanvas';
import { ICONS } from './constants';
import SpotifyApp from './components/SpotifyPlayer';
import MusicPlayer from './components/MusicPlayer';
import MapsContainer from './components/MapsContainer';
import AppLauncher from './components/AppLauncher';
import TopStatusBar from './components/TopStatusBar';
import WeatherModal from './components/WeatherModal';
import MiniMap from './components/MiniMap';
import { WeatherData, TempUnit, WeatherParams, RadioStation, NowPlayingState } from './types';
import { HOT_TEMP, COLD_TEMP } from './components/WeatherIcon';
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

const weatherConfig: Record<string, WeatherParams> = {
  'Cielo sereno': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 50, fogFar: 150 },
  'Prevalentemente sereno': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 45, fogFar: 140 },
  'Parzialmente nuvoloso': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 35, fogFar: 120 },
  'Coperto': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 25, fogFar: 80 },
  'Pioggerella': { rainDensity: 0.2, rainSpeed: 5, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 20, fogFar: 60 },
  'Pioggia leggera': { rainDensity: 0.4, rainSpeed: 8, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 18, fogFar: 50 },
  'Pioggia': { rainDensity: 0.7, rainSpeed: 11, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 15, fogFar: 40 },
  'Pioggia forte': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 10, fogFar: 30 },
  'Rovescio': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 10, fogFar: 30 },
  'Temporale': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 8, fogFar: 25 },
  'Neve leggera': { rainDensity: 0, rainSpeed: 0, snowDensity: 0.4, snowSpeed: 1.5, hailDensity: 0, fogNear: 15, fogFar: 40 },
  'Neve': { rainDensity: 0, rainSpeed: 0, snowDensity: 0.7, snowSpeed: 3.0, hailDensity: 0, fogNear: 12, fogFar: 35 },
  'Neve forte': { rainDensity: 0, rainSpeed: 0, snowDensity: 1.0, snowSpeed: 6.0, hailDensity: 0, fogNear: 8, fogFar: 25 },
  'Grandine': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 1.0, fogNear: 12, fogFar: 35 },
  'Nebbia': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 1, fogFar: 20 },
  'Sunrise': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 130 },
  'Sunset': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 130 },
  'Cloudy Sunrise': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 30, fogFar: 100 },
  'Cloudy Sunset': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 30, fogFar: 100 },
  'Partly Cloudy Night': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 120 },
  'Default': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 50, fogFar: 150 },
};

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

const NavigationStatus = ({ target, currentPosition, isNight, onCancel, tripInfo, simulatedRemainingDistance, width, widgetBgColor }: {
    target: { lat: number, lng: number, name: string },
    currentPosition: { lat: number, lng: number } | null,
    isNight: boolean,
    onCancel: (message?: string) => void,
    tripInfo: { time: number, distance: number } | null,
    simulatedRemainingDistance: number | null,
    width: number,
    widgetBgColor: string,
}) => {
    const [totalDistance, setTotalDistance] = useState<number | null>(null);
    const [remainingDistance, setRemainingDistance] = useState<number | null>(null);
    const [remainingTime, setRemainingTime] = useState<number | null>(null);
    const routeRef = useRef<[number, number][] | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const arrowIndicatorRef = useRef<HTMLDivElement>(null);
    const isNewTrip = useRef(false);
    const ARROW_SIZE = 44;

    useEffect(() => {
        const unsubscribe = routeStore.subscribe(coords => {
            routeRef.current = coords;
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (target && tripInfo) {
            const totalDistKm = tripInfo.distance / 1000;
            setTotalDistance(totalDistKm);
            setRemainingDistance(totalDistKm);
            setRemainingTime(tripInfo.time / 60); 
            isNewTrip.current = true;
        } else {
            setTotalDistance(null);
            setRemainingDistance(null);
            setRemainingTime(null);
        }
    }, [target, tripInfo]);

    useEffect(() => {
        if (!currentPosition || !routeRef.current || totalDistance === null) return;
        
        if (isNewTrip.current) {
            isNewTrip.current = false;
            return;
        }

        let minDistanceSq = Infinity;
        let closestIndex = 0;
        
        for (let i = 0; i < routeRef.current.length; i++) {
            const dLat = routeRef.current[i][0] - currentPosition.lat;
            const dLng = routeRef.current[i][1] - currentPosition.lng;
            const distSq = dLat * dLat + dLng * dLng;
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestIndex = i;
            }
        }

        let remDist = 0;
        for (let i = closestIndex; i < routeRef.current.length - 1; i++) {
            remDist += calculateGeoDistance(routeRef.current[i][0], routeRef.current[i][1], routeRef.current[i+1][0], routeRef.current[i+1][1]);
        }
        
        setRemainingDistance(remDist);

        if (tripInfo?.time && totalDistance > 0) {
            const timeInMinutes = tripInfo.time / 60;
            const remainingTimeCalc = (remDist / totalDistance) * timeInMinutes;
            setRemainingTime(remainingTimeCalc);
        } else {
            setRemainingTime(null);
        }

        if (remDist < 0.05) { 
            onCancel('Sei arrivato a destinazione!');
        }

    }, [currentPosition, totalDistance, onCancel, tripInfo]);

    const { percent } = useMemo(() => {
        const track = trackRef.current;
        if (!track) {
            return { percent: 0 };
        }
        
        const effectiveRemaining = simulatedRemainingDistance ?? remainingDistance;
        const hasRouteData = totalDistance !== null && totalDistance > 0 && effectiveRemaining !== null;

        if (!hasRouteData) {
            return { percent: 0 };
        }

        const p = totalDistance > 0 ? 1 - (effectiveRemaining / totalDistance) : 0;
        const clampedP = Math.max(0, Math.min(1, p));
        
        return { percent: clampedP };
    }, [totalDistance, remainingDistance, simulatedRemainingDistance]);

    useEffect(() => {
        const arrow = arrowIndicatorRef.current;
        if (arrow) {
            arrow.style.opacity = '1';
        }
    }, [percent]);

    const theme = {
        bg: 'var(--player-bg)',
        border: isNight ? 'border-zinc-700/80' : 'border-zinc-300',
    };

    return (
        <div 
            className={`relative backdrop-blur-md border rounded-xl shadow-lg flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 ${theme.border}`}
            style={{ 
                width: `${width}px`,
                height: '113px',
                background: !isNight ? widgetBgColor : theme.bg
            }}
        >
            <div className="p-4 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                    <div className="flex-grow min-w-0 pr-2">
                        <p className={`font-semibold truncate text-base ${isNight ? 'text-zinc-100' : 'text-zinc-800'}`}>{target.name}</p>
                         <div className={`flex items-center gap-2 text-sm font-medium ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            <span>{formatTravelTime(remainingTime)}</span>
                            <span className="text-xs">&#9679;</span>
                            <span>{remainingDistance?.toFixed(1) ?? '--'} km</span>
                        </div>
                    </div>
                     <button onClick={() => onCancel('Navigazione terminata.')} className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${isNight ? 'bg-red-800/50 hover:bg-red-800/80 text-red-200' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}>
                        <ICONS.endTrip className="w-4 h-4" />
                        <span>Termina</span>
                    </button>
                </div>

                <div className="relative w-full h-10">
                    <div 
                        ref={trackRef} 
                        className="absolute top-1/2 -translate-y-1/2 w-full h-2.5"
                    >
                        <div 
                            className="w-full h-full rounded-full"
                            style={{ backgroundColor: isNight ? 'rgba(90, 90, 100, 0.6)' : '#e5e7eb' }} 
                        />
                        <div 
                            className="absolute top-0 left-0 h-full rounded-full bg-blue-500" 
                            style={{ 
                                width: `${percent * 100}%`,
                                transition: 'width 300ms linear'
                            }}
                        />
                    </div>
                    <div 
                        ref={arrowIndicatorRef}
                        className="absolute top-1/2 z-10"
                        style={{ 
                            left: `${percent * 100}%`,
                            transform: `translate(-50%, -50%)`,
                            opacity: 1,
                            transition: 'left 300ms linear',
                        }}
                        aria-label="Vehicle position indicator"
                    >
                        <VehicleArrowIcon size={ARROW_SIZE} bearing={90} />
                    </div>
                </div>
            </div>
        </div>
    );
}

const degToCompass = (num: number) => {
    const val = Math.floor((num / 45) + 0.5);
    const arr = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
    return arr[(val % 8)];
};
const timestampToHHMM = (ts: number) => {
    const date = new Date(ts * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const wmoCodeToCondition = (code: number): string => {
    const mapping: { [key: number]: string } = {
        0: 'Cielo sereno', 1: 'Prevalentemente sereno', 2: 'Parzialmente nuvoloso', 3: 'Coperto',
        45: 'Nebbia', 48: 'Nebbia', 51: 'Pioggerella', 53: 'Pioggerella', 55: 'Pioggerella',
        56: 'Pioggerella', 57: 'Pioggerella', 61: 'Pioggia leggera', 63: 'Pioggia', 65: 'Pioggia forte',
        66: 'Pioggia', 67: 'Pioggia', 71: 'Neve leggera', 73: 'Neve', 75: 'Neve forte', 77: 'Grandine',
        80: 'Rovescio', 81: 'Rovescio', 82: 'Rovescio', 85: 'Neve', 86: 'Neve', 95: 'Temporale',
        96: 'Temporale', 99: 'Temporale',
    };
    return mapping[code] ?? 'Parzialmente nuvoloso';
};

const mapYouTubeItemToMediaItem = (item: any): MediaItem | null => {
    if (!item || !item.snippet) return null;

    const id = typeof item.id === 'string' ? item.id : item.id?.videoId || item.id?.playlistId;
    if (!id) return null;

    const type = item.kind === 'youtube#video' || item.id?.kind === 'youtube#video' ? 'track' :
                 item.kind === 'youtube#playlist' || item.id?.kind === 'youtube#playlist' ? 'playlist' : 'track';

    return {
        id,
        name: item.snippet.title,
        uri: `youtube:${type}:${id}`,
        images: [item.snippet.thumbnails.high || item.snippet.thumbnails.default],
        description: item.snippet.channelTitle,
        type: type,
    };
};

const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || "AIzaSyArzF2ad4FR6Ic_MFtd6JQ1cALR8j960sk";

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

function calculateGeoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const DEFAULT_HOME_CONFIG: SceneConfig = {
    cameraPos: { x: 8.30, y: 3.30, z: 8.80 }, 
    cameraTarget: { x: -1.30, y: -0.40, z: 0.05 }, 
    modelPos: { x: -1.40, y: -1.05, z: 0.15 },
    modelRot: { x: 0.01, y: -1.49, z: 0.00 },
    modelScale: 2.68,
};

function AppContent() {
  const { nowPlaying, setNowPlaying, pauseSpotify } = useAuth();

  const [timeOverride, setTimeOverride] = useState<Date | null>(null);
  const [weatherConditionOverride, setWeatherConditionOverride] = useState<string | null>(null);
  const [sunsetArrowYPosition, setSunsetArrowYPosition] = useState(1);
  const [sunriseArrowYPosition, setSunriseArrowYPosition] = useState(5);

  const [topBarScale, setTopBarScale] = useState(1.0);
  const [topBarOffsetY, setTopBarOffsetY] = useState(-7);
  // mapsSearchPanelWidth is no longer used, we use navigateToolWidth instead for consistency
  const [mapsSearchPanelWidth, setMapsSearchPanelWidth] = useState(401);
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
  
  const [homeConfig, setHomeConfig] = useState<SceneConfig>(DEFAULT_HOME_CONFIG);

  const [appOpenConfig, setAppOpenConfig] = useState<SceneConfig>({
      cameraPos: { x: 1.55, y: 1.74, z: 3.58 },
      cameraTarget: { x: 0.10, y: 0.22, z: 0.65 },
      modelPos: { x: -5.45, y: -1.00, z: 1.90 }, 
      modelRot: { x: 0.01, y: -1.49, z: 0.01 },
      modelScale: 1.25, 
  });

  const [headlightConfig, setHeadlightConfig] = useState({
      x: -0.05,
      y: 0.77,
      z: -1.55,
      angle: 0.06,
      yaw: 0.01, 
      assemblyYaw: -1.588, // -91 deg in rad
      intensity: 0.75,
      startWidth: 0.30,
      endWidth: 0.10,
      length: 7.00,
      startHeight: 0.03,
      endHeight: 0.01,
      fade: 7.40,
      separation: 1.25,
      circular: true,
      linked: true, 
  });

  const [sceneColors, setSceneColors] = useState<SceneColors>(initialSceneColors);
  const [nightAmbientIntensity, setNightAmbientIntensity] = useState(0.25);
  const [nightFrontLightIntensity, setNightFrontLightIntensity] = useState(0.60);
  const [nightEnvironmentIntensity, setNightEnvironmentIntensity] = useState(0.55);
  const [isCanvasInteracting, setIsCanvasInteracting] = useState(false);
  const [dayFogNear, setDayFogNear] = useState(13);
  const [dayFogFar, setDayFogFar] = useState(52);

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
  const [playerControlsVerticalPosition, setPlayerControlsVerticalPosition] = useState(2);
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

  const [youtubeHomeData, setYoutubeHomeData] = useState<{[key: string]: MediaItem[]}>({});
  const [youtubeHomeIsLoading, setYoutubeHomeIsLoading] = useState(true);
  const [youtubeHomeError, setYoutubeHomeError] = useState<string | null>(null);
  const [youtubeHomeQuotaExceeded, setYoutubeHomeQuotaExceeded] = useState(false);
  const retryIntervalRef = useRef<number | null>(null);

  const [dayPlayerButtonColor, setDayPlayerButtonColor] = useState('#454545');
  const [nightPlayerButtonColor, setNightPlayerButtonColor] = useState('#ffffff');
  const [widgetBgHex, setWidgetBgHex] = useState('#ffffff');
  const widgetBgColor = useMemo(() => {
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

  // Music Player Customization State
  const [progressBarHeight, setProgressBarHeight] = useState(7.2);
  const [progressBarVerticalOffset, setProgressBarVerticalOffset] = useState(10.3);
  const [playButtonScale, setPlayButtonScale] = useState(0.95);
  const [skipButtonScale, setSkipButtonScale] = useState(1.42);

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [dockApps, setDockApps] = useState<string[]>(['spotify', 'maps']);
  const [launcherApps, setLauncherApps] = useState<string[]>(['theater', 'radio', 'youtube-music', 'debug']);
  const [recentlyOpened, setRecentlyOpened] = useState<string[]>([]);
  
  const [favoriteStationUUIDs, setFavoriteStationUUIDs] = useState<string[]>([]);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState<HTMLElement | null>(null);
  const [virtualKeyboardKeySize, setVirtualKeyboardKeySize] = useState(41);
  const [virtualKeyboardHeight, setVirtualKeyboardHeight] = useState(38);
  const [virtualKeyboardPaddingX, setVirtualKeyboardPaddingX] = useState(69);
  const [virtualKeyboardKeyGapX, setVirtualKeyboardKeyGapX] = useState(2);
  const [virtualKeyboardKeyGapY, setVirtualKeyboardKeyGapY] = useState(2);
  const [virtualKeyboardKeyFontWeight, setVirtualKeyboardKeyFontWeight] = useState(600);
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
    dragProgressRef.current = val;
  }, []);

  const handleSpotifyDrag = useCallback((progress: number | null) => {
    if (isMapsLayered && progress !== null) {
        return; 
    }
    dragProgressRef.current = progress;
  }, [isMapsLayered]);

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
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.altKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            setIsDebugOpen(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  const [isWeatherModalOpen, setWeatherModalOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('idle');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tempUnit, setTempUnit] = useState<TempUnit>('C');
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [bearing, setBearing] = useState(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [arrivalMessage, setArrivalMessage] = useState<string | null>(null);
  const arrivalTimeoutRef = useRef<number | null>(null);
  const [tripInfo, setTripInfo] = useState<{ time: number, distance: number } | null>(null);
  const [throttledPosition, setThrottledPosition] = useState(currentPosition);
  const [homeLocation, setHomeLocation] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [workLocation, setWorkLocation] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [favoriteLocations, setFavoriteLocations] = useState<{ lat: number, lng: number, name: string }[]>([]);

  const [simulatedRemainingDistance, setSimulatedRemainingDistance] = useState<number | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);
  
  const [navigationTarget, setNavigationTarget] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [mapStyle, setMapStyle] = useState('dark');
  
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

  const startTripSimulation = useCallback(() => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    if (!tripInfo) return;
    const totalDistKm = tripInfo.distance / 1000;
    let currentDist = totalDistKm;
    setSimulatedRemainingDistance(currentDist);
    simulationIntervalRef.current = window.setInterval(() => {
        currentDist -= totalDistKm / 100; 
        if (currentDist <= 0) {
            currentDist = 0;
            if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        }
        setSimulatedRemainingDistance(currentDist);
    }, 200);
  }, [tripInfo]);

  const stopTripSimulation = useCallback(() => {
    if (simulationIntervalRef.current) { clearInterval(simulationIntervalRef.current); simulationIntervalRef.current = null; }
    setSimulatedRemainingDistance(null);
  }, []);

  const handleSelectDestination = (target: { lat: number, lng: number, name: string }) => { setNavigationTarget(target); setActiveApp('maps'); };
  
  const handleCancelNavigation = useCallback((message?: string) => {
    setNavigationTarget(null); setTripInfo(null); routeStore.setRoute(null);
    const mapsIframe = document.querySelector('iframe[title="Tesla Navigation"]');
    if (mapsIframe && (mapsIframe as HTMLIFrameElement).contentWindow) { (mapsIframe as HTMLIFrameElement).contentWindow.postMessage({ type: 'CLEAR_ROUTE_FROM_PARENT' }, '*'); }
    if (message) { setArrivalMessage(message); if (arrivalTimeoutRef.current) clearTimeout(arrivalTimeoutRef.current); arrivalTimeoutRef.current = window.setTimeout(() => setArrivalMessage(null), 5000); }
  }, []);

  // --- MAP INTERACTION HANDLER FOR KEYBOARD DISMISSAL ---
  // Moved here to fix "Block-scoped variable used before declaration" error
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ROUTE_CLEARED') handleCancelNavigation();
      if (event.data?.type === 'ROUTE_UPDATED' && event.data.payload) {
        const { geometry, info, target } = event.data.payload;
        const routeData: [number, number][] = geometry.map((coords: [number, number]) => [coords[1], coords[0]]);
        routeStore.setRoute(routeData); setTripInfo(info); 
        // When route updates, don't overwrite if we already have the target (to preserve custom name), 
        // unless it's a new nav started from within map
        if (target) {
             setNavigationTarget(prev => prev ? prev : target);
        }
      }
      if (event.data?.type === 'MAP_STYLE_CHANGED') setMapStyle(event.data.payload.style);
      if (event.data?.type === 'SAVE_LOCATION' && event.data.payload) {
        const { type, coords, name } = event.data.payload;
        const locationData = { lat: coords.lat, lng: coords.lng, name };
        if (type === 'home') { setHomeLocation(locationData); localStorage.setItem('home_location', JSON.stringify(locationData)); }
        else if (type === 'work') { setWorkLocation(locationData); localStorage.setItem('work_location', JSON.stringify(locationData)); }
      }
       if (event.data?.type === 'SAVE_FAVORITE' && event.data.payload) {
            const newFavorite = event.data.payload;
            setFavoriteLocations(prev => {
                if (prev.some(f => f.name === newFavorite.name)) return prev;
                const updatedFavorites = [newFavorite, ...prev]; localStorage.setItem('favorite_locations', JSON.stringify(updatedFavorites));
                return updatedFavorites;
            });
        }
        // Listen for MAP_INTERACTION from MapsContainer
        if (event.data?.type === 'MAP_INTERACTION') {
            handleKeyboardClose();
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleCancelNavigation, handleKeyboardClose]); // Added handleKeyboardClose

  useEffect(() => {
    try {
        const storedHome = localStorage.getItem('home_location'); if (storedHome) setHomeLocation(JSON.parse(storedHome));
        const storedWork = localStorage.getItem('work_location'); if (storedWork) setWorkLocation(JSON.parse(storedWork));
        const storedFavorites = localStorage.getItem('favorite_locations'); if (storedFavorites) setFavoriteLocations(JSON.parse(storedFavorites));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { const intervalId = setInterval(() => setCurrentTime(new Date()), 60000); return () => clearInterval(intervalId); }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          const newPos = { lat: latitude, lng: longitude };
          setCurrentPosition(newPos);
          if (heading !== null && heading !== undefined) {
              setBearing(prevBearing => { let diff = heading - prevBearing; if (diff > 180) diff -= 360; if (diff < -180) diff += 360; return (prevBearing + diff * 0.3 + 360) % 360; });
          }
          lastPositionRef.current = newPos;
        },
        (error) => console.warn(error.message),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);
  
  useEffect(() => { const handler = setTimeout(() => { if (currentPosition) setThrottledPosition(currentPosition); }, 250); return () => clearTimeout(handler); }, [currentPosition]);

  const effectiveTime = timeOverride || currentTime;

  const { isNight, effectiveWeatherCondition, isHot, isCold } = useMemo(() => {
    const now = effectiveTime; let night: boolean; let condition: string;
    if (weatherData?.details?.sunrise && weatherData?.details?.sunset) {
        const sunriseDate = new Date(now.getTime()); const sunsetDate = new Date(now.getTime());
        const [sr_h, sr_m] = weatherData.details.sunrise.split(':').map(Number);
        const [ss_h, ss_m] = weatherData.details.sunset.split(':').map(Number);
        sunriseDate.setHours(sr_h, sr_m, 0, 0); sunsetDate.setHours(ss_h, ss_m, 0, 0);
        night = now.getTime() < sunriseDate.getTime() || now.getTime() >= sunsetDate.getTime();
        const isCloudy = /nuvol|nebbia|coperto/i.test(weatherData.current.condition);
        if (now.getHours() === sunriseDate.getHours()) condition = isCloudy ? 'Cloudy Sunrise' : 'Sunrise';
        else if (now.getHours() === sunsetDate.getHours()) condition = isCloudy ? 'Cloudy Sunset' : 'Sunset';
        else condition = weatherData.current.condition;
    } else {
        const hour = now.getHours(); const month = now.getMonth();
        night = hour < (month >= 3 && month <= 8 ? 6 : 7) || hour >= (month >= 3 && month <= 8 ? 20 : 17);
        condition = 'Nuvoloso';
    }
    const finalCondition = weatherConditionOverride || condition;
    const currentTemp = weatherData?.hourly.find(h => new Date(h.dt * 1000).getHours() === now.getHours())?.temperature ?? weatherData?.current.temperature ?? 20;
    return { isNight: night, effectiveWeatherCondition: finalCondition, isHot: currentTemp >= HOT_TEMP && !/nuvol|coperto|piogg|rovescio|nev|nebbia|temporale|grandin/i.test(finalCondition), isCold: currentTemp <= COLD_TEMP };
  }, [effectiveTime, weatherData, weatherConditionOverride]);

  const useDarkTheme = isNight || /temporale|pioggia|rovescio|grandine|neve|nebbia/i.test(effectiveWeatherCondition.toLowerCase());
  
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

  const targetWeatherParams = useMemo(() => weatherConfig[effectiveWeatherCondition] || weatherConfig['Default'], [effectiveWeatherCondition]);

  const fetchWeatherData = useCallback(async (latitude: number, longitude: number) => {
      setWeatherStatus('fetching'); setWeatherError(null);
      try {
          const [weatherResponse, locationResponse] = await Promise.all([
              fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`),
              fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`)
          ]);
          const weatherApiData = await weatherResponse.json(); const locationData = await locationResponse.json();
          if (weatherApiData.error) throw new Error(`Open-Meteo Error: ${weatherApiData.reason}`);
          const locationName = locationData.address?.city || locationData.address?.town || locationData.address?.village || locationData.address?.county || 'Current Location';
          const mappedData: Omit<WeatherData, 'lastUpdated'> = {
              locationName, current: { temperature: Math.round(weatherApiData.current.temperature_2m), condition: wmoCodeToCondition(weatherApiData.current.weather_code), high: Math.round(weatherApiData.daily.temperature_2m_max[0]), low: Math.round(weatherApiData.daily.temperature_2m_min[0]) },
              hourly: weatherApiData.hourly.time.map((isoTime: string, index: number) => ({ time: new Date(isoTime).getHours().toString().padStart(2, '0') + ':00', dt: new Date(isoTime).getTime() / 1000, temperature: Math.round(weatherApiData.hourly.temperature_2m[index]), condition: wmoCodeToCondition(weatherApiData.hourly.weather_code[index]) })),
              details: { chanceOfRain: Math.round(weatherApiData.current.precipitation_probability ?? 0), humidity: Math.round(weatherApiData.current.relative_humidity_2m), wind: `${Math.round(weatherApiData.current.wind_speed_10m)} km/h ${degToCompass(weatherApiData.current.wind_direction_10m)}`, sunrise: timestampToHHMM(new Date(weatherApiData.daily.sunrise[0]).getTime() / 1000), sunset: timestampToHHMM(new Date(weatherApiData.daily.sunset[0]).getTime() / 1000) }
          };
          setWeatherData({ ...mappedData, lastUpdated: new Date() }); setWeatherStatus('success');
      } catch (error: any) { setWeatherError(error.message || "Impossibile recuperare i dati."); setWeatherData(null); setWeatherStatus('error'); }
  }, []);

  const requestWeather = useCallback(() => {
    setWeatherData(null); setWeatherError(null); setWeatherStatus('locating');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => { if (position.coords.accuracy > 1500) { setWeatherError("Posizione troppo imprecisa."); setWeatherStatus('error'); return; } fetchWeatherData(position.coords.latitude, position.coords.longitude); },
            (error) => { setWeatherError("Impossibile ottenere la posizione."); setWeatherStatus('error'); },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
        );
    } else { setWeatherError("Geolocalizzazione non supportata."); setWeatherStatus('error'); }
  }, [fetchWeatherData]);

  useEffect(() => { requestWeather(); const intervalId = setInterval(requestWeather, 15 * 60 * 1000); return () => clearInterval(intervalId); }, [requestWeather]);
  const handleWeatherClick = () => { setWeatherModalOpen(true); if (weatherStatus !== 'locating' && weatherStatus !== 'fetching') { if (!weatherData || (new Date().getTime() - weatherData.lastUpdated.getTime()) > 300000) requestWeather(); } };
  
  const fetchYouTubeHomeData = useCallback(async () => {
    if (Object.keys(youtubeHomeData).length > 0 && !youtubeHomeQuotaExceeded) return;
    setYoutubeHomeIsLoading(true); setYoutubeHomeError(null);
    try {
        const endpoints = [ `videos?part=snippet&chart=mostPopular&regionCode=IT&videoCategoryId=10&maxResults=10`, `search?part=snippet&q=official pop hits playlist&type=playlist&maxResults=10`, `search?part=snippet&q=live performance full concert&type=video&videoCategoryId=10&maxResults=10`, `search?part=snippet&q=musica italiana playlist&type=playlist&maxResults=10`, `search?part=snippet&q=workout music playlist&type=playlist&maxResults=10`, `search?part=snippet&q=acoustic sessions live&type=video&maxResults=10` ];
        const responses = await Promise.all(endpoints.map(ep => fetch(`https://www.googleapis.com/youtube/v3/${ep}&key=${YOUTUBE_API_KEY}`)));
        for (const res of responses) { if (!res.ok) { const errorData = await res.json(); if (errorData.error?.message.toLowerCase().includes('quota')) throw new Error("quotaExceeded"); throw new Error(errorData.error?.message); } }
        const data = await Promise.all(responses.map(res => res.json()));
        setYoutubeHomeData({ musicCharts: data[0].items.map(mapYouTubeItemToMediaItem).filter(Boolean), popPlaylists: data[1].items.map(mapYouTubeItemToMediaItem).filter(Boolean), livePerformances: data[2].items.map(mapYouTubeItemToMediaItem).filter(Boolean), italianPlaylists: data[3].items.map(mapYouTubeItemToMediaItem).filter(Boolean), workoutPlaylists: data[4].items.map(mapYouTubeItemToMediaItem).filter(Boolean), acousticSessions: data[5].items.map(mapYouTubeItemToMediaItem).filter(Boolean) });
        setYoutubeHomeQuotaExceeded(false);
    } catch (err: any) { if (err.message === 'quotaExceeded') setYoutubeHomeQuotaExceeded(true); else setYoutubeHomeError(err.message); } finally { setYoutubeHomeIsLoading(false); }
  }, [youtubeHomeData, youtubeHomeQuotaExceeded]);
  
  useEffect(() => { if (activeApp === 'youtube-music' && !nowPlaying.youtubeTrack) fetchYouTubeHomeData(); }, [activeApp, fetchYouTubeHomeData, nowPlaying.youtubeTrack]);
  useEffect(() => { if (youtubeHomeQuotaExceeded) { if (retryIntervalRef.current) clearInterval(retryIntervalRef.current); retryIntervalRef.current = window.setInterval(() => fetchYouTubeHomeData(), 15 * 60 * 1000); } else if (retryIntervalRef.current) { clearInterval(retryIntervalRef.current); retryIntervalRef.current = null; } return () => { if (retryIntervalRef.current) clearInterval(retryIntervalRef.current); }; }, [youtubeHomeQuotaExceeded, fetchYouTubeHomeData]);
  const handleGenericQuotaError = useCallback(() => setYoutubeHomeQuotaExceeded(true), []);

  const toggleApp = (appName: string) => {
    setIsAppLauncherOpen(false); setIsCustomizing(false);
    const willBeActive = activeApp !== appName; if (willBeActive && !dockApps.includes(appName)) setRecentlyOpened(prev => [appName, ...prev.filter(id => id !== appName)]);
    if (appName === 'spotify' && activeApp === 'maps') { setActiveApp('spotify'); setIsMapsLayered(true); }
    else if (appName === 'spotify' && activeApp === 'spotify' && isMapsLayered) { setActiveApp('maps'); setIsMapsLayered(false); }
    else { setIsMapsLayered(false); setActiveApp(prevApp => (prevApp === appName ? null : appName)); }
  };

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

  return (
    <div className="relative w-screen h-screen bg-black select-none overflow-hidden" onClick={() => { if (isAppLauncherOpen) { setIsAppLauncherOpen(false); setIsCustomizing(false); }}} data-theme={useDarkTheme ? 'dark' : 'light'}>
      <VehicleCanvas isAppOpen={activeApp !== null} isNight={isNight} minOrbitDistance={minOrbitDistance} maxOrbitDistance={maxOrbitDistance} appOpenConfig={appOpenConfig} homeConfig={homeConfig} sceneColors={sceneColors} nightAmbientIntensity={nightAmbientIntensity} nightFrontLightIntensity={nightFrontLightIntensity} nightEnvironmentIntensity={nightEnvironmentIntensity} onInteractionChange={setIsCanvasInteracting} effectiveWeatherCondition={effectiveWeatherCondition} dayFogNear={dayFogNear} dayFogFar={dayFogFar} targetWeatherParams={targetWeatherParams} uiScale={uiScale ?? 1.0} headlightConfig={headlightConfig} dragProgress={dragProgressRef}/>
      <TopStatusBar isNight={useDarkTheme} onWeatherClick={handleWeatherClick} weatherData={weatherData} weatherCondition={effectiveWeatherCondition} sunsetArrowYPosition={sunsetArrowYPosition} sunriseArrowYPosition={sunriseArrowYPosition} isHot={isHot} isCold={isCold} tempUnit={tempUnit} setTempUnit={setTempUnit} scale={uiScale ?? 1.0} offsetY={topBarOffsetY} setTopBarOffsetY={setTopBarOffsetY} mapStyle={mapStyle} isMapVisible={activeApp === 'maps' || isMapsLayered}/>
      <WeatherModal isOpen={isWeatherModalOpen} onClose={() => setWeatherModalOpen(false)} isNight={useDarkTheme} status={weatherStatus} data={weatherData} error={weatherError} effectiveTime={effectiveTime} sunsetArrowYPosition={sunsetArrowYPosition} sunriseArrowYPosition={sunriseArrowYPosition} tempUnit={tempUnit}/>
      <MiniMap isVisible={activeApp === null && !isCanvasInteracting} position={currentPosition} bearing={bearing} isNight={isNight} useDarkTheme={useDarkTheme} top={miniMapTop} right={miniMapRight} size={miniMapSize} zoom={miniMapZoom} fadeStart={miniMapFadeStart} fadeEnd={miniMapFadeEnd} onClick={(e) => { e.stopPropagation(); toggleApp('maps'); }} uiScale={uiScale ?? 1.0}/>
      <div className="ui-scaler" style={uiScale ? { '--ui-scale': uiScale } as React.CSSProperties : {}}>
        <div id="scaled-portal-root" className="relative z-[9999]"></div>
        <MapsContainer 
            isOpen={activeApp === 'maps' || isMapsLayered} 
            onClose={handleCloseMaps} 
            onInteractionStart={handleMapsInteractionStart} 
            isNight={useDarkTheme} 
            searchPanelWidth={mapsSearchPanelWidth} // This prop is now ignored by MapsContainer in favor of width, but kept for compatibility if needed
            searchPanelTop={mapsSearchPanelTop} 
            navigationTarget={navigationTarget} 
            spotifyPlayerTop={spotifyPlayerTop} 
            spotifyPlayerBottom={spotifyPlayerBottom} 
            satelliteLabelBrightness={satelliteLabelBrightness} 
            satelliteLabelOutlineWidth={satelliteLabelOutlineWidth} 
            onDragProgress={handleDragProgress}
            currentPosition={currentPosition}
            homeLocation={homeLocation}
            workLocation={workLocation}
            onSelectDestination={handleSelectDestination}
            // NEW PROPS FOR NAVIGATE TOOL CONSISTENCY
            width={navigateToolWidth}
            widgetBgColor={widgetBgColor}
            dayPlayerButtonColor={dayPlayerButtonColor}
            nightPlayerButtonColor={nightPlayerButtonColor}
            darkNavigateInputBg={darkNavigateInputBg}
        />
        <SpotifyApp isOpen={activeApp === 'spotify'} onClose={() => toggleApp('spotify')} isNight={useDarkTheme} spotifyPlayerTop={spotifyPlayerTop} spotifyPlayerBottom={spotifyPlayerBottom} isMapsLayered={isMapsLayered} onDragProgress={handleSpotifyDrag} />
        <AnimatePresence>
          {activeApp === 'theater' && <TheaterApp onClose={() => toggleApp('theater')} isNight={useDarkTheme} spotifyPlayerTop={spotifyPlayerTop} spotifyPlayerBottom={spotifyPlayerBottom} onDragProgress={handleDragProgress}/>}
          {activeApp === 'debug' && (
                <DebugControls
                    isOpen={true}
                    onClose={() => setActiveApp(null)}
                    onDragProgress={handleDragProgress}
                    isAppView={true}
                    timeOverride={timeOverride}
                    setTimeOverride={setTimeOverride}
                    sunsetArrowYPosition={sunsetArrowYPosition}
                    setSunsetArrowYPosition={setSunsetArrowYPosition}
                    sunriseArrowYPosition={sunriseArrowYPosition}
                    setSunriseArrowYPosition={setSunriseArrowYPosition}
                    weatherConditionOverride={weatherConditionOverride}
                    setWeatherConditionOverride={setWeatherConditionOverride}
                    effectiveWeatherCondition={effectiveWeatherCondition}
                    isNight={isNight}
                    isHot={isHot}
                    isCold={isCold}
                    topBarScale={topBarScale}
                    setTopBarScale={setTopBarScale}
                    topBarOffsetY={topBarOffsetY}
                    setTopBarOffsetY={setTopBarOffsetY}
                    mapsSearchPanelWidth={mapsSearchPanelWidth}
                    setMapsSearchPanelWidth={setMapsSearchPanelWidth}
                    mapsSearchPanelTop={mapsSearchPanelTop}
                    setMapsSearchPanelTop={setMapsSearchPanelTop}
                    miniMapTop={miniMapTop}
                    setMiniMapTop={setMiniMapTop}
                    miniMapRight={miniMapRight}
                    setMiniMapRight={setMiniMapRight}
                    miniMapSize={miniMapSize}
                    setMiniMapSize={setMiniMapSize}
                    miniMapZoom={miniMapZoom}
                    setMiniMapZoom={setMiniMapZoom}
                    miniMapFadeStart={miniMapFadeStart}
                    setMiniMapFadeStart={setMiniMapFadeStart}
                    miniMapFadeEnd={miniMapFadeEnd}
                    setMiniMapFadeEnd={setMiniMapFadeEnd}
                    minOrbitDistance={minOrbitDistance}
                    setMinOrbitDistance={setMinOrbitDistance}
                    maxOrbitDistance={maxOrbitDistance}
                    setMaxOrbitDistance={setMaxOrbitDistance}
                    appOpenConfig={appOpenConfig}
                    setAppOpenConfig={setAppOpenConfig}
                    homeConfig={homeConfig}
                    setHomeConfig={setHomeConfig}
                    sceneColors={sceneColors}
                    setSceneColors={setSceneColors}
                    spotifyPlayerTop={spotifyPlayerTop}
                    setSpotifyPlayerTop={setSpotifyPlayerTop}
                    spotifyPlayerBottom={spotifyPlayerBottom}
                    setSpotifyPlayerBottom={setSpotifyPlayerBottom}
                    playerDockedWidth={playerDockedWidth}
                    setPlayerDockedWidth={setPlayerDockedWidth}
                    playerDockedLeft={playerDockedLeft}
                    setPlayerDockedLeft={setPlayerDockedLeft}
                    playerDockedHeight={playerDockedHeight}
                    setPlayerDockedHeight={setPlayerDockedHeight}
                    playerFloatingWidth={playerFloatingWidth}
                    setPlayerFloatingWidth={setPlayerFloatingWidth}
                    playerFloatingBottom={playerFloatingBottom}
                    setPlayerFloatingBottom={setPlayerFloatingBottom}
                    playerFloatingHeight={playerFloatingHeight}
                    setPlayerFloatingHeight={setPlayerFloatingHeight}
                    navigateToolWidth={navigateToolWidth}
                    setNavigateToolWidth={setNavigateToolWidth}
                    nightAmbientIntensity={nightAmbientIntensity}
                    setNightAmbientIntensity={setNightAmbientIntensity}
                    nightFrontLightIntensity={nightFrontLightIntensity}
                    setNightFrontLightIntensity={setNightFrontLightIntensity}
                    nightEnvironmentIntensity={nightEnvironmentIntensity}
                    setNightEnvironmentIntensity={setNightEnvironmentIntensity}
                    tripInfo={tripInfo}
                    startTripSimulation={startTripSimulation}
                    stopTripSimulation={stopTripSimulation}
                    isSimulating={!!simulationIntervalRef.current}
                    playerControlsSize={playerControlsSize}
                    setPlayerControlsSize={setPlayerControlsSize}
                    playerControlsGap={playerControlsGap}
                    setPlayerControlsGap={setPlayerControlsGap}
                    playerControlsVerticalPosition={playerControlsVerticalPosition}
                    setPlayerControlsVerticalPosition={setPlayerControlsVerticalPosition}
                    dayPlayerButtonColor={dayPlayerButtonColor}
                    setDayPlayerButtonColor={setDayPlayerButtonColor}
                    nightPlayerButtonColor={nightPlayerButtonColor}
                    setNightPlayerButtonColor={setNightPlayerButtonColor}
                    widgetBgHex={widgetBgHex}
                    setWidgetBgHex={setWidgetBgHex}
                    volumeIconSize={volumeIconSize}
                    setVolumeIconSize={setVolumeIconSize}
                    volumeSliderOffsetY={volumeSliderOffsetY}
                    setVolumeSliderOffsetY={setVolumeSliderOffsetY}
                    volumeSliderOffsetX={volumeSliderOffsetX}
                    setVolumeSliderOffsetX={setVolumeSliderOffsetX}
                    volumeControlMarginRight={volumeControlMarginRight}
                    setVolumeControlMarginRight={setVolumeControlMarginRight}
                    volumeSliderWidth={volumeSliderWidth}
                    setVolumeSliderWidth={setVolumeSliderWidth}
                    volumeSliderThickness={volumeSliderThickness}
                    setVolumeSliderThickness={setVolumeSliderThickness}
                    volumeSliderThumbOffsetY={volumeSliderThumbOffsetY}
                    setVolumeSliderThumbOffsetY={setVolumeSliderThumbOffsetY}
                    volumeSliderPopupWidth={volumeSliderPopupWidth}
                    setVolumeSliderPopupWidth={setVolumeSliderPopupWidth}
                    volumeSliderPopupHeight={volumeSliderPopupHeight}
                    setVolumeSliderPopupHeight={setVolumeSliderPopupHeight}
                    volumeControlZIndex={volumeControlZIndex}
                    setVolumeControlZIndex={setVolumeControlZIndex}
                    appLauncherWidth={appLauncherWidth}
                    setAppLauncherWidth={setAppLauncherWidth}
                    appLauncherHeight={appLauncherHeight}
                    setAppLauncherHeight={setAppLauncherHeight}
                    dayFogNear={dayFogNear}
                    setDayFogNear={setDayFogNear}
                    dayFogFar={dayFogFar}
                    setDayFogFar={setDayFogFar}
                    virtualKeyboardKeySize={virtualKeyboardKeySize}
                    setVirtualKeyboardKeySize={setVirtualKeyboardKeySize}
                    virtualKeyboardHeight={virtualKeyboardHeight}
                    setVirtualKeyboardHeight={setVirtualKeyboardHeight}
                    virtualKeyboardPaddingX={virtualKeyboardPaddingX}
                    setVirtualKeyboardPaddingX={setVirtualKeyboardPaddingX}
                    virtualKeyboardKeyGapX={virtualKeyboardKeyGapX}
                    setVirtualKeyboardKeyGapX={setVirtualKeyboardKeyGapX}
                    virtualKeyboardKeyGapY={virtualKeyboardKeyGapY}
                    setVirtualKeyboardKeyGapY={setVirtualKeyboardKeyGapY}
                    virtualKeyboardKeyFontWeight={virtualKeyboardKeyFontWeight}
                    setVirtualKeyboardKeyFontWeight={setVirtualKeyboardKeyFontWeight}
                    uiScale={uiScale}
                    setUiScale={setUiScale}
                    appBarWidth={appBarWidth}
                    setAppBarWidth={setAppBarWidth}
                    darkVolumeTrackBg={darkVolumeTrackBg}
                    setDarkVolumeTrackBg={setDarkVolumeTrackBg}
                    darkVolumeThumbBg={darkVolumeThumbBg}
                    setDarkVolumeThumbBg={setDarkVolumeThumbBg}
                    darkVolumeFillBg={darkVolumeFillBg}
                    setDarkVolumeFillBg={setDarkVolumeFillBg}
                    darkPlayerBg={darkPlayerBg}
                    setDarkPlayerBg={setDarkPlayerBg}
                    darkNavigateInputBg={darkNavigateInputBg}
                    setDarkNavigateInputBg={setDarkNavigateInputBg}
                    queuePopoverHeight={queuePopoverHeight}
                    setQueuePopoverHeight={setQueuePopoverHeight}
                    queuePopoverBottomOffset={queuePopoverBottomOffset}
                    setQueuePopoverBottomOffset={setQueuePopoverBottomOffset}
                    queuePopoverScale={queuePopoverScale}
                    setQueuePopoverScale={setQueuePopoverScale}
                    queuePopoverWidth={queuePopoverWidth}
                    setQueuePopoverWidth={setQueuePopoverWidth}
                    queuePopoverOffsetX={queuePopoverOffsetX}
                    setQueuePopoverOffsetX={setQueuePopoverOffsetX}
                    spinnerSize={spinnerSize}
                    setSpinnerSize={setSpinnerSize}
                    spinnerShuffleGap={spinnerShuffleGap}
                    setSpinnerShuffleGap={setSpinnerShuffleGap}
                    debugSpinner={debugSpinner}
                    setDebugSpinner={setDebugSpinner}
                    spinnerTop={spinnerTop}
                    setSpinnerTop={setSpinnerTop}
                    spinnerRight={spinnerRight}
                    setSpinnerRight={setSpinnerRight}
                    spinnerBottom={spinnerBottom}
                    setSpinnerBottom={setSpinnerBottom}
                    spinnerLeft={spinnerLeft}
                    setSpinnerLeft={setSpinnerLeft}
                    homeDataQuotaExceeded={youtubeHomeQuotaExceeded}
                    satelliteLabelBrightness={satelliteLabelBrightness}
                    setSatelliteLabelBrightness={setSatelliteLabelBrightness}
                    satelliteLabelOutlineWidth={satelliteLabelOutlineWidth}
                    setSatelliteLabelOutlineWidth={setSatelliteLabelOutlineWidth}
                    headlightConfig={headlightConfig}
                    setHeadlightConfig={setHeadlightConfig}
                    // New Props
                    progressBarHeight={progressBarHeight}
                    setProgressBarHeight={setProgressBarHeight}
                    progressBarVerticalOffset={progressBarVerticalOffset}
                    setProgressBarVerticalOffset={setProgressBarVerticalOffset}
                    playButtonScale={playButtonScale}
                    setPlayButtonScale={setPlayButtonScale}
                    skipButtonScale={skipButtonScale}
                    setSkipButtonScale={setSkipButtonScale}
                />
          )}
          {activeApp === 'radio' && <RadioApp isOpen={activeApp === 'radio'} onClose={() => toggleApp('radio')} isNight={useDarkTheme} onPlayStation={handlePlayStation} spotifyPlayerTop={spotifyPlayerTop} spotifyPlayerBottom={spotifyPlayerBottom} favoriteStationUUIDs={favoriteStationUUIDs} onDragProgress={handleDragProgress}/>}
          {activeApp === 'youtube-music' && <YouTubeMusicApp isOpen={activeApp === 'youtube-music'} onClose={() => toggleApp('youtube-music')} isNight={useDarkTheme} spotifyPlayerTop={spotifyPlayerTop} spotifyPlayerBottom={spotifyPlayerBottom} homeData={youtubeHomeData} isHomeDataLoading={youtubeHomeIsLoading} youtubeHomeError={youtubeHomeError} homeDataQuotaExceeded={youtubeHomeQuotaExceeded} onRetry={fetchYouTubeHomeData} onQuotaError={handleGenericQuotaError} onDragProgress={handleDragProgress}/>}
        </AnimatePresence>
        <AnimatePresence>{arrivalMessage && <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }} className="fixed left-1/2 -translate-x-1/2 z-50 bg-zinc-800/80 backdrop-blur-md text-white font-bold px-6 py-3 rounded-xl shadow-lg border border-white/10" style={{ bottom: '230px' }}>{arrivalMessage}</motion.div>}</AnimatePresence>
        {/* NAVIGATE TOOL CONTAINER */}
        <div ref={navigateToolRef} className="flex items-end" style={navigateToolStyle}>
            {navigationTarget ? <NavigationStatus target={navigationTarget} currentPosition={throttledPosition} isNight={useDarkTheme} onCancel={handleCancelNavigation} tripInfo={tripInfo} simulatedRemainingDistance={simulatedRemainingDistance} width={navigateToolWidth} widgetBgColor={widgetBgColor}/> : <NavigateTool isNight={useDarkTheme} onSelectDestination={handleSelectDestination} currentPosition={currentPosition} width={navigateToolWidth} widgetBgColor={widgetBgColor} dayPlayerButtonColor={dayPlayerButtonColor} nightPlayerButtonColor={nightPlayerButtonColor} homeLocation={homeLocation} workLocation={workLocation} darkNavigateInputBg={darkNavigateInputBg} isHome={activeApp === null}/>}
        </div>
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
        <AppContent />
      </AuthProvider>
    </VehicleProvider>
  );
}
