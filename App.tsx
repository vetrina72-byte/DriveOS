import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VehicleProvider } from './context/VehicleContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import VehicleCanvas, { SceneConfig } from './components/VehicleCanvas';
import { ICONS } from './constants';
import SpotifyApp from './components/SpotifyPlayer';
// FIX: MusicPlayer is a default export. The import is correct.
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
];

const weatherConfig: Record<string, WeatherParams> = {
  // Clear conditions, minimal fog
  'Cielo sereno': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 50, fogFar: 150 },
  'Prevalentemente sereno': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 45, fogFar: 140 },
  'Parzialmente nuvoloso': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 35, fogFar: 120 },
  'Coperto': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 25, fogFar: 80 },

  // Precipitation
  'Pioggerella': { rainDensity: 0.2, rainSpeed: 5, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 20, fogFar: 60 },
  'Pioggia leggera': { rainDensity: 0.4, rainSpeed: 8, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 18, fogFar: 50 },
  'Pioggia': { rainDensity: 0.7, rainSpeed: 11, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 15, fogFar: 40 },
  'Pioggia forte': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 10, fogFar: 30 },
  'Rovescio': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 10, fogFar: 30 },
  'Temporale': { rainDensity: 1.0, rainSpeed: 18, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 8, fogFar: 25 },

  // Frozen Precipitation
  'Neve leggera': { rainDensity: 0, rainSpeed: 0, snowDensity: 0.4, snowSpeed: 1.5, hailDensity: 0, fogNear: 15, fogFar: 40 },
  'Neve': { rainDensity: 0, rainSpeed: 0, snowDensity: 0.7, snowSpeed: 3.0, hailDensity: 0, fogNear: 12, fogFar: 35 },
  'Neve forte': { rainDensity: 0, rainSpeed: 0, snowDensity: 1.0, snowSpeed: 6.0, hailDensity: 0, fogNear: 8, fogFar: 25 },
  'Grandine': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 1.0, fogNear: 12, fogFar: 35 },

  // Obscuration
  'Nebbia': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 1, fogFar: 20 },
  
  // Special / Time-based
  'Sunrise': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 130 },
  'Sunset': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 130 },
  'Cloudy Sunrise': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 30, fogFar: 100 },
  'Cloudy Sunset': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 30, fogFar: 100 },
  'Partly Cloudy Night': { rainDensity: 0, rainSpeed: 0, snowDensity: 0, snowSpeed: 0, hailDensity: 0, fogNear: 40, fogFar: 120 },

  // Default fallback
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

const IconLocationResult = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12 2C8.13401 2 5 5.13401 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13401 15.866 2 12 2Z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 11C12.5523 11 13 10.5523 13 10C13 9.44772 12.5523 9 12 9C11.4477 9 11 9.44772 11 10C11 10.5523 11.4477 11 12 11Z" fill="#EF4444"/>
    </svg>
);

