import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FiLoader, FiRadio, FiAlertTriangle, FiSearch, FiX } from 'react-icons/fi';
import type { RadioStation } from '../types';
import RadioCard from './RadioCard';
import HorizontalCarousel from './HorizontalCarousel';
import { curatedStations } from './radio_curated';

// Helper to sanitize and override logos for station data from the API
const sanitizeStation = (station: any): RadioStation | null => {
    if (
        !station.url_resolved ||
        station.name.toLowerCase().includes('test') ||
        !station.stationuuid ||
        station.codec?.toLowerCase() === 'webm'
    ) {
        return null;
    }

    let favicon = (station.favicon && station.favicon.startsWith('http') && !station.favicon.includes('default')) 
        ? station.favicon 
        : '';

    const stationNameLower = station.name.toLowerCase();

    // Specific logo overrides based on keywords
    const logoOverrides = [
        { keywords: ['virgin radio'], logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/VirginRadio.png' },
        { keywords: ['radio deejay', 'deejay'], logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Logo_DeeJay.png' },
        { keywords: ['rtl 102.5', 'rtl 1025'], logo: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/RTL_102.5_logo.svg' },
        { keywords: ['radio 105', '105 network', '105 rap'], logo: 'https://upload.wikimedia.org/wikipedia/commons/5/50/Radio_105_logo.svg' },
        { keywords: ['r101'], logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/R101_-_Logo_2015.svg' },
        { keywords: ['radio italia'], logo: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Radio_Italia_logo_%282020%29.svg' },
        { keywords: ['kiss kiss'], logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Kiss_95.9.png' },
        { keywords: ['radio 80'], logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/80s80s_Logo_2015.svg' },
    ];

    for (const override of logoOverrides) {
        if (override.keywords.some(keyword => stationNameLower.includes(keyword))) {
            favicon = override.logo;
            break; // Stop after first match
        }
    }

    return {
        stationuuid: station.stationuuid,
        name: station.name.trim(),
        url_resolved: station.url_resolved,
        favicon: favicon,
        tags: station.tags || '',
        codec: station.codec || '',
    };
};


interface RadioAppProps {
    isOpen: boolean;
    onClose: () => void;
    isNight: boolean;
    onPlayStation: (station: RadioStation, context: RadioStation[]) => void;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
    favoriteStationUUIDs: string[];
}

const SkeletonCarousel = ({ isNight }: { isNight: boolean }) => {
    const bgColor = isNight ? 'bg-white/5' : 'bg-black/5';
    return (
        <div className="mb-8 px-6 animate-pulse">
            <div className={`h-8 w-1/3 rounded-md mb-4 ${bgColor}`}></div>
            <div className="flex gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`flex-shrink-0 w-44`}>
                        <div className={`w-full aspect-square rounded-md ${bgColor}`}></div>
                        <div className={`h-4 w-full rounded-md mt-3 ${bgColor}`}></div>
                        <div className={`h-3 w-2/3 rounded-md mt-2 ${bgColor}`}></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RadioApp: React.FC<RadioAppProps> = ({ isOpen, isNight, onPlayStation, spotifyPlayerTop, spotifyPlayerBottom, favoriteStationUUIDs }) => {
    const [translateX, setTranslateX] = useState(100);
    const animationFrameId = useRef<number | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<{name: string; stations: RadioStation[]}[]>([]);
    const [favorites, setFavorites] = useState<RadioStation[]>([]);
    const [favoritesLoading, setFavoritesLoading] = useState(true);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RadioStation[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchDebounceRef = useRef<number | null>(null);

    const openingBoxSpeed = 4.5;
    const closingBoxSpeed = 8.6;

    const radioBrowserApi = useMemo(() => {
        const servers = [
            'https://de1.api.radio-browser.info/json',
            'https://nl1.api.radio-browser.info/json',
            'https://fr1.api.radio-browser.info/json',
            'https://at1.api.radio-browser.info/json',
        ].sort(() => Math.random() - 0.5);
        let currentServerIndex = 0;

        const performRequest = async (config: { url: string; params?: any; }, retryCount = 0): Promise<{ data: any }> => {
            const server = servers[currentServerIndex];
            const url = new URL(server + config.url);
            if (config.params) {
                Object.keys(config.params).forEach(key => url.searchParams.append(key, String(config.params[key])));
            }

            try {
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: { 'User-Agent': 'AutomotiveUIConceptOKPERFET/1.0' },
                    signal: AbortSignal.timeout(5000),
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                return { data };
            } catch (error) {
                console.warn(`Request to ${server} failed.`, error);
                if (retryCount < servers.length - 1) {
                    currentServerIndex = (currentServerIndex + 1) % servers.length;
                    console.log(`Retrying with ${servers[currentServerIndex]}`);
                    return performRequest(config, retryCount + 1);
                } else {
                    throw new Error("All Radio Browser API servers failed.");
                }
            }
        };
        
        const recordClick = (stationuuid: string) => {
            performRequest({ url: `/url/${stationuuid}` }).catch(err => {
                console.error(`Failed to record click for ${stationuuid}`, err);
            });
        };

        return { performRequest, recordClick };
    }, []);

    useEffect(() => {
        const fetchFavorites = async () => {
            if (!isOpen || favoriteStationUUIDs.length === 0) {
                setFavorites([]);
                setFavoritesLoading(false);
                return;
            }
            setFavoritesLoading(true);
            try {
                const response = await radioBrowserApi.performRequest({
                    url: '/stations/byuuid',
                    params: {
                        uuids: favoriteStationUUIDs.join(','),
                        hidebroken: 'true',
                    }
                });
                const stations = response.data
                    .map(sanitizeStation)
                    .filter((s): s is RadioStation => s !== null);
                setFavorites(stations);
            } catch (err) {
                console.error("Failed to fetch favorite stations", err);
                setFavorites([]);
            } finally {
                setFavoritesLoading(false);
            }
        };

        fetchFavorites();
    }, [isOpen, favoriteStationUUIDs, radioBrowserApi]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            setError(null);

            const categoriesToFetch = [
                { name: 'Successi Italiani', params: { tag: 'italian', countrycode: 'IT', limit: 20, order: 'votes', reverse: 'true' }},
                { name: 'Pop', params: { tag: 'pop', countrycode: 'IT', limit: 20, order: 'votes', reverse: 'true' }},
                { name: 'Rock', params: { tag: 'rock', countrycode: 'IT', limit: 20, order: 'votes', reverse: 'true' }},
                { name: 'Dance', params: { tag: 'dance', countrycode: 'IT', limit: 20, order: 'votes', reverse: 'true' }},
                { name: 'Notizie', params: { tag: 'news', countrycode: 'IT', limit: 20, order: 'votes', reverse: 'true' }},
            ];

            try {
                const requests = categoriesToFetch.map(cat => 
                    radioBrowserApi.performRequest({ url: '/stations/search', params: { ...cat.params, hidebroken: 'true' } })
                );
                
                const responses = await Promise.allSettled(requests);
                
                const curatedStationUuids = new Set(curatedStations.map(s => s.stationuuid));
                const curatedStationNames = new Set(curatedStations.map(s => s.name.toLowerCase()));

                const categoryPromises = responses.map(async (res, index) => {
                    const categoryConfig = categoriesToFetch[index];
                    
                    if (res.status === 'fulfilled') {
                        let liveStations = (res.value.data || [])
                            .map(sanitizeStation)
                            .filter((s): s is RadioStation => s !== null && !!s.favicon);

                        // Filter out any curated stations from these other categories to avoid duplicates
                        liveStations = liveStations.filter(s => !curatedStationUuids.has(s.stationuuid) && !curatedStationNames.has(s.name.toLowerCase()));

                        if (categoryConfig.name === 'Notizie') {
                            liveStations = liveStations.filter(s => {
                                const nameLower = s.name.toLowerCase();
                                const isSole24Ore = nameLower.includes('sole') && nameLower.includes('24');
                                return !nameLower.includes('rai news 24') && !isSole24Ore;
                            });
                        }

                        if (liveStations.length > 0) {
                            return { name: categoryConfig.name, stations: liveStations };
                        }
                    }
                    return null;
                });
                
                const fetchedCategories = (await Promise.all(categoryPromises))
                    .filter((c): c is { name: string; stations: RadioStation[] } => c !== null);

                // Manually prepend the curated list as the first category
                const allCategories = [
                    { name: 'Le più ascoltate in Italia', stations: curatedStations },
                    ...fetchedCategories
                ];
                
                setCategories(allCategories);

            } catch (err) {
                setError("Impossibile caricare le stazioni radio. Verranno mostrate solo quelle principali.");
                // If API fails, at least show the curated stations
                setCategories([{ name: 'Le più ascoltate in Italia', stations: curatedStations }]);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [radioBrowserApi]);
    
    useEffect(() => {
        if (searchQuery.trim().length < 3) {
            setSearchResults([]);
            return;
        }

        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        
        setIsSearching(true);
        searchDebounceRef.current = window.setTimeout(async () => {
            try {
                const response = await radioBrowserApi.performRequest({
                    url: '/stations/search',
                    params: {
                        name: searchQuery,
                        countrycode: 'IT',
                        limit: 50,
                        order: 'votes',
                        reverse: 'true',
                        hidebroken: 'true',
                    }
                });
                 const stationsWithLogos = response.data
                    .map(sanitizeStation)
                    .filter((s): s is RadioStation => s !== null && !!s.favicon);

                setSearchResults(stationsWithLogos);

            } catch (err) {
                console.error('Radio search failed', err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [searchQuery, radioBrowserApi]);

    useEffect(() => {
        let lastTime = performance.now();
        const animate = (now: number) => {
            const delta = (now - lastTime) / 1000;
            lastTime = now;
            setTranslateX(currentX => {
                const target = isOpen ? 0 : 100;
                const speed = isOpen ? openingBoxSpeed : closingBoxSpeed;
                const damp = 1 - Math.exp(-speed * delta);
                const newX = currentX + (target - currentX) * damp;
                if (Math.abs(target - newX) < 0.1) {
                    if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                    return target;
                }
                return newX;
            });
            animationFrameId.current = requestAnimationFrame(animate);
        };
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = requestAnimationFrame(animate);
        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, [isOpen, openingBoxSpeed, closingBoxSpeed]);

    const handlePlayStation = (station: RadioStation, context: RadioStation[]) => {
        radioBrowserApi.recordClick(station.stationuuid);
        onPlayStation(station, context);
    };
    
    const renderContent = () => {
        if (loading) {
            return (
                <>
                    <SkeletonCarousel isNight={isNight} />
                    <SkeletonCarousel isNight={isNight} />
                    <SkeletonCarousel isNight={isNight} />
                </>
            );
        }
        if (error) {
            return (
                <div className="flex-grow flex flex-col justify-center items-center text-red-400 gap-4 text-center p-4">
                    <FiAlertTriangle className="w-10 h-10" />
                    <p>{error}</p>
                </div>
            );
        }
        
        if (searchQuery.trim().length >= 3) {
             return (
                <div className="px-6">
                    {isSearching ? (
                        <div className="flex justify-center items-center py-10">
                            <FiLoader className="animate-spin text-3xl text-zinc-400" />
                        </div>
                    ) : searchResults.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {searchResults.map((station, index) => (
                                <RadioCard
                                    key={`${station.stationuuid}-${index}`}
                                    station={station}
                                    isNight={isNight}
                                    onPlay={(s) => handlePlayStation(s, searchResults)}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-zinc-400 py-10">Nessun risultato per "{searchQuery}"</p>
                    )}
                </div>
             );
        }

        return (
            <>
                {!favoritesLoading && favorites.length > 0 && (
                     <section className="mb-8">
                        <h2 className="text-2xl font-bold mb-4 px-6" style={{ color: `var(--heading-color)` }}>
                            I tuoi preferiti
                        </h2>
                        <HorizontalCarousel isNight={isNight}>
                            {favorites.map((station) => (
                                <RadioCard
                                    key={station.stationuuid}
                                    station={station}
                                    isNight={isNight}
                                    onPlay={(s) => handlePlayStation(s, favorites)}
                                />
                            ))}
                        </HorizontalCarousel>
                    </section>
                )}
                {categories.map(category => (
                    <section key={category.name} className="mb-8">
                        <h2 className="text-2xl font-bold mb-4 px-6" style={{ color: `var(--heading-color)` }}>
                            {category.name}
                        </h2>
                        <HorizontalCarousel isNight={isNight}>
                            {category.stations.map((station) => (
                                <RadioCard
                                    key={station.stationuuid}
                                    station={station}
                                    isNight={isNight}
                                    onPlay={(s) => handlePlayStation(s, category.stations)}
                                />
                            ))}
                        </HorizontalCarousel>
                    </section>
                ))}
            </>
        );
    };

    return (
        <div 
            className={`fixed right-0 w-2/3 shadow-2xl z-20 flex`}
            style={{
                transform: `translateX(${translateX}%)`,
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="radio-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div 
              className={`w-full h-full flex flex-col relative backdrop-blur-lg`}
              style={{ backgroundColor: 'var(--spotify-panel-bg)' }}
            >
                 <header className="px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <FiRadio className="w-8 h-8" style={{ color: 'var(--text-primary)' }} />
                        <h1 id="radio-app-title" className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Radio</h1>
                    </div>
                     <div className="flex items-center gap-6">
                        <div className="relative max-w-xs">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Cerca una stazione..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-11 pr-10 py-3 rounded-full text-sm font-medium transition-colors duration-300 placeholder:text-zinc-400 border border-transparent focus:outline-none ${isNight ? 'bg-white/10 focus:border-white/20' : 'bg-black/5 focus:border-black/20'}`}
                                style={{ color: 'var(--text-primary)' }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20"
                                >
                                    <FiX className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                </button>
                            )}
                        </div>
                     </div>
                 </header>
                <div className="flex-grow flex flex-col overflow-y-auto hide-scrollbar">
                     {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default React.memo(RadioApp);
