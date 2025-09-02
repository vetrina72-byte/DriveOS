import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { FiRadio, FiHeart, FiLoader, FiAlertTriangle, FiSearch, FiSend } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

// Framer Motion Variants
const panelVariant: Variants = {
    initial: { x: '100%' },
    animate: { x: '0%', transition: { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] } },
    exit: { x: '100%', transition: { duration: 0.5, ease: [0.8, 0.2, 1, 0.2] } },
};

const contentVariant: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 1, delay: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      ease: "easeOut",
      duration: 0.3
    }
  }
};

// Interfacce per le stazioni radio
interface RadioStation {
    id: string;
    name: string;
    logo?: string;
    streamUrl: string;
    country: string;
    description?: string;
    genre?: string;
    nowPlaying?: string;
    website?: string;
}

interface RadioContextType {
    currentStation: RadioStation | null;
    isPlaying: boolean;
    volume: number;
    favorites: RadioStation[];
}

// Hook personalizzato per gestire il player radio
const useRadioPlayer = () => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [radioContext, setRadioContext] = useState<RadioContextType>({
        currentStation: null,
        isPlaying: false,
        volume: 0.7,
        favorites: []
    });

    const playStation = (station: RadioStation) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = station.streamUrl;
            audioRef.current.volume = radioContext.volume;
            audioRef.current.play().catch(err => {
                console.error('Errore riproduzione radio:', err);
            });
        } else {
            audioRef.current = new Audio(station.streamUrl);
            audioRef.current.volume = radioContext.volume;
            audioRef.current.play().catch(err => {
                console.error('Errore riproduzione radio:', err);
            });
        }

        setRadioContext(prev => ({
            ...prev,
            currentStation: station,
            isPlaying: true
        }));
    };

    const pauseRadio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setRadioContext(prev => ({ ...prev, isPlaying: false }));
    };

    const resumeRadio = () => {
        if (audioRef.current && radioContext.currentStation) {
            audioRef.current.play().catch(err => {
                console.error('Errore ripresa radio:', err);
            });
            setRadioContext(prev => ({ ...prev, isPlaying: true }));
        }
    };

    const togglePlayPause = () => {
        if (radioContext.isPlaying) {
            pauseRadio();
        } else {
            resumeRadio();
        }
    };

    const setVolume = (volume: number) => {
        const newVolume = Math.max(0, Math.min(1, volume));
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
        setRadioContext(prev => ({ ...prev, volume: newVolume }));
    };

    const toggleFavorite = (station: RadioStation) => {
        setRadioContext(prev => {
            const isFavorite = prev.favorites.some(fav => fav.id === station.id);
            const newFavorites = isFavorite
                ? prev.favorites.filter(fav => fav.id !== station.id)
                : [...prev.favorites, station];
            
            // Salva nei preferiti locali
            localStorage.setItem('radio_favorites', JSON.stringify(newFavorites));
            
            return { ...prev, favorites: newFavorites };
        });
    };

    // Carica preferiti salvati
    useEffect(() => {
        const savedFavorites = localStorage.getItem('radio_favorites');
        if (savedFavorites) {
            try {
                const favorites = JSON.parse(savedFavorites);
                setRadioContext(prev => ({ ...prev, favorites }));
            } catch (err) {
                console.error('Errore caricamento preferiti radio:', err);
            }
        }
    }, []);

    return {
        radioContext,
        playStation,
        pauseRadio,
        resumeRadio,
        togglePlayPause,
        setVolume,
        toggleFavorite
    };
};