const formatTravelTime = (minutes: number | null): string => {
    if (minutes === null || isNaN(minutes)) return '-- min';
    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours} h ${remainingMinutes} min`;
};


const NavigateTool = ({ isNight, onSelectDestination, currentPosition, width, widgetBgColor, dayPlayerButtonColor, nightPlayerButtonColor, homeLocation, workLocation, darkNavigateInputBg }: { 
    isNight: boolean,
    onSelectDestination: (target: { lat: number, lng: number, name: string }) => void,
    currentPosition: { lat: number; lng: number } | null,
    width: number,
    widgetBgColor: string;
    dayPlayerButtonColor: string;
    nightPlayerButtonColor: string;
    homeLocation: { lat: number, lng: number, name: string } | null;
    workLocation: { lat: number, lng: number, name: string } | null;
    darkNavigateInputBg: string;
}) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<{feature: any, distance: number | null}[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const searchTimeoutRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const GEOAPIFY_API_KEY = '0d2c9c7f72c0477eb3260838db72a383';

    const baseHeight = 113;
    const expandedHeight = 400;

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    const highlightMatch = (text: string | undefined, query: string) => {
        if (!query || !text) {
            return text;
        }
        const queryParts = query.trim().split(/\s+/).map(part =>
            part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        ).filter(part => part.length > 0);

        if (queryParts.length === 0) return text;

        const regex = new RegExp(`(${queryParts.join('|')})`, 'gi');
        const parts = text.split(regex);
        return (
            <>
                {parts.map((part, i) =>
                    queryParts.some(q => new RegExp(`^${q}$`, 'i').test(part)) ? (
                        <strong key={i}>{part}</strong>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };

    useEffect(() => {
        if (query.length < 3) {
            setSuggestions([]);
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            return;
        }
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        setLoading(true);
        searchTimeoutRef.current = window.setTimeout(async () => {
            try {
                const biasParam = currentPosition ? `&bias=proximity:${currentPosition.lng},${currentPosition.lat}` : '';
                const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&lang=it&limit=5&apiKey=${GEOAPIFY_API_KEY}${biasParam}`);
                const data = await response.json();
                const features = data.features || [];
                const suggestionsWithDistance = features.map((feature: any) => {
                    let distance = null;
                    if (currentPosition && feature.properties.lat && feature.properties.lon) {
                        const { lat, lon } = feature.properties;
                        distance = calculateDistance(currentPosition.lat, currentPosition.lng, lat, lon);
                    }
                    return { feature, distance };
                });
                setSuggestions(suggestionsWithDistance);
            } catch (error) {
                console.error("Autocomplete search failed:", error);
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        }
    }, [query, currentPosition]);

    useEffect(() => {
        // The panel should be expanded if the user is focused on the input,
        // OR if there is text in the input (even if focus is lost).
        // This prevents the panel from closing when the user clicks away while typing.
        setIsExpanded(isFocused || query.length > 0);
    }, [isFocused, query]);

    const handleSelect = (feature: any) => {
        const { lat, lon: lng } = feature.properties;
        const name = feature.properties.name || feature.properties.formatted;
        setQuery('');
        setSuggestions([]);
        setIsFocused(false);
        onSelectDestination({ lat, lng, name });
    };
    
    useEffect(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height
            textarea.style.height = `${textarea.scrollHeight}px`; // Set to scroll height
        }
    }, [query]);
    
    const theme = {
        bg: 'var(--player-bg)',
        border: isNight ? 'border-zinc-700/80' : 'border-zinc-300',
        inputText: isNight ? 'text-zinc-100' : 'text-zinc-800',
        placeholderText: isNight ? 'placeholder:text-zinc-500' : 'placeholder:text-zinc-400',
        iconColor: isNight ? 'text-zinc-400' : 'text-zinc-500',
        suggestionHover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10'
    };

    return (
        <div 
            ref={containerRef}
            className={`relative backdrop-blur-md border rounded-xl shadow-lg flex flex-col transition-all duration-300 ease-in-out ${theme.border}`}
            style={{ 
                width: `${width}px`,
                height: `${isExpanded ? expandedHeight : baseHeight}px`,
                background: !isNight ? widgetBgColor : theme.bg
            }}
        >
             <div className="p-3 flex flex-col h-full overflow-hidden">
                <div className="relative flex-shrink-0">
                    <ICONS.search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 ${theme.iconColor}`} />
                    <textarea
                        ref={inputRef}
                        rows={1}
                        id="home-search-input"
                        name="destination"
                        aria-label="Navigate"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setTimeout(() => {
                            if (!containerRef.current?.contains(document.activeElement)) {
                                setIsFocused(false);
                            }
                        }, 200)}
                        placeholder="Navigate"
                        className={`w-full pl-11 pr-4 py-2.5 rounded-lg text-sm font-medium transition-colors resize-none overflow-y-auto hide-scrollbar ${!isNight ? 'bg-zinc-100' : ''} ${theme.inputText} ${theme.placeholderText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        style={isNight ? { backgroundColor: darkNavigateInputBg } : undefined}
                    />
                </div>
                
                <div className={`overflow-y-auto hide-scrollbar transition-opacity duration-200 ${isExpanded ? 'flex-grow mt-2 opacity-100' : 'opacity-0'}`}>
                    {loading && <div className="text-center p-2 text-sm text-zinc-400">Ricerca...</div>}
                    {!loading && suggestions.map(({ feature, distance }) => {
                        const name = feature.properties.name || feature.properties.formatted;
                        const address = feature.properties.address_line2;
                        const avgSpeed = distance && distance > 200 ? 80 : 45;
                        const estimatedTime = distance !== null ? (distance / avgSpeed) * 60 : null;
                        return (
                            <button 
                                key={feature.properties.place_id} 
                                onMouseDown={() => handleSelect(feature)} 
                                className={`w-full text-left p-2.5 rounded-lg flex items-center gap-4 ${theme.suggestionHover}`}
                            >
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                    <IconLocationResult className="w-6 h-6" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className={`font-medium truncate ${isNight ? 'text-zinc-100' : 'text-zinc-800'}`}>
                                        {highlightMatch(name, query)}
                                    </p>
                                    {address && (
                                        <p className={`text-xs truncate ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                            {highlightMatch(address, query)}
                                        </p>
                                    )}
                                </div>
                                <div className="flex-shrink-0 text-right">
                                    <p className={`font-semibold text-sm ${isNight ? 'text-zinc-200' : 'text-zinc-700'}`}>
                                        {distance?.toFixed(1)} km
                                    </p>
                                    {estimatedTime !== null && (
                                        <p className={`text-xs ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                            ~{formatTravelTime(estimatedTime)}
                                        </p>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className={`flex-shrink-0 mt-auto pt-2 border-t ${theme.border}`}>
                    <div className="flex justify-around items-center">
                        <button 
                            onClick={() => homeLocation && onSelectDestination(homeLocation)}
                            disabled={!homeLocation}
                            className={`flex items-center gap-2.5 py-1 px-4 rounded-lg text-sm font-semibold transition-colors ${!homeLocation ? 'opacity-50 cursor-not-allowed' : theme.suggestionHover}`}
                            style={{ color: isNight ? nightPlayerButtonColor : dayPlayerButtonColor }}
                        >
                            <ICONS.home className="w-5 h-5" />
                            <span>Home</span>
                        </button>
                         <button 
                            onClick={() => workLocation && onSelectDestination(workLocation)}
                            disabled={!workLocation}
                            className={`flex items-center gap-2.5 py-1 px-4 rounded-lg text-sm font-semibold transition-colors ${!workLocation ? 'opacity-50 cursor-not-allowed' : theme.suggestionHover}`}
                            style={{ color: isNight ? nightPlayerButtonColor : dayPlayerButtonColor }}
                         >
                            <ICONS.work className="w-5 h-5" />
                            <span>Work</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const calculateGeoDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

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
            setRemainingTime(tripInfo.time / 60); // Set initial time
            isNewTrip.current = true;
        } else {
            setTotalDistance(null);
            setRemainingDistance(null);
            setRemainingTime(null);
        }
    }, [target, tripInfo]);

    // Effect to update remaining distance based on real-time position.
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

        if (remDist < 0.05) { // Arrived (50 meters)
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
        
        console.log(
            '[NAV_DEBUG]',
            `rem: ${effectiveRemaining.toFixed(2)}km`,
            `total: ${totalDistance.toFixed(2)}km`,
            `perc: ${clampedP.toFixed(3)}`
        );

        return { percent: clampedP };
    }, [totalDistance, remainingDistance, simulatedRemainingDistance]);

    useEffect(() => {
        const arrow = arrowIndicatorRef.current;
        if (arrow) {
            arrow.style.opacity = '1';
            setTimeout(() => {
                if (arrow) {
                    const currentOpacity = parseFloat(window.getComputedStyle(arrow).opacity);
                    if (currentOpacity < 0.9) {
                        console.warn(`[NAV_ARROW_OPACITY_WARN] Arrow opacity is unexpectedly low: ${currentOpacity}. Check for conflicting global CSS.`);
                    }
                }
            }, 100);
        }
    }, [percent]);

    const theme = {
        bg: 'var(--player-bg)',
        border: isNight ? 'border-zinc-700/80' : 'border-zinc-300',
    };

    return (
        <div 
            className={`relative backdrop-blur-md border rounded-xl shadow-lg flex flex-col transition-all duration-300 ease-in-out ${theme.border}`}
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

// Helper Functions for weather data processing
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
        0: 'Cielo sereno',
        1: 'Prevalentemente sereno',
        2: 'Parzialmente nuvoloso',
        3: 'Coperto',
        45: 'Nebbia',
        48: 'Nebbia',
        51: 'Pioggerella',
        53: 'Pioggerella',
        55: 'Pioggerella',
        56: 'Pioggerella',
        57: 'Pioggerella',
        61: 'Pioggia leggera',
        63: 'Pioggia',
        65: 'Pioggia forte',
        66: 'Pioggia',
        67: 'Pioggia',
        71: 'Neve leggera',
        73: 'Neve',
        75: 'Neve forte',
        77: 'Grandine',
        80: 'Rovescio',
        81: 'Rovescio',
        82: 'Rovescio',
        85: 'Neve',
        86: 'Neve',
        95: 'Temporale',
        96: 'Temporale',
        99: 'Temporale',
    };
    return mapping[code] ?? 'Parzialmente nuvoloso';
};


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

// FIX: Changed SceneColors to use explicit 'day' and 'night' keys for better type safety.
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

const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || "AIzaSyArzF2ad4FR6Ic_MFtd6JQ1cALR8j960sk";

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

function AppContent() {
  const { nowPlaying, setNowPlaying, pauseSpotify } = useAuth();
  const [isDebugOpen, setIsDebugOpen] = useState(true);

  // Time and Weather
  const [timeOverride, setTimeOverride] = useState<Date | null>(null);
  const [weatherConditionOverride, setWeatherConditionOverride] = useState<string | null>(null);
  const [sunsetArrowYPosition, setSunsetArrowYPosition] = useState(1);
  const [sunriseArrowYPosition, setSunriseArrowYPosition] = useState(5);

  // UI Layout
  const [topBarScale, setTopBarScale] = useState(1.0);
  const [topBarOffsetY, setTopBarOffsetY] = useState(-7);
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

  // 3D Scene
  const [minOrbitDistance, setMinOrbitDistance] = useState(9.5);
  const [maxOrbitDistance, setMaxOrbitDistance] = useState(18);
  const [appOpenConfig, setAppOpenConfig] = useState<SceneConfig>({
      cameraPos: { x: 1.55, y: 1.74, z: 3.58 },
      cameraTarget: { x: 0.60, y: 0.22, z: 0.65 },
      modelPos: { x: -4.65, y: -1.00, z: 1.47 },
      modelRot: { x: 0, y: -0.09, z: 0.0 },
      modelScale: 0.78,
  });
  const [sceneColors, setSceneColors] = useState<SceneColors>(initialSceneColors);
  const [nightAmbientIntensity, setNightAmbientIntensity] = useState(0.25);
  const [nightFrontLightIntensity, setNightFrontLightIntensity] = useState(0.60);
  const [nightEnvironmentIntensity, setNightEnvironmentIntensity] = useState(0.55);
  const [isCanvasInteracting, setIsCanvasInteracting] = useState(false);
  const [dayFogNear, setDayFogNear] = useState(13);
  const [dayFogFar, setDayFogFar] = useState(52);

  // Spotify Player & Home Widgets
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
  const [appLauncherWidth, setAppLauncherWidth] = useState(30); // percentage
  const [appLauncherHeight, setAppLauncherHeight] = useState(286); // pixels
  const [queuePopoverHeight, setQueuePopoverHeight] = useState(80);
  const [queuePopoverBottomOffset, setQueuePopoverBottomOffset] = useState(16);
  const [queuePopoverScale, setQueuePopoverScale] = useState(1.0);
  const [queuePopoverWidth, setQueuePopoverWidth] = useState(288);
  const [queuePopoverOffsetX, setQueuePopoverOffsetX] = useState(0);


  // YouTube Music State
  const [youtubeHomeData, setYoutubeHomeData] = useState<{[key: string]: MediaItem[]}>({});
  const [youtubeHomeIsLoading, setYoutubeHomeIsLoading] = useState(true);
  const [youtubeHomeError, setYoutubeHomeError] = useState<string | null>(null);
  const [youtubeHomeQuotaExceeded, setYoutubeHomeQuotaExceeded] = useState(false);
  const retryIntervalRef = useRef<number | null>(null);

  // Debug UI Colors
  const [dayPlayerButtonColor, setDayPlayerButtonColor] = useState('#454545');
  const [nightPlayerButtonColor, setNightPlayerButtonColor] = useState('#ffffff');
  const [widgetBgHex, setWidgetBgHex] = useState('#ffffff');
  const widgetBgColor = useMemo(() => {
    const rgb = hexToRgb(widgetBgHex);
    return rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : 'rgb(255, 255, 255)';
  }, [widgetBgHex]);
  
  // Custom Dark Mode Volume Colors
  const [darkVolumeTrackBg, setDarkVolumeTrackBg] = useState('#4D4D4D');
  const [darkVolumeThumbBg, setDarkVolumeThumbBg] = useState('#ffffff');
  const [darkVolumeFillBg, setDarkVolumeFillBg] = useState('#ffffff');
  const [darkPlayerBg, setDarkPlayerBg] = useState('#212121');
  const [darkNavigateInputBg, setDarkNavigateInputBg] = useState('#2b2b2b');


  // App Customization State
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [dockApps, setDockApps] = useState<string[]>(['spotify', 'maps']);
  const [launcherApps, setLauncherApps] = useState<string[]>(['theater', 'radio', 'youtube-music']);
  const [recentlyOpened, setRecentlyOpened] = useState<string[]>([]);
  
  // Radio Favorites State
  const [favoriteStationUUIDs, setFavoriteStationUUIDs] = useState<string[]>([]);

  // Virtual Keyboard State
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState<HTMLElement | null>(null);
  const [virtualKeyboardKeySize, setVirtualKeyboardKeySize] = useState(41);
  const [virtualKeyboardHeight, setVirtualKeyboardHeight] = useState(38);
  const [virtualKeyboardPaddingX, setVirtualKeyboardPaddingX] = useState(69);
  const [virtualKeyboardKeyGapX, setVirtualKeyboardKeyGapX] = useState(2);
  const [virtualKeyboardKeyGapY, setVirtualKeyboardKeyGapY] = useState(2);
  const [virtualKeyboardKeyFontWeight, setVirtualKeyboardKeyFontWeight] = useState(600);
  const [webAppUrl, setWebAppUrl] = useState<string | null>(null);

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

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  const handleKeyboardClose = useCallback(() => {
    if (keyboardTarget) {
      keyboardTarget.blur();
    }
    setIsKeyboardVisible(false);
    setKeyboardTarget(null);
  }, [keyboardTarget]);


  useEffect(() => {
    try {
        const storedFavorites = localStorage.getItem('radio_favorite_uuids');
        if (storedFavorites) {
            setFavoriteStationUUIDs(JSON.parse(storedFavorites));
        }
    } catch (e) {
        console.error("Failed to load favorite stations from localStorage", e);
    }
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem('radio_favorite_uuids', JSON.stringify(favoriteStationUUIDs));
    } catch (e) {
        console.error("Failed to save favorite stations to localStorage", e);
    }
  }, [favoriteStationUUIDs]);

  const handleToggleFavorite = useCallback((station: RadioStation) => {
    setFavoriteStationUUIDs(prev => {
        if (prev.includes(station.stationuuid)) {
            return prev.filter(uuid => uuid !== station.stationuuid);
        } else {
            return [...prev, station.stationuuid];
        }
    });
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

  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [isMapsLayered, setIsMapsLayered] = useState(false);
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

  // States for trip simulation
  const [simulatedRemainingDistance, setSimulatedRemainingDistance] = useState<number | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);
  
  const [navigationTarget, setNavigationTarget] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [mapStyle, setMapStyle] = useState('dark');
  
  const handlePlayStation = (station: RadioStation, context: RadioStation[]) => {
      pauseSpotify();
      setNowPlaying(prev => ({
        ...prev,
        source: 'radio',
        radioStation: station,
        radioContext: context,
        youtubeTrack: null,
        isLoading: true,
      }));
  };
  
  const handleStationChange = (direction: 'next' | 'prev') => {
      if (nowPlaying?.source !== 'radio' || !nowPlaying.radioContext || nowPlaying.radioContext.length === 0) return;
      
      const { radioStation, radioContext } = nowPlaying;
      if (!radioStation || !radioContext) return;
      
      const currentIndex = radioContext.findIndex(s => s.stationuuid === radioStation.stationuuid);
      if (currentIndex === -1) return;
      
      let nextIndex;
      if (direction === 'next') {
          nextIndex = (currentIndex + 1) % radioContext.length;
      } else {
          nextIndex = (currentIndex - 1 + radioContext.length) % radioContext.length;
      }
      setNowPlaying(prev => ({ ...prev, radioStation: radioContext[nextIndex] }));
  };

  const startTripSimulation = useCallback(() => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    if (!tripInfo) {
        console.warn("Cannot start simulation: no trip is active.");
        return;
    }

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
    if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
    }
    setSimulatedRemainingDistance(null);
  }, []);

  const handleSelectDestination = (target: { lat: number, lng: number, name: string }) => {
    setNavigationTarget(target);
    setActiveApp('maps');
  };
  
  const handleCancelNavigation = useCallback((message?: string) => {
    setNavigationTarget(null);
    setTripInfo(null);
    routeStore.setRoute(null);

    const mapsIframe = document.querySelector('iframe[title="Tesla Navigation"]');
    if (mapsIframe && (mapsIframe as HTMLIFrameElement).contentWindow) {
        (mapsIframe as HTMLIFrameElement).contentWindow.postMessage({ type: 'CLEAR_ROUTE_FROM_PARENT' }, '*');
    }

    if (message) {
      setArrivalMessage(message);
      if (arrivalTimeoutRef.current) clearTimeout(arrivalTimeoutRef.current);
      arrivalTimeoutRef.current = window.setTimeout(() => setArrivalMessage(null), 5000);
    }
  }, []);

  useEffect(() => {
    try {
        const storedHome = localStorage.getItem('home_location');
        if (storedHome) setHomeLocation(JSON.parse(storedHome));
        const storedWork = localStorage.getItem('work_location');
        if (storedWork) setWorkLocation(JSON.parse(storedWork));
        const storedFavorites = localStorage.getItem('favorite_locations');
        if (storedFavorites) setFavoriteLocations(JSON.parse(storedFavorites));
    } catch (e) { console.error("Failed to load locations from localStorage", e); }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ROUTE_CLEARED') {
          handleCancelNavigation();
      }
      
      if (event.data?.type === 'ROUTE_UPDATED' && event.data.payload) {
        const { geometry, info, target } = event.data.payload;
        const routeData: [number, number][] = geometry.map((coords: [number, number]) => [coords[1], coords[0]]);
        routeStore.setRoute(routeData);
        setTripInfo(info);
        if (target) {
          setNavigationTarget(target);
        }
      }
      
      if (event.data?.type === 'MAP_STYLE_CHANGED') {
        setMapStyle(event.data.payload.style);
      }

      if (event.data?.type === 'SAVE_LOCATION' && event.data.payload) {
        const { type, coords, name } = event.data.payload;
        const locationData = { lat: coords.lat, lng: coords.lng, name };
        if (type === 'home') {
            setHomeLocation(locationData);
            localStorage.setItem('home_location', JSON.stringify(locationData));
        } else if (type === 'work') {
            setWorkLocation(locationData);
            localStorage.setItem('work_location', JSON.stringify(locationData));
        }
      }
       if (event.data?.type === 'SAVE_FAVORITE' && event.data.payload) {
            const newFavorite = event.data.payload;
            setFavoriteLocations(prev => {
                if (prev.some(f => f.name === newFavorite.name)) return prev;
                const updatedFavorites = [newFavorite, ...prev];
                localStorage.setItem('favorite_locations', JSON.stringify(updatedFavorites));
                return updatedFavorites;
            });
        }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleCancelNavigation]);

  const handleCloseMaps = () => {
    toggleApp('maps');
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
        setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
      const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          const newPos = { lat: latitude, lng: longitude };
          
          setCurrentPosition(newPos);

          if (heading !== null && heading !== undefined) {
              setBearing(prevBearing => {
                  let diff = heading - prevBearing;
                  if (diff > 180) diff -= 360;
                  if (diff < -180) diff += 360;
                  return (prevBearing + diff * 0.3 + 360) % 360;
              });
          } else if (lastPositionRef.current && (Math.abs(lastPositionRef.current.lat - newPos.lat) > 0.00001 || Math.abs(lastPositionRef.current.lng - newPos.lng) > 0.00001)) {
              const newBearing = calculateBearing(lastPositionRef.current.lat, lastPositionRef.current.lng, newPos.lat, newPos.lng);
              setBearing(prevBearing => {
                  let diff = newBearing - prevBearing;
                  if (diff > 180) diff -= 360;
                  if (diff < -180) diff += 360;
                  return (prevBearing + diff * 0.3 + 360) % 360;
              });
          }
          lastPositionRef.current = newPos;
        },
        (error) => {
          console.warn("Geolocation watch error:", error.message);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
      
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);
  
  useEffect(() => {
      const handler = setTimeout(() => {
          if (currentPosition) {
              setThrottledPosition(currentPosition);
          }
      }, 250);
      return () => clearTimeout(handler);
  }, [currentPosition]);


  const effectiveTime = timeOverride || currentTime;

  const { isNight, effectiveWeatherCondition, isHot, isCold } = useMemo(() => {
    const now = effectiveTime;
    let night: boolean;
    let condition: string;

    if (weatherData?.details?.sunrise && weatherData?.details?.sunset) {
        const sunriseDate = new Date(now.getTime());
        const sunsetDate = new Date(now.getTime());
        const [sr_h, sr_m] = weatherData.details.sunrise.split(':').map(Number);
        const [ss_h, ss_m] = weatherData.details.sunset.split(':').map(Number);
        sunriseDate.setHours(sr_h, sr_m, 0, 0);
        sunsetDate.setHours(ss_h, ss_m, 0, 0);

        night = now.getTime() < sunriseDate.getTime() || now.getTime() >= sunsetDate.getTime();

        const isCloudy = /nuvol|nebbia|coperto/i.test(weatherData.current.condition);
        
        if (now.getHours() === sunriseDate.getHours()) {
            condition = isCloudy ? 'Cloudy Sunrise' : 'Sunrise';
        } else if (now.getHours() === sunsetDate.getHours()) {
            condition = isCloudy ? 'Cloudy Sunset' : 'Sunset';
        } else {
            condition = weatherData.current.condition;
        }

    } else {
        const hour = now.getHours();
        const month = now.getMonth();
        const isSummer = month >= 3 && month <= 8;
        const sunriseHour = isSummer ? 6 : 7;
        const sunsetHour = isSummer ? 20 : 17;

        night = hour < sunriseHour || hour >= sunsetHour;
        condition = 'Nuvoloso';
    }
    
    const finalCondition = weatherConditionOverride || condition;

    const nowHourlyData = weatherData?.hourly.find(h => new Date(h.dt * 1000).getHours() === now.getHours());
    const currentTemp = nowHourlyData?.temperature ?? weatherData?.current.temperature ?? 20;

    const hot = currentTemp >= HOT_TEMP && !/nuvol|coperto|piogg|rovescio|nev|nebbia|temporale|grandin/i.test(finalCondition);
    const cold = currentTemp <= COLD_TEMP;

    return { 
        isNight: night, 
        effectiveWeatherCondition: finalCondition,
        isHot: hot,
        isCold: cold
    };
  }, [effectiveTime, weatherData, weatherConditionOverride]);

  const isGloomyDay = useMemo(() => {
    if (isNight) return false;
    const condition = effectiveWeatherCondition.toLowerCase();
    return condition.includes('temporale') || condition.includes('pioggia') || condition.includes('rovescio') || condition.includes('grandine');
  }, [isNight, effectiveWeatherCondition]);

  const useDarkTheme = isNight || isGloomyDay;
  
  useEffect(() => {
    const root = document.documentElement;
    if (useDarkTheme) {
        root.style.setProperty('--volume-slider-track-bg', darkVolumeTrackBg);
        root.style.setProperty('--volume-slider-thumb-bg', darkVolumeThumbBg);
        root.style.setProperty('--volume-slider-fill-bg', darkVolumeFillBg);
        root.style.setProperty('--player-bg', darkPlayerBg);
    } else {
        // When not in dark theme, remove the overrides so the CSS file's :root variables take effect.
        root.style.removeProperty('--volume-slider-track-bg');
        root.style.removeProperty('--volume-slider-thumb-bg');
        root.style.removeProperty('--volume-slider-fill-bg');
        root.style.removeProperty('--player-bg');
    }
  }, [useDarkTheme, darkVolumeTrackBg, darkVolumeThumbBg, darkVolumeFillBg, darkPlayerBg]);


  const targetWeatherParams = useMemo(() => {
    return weatherConfig[effectiveWeatherCondition] || weatherConfig['Default'];
  }, [effectiveWeatherCondition]);

  const fetchWeatherData = useCallback(async (latitude: number, longitude: number) => {
      setWeatherStatus('fetching');
      setWeatherError(null);
      try {
          const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;
          const locationApiUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`;

          const [weatherResponse, locationResponse] = await Promise.all([
              fetch(weatherApiUrl),
              fetch(locationApiUrl)
          ]);

          if (!weatherResponse.ok) throw new Error('Failed to fetch weather data from Open-Meteo');
          if (!locationResponse.ok) throw new Error('Failed to fetch location data from Nominatim');

          const weatherApiData = await weatherResponse.json();
          const locationData = await locationResponse.json();
          
          if (weatherApiData.error) {
              throw new Error(`Open-Meteo Error: ${weatherApiData.reason}`);
          }

          const locationName = locationData.address?.city || locationData.address?.town || locationData.address?.village || locationData.address?.county || 'Current Location';

          const mappedData: Omit<WeatherData, 'lastUpdated'> = {
              locationName,
              current: {
                  temperature: Math.round(weatherApiData.current.temperature_2m),
                  condition: wmoCodeToCondition(weatherApiData.current.weather_code),
                  high: Math.round(weatherApiData.daily.temperature_2m_max[0]),
                  low: Math.round(weatherApiData.daily.temperature_2m_min[0]),
              },
              hourly: weatherApiData.hourly.time.map((isoTime: string, index: number) => ({
                  time: new Date(isoTime).getHours().toString().padStart(2, '0') + ':00',
                  dt: new Date(isoTime).getTime() / 1000,
                  temperature: Math.round(weatherApiData.hourly.temperature_2m[index]),
                  condition: wmoCodeToCondition(weatherApiData.hourly.weather_code[index]),
              })),
              details: {
                  chanceOfRain: Math.round(weatherApiData.current.precipitation_probability ?? 0),
                  humidity: Math.round(weatherApiData.current.relative_humidity_2m),
                  wind: `${Math.round(weatherApiData.current.wind_speed_10m)} km/h ${degToCompass(weatherApiData.current.wind_direction_10m)}`,
                  sunrise: timestampToHHMM(new Date(weatherApiData.daily.sunrise[0]).getTime() / 1000),
                  sunset: timestampToHHMM(new Date(weatherApiData.daily.sunset[0]).getTime() / 1000),
              }
          };
          
          setWeatherData({ ...mappedData, lastUpdated: new Date() });
          setWeatherStatus('success');

      } catch (error: any) {
          console.error("Error fetching weather data:", error);
          setWeatherError(error.message || "Impossibile recuperare i dati. Riprova più tardi.");
          setWeatherData(null);
          setWeatherStatus('error');
      }
  }, []);

  const requestWeather = useCallback(() => {
    setWeatherData(null);
    setWeatherError(null);
    setWeatherStatus('locating');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (position.coords.accuracy > 1500) {
                    console.warn(`Geolocation accuracy is poor: ${position.coords.accuracy}m. Required < 1500m.`);
                    setWeatherError("La posizione rilevata è troppo imprecisa. Prova a migliorare il segnale GPS o la connessione di rete.");
                    setWeatherStatus('error');
                    return;
                }
                fetchWeatherData(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.error("Geolocation error details:", `Code ${error.code}: ${error.message}`);
                
                let userMessage = "Impossibile ottenere la posizione.";
                switch (error.code) {
                    case 1:
                        userMessage = "Permesso di geolocalizzazione negato. Abilitalo nelle impostazioni del browser e ricarica.";
                        break;
                    case 2:
                        userMessage = "Informazioni sulla posizione non disponibili. Controlla il segnale GPS o la connessione di rete.";
                        break;
                    case 3:
                        userMessage = "Timeout nel recupero della posizione. Riprova più tardi.";
                        break;
                }
                
                setWeatherError(userMessage);
                setWeatherStatus('error');
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
        );
    } else {
        setWeatherError("La geolocalizzazione non è supportata da questo browser.");
        setWeatherStatus('error');
    }
  }, [fetchWeatherData]);

  useEffect(() => {
    requestWeather();
    const intervalId = setInterval(requestWeather, 15 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [requestWeather]);

  const handleWeatherClick = () => {
    setWeatherModalOpen(true);
    if (weatherStatus !== 'locating' && weatherStatus !== 'fetching') {
       if (!weatherData || (new Date().getTime() - weatherData.lastUpdated.getTime()) > 300000) {
          requestWeather();
       }
    }
  };
  
  const fetchYouTubeHomeData = useCallback(async () => {
    if (Object.keys(youtubeHomeData).length > 0 && !youtubeHomeQuotaExceeded) return;

    setYoutubeHomeIsLoading(true);
    setYoutubeHomeError(null);
    try {
        const [chartsRes, popRes, liveRes, italianRes, workoutRes, acousticRes] = await Promise.all([
            fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=IT&videoCategoryId=10&maxResults=10&key=${YOUTUBE_API_KEY}`),
            fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=official pop hits playlist&type=playlist&maxResults=10&key=${YOUTUBE_API_KEY}`),
            fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=live performance full concert&type=video&videoCategoryId=10&maxResults=10&key=${YOUTUBE_API_KEY}`),
            fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=musica italiana playlist&type=playlist&maxResults=10&key=${YOUTUBE_API_KEY}`),
            fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=workout music playlist&type=playlist&maxResults=10&key=${YOUTUBE_API_KEY}`),
            fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=acoustic sessions live&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`)
        ]);

        const responses = [chartsRes, popRes, liveRes, italianRes, workoutRes, acousticRes];
        for (const res of responses) {
            if (!res.ok) {
                const errorData = await res.json();
                if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded' || errorData.error?.message.toLowerCase().includes('quota')) {
                    throw new Error("quotaExceeded");
                }
                throw new Error(errorData.error?.message || 'Failed to fetch data from YouTube API');
            }
        }

        const [chartsData, popData, liveData, italianData, workoutData, acousticData] = await Promise.all(responses.map(res => res.json()));

        setYoutubeHomeData({
            musicCharts: chartsData.items.map(mapYouTubeItemToMediaItem).filter(Boolean),
            popPlaylists: popData.items.map(mapYouTubeItemToMediaItem).filter(Boolean),
            livePerformances: liveData.items.map(mapYouTubeItemToMediaItem).filter(Boolean),
            italianPlaylists: italianData.items.map(mapYouTubeItemToMediaItem).filter(Boolean),
            workoutPlaylists: workoutData.items.map(mapYouTubeItemToMediaItem).filter(Boolean),
            acousticSessions: acousticData.items.map(mapYouTubeItemToMediaItem).filter(Boolean),
        });
        setYoutubeHomeQuotaExceeded(false);

    } catch (err: any) {
        if (err.message === 'quotaExceeded') {
            setYoutubeHomeError(null);
            setYoutubeHomeQuotaExceeded(true);
        } else {
            setYoutubeHomeError(err.message || "Could not load content from YouTube.");
        }
    } finally {
        setYoutubeHomeIsLoading(false);
    }
  }, [youtubeHomeData, youtubeHomeQuotaExceeded]);
  
  useEffect(() => {
    if (activeApp === 'youtube-music' && !nowPlaying.youtubeTrack) {
        fetchYouTubeHomeData();
    }
  }, [activeApp, fetchYouTubeHomeData, nowPlaying.youtubeTrack]);

  // This effect will automatically retry fetching the home data if the quota was exceeded.
  useEffect(() => {
      const retryFetch = () => {
          console.log("Retrying to fetch YouTube home data after quota error...");
          fetchYouTubeHomeData();
      };

      if (youtubeHomeQuotaExceeded) {
          if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
          retryIntervalRef.current = window.setInterval(retryFetch, 15 * 60 * 1000); // 15 minutes
          console.log("YouTube quota exceeded. Auto-retry scheduled.");
      } else {
          if (retryIntervalRef.current) {
              clearInterval(retryIntervalRef.current);
              retryIntervalRef.current = null;
              console.log("YouTube quota seems restored. Auto-retry timer cleared.");
          }
      }

      return () => {
          if (retryIntervalRef.current) {
              clearInterval(retryIntervalRef.current);
          }
      };
  }, [youtubeHomeQuotaExceeded, fetchYouTubeHomeData]);

  const handleGenericQuotaError = useCallback(() => {
      setYoutubeHomeQuotaExceeded(true);
  }, []);

  const toggleApp = (appName: string) => {
    setIsAppLauncherOpen(false);
    setIsCustomizing(false);
    
    const willBeActive = activeApp !== appName;
    if (willBeActive && !dockApps.includes(appName)) {
        setRecentlyOpened(prev => [appName, ...prev.filter(id => id !== appName)]);
    }

    if (appName === 'spotify' && activeApp === 'maps') {
        setActiveApp('spotify');
        setIsMapsLayered(true);
    } else if (appName === 'spotify' && activeApp === 'spotify' && isMapsLayered) {
        setActiveApp('maps');
        setIsMapsLayered(false);
    } else {
        const isSwitchingToMediaApp = ['spotify', 'radio', 'youtube-music'].includes(appName);
        const isSwitchingFromMediaApp = ['spotify', 'radio', 'youtube-music'].includes(activeApp ?? '');
        
        // If switching away from a media app to a non-media app, don't clear nowPlaying
        if(isSwitchingFromMediaApp && !isSwitchingToMediaApp && willBeActive) {
            // Don't do anything to nowPlaying state
        } else if (isSwitchingFromMediaApp && isSwitchingToMediaApp && willBeActive) {
            // This is handled by play functions in AuthContext
        } else {
            // setNowPlaying({ source: null, spotifyState: null, radioStation: null, radioContext: [], youtubeTrack: null });
        }
        
        setIsMapsLayered(false);
        setActiveApp(prevApp => (prevApp === appName ? null : appName));
    }
  };

  const toggleLauncher = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLauncherState = !isAppLauncherOpen;
    setIsAppLauncherOpen(newLauncherState);
    if (!newLauncherState) {
        setIsCustomizing(false);
    }
  };
  
  const handleWrapperClick = () => {
    if (isAppLauncherOpen) {
        setIsAppLauncherOpen(false);
        setIsCustomizing(false);
    }
  };

  const isUIOverlayActive = activeApp !== null;
  const isHomeScreenDocked = isUIOverlayActive || isAppLauncherOpen;
  
    const navigateToolStyle = useMemo(() => {
        const baseStyle: React.CSSProperties = {
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'fixed',
            zIndex: 1000,
            bottom: `${playerFloatingBottom}px`,
            transform: 'none', // Unified transform property
        };
    
        const homeLeft = `calc(50% + (${playerFloatingWidth}px / 2) + 8px - (${navigateToolWidth}px / 2))`;
        
        // Symmetrical position adjustment for when the launcher is open.
        // This moves the nav tool further from the right edge to balance the wider music player on the left.
        const launcherOpenRightOffset = playerDockedLeft + 90; 
        const launcherOpenLeft = `calc(100% - ${launcherOpenRightOffset}px - ${navigateToolWidth}px)`;

        if (isAppLauncherOpen) { // State 3: Launcher Open
            return {
                ...baseStyle,
                opacity: 1,
                pointerEvents: 'auto',
                left: launcherOpenLeft,
            };
        } else if (isUIOverlayActive) { // State 2: App Open (e.g., Spotify)
            return {
                ...baseStyle,
                opacity: 0,
                pointerEvents: 'none',
                left: homeLeft, // Keep position during fade-out to prevent jump
            };
        } else { // State 1: Home Screen (Floating)
            return {
                ...baseStyle,
                opacity: 1,
                pointerEvents: 'auto',
                left: homeLeft,
            };
        }
    }, [isAppLauncherOpen, isUIOverlayActive, playerFloatingBottom, playerDockedLeft, playerFloatingWidth, navigateToolWidth, playerDockedWidth]);
  
  const recentAppsToShow = recentlyOpened.filter(id => !dockApps.includes(id)).slice(0, 2);

  return (
    <div 
      className="relative w-screen h-screen bg-black select-none overflow-hidden"
      onClick={handleWrapperClick}
      data-theme={useDarkTheme ? 'dark' : 'light'}
    >
      <VehicleCanvas 
          isAppOpen={isUIOverlayActive} 
          isNight={isNight}
          minOrbitDistance={minOrbitDistance}
          maxOrbitDistance={maxOrbitDistance}
          appOpenConfig={appOpenConfig}
          sceneColors={sceneColors}
          nightAmbientIntensity={nightAmbientIntensity}
          nightFrontLightIntensity={nightFrontLightIntensity}
          nightEnvironmentIntensity={nightEnvironmentIntensity}
          onInteractionChange={setIsCanvasInteracting}
          effectiveWeatherCondition={effectiveWeatherCondition}
          dayFogNear={dayFogNear}
          dayFogFar={dayFogFar}
          targetWeatherParams={targetWeatherParams}
          uiScale={uiScale ?? 1.0}
      />
      
      {/* --- NON-SCALABLE / FIXED UI --- */}
      <TopStatusBar 
          isNight={useDarkTheme} 
          onWeatherClick={handleWeatherClick}
          weatherData={weatherData}
          weatherCondition={effectiveWeatherCondition}
          sunsetArrowYPosition={sunsetArrowYPosition}
          sunriseArrowYPosition={sunriseArrowYPosition}
          isHot={isHot}
          isCold={isCold}
          tempUnit={tempUnit}
          setTempUnit={setTempUnit}
          scale={uiScale ?? 1.0}
          offsetY={topBarOffsetY}
          mapStyle={mapStyle}
          isMapVisible={activeApp === 'maps' || isMapsLayered}
      />
      
      <WeatherModal 
          isOpen={isWeatherModalOpen}
          onClose={() => setWeatherModalOpen(false)}
          isNight={useDarkTheme}
          status={weatherStatus}
          data={weatherData}
          error={weatherError}
          effectiveTime={effectiveTime}
          sunsetArrowYPosition={sunsetArrowYPosition}
          sunriseArrowYPosition={sunriseArrowYPosition}
          tempUnit={tempUnit}
      />
        
      <MapsContainer 
          isOpen={activeApp === 'maps' || isMapsLayered}
          onClose={handleCloseMaps}
          isNight={useDarkTheme}
          searchPanelWidth={mapsSearchPanelWidth}
          searchPanelTop={mapsSearchPanelTop}
          navigationTarget={navigationTarget}
          spotifyPlayerTop={spotifyPlayerTop}
          spotifyPlayerBottom={spotifyPlayerBottom}
      />
      
      <SpotifyApp 
          isOpen={activeApp === 'spotify'} 
          onClose={() => toggleApp('spotify')} 
          isNight={useDarkTheme}
          spotifyPlayerTop={spotifyPlayerTop}
          spotifyPlayerBottom={spotifyPlayerBottom}
      />
      
      <AnimatePresence>
        {activeApp === 'theater' && (
          <TheaterApp
            onClose={() => toggleApp('theater')}
            isNight={useDarkTheme}
            spotifyPlayerTop={spotifyPlayerTop}
            spotifyPlayerBottom={spotifyPlayerBottom}
          />
        )}
        {activeApp === 'radio' && (
          <RadioApp
            isOpen={activeApp === 'radio'}
            onClose={() => toggleApp('radio')}
            isNight={useDarkTheme}
            onPlayStation={handlePlayStation}
            spotifyPlayerTop={spotifyPlayerTop}
            spotifyPlayerBottom={spotifyPlayerBottom}
            favoriteStationUUIDs={favoriteStationUUIDs}
          />
        )}
         {activeApp === 'youtube-music' && (
          <YouTubeMusicApp
            isOpen={activeApp === 'youtube-music'}
            onClose={() => toggleApp('youtube-music')}
            isNight={useDarkTheme}
            spotifyPlayerTop={spotifyPlayerTop}
            spotifyPlayerBottom={spotifyPlayerBottom}
            homeData={youtubeHomeData}
            isHomeDataLoading={youtubeHomeIsLoading}
            youtubeHomeError={youtubeHomeError}
            homeDataQuotaExceeded={youtubeHomeQuotaExceeded}
            onRetry={fetchYouTubeHomeData}
            onQuotaError={handleGenericQuotaError}
          />
        )}
      </AnimatePresence>
        
      <MiniMap 
          isVisible={!isUIOverlayActive && !isCanvasInteracting} 
          position={currentPosition} 
          bearing={bearing}
          isNight={isNight}
          useDarkTheme={useDarkTheme}
          top={miniMapTop}
          right={miniMapRight}
          size={miniMapSize}
          zoom={miniMapZoom}
          fadeStart={miniMapFadeStart}
          fadeEnd={miniMapFadeEnd}
          onClick={(e) => { e.stopPropagation(); toggleApp('maps'); }}
          uiScale={uiScale ?? 1.0}
      />

      {/* --- SCALABLE UI CONTAINER --- */}
      <div className="ui-scaler" style={uiScale ? { '--ui-scale': uiScale } as React.CSSProperties : {}}>
        <div id="scaled-portal-root" className="relative z-[9999]"></div>
        
        <AnimatePresence>
            {arrivalMessage && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-zinc-800/80 backdrop-blur-md text-white font-bold px-6 py-3 rounded-xl shadow-lg border border-white/10"
                >
                    {arrivalMessage}
                </motion.div>
            )}
        </AnimatePresence>

        <div
          className="flex items-end"
          style={navigateToolStyle}
        >
            {navigationTarget ? (
              <NavigationStatus
                target={navigationTarget}
                currentPosition={throttledPosition}
                isNight={useDarkTheme}
                onCancel={handleCancelNavigation}
                tripInfo={tripInfo}
                simulatedRemainingDistance={simulatedRemainingDistance}
                width={navigateToolWidth}
                widgetBgColor={widgetBgColor}
              />
            ) : (
              <NavigateTool 
                isNight={useDarkTheme}
                onSelectDestination={handleSelectDestination}
                currentPosition={currentPosition}
                width={navigateToolWidth}
                widgetBgColor={widgetBgColor}
                dayPlayerButtonColor={dayPlayerButtonColor}
                nightPlayerButtonColor={nightPlayerButtonColor}
                homeLocation={homeLocation}
                workLocation={workLocation}
                darkNavigateInputBg={darkNavigateInputBg}
              />
            )}
        </div>

        <MusicPlayer
          activeApp={activeApp}
          onStationChange={handleStationChange}
          isAnyAppOpen={isHomeScreenDocked}
          isNight={useDarkTheme}
          dockedConfig={{
            width: playerDockedWidth,
            bottom: playerFloatingBottom,
            left: playerDockedLeft,
            height: playerDockedHeight,
          }}
          floatingConfig={{
            width: playerFloatingWidth,
            bottom: playerFloatingBottom,
            height: playerFloatingHeight,
            otherWidgetWidth: navigateToolWidth,
          }}
          playerControlsSize={playerControlsSize}
          playerControlsGap={playerControlsGap}
          playerControlsVerticalPosition={playerControlsVerticalPosition}
          spinnerSize={spinnerSize}
          spinnerShuffleGap={spinnerShuffleGap}
          debugSpinner={debugSpinner}
          widgetBgColor={widgetBgColor}
          dayPlayerButtonColor={dayPlayerButtonColor}
          nightPlayerButtonColor={nightPlayerButtonColor}
          favoriteStationUUIDs={favoriteStationUUIDs}
          onToggleFavorite={handleToggleFavorite}
          queuePopoverHeight={queuePopoverHeight}
          queuePopoverBottomOffset={queuePopoverBottomOffset}
          queuePopoverScale={queuePopoverScale}
          queuePopoverWidth={queuePopoverWidth}
          queuePopoverOffsetX={queuePopoverOffsetX}
          spinnerTop={spinnerTop}
          spinnerRight={spinnerRight}
          spinnerBottom={spinnerBottom}
          spinnerLeft={spinnerLeft}
        />
        
        <AppLauncher
            isOpen={isAppLauncherOpen}
            width={appLauncherWidth}
            height={appLauncherHeight}
            apps={launcherApps.map(id => ALL_APPS.find(app => app.id === id)!)}
            isCustomizing={isCustomizing}
            onCustomizeClick={moveAppToDock}
            onAppLaunch={toggleApp}
            isNight={useDarkTheme}
        />

        {isAppLauncherOpen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCustomizing(prev => !prev);
            }}
            className={`fixed left-1/2 -translate-x-1/2 z-[8000] px-6 py-2 rounded-full font-semibold transition-all duration-300 ease-out shadow-lg
              ${isCustomizing ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-800/80 hover:bg-zinc-700/90 text-gray-200 border border-white/20 backdrop-blur-sm'}
              ${isAppLauncherOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
            style={{
              bottom: `calc(6rem + ${appLauncherHeight}px + 0.75rem)`,
            }}
          >
            {isCustomizing ? 'Fine' : 'Personalizza'}
          </button>
        )}
        
        <AnimatePresence>
          {isKeyboardVisible && (
              <VirtualKeyboard 
                  isVisible={isKeyboardVisible}
                  targetElement={keyboardTarget as HTMLInputElement | HTMLTextAreaElement | null}
                  onClose={handleKeyboardClose}
                  isNight={useDarkTheme}
                  virtualKeyboardKeySize={virtualKeyboardKeySize}
                  virtualKeyboardHeight={virtualKeyboardHeight}
                  virtualKeyboardPaddingX={virtualKeyboardPaddingX}
                  virtualKeyboardKeyGapX={virtualKeyboardKeyGapX}
                  virtualKeyboardKeyGapY={virtualKeyboardKeyGapY}
                  virtualKeyboardKeyFontWeight={virtualKeyboardKeyFontWeight}
              />
          )}
        </AnimatePresence>

        <footer 
            className="fixed bottom-0 left-0 right-0 h-20 z-[4500]"
            aria-label="Application Dock"
        >
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 h-full bg-black"
              style={{ width: `${appBarWidth}%` }}
            />

            <div className="relative z-10 h-full flex justify-center items-center">
                <div className="flex justify-center items-center gap-4">
                    {dockApps.map(appId => {
                    const app = ALL_APPS.find(a => a.id === appId);
                    if (!app) return null;

                    const effectiveColorClasses = app.colorClasses ?? 'text-gray-400 hover:text-white';
                    
                    return (
                        <div key={app.id} className="relative flex flex-col items-center">
                        <button
                            onClick={(e) => {
                            e.stopPropagation();
                            if (isCustomizing) return;
                            toggleApp(app.id);
                            }}
                            className={`flex flex-col items-center justify-center w-24 h-full transition-all duration-200 ease-in-out ${isCustomizing ? 'customizing-jiggle cursor-default' : 'hover:scale-110'} ${effectiveColorClasses}`}
                            aria-label={app.label}
                        >
                            <app.icon className="w-10 h-10" />
                        </button>
                        {activeApp === app.id && !isCustomizing && (
                            <div className="absolute -bottom-2.5 w-6 h-1 bg-zinc-300 rounded-full transition-opacity" />
                        )}
                        {isCustomizing && (
                            <button
                            onClick={(e) => { e.stopPropagation(); moveAppToLauncher(app.id); }}
                            className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center border-2 border-black transition-all duration-200 hover:scale-110 cursor-pointer"
                            aria-label={`Sposta ${app.label} nel launcher`}
                            >
                            <FiMinus className="w-4 h-4 text-white" strokeWidth={3}/>
                            </button>
                        )}
                        </div>
                    );
                    })}
                    
                    <div className="relative flex flex-col items-center">
                        <DockButton 
                        icon={ICONS.apps} 
                        onClick={toggleLauncher}
                        label="Open App Launcher"
                        />
                        {isAppLauncherOpen && !isCustomizing && (
                            <div className="absolute -bottom-2.5 w-6 h-1 bg-zinc-300 rounded-full transition-opacity" />
                        )}
                    </div>

                    {recentAppsToShow.length > 0 && (
                    <>
                        <div className="w-px h-8 bg-gray-600" />
                        {recentAppsToShow.map(appId => {
                            const app = ALL_APPS.find(a => a.id === appId);
                            if (!app) return null;
                            const effectiveColorClasses = app.colorClasses ?? 'text-gray-400 hover:text-white';
                            return (
                            <div key={`recent-${app.id}`} className="relative flex flex-col items-center">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleApp(app.id); }}
                                        className={`flex flex-col items-center justify-center w-24 h-full transition-all duration-200 ease-in-out hover:scale-110 ${effectiveColorClasses}`}
                                        aria-label={app.label}
                                    >
                                        <app.icon className="w-8 h-8" />
                                    </button>
                                    {activeApp === app.id && (
                                        <div className="absolute -bottom-2.5 w-6 h-1 bg-zinc-300 rounded-full transition-opacity" />
                                    )}
                            </div>
                            );
                        })}
                    </>
                    )}
                </div>
                
                <div className="absolute top-0 right-0 h-full flex items-center" style={{ paddingRight: `${volumeControlMarginRight}px` }}>
                    {/* FIX: Corrected variable names passed as props from slider... to volumeSlider... */}
                    <VolumeControl 
                        iconSize={volumeIconSize}
                        volumeSliderOffsetY={volumeSliderOffsetY}
                        volumeSliderOffsetX={volumeSliderOffsetX}
                        volumeSliderWidth={volumeSliderWidth}
                        volumeSliderThickness={volumeSliderThickness}
                        volumeSliderPopupWidth={volumeSliderPopupWidth}
                        volumeSliderPopupHeight={volumeSliderPopupHeight}
                        zIndex={volumeControlZIndex}
                        volumeSliderThumbOffsetY={volumeSliderThumbOffsetY}
                    />
                </div>
            </div>
        </footer>
      </div>

       {webAppUrl && <WebAppViewer url={webAppUrl} onClose={() => setWebAppUrl(null)} />}

      {isDebugOpen && <DebugControls
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
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
        navigateToolWidth={navigateToolWidth}
        setNavigateToolWidth={setNavigateToolWidth}
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
      />}
    </div>
  );
}

function App() {  
  return (
    <AuthProvider>
      <VehicleProvider>
        <AppContent />
        <div id="portal-root"></div>
      </VehicleProvider>
    </AuthProvider>
  );
}

export default App;