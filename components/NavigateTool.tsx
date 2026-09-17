import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { FiClock } from 'react-icons/fi';
import { useNavigation } from '../context/NavigationContext';
import { globalSearchService } from '../services/SearchService';
import { LocationInfo } from '../types/maps';
import {
  Fuel,
  ParkingCircle,
  Utensils,
  Hotel,
  Pill,
  ShoppingBag,
  Zap,
  MapPin
} from 'lucide-react';

export const formatTravelTime = (minutes: number | null): string => {
    if (minutes === null || isNaN(minutes)) return '-- min';
    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours} h ${remainingMinutes} min`;
};

interface RecentPlace {
    name: string;
    address?: string;
    lat: number;
    lng: number;
}

const NavigateTool = ({ 
    isNight,
    width,
    widgetBgColor,
    dayPlayerButtonColor,
    nightPlayerButtonColor,
    darkNavigateInputBg,
    isHome = true,
}: { 
    isNight: boolean;
    width: number;
    widgetBgColor: string;
    dayPlayerButtonColor: string;
    nightPlayerButtonColor: string;
    darkNavigateInputBg: string;
    isHome?: boolean;
    showRecentsOnFocus?: boolean;
}) => {
    const {
        throttledPosition: currentPosition,
        homeLocation,
        workLocation,
        handleSelectDestination: onSelectDestination,
    } = useNavigation();

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<LocationInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [recents, setRecents] = useState<RecentPlace[]>([]);
    const searchTimeoutRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const baseHeight = 113;
    const expandedHeight = 400;

    useEffect(() => {
        try {
            const storedRecents = localStorage.getItem('recent_destinations');
            if (storedRecents) {
                setRecents(JSON.parse(storedRecents));
            }
        } catch (e) {
            console.error("Failed to load recent destinations", e);
        }
    }, []);

    const saveToRecents = (place: RecentPlace) => {
        const newRecents = [place, ...recents.filter(r => 
            r.name !== place.name && (Math.abs(r.lat - place.lat) > 0.0001 || Math.abs(r.lng - place.lng) > 0.0001)
        )].slice(0, 5);
        setRecents(newRecents);
        localStorage.setItem('recent_destinations', JSON.stringify(newRecents));
    };

    const highlightMatch = (text: string | undefined, q: string) => {
        if (!q || !text) {
            return text || '';
        }
        const queryParts = q.trim().split(/\s+/).map(part =>
            part?.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') || ''
        ).filter(part => part.length > 0);

        if (queryParts.length === 0) return text;

        const regex = new RegExp(`(${queryParts.join('|')})`, 'i');
        const parts = text.split(new RegExp(`(${queryParts.join('|')})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    regex.test(part) ? (
                        <strong key={i} className={isNight ? 'text-white font-extrabold' : 'text-black font-extrabold'}>{part}</strong>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };

    useEffect(() => {
        if (query.trim().length < 1) {
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
                const results = await globalSearchService.search(query.trim(), currentPosition || undefined);
                setSuggestions(results || []);
            } catch (error) {
                console.error("Autocomplete search failed:", error);
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [query, currentPosition]);

    useEffect(() => {
        if (!isHome) {
            setIsExpanded(false);
            return;
        }

        if (isFocused) {
            setIsExpanded(true);
        }
    }, [isFocused, isHome]);

    const handleSelect = (item: LocationInfo) => {
        const { lat, lng, name, address } = item;
        saveToRecents({ name, address, lat, lng });
        
        setQuery('');
        setSuggestions([]);
        setIsFocused(false);
        setIsExpanded(false);
        onSelectDestination({ lat, lng, name });
    };

    const handleRecentSelect = (place: RecentPlace) => {
        saveToRecents(place);
        setQuery('');
        setSuggestions([]);
        setIsFocused(false);
        setIsExpanded(false);
        onSelectDestination({ lat: place.lat, lng: place.lng, name: place.name });
    };
    
    const handleClose = () => {
        setIsFocused(false);
        setIsExpanded(false);
        setQuery('');
        setSuggestions([]);
        if (inputRef.current) {
            inputRef.current.blur();
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsFocused(false);
                setIsExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const theme = {
        bg: isNight ? 'rgba(24, 24, 27, 0.75)' : 'rgba(255, 255, 255, 0.85)',
        text: isNight ? 'text-zinc-100' : 'text-zinc-900',
        inputText: isNight ? 'text-zinc-100' : 'text-zinc-900',
        placeholderText: isNight ? 'placeholder-zinc-400' : 'placeholder-zinc-500',
        iconColor: isNight ? 'text-zinc-400' : 'text-zinc-500',
        suggestionHover: isNight ? 'hover:bg-zinc-700/50' : 'hover:bg-zinc-200/60',
        border: isNight ? 'border-zinc-700/50' : 'border-zinc-200/80',
        recentsHeader: isNight ? 'text-zinc-400' : 'text-zinc-500',
    };

    const renderCategoryIcon = (cat?: string) => {
        switch (cat) {
            case 'fuel':
                return <Fuel className="w-5 h-5 text-amber-500" />;
            case 'parking':
                return <ParkingCircle className="w-5 h-5 text-blue-500" />;
            case 'restaurant':
                return <Utensils className="w-5 h-5 text-rose-500" />;
            case 'hotel':
                return <Hotel className="w-5 h-5 text-purple-500" />;
            case 'pharmacy':
                return <Pill className="w-5 h-5 text-emerald-500" />;
            case 'supermarket':
                return <ShoppingBag className="w-5 h-5 text-orange-500" />;
            case 'charging':
                return <Zap className="w-5 h-5 text-cyan-500" />;
            default:
                return <MapPin className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <div 
            id="navigate-tool-container"
            ref={containerRef}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className={`relative backdrop-blur-md rounded-2xl border border-white/10 shadow-lg flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 pointer-events-auto`}
            style={{ 
                width: `${(width) / 16}rem`,
                height: `${(isExpanded ? expandedHeight : baseHeight) / 16}rem`,
                background: !isNight ? widgetBgColor : theme.bg
            }}
        >
             <div className="p-3 flex flex-col h-full overflow-hidden">
                <div className="relative flex-shrink-0 flex items-center gap-2">
                    <div className="relative flex-grow flex items-center">
                        <ICONS.search className={`absolute left-3.5 w-5 h-5 pointer-events-none ${theme.iconColor}`} />
                        <input
                            ref={inputRef}
                            type="text"
                            id="home-search-input"
                            name="destination"
                            aria-label="Navigate"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => {
                                setIsFocused(true);
                                setIsExpanded(true);
                            }}
                            placeholder="Cerca destinazione"
                            className={`w-full h-10 pl-11 pr-4 rounded-xl text-sm font-medium transition-colors ${!isNight ? 'bg-zinc-100' : ''} ${theme.inputText} ${theme.placeholderText} focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center select-text touch-auto pointer-events-auto`}
                            style={isNight ? { backgroundColor: darkNavigateInputBg } : undefined}
                        />
                    </div>
                    {isExpanded && (
                        <button
                            onClick={handleClose}
                            className={`flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${theme.suggestionHover} ${isNight ? 'text-zinc-300' : 'text-zinc-700'}`}
                        >
                            Chiudi
                        </button>
                    )}
                </div>
                
                <div className={`overflow-y-auto hide-scrollbar transition-opacity duration-200 ${isExpanded ? 'flex-grow mt-2 opacity-100' : 'hidden'}`}>
                    {loading && <div className="text-center p-2 text-sm text-zinc-400">Ricerca in corso...</div>}
                    
                    {!loading && query.trim().length === 0 && recents.length > 0 && (
                        <>
                            <div className={`px-2 py-1 text-xs font-bold uppercase tracking-wider ${theme.recentsHeader}`}>Recenti</div>
                            {recents.map((place, i) => (
                                <button
                                    key={`recent-${i}`}
                                    onMouseDown={() => handleRecentSelect(place)}
                                    className={`w-full text-left p-2.5 rounded-lg flex items-center gap-4 ${theme.suggestionHover}`}
                                >
                                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                        <FiClock className={`w-5 h-5 ${theme.iconColor}`} />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className={`font-medium truncate ${isNight ? 'text-zinc-100' : 'text-zinc-800'}`}>
                                            {place.name}
                                        </p>
                                        {place.address && (
                                            <p className={`text-xs truncate ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                {place.address}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </>
                    )}

                    {!loading && query.trim().length > 0 && suggestions.map((item, idx) => {
                        const name = item.name;
                        const address = item.address;
                        const distance = item.dk;
                        const estimatedTime = item.em;
                        return (
                            <button 
                                key={`${item.name}_${idx}`} 
                                onMouseDown={() => handleSelect(item)} 
                                className={`w-full text-left p-2.5 rounded-lg flex items-center gap-4 ${theme.suggestionHover}`}
                            >
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                    {renderCategoryIcon(item.category)}
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
                                {distance !== undefined && (
                                    <div className="flex-shrink-0 text-right">
                                        <p className={`font-semibold text-sm ${isNight ? 'text-zinc-200' : 'text-zinc-700'}`}>
                                            {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
                                        </p>
                                        {estimatedTime !== undefined && (
                                            <p className={`text-xs ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                ~{formatTravelTime(estimatedTime)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className={`flex-shrink-0 mt-auto pt-2 border-t ${theme.border}`}>
                    <div className="flex justify-around items-center gap-2">
                        <button 
                            onClick={() => {
                                if (homeLocation) {
                                    onSelectDestination(homeLocation);
                                } else {
                                    window.dispatchEvent(new CustomEvent('reconfigure-location', { detail: 'home' }));
                                }
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${theme.suggestionHover}`}
                            style={{ color: isNight ? nightPlayerButtonColor : dayPlayerButtonColor }}
                            title={homeLocation ? `Naviga a Casa (${homeLocation.name})` : 'Imposta indirizzo di Casa'}
                        >
                            <ICONS.home className="w-4 h-4" />
                            <span>{homeLocation ? 'Casa' : 'Imposta Casa'}</span>
                        </button>
                        <button 
                            onClick={() => {
                                if (workLocation) {
                                    onSelectDestination(workLocation);
                                } else {
                                    window.dispatchEvent(new CustomEvent('reconfigure-location', { detail: 'work' }));
                                }
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${theme.suggestionHover}`}
                            style={{ color: isNight ? nightPlayerButtonColor : dayPlayerButtonColor }}
                            title={workLocation ? `Naviga a Lavoro (${workLocation.name})` : 'Imposta indirizzo di Lavoro'}
                        >
                            <ICONS.work className="w-4 h-4" />
                            <span>{workLocation ? 'Lavoro' : 'Imposta Lavoro'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NavigateTool;