// Componente per singola stazione radio
const RadioStationItem = ({ 
    station, 
    isNight, 
    onPlay, 
    onToggleFavorite, 
    isFavorite,
    isCurrentStation,
    isPlaying 
}: {
    station: RadioStation;
    isNight: boolean;
    onPlay: (station: RadioStation) => void;
    onToggleFavorite: (station: RadioStation) => void;
    isFavorite: boolean;
    isCurrentStation: boolean;
    isPlaying: boolean;
}) => {
    const textColorPrimary = isNight ? 'text-white' : 'text-zinc-800';
    const textColorSecondary = isNight ? 'text-[#b3b3b3]' : 'text-zinc-500';
    const bgColor = isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10';
    const placeholderBg = isNight ? 'bg-zinc-800' : 'bg-zinc-300';
    const heartColor = isFavorite ? 'text-red-500' : (isNight ? 'text-zinc-400' : 'text-zinc-500');

    const AnimatedEqualizer = () => (
        <div className="flex items-end justify-center w-4 h-4 gap-0.5 text-green-400">
            <style>{`
                @keyframes radio-equalizer {
                    0%, 100% { height: 20%; }
                    50% { height: 100%; }
                }
            `}</style>
            <span className="w-1 bg-current" style={{ animation: 'radio-equalizer 1.2s ease-in-out infinite', animationDelay: '0s' }}></span>
            <span className="w-1 bg-current" style={{ animation: 'radio-equalizer 1.2s ease-in-out infinite', animationDelay: '-0.2s' }}></span>
            <span className="w-1 bg-current" style={{ animation: 'radio-equalizer 1.2s ease-in-out infinite', animationDelay: '-0.4s' }}></span>
            <span className="w-1 bg-current" style={{ animation: 'radio-equalizer 1.2s ease-in-out infinite', animationDelay: '-0.6s' }}></span>
        </div>
    );

    return (
        <div 
            onClick={() => onPlay(station)} 
            className={`p-3 rounded-lg transition-colors duration-200 cursor-pointer w-44 flex-shrink-0 ${bgColor} ${isCurrentStation ? 'ring-2 ring-green-500' : ''}`}
        >
            <div className="relative w-full aspect-square mb-3">
                {station.logo ? (
                    <img 
                        src={station.logo} 
                        alt={station.name} 
                        className="w-full h-full rounded-md object-cover shadow-lg"
                        onError={(e) => {
                            // Fallback se l'immagine non carica
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                        }}
                    />
                ) : null}
                <div className={`w-full h-full rounded-md flex items-center justify-center ${placeholderBg} ${station.logo ? 'hidden' : ''}`}>
                    <FiRadio className={`w-10 h-10 ${isNight ? 'text-zinc-500' : 'text-zinc-600'}`} />
                </div>
                
                {/* Indicatore di riproduzione */}
                {isCurrentStation && isPlaying && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                        <AnimatedEqualizer />
                    </div>
                )}
                
                {/* Pulsante cuore */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(station);
                    }}
                    className="absolute bottom-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                >
                    <FiHeart className={`w-4 h-4 ${heartColor} ${isFavorite ? 'fill-current' : ''}`} />
                </button>
            </div>
            
            <h3 className={`font-bold truncate ${textColorPrimary}`}>{station.name}</h3>
            <p className={`text-sm truncate ${textColorSecondary}`}>
                {station.nowPlaying || station.genre || station.description || 'Stazione Radio'}
            </p>
        </div>
    );
};

