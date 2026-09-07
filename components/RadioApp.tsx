
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { FiRadio, FiAlertTriangle, FiSearch, FiX, FiChevronLeft } from 'react-icons/fi';
import { useUIConfig } from '../context/UIConfigContext';
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
    favoriteStationUUIDs: string[];
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
    isMapsLayered?: boolean;
    onDragProgress?: (progress: number | null) => void;
    layeredAppTopOffset?: number;
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

const RadioApp: React.FC<RadioAppProps> = ({ 
    isOpen, onClose, isNight, onPlayStation, favoriteStationUUIDs, 
    spotifyPlayerTop, spotifyPlayerBottom, onDragProgress, isMapsLayered, 
    layeredAppTopOffset = 0 
}) => {
    const { sceneTransitionSpeed = 1.10 } = useUIConfig();
    const panelRef = useRef<HTMLDivElement>(null);
    
    const [renderLayered, setRenderLayered] = useState(isMapsLayered);
    const isVerticalRef = useRef(isMapsLayered);

    useEffect(() => {
        if (isOpen) {
            setRenderLayered(!!isMapsLayered);
            isVerticalRef.current = !!isMapsLayered;
        }
    }, [isMapsLayered, isOpen]);

    // --- PHYSICS ENGINE (Unified) ---
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
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<{name: string; stations: RadioStation[]}[]>([]);
    const [favorites, setFavorites] = useState<RadioStation[]>([]);
    const [favoritesLoading, setFavoritesLoading] = useState(true);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RadioStation[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchDebounceRef = useRef<number | null>(null);

    const updateRef = useRef<() => void>(() => {});

    const startAnimation = useCallback(() => {
        if (!physics.current.animationId) {
            physics.current.animationId = requestAnimationFrame(() => {
                physics.current.animationId = 0;
                updateRef.current();
            });
        }
    }, []);

    // --- PHYSICS LOOP ---
    useEffect(() => {
        const update = () => {
            const state = physics.current;
            const panel = panelRef.current;

            // 1. Update Physics
            let isSettled = false;
            if (!state.isDragging) {
                if (state.animStartTime > 0) {
                    const elapsed = performance.now() - state.animStartTime;
                    const duration = sceneTransitionSpeed * 1000; // ms
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
    }, [onDragProgress]);

    // --- SYNC REACT PROP TO PHYSICS TARGET ---
    useEffect(() => {
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
    }, [isOpen, startAnimation]);

    // --- DRAG HANDLERS ---
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!panelRef.current) return;
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
        e.stopPropagation();
        e.currentTarget.releasePointerCapture(e.pointerId);
        
        const state = physics.current;
        // CRITICAL FIX: Only process drop logic if we were actually dragging.
        // Prevents premature close trigger on startup/mount.
        if (!state.isDragging) return;

        state.isDragging = false;
        // DO NOT call onDragProgress(null) here. The loop handles it.

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

    const handleColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';
    
    // --- CONDITIONAL HANDLE STYLES & POSITIONING ---
    const handleContainerClass = renderLayered
        ? `absolute -top-12 left-0 right-0 h-12 flex items-end justify-center pb-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`
        : `absolute top-0 bottom-0 -left-12 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`;

    const handlePillClass = renderLayered
        ? `w-16 h-1.5 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-x-110 ${handleColorClass}`
        : `w-1.5 h-16 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 ${handleColorClass}`;

    const portalTarget = renderLayered ? document.getElementById('maps-anchored-container') : null;

    const radioBrowserApi = useMemo(() => {
        const servers = [
            'https://all.api.radio-browser.info/json',
            'https://de1.api.radio-browser.info/json',
            'https://nl1.api.radio-browser.info/json',
        ];
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

                        // Filter out stations requested by the user for removal.
                        liveStations = liveStations.filter(s => {
                            const nameLower = s.name.toLowerCase();
                            return !nameLower.includes('radio italia dance') && !nameLower.includes('studio più');
                        });

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
                            <div className={`w-8 h-8 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} />
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

    const mainContent = (
        <div 
            ref={panelRef}
            className={`spotify-app-panel shadow-2xl flex ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} ${renderLayered ? 'absolute left-0 right-0 w-full' : 'fixed w-[85%] sm:w-[75%] md:w-1/2 lg:w-[65%] xl:w-[60%] right-0'}`}
            style={{
                // Transform managed by physics loop
                top: renderLayered ? `${layeredAppTopOffset}px` : `${(spotifyPlayerTop) / 16}rem`,
                bottom: renderLayered ? 0 : `${(spotifyPlayerBottom) / 16}rem`,
                willChange: 'transform',
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="radio-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div 
              className={`w-full h-full flex flex-col relative backdrop-blur-lg rounded-t-[2rem]`}
              style={{ backgroundColor: 'var(--spotify-panel-bg)' }}
            >
                {/* --- DRAG HANDLE --- */}
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
                {/* ------------------- */}

                 <header className="px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        {searchQuery.trim().length > 0 ? (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="p-2 -ml-2 rounded-full transition-colors hover:bg-white/10"
                                aria-label="Indietro"
                            >
                                <FiChevronLeft className="w-7 h-7" style={{ color: 'var(--text-primary)' }} />
                            </button>
                        ) : (
                            <>
                                <FiRadio className="w-8 h-8" style={{ color: 'var(--text-primary)' }} />
                                <h1 id="radio-app-title" className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Radio</h1>
                            </>
                        )}
                    </div>
                     <div className="flex items-center gap-6">
                        <div className="relative max-w-xs">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Cerca una stazione..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-11 pr-4 py-3 rounded-full text-sm font-medium transition-colors duration-300 placeholder:text-zinc-400 border border-transparent focus:outline-none ${isNight ? 'bg-white/10 focus:border-white/20' : 'bg-black/5 focus:border-black/20'}`}
                                style={{ color: 'var(--text-primary)' }}
                            />
                        </div>
                     </div>
                 </header>
                <div className="flex-grow flex flex-col overflow-y-auto hide-scrollbar">
                     {renderContent()}
                </div>
            </div>
        </div>
    );

    if (renderLayered && portalTarget) {
        return ReactDOM.createPortal(mainContent, portalTarget);
    }

    return mainContent;
};

export default React.memo(RadioApp);
