
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { FiClock } from 'react-icons/fi';
import { useNavigation } from '../context/NavigationContext';

export const formatTravelTime = (minutes: number | null): string => {
    if (minutes === null || isNaN(minutes)) return '-- min';
    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours} h ${remainingMinutes} min`;
};

const IconLocationResult = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12 2C8.13401 2 5 5.13401 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13401 15.866 2 12 2Z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 11C12.5523 11 13 10.5523 13 10C13 9.44772 12.5523 9 12 9C11.4477 9 11 9.44772 11 10C11 10.5523 11.4477 11 12 11Z" fill="#EF4444"/>
    </svg>
);

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
    showRecentsOnFocus = true
}: { 
    isNight: boolean,
    width: number,
    widgetBgColor: string;
    dayPlayerButtonColor: string;
    nightPlayerButtonColor: string;
    darkNavigateInputBg: string;
    isHome?: boolean;
    showRecentsOnFocus?: boolean;
}) => {
    const {
        currentPosition,
        homeLocation,
        workLocation,
        handleSelectDestination: onSelectDestination,
    } = useNavigation();

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<{feature: any, distance: number | null}[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [recents, setRecents] = useState<RecentPlace[]>([]);
    const searchTimeoutRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const GEOAPIFY_API_KEY = '0d2c9c7f72c0477eb3260838db72a383';

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

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; 
    };

    const highlightMatch = (text: string | undefined, query: string) => {
        if (!query || !text) {
            return text;
        }
        const queryParts = query.trim().split(/\s+/).map(part =>
            part?.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') || ''
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
                const biasParam = currentPosition ? `&bias=proximity:${currentPosition.lng},${currentPosition.lat}` : '';
                const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&lang=it&limit=10&apiKey=${GEOAPIFY_API_KEY}${biasParam}`);
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
        if (!isHome) {
            setIsExpanded(false);
            return;
        }

        if (isFocused) {
            if (showRecentsOnFocus) {
                setIsExpanded(true);
            } else {
                setIsExpanded(query.trim().length > 0);
            }
        } else {
            setIsExpanded(false);
        }
    }, [isFocused, isHome, showRecentsOnFocus, query]);

    const handleSelect = (feature: any) => {
        const { lat, lon: lng } = feature.properties;
        const name = feature.properties.name || feature.properties.formatted;
        const address = feature.properties.address_line2 || feature.properties.formatted;
        
        saveToRecents({ name, address, lat, lng });
        
        setQuery('');
        setSuggestions([]);
        setIsFocused(false);
        onSelectDestination({ lat, lng, name });
    };

    const handleRecentSelect = (place: RecentPlace) => {
        saveToRecents(place); // Move to top
        setQuery('');
        setSuggestions([]);
        setIsFocused(false);
        onSelectDestination({ lat: place.lat, lng: place.lng, name: place.name });
    };
    
    useEffect(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; 
            textarea.style.height = `${textarea.scrollHeight}px`; 
        }
    }, [query]);
    
    const theme = {
        bg: 'var(--player-bg)',
        border: isNight ? 'border-zinc-700/80' : 'border-zinc-300',
        inputText: isNight ? 'text-zinc-100' : 'text-zinc-800',
        placeholderText: isNight ? 'placeholder:text-zinc-500' : 'placeholder:text-zinc-400',
        iconColor: isNight ? 'text-zinc-400' : 'text-zinc-500',
        suggestionHover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10',
        recentsHeader: isNight ? 'text-zinc-400' : 'text-zinc-500',
    };

    return (
        <div 
            ref={containerRef}
            className={`relative backdrop-blur-md rounded-xl shadow-lg flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 pointer-events-auto`}
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

                    {!loading && query.trim().length > 0 && suggestions.map(({ feature, distance }) => {
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

export default NavigateTool;