// Componente per carousel di stazioni
const RadioCarousel = ({ 
    title, 
    stations, 
    isNight, 
    onPlay, 
    onToggleFavorite, 
    favorites,
    currentStation,
    isPlaying 
}: {
    title: string;
    stations: RadioStation[];
    isNight: boolean;
    onPlay: (station: RadioStation) => void;
    onToggleFavorite: (station: RadioStation) => void;
    favorites: RadioStation[];
    currentStation: RadioStation | null;
    isPlaying: boolean;
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    if (stations.length === 0) return null;

    return (
        <section className="mb-8">
            <h2 
                className="text-2xl font-bold mb-4 px-6" 
                style={{ color: 'var(--heading-color)' }}
            >
                {title}
            </h2>
            <motion.div
                ref={scrollRef}
                className="spotify-carousel gap-4 px-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {stations.map((station, index) => (
                    <motion.div variants={itemVariants} key={`${title}-${station.id}-${index}`}>
                        <RadioStationItem
                            station={station}
                            isNight={isNight}
                            onPlay={onPlay}
                            onToggleFavorite={onToggleFavorite}
                            isFavorite={favorites.some(fav => fav.id === station.id)}
                            isCurrentStation={currentStation?.id === station.id}
                            isPlaying={isPlaying}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </section>
    );
};

// Servizio per recuperare stazioni radio
const RadioService = {
    // Funzione per ottenere la posizione dell'utente
    async getUserCountry(): Promise<string> {
        try {
            // Prova a ottenere la posizione GPS
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 5000,
                    enableHighAccuracy: false
                });
            });

            // Usa un servizio di geocoding per ottenere il paese
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=it`
            );
            const data = await response.json();
            return data.countryCode || 'IT';
        } catch (error) {
            console.log('Impossibile ottenere posizione, uso Italia come default');
            return 'IT';
        }
    },

    // Funzione principale per ottenere stazioni radio
    async getRadioStations(country: string = 'IT'): Promise<{ popular: RadioStation[], national: RadioStation[] }> {
        try {
            // Prima prova con Radio Browser API (gratuita e affidabile)
            const response = await fetch(
                `https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/${country}?limit=100&order=clickcount&reverse=true`
            );
            
            if (!response.ok) {
                throw new Error('Errore API Radio Browser');
            }

            const stations = await response.json();
            
            // Filtra e mappa le stazioni
            const validStations: RadioStation[] = stations
                .filter((station: any) => 
                    station.url_resolved && 
                    station.name && 
                    station.clickcount > 100 // Solo stazioni popolari
                )
                .map((station: any) => ({
                    id: station.stationuuid,
                    name: station.name,
                    logo: station.favicon || undefined,
                    streamUrl: station.url_resolved,
                    country: station.countrycode,
                    description: station.tags || station.state,
                    genre: station.tags,
                    website: station.homepage
                }))
                .slice(0, 50); // Limita a 50 stazioni

            // Dividi in popolari (prime 20) e nazionali (resto)
            const popular = validStations.slice(0, 20);
            const national = validStations.slice(20);

            return { popular, national };
        } catch (error) {
            console.error('Errore caricamento stazioni radio:', error);
            
            // Fallback con stazioni italiane predefinite
            return this.getFallbackStations();
        }
    },

    // Stazioni di fallback per l'Italia
    getFallbackStations(): { popular: RadioStation[], national: RadioStation[] } {
        const fallbackStations: RadioStation[] = [
            {
                id: 'rai-radio1',
                name: 'RAI Radio 1',
                logo: 'https://www.raiplayradio.it/assets/img/loghi/radio1.png',
                streamUrl: 'https://icestreaming.rai.it/1.mp3',
                country: 'IT',
                description: 'La radio generalista della RAI',
                genre: 'Generalista'
            },
            {
                id: 'rai-radio2',
                name: 'RAI Radio 2',
                logo: 'https://www.raiplayradio.it/assets/img/loghi/radio2.png',
                streamUrl: 'https://icestreaming.rai.it/2.mp3',
                country: 'IT',
                description: 'Musica e intrattenimento',
                genre: 'Musica'
            },
            {
                id: 'rtl-102.5',
                name: 'RTL 102.5',
                logo: 'https://www.rtl.it/assets/img/logo-rtl.png',
                streamUrl: 'https://streamingv2.shoutcast.com/rtl-1025',
                country: 'IT',
                description: 'Very Normal People',
                genre: 'Pop'
            },
            {
                id: 'radio-italia',
                name: 'Radio Italia',
                logo: 'https://www.radioitalia.it/images/logo.png',
                streamUrl: 'https://radioitalia-lh.akamaihd.net/i/radioitalia_1@329645/master.m3u8',
                country: 'IT',
                description: 'Solo musica italiana',
                genre: 'Italiana'
            },
            {
                id: 'radio-deejay',
                name: 'Radio Deejay',
                logo: 'https://www.deejay.it/images/logo.png',
                streamUrl: 'https://deejay-lh.akamaihd.net/i/DeejayTV_1@129866/master.m3u8',
                country: 'IT',
                description: 'La radio più ascoltata',
                genre: 'Pop'
            },
            {
                id: 'radio-capital',
                name: 'Radio Capital',
                logo: 'https://www.capital.it/images/logo.png',
                streamUrl: 'https://capital-lh.akamaihd.net/i/CapitalTV_1@183098/master.m3u8',
                country: 'IT',
                description: 'Rock e musica alternativa',
                genre: 'Rock'
            }
        ];

        return {
            popular: fallbackStations.slice(0, 4),
            national: fallbackStations.slice(4)
        };
    },

    // Ricerca stazioni
    async searchStations(query: string, country: string = 'IT'): Promise<RadioStation[]> {
        try {
            const response = await fetch(
                `https://de1.api.radio-browser.info/json/stations/byname/${encodeURIComponent(query)}?limit=20&countrycode=${country}`
            );
            
            if (!response.ok) {
                throw new Error('Errore ricerca stazioni');
            }

            const stations = await response.json();
            
            return stations
                .filter((station: any) => station.url_resolved && station.name)
                .map((station: any) => ({
                    id: station.stationuuid,
                    name: station.name,
                    logo: station.favicon || undefined,
                    streamUrl: station.url_resolved,
                    country: station.countrycode,
                    description: station.tags || station.state,
                    genre: station.tags
                }));
        } catch (error) {
            console.error('Errore ricerca stazioni:', error);
            return [];
        }
    }
};

// Componente principale RadioApp
const RadioApp = ({
    isOpen,
    onClose,
    isNight,
    spotifyPlayerTop,
    spotifyPlayerBottom,
}: {
    isOpen: boolean;
    onClose: () => void;
    isNight: boolean;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
}) => {
    const [popularStations, setPopularStations] = useState<RadioStation[]>([]);
    const [nationalStations, setNationalStations] = useState<RadioStation[]>([]);
    const [searchResults, setSearchResults] = useState<RadioStation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [userCountry, setUserCountry] = useState('IT');

    const { radioContext, playStation, togglePlayPause, toggleFavorite } = useRadioPlayer();

    // Carica stazioni all'apertura
    useEffect(() => {
        if (isOpen) {
            loadStations();
        }
    }, [isOpen]);

    const loadStations = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const country = await RadioService.getUserCountry();
            setUserCountry(country);
            
            const { popular, national } = await RadioService.getRadioStations(country);
            setPopularStations(popular);
            setNationalStations(national);
        } catch (err) {
            console.error('Errore caricamento stazioni:', err);
            setError('Impossibile caricare le stazioni radio');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;
        
        setIsSearching(true);
        try {
            const results = await RadioService.searchStations(searchTerm, userCountry);
            setSearchResults(results);
        } catch (err) {
            console.error('Errore ricerca:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const clearSearch = () => {
        setSearchTerm('');
        setSearchResults([]);
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex-grow flex justify-center items-center">
                    <div className="flex flex-col items-center gap-4">
                        <FiLoader className={`animate-spin text-4xl ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`} />
                        <p className={`${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            Caricamento stazioni radio...
                        </p>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex-grow flex justify-center items-center">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <FiAlertTriangle className="text-4xl text-red-500" />
                        <p className="font-semibold text-lg">Errore</p>
                        <p className={`${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>{error}</p>
                        <button 
                            onClick={loadStations}
                            className="mt-4 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-semibold transition-colors"
                        >
                            Riprova
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
                {/* Header con ricerca */}
                <div className="px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4 mb-6">
                        <FiRadio className={`w-8 h-8 ${isNight ? 'text-green-400' : 'text-green-600'}`} />
                        <h1 
                            className="text-3xl font-bold"
                            style={{ color: 'var(--heading-color)' }}
                        >
                            Radio
                        </h1>
                    </div>

                    {/* Barra di ricerca */}
                    <div className="relative max-w-md">
                        <FiSearch className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`} />
                        <input
                            type="text"
                            placeholder="Cerca stazioni radio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className={`w-full pl-11 pr-10 py-3 rounded-full text-sm font-medium transition-colors duration-300 ${
                                isNight ? 'bg-white/10' : 'bg-black/5'
                            } placeholder:text-[#b3b3b3] border border-transparent focus:border-white/20 focus:outline-none`}
                            style={{ color: 'var(--text-primary)' }}
                        />
                        <button 
                            onClick={handleSearch}
                            disabled={isSearching}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors duration-200 ${
                                isNight ? 'hover:bg-white/10' : 'hover:bg-black/5'
                            } disabled:opacity-50`}
                            aria-label="Cerca"
                        >
                            {isSearching ? (
                                <FiLoader className="w-4 h-4 animate-spin" style={{ color: 'var(--text-primary)' }} />
                            ) : (
                                <FiSend className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
                            )}
                        </button>
                    </div>

                    {searchTerm && (
                        <button
                            onClick={clearSearch}
                            className={`mt-2 text-sm ${isNight ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'} transition-colors`}
                        >
                            Cancella ricerca
                        </button>
                    )}
                </div>

                {/* Risultati ricerca */}
                {searchResults.length > 0 && (
                    <RadioCarousel
                        title={`Risultati per "${searchTerm}"`}
                        stations={searchResults}
                        isNight={isNight}
                        onPlay={playStation}
                        onToggleFavorite={toggleFavorite}
                        favorites={radioContext.favorites}
                        currentStation={radioContext.currentStation}
                        isPlaying={radioContext.isPlaying}
                    />
                )}

                {/* Preferiti */}
                {radioContext.favorites.length > 0 && (
                    <RadioCarousel
                        title="Le tue stazioni preferite"
                        stations={radioContext.favorites}
                        isNight={isNight}
                        onPlay={playStation}
                        onToggleFavorite={toggleFavorite}
                        favorites={radioContext.favorites}
                        currentStation={radioContext.currentStation}
                        isPlaying={radioContext.isPlaying}
                    />
                )}

                {/* Stazioni popolari */}
                {popularStations.length > 0 && (
                    <RadioCarousel
                        title="Stazioni più popolari"
                        stations={popularStations}
                        isNight={isNight}
                        onPlay={playStation}
                        onToggleFavorite={toggleFavorite}
                        favorites={radioContext.favorites}
                        currentStation={radioContext.currentStation}
                        isPlaying={radioContext.isPlaying}
                    />
                )}

                {/* Stazioni nazionali */}
                {nationalStations.length > 0 && (
                    <RadioCarousel
                        title="Altre stazioni nazionali"
                        stations={nationalStations}
                        isNight={isNight}
                        onPlay={playStation}
                        onToggleFavorite={toggleFavorite}
                        favorites={radioContext.favorites}
                        currentStation={radioContext.currentStation}
                        isPlaying={radioContext.isPlaying}
                    />
                )}
            </div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={panelVariant}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="fixed right-0 w-2/3 shadow-2xl z-20 flex"
                    style={{
                        top: `${spotifyPlayerTop}px`,
                        bottom: `${spotifyPlayerBottom}px`,
                    }}
                    aria-hidden={!isOpen}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="radio-app-title"
                    onClick={(e) => e.stopPropagation()}
                >
                    <motion.div
                        className="w-full h-full flex flex-col relative backdrop-blur-lg"
                        style={{ backgroundColor: 'var(--spotify-panel-bg)' }}
                        variants={contentVariant}
                    >
                        <h1 id="radio-app-title" className="sr-only">Radio App</h1>
                        {renderContent()}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default React.memo(RadioApp);