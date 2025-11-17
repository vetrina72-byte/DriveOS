import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { SpotifyItem as MediaItem } from './PlaylistItem';
import { FiLoader, FiSearch, FiX } from 'react-icons/fi';
import type { YouTubeTrackInfo } from '../types';
import YouTubePlaylistDetailView from './YouTubePlaylistDetailView';
import QuotaErrorModal from './QuotaErrorModal';

interface YouTubeMusicAppProps {
    isOpen: boolean;
    onClose: () => void;
    isNight: boolean;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
    homeData: { [key: string]: MediaItem[] };
    isHomeDataLoading: boolean;
    youtubeHomeError: string | null;
    homeDataQuotaExceeded: boolean;
    onRetry: () => void;
    onQuotaError: () => void;
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

const logoUrlDark = "https://upload.wikimedia.org/wikipedia/commons/c/c3/YouTube_Music_short_logo_with_white_wordmark.svg";
const logoUrlLight = "https://upload.wikimedia.org/wikipedia/commons/0/0a/YouTube_Music_short_logo-black.svg";

const YouTubeMusicApp: React.FC<YouTubeMusicAppProps> = ({ 
    isOpen, 
    isNight, 
    spotifyPlayerTop, 
    spotifyPlayerBottom,
    homeData,
    isHomeDataLoading,
    youtubeHomeError,
    homeDataQuotaExceeded,
    onRetry,
    onQuotaError,
}) => {
    const { playYouTube } = useAuth();
    const [translateX, setTranslateX] = useState(100);
    const animationFrameId = useRef<number | null>(null);

    const [error, setError] = useState<string | null>(null);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState<{ id: string; name: string; images?: { url: string }[], description?: string } | null>(null);
    const [isQuotaModalDismissed, setIsQuotaModalDismissed] = useState(false);

    const openingBoxSpeed = 4.365;
    const closingBoxSpeed = 8.342;
    
    useEffect(() => {
        // Reset dismissed state if the quota error is resolved and comes back later
        if (!homeDataQuotaExceeded) {
            setIsQuotaModalDismissed(false);
        }
    }, [homeDataQuotaExceeded]);

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

    const handleSearchSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim().length < 2) return;
        
        setIsSearching(true);
        setError(null);
        setSubmittedQuery(searchQuery);
        setSearchResults([]);
        setSelectedPlaylist(null); // Exit playlist view on new search

        try {
            const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || "AIzaSyArzF2ad4FR6Ic_MFtd6JQ1cALR8j960sk";
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&videoCategoryId=10&maxResults=20&key=${YOUTUBE_API_KEY}`);
             if (!res.ok) {
                const errorData = await res.json();
                console.error("YouTube API Error:", errorData);
                if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded' || errorData.error?.message.toLowerCase().includes('quota')) {
                    throw new Error("quotaExceeded");
                }
                throw new Error(errorData.error?.message || 'YouTube search failed');
            }
            const data = await res.json();
            setSearchResults(data.items.map(mapYouTubeItemToMediaItem).filter(Boolean));
        } catch (err: any) {
            console.error("YouTube search error:", err);
            if (err.message === 'quotaExceeded') {
                onQuotaError();
            } else {
                setError(err.message || "Search failed.");
            }
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, onQuotaError]);
    
    const handleSelectItem = (item: MediaItem, contextItems?: MediaItem[]) => {
        if (item.type === 'track' && item.id) {
            const trackInfo: YouTubeTrackInfo = {
                videoId: item.id,
                title: item.name,
                channelTitle: item.description || 'YouTube',
                thumbnail: item.images?.[0]?.url || '',
            };
            
            let context: YouTubeTrackInfo[] | undefined;
            if (contextItems) {
                context = contextItems
                    .filter(i => i.type === 'track')
                    .map(i => ({
                        videoId: i.id,
                        title: i.name,
                        channelTitle: i.description || 'YouTube',
                        thumbnail: i.images?.[0]?.url || '',
                    }));
            }
            
            playYouTube(trackInfo, context);
        } else if (item.type === 'playlist' && item.id) {
            setSelectedPlaylist({
                id: item.id,
                name: item.name,
                images: item.images,
                description: item.description
            });
        }
    };

    const handlePlayYouTubeTrack = (track: YouTubeTrackInfo, playlistContext?: YouTubeTrackInfo[]) => {
        playYouTube(track, playlistContext);
    }
    
    const handlePlaylistQuotaError = useCallback((err: Error) => {
        if (err.message === 'quotaExceeded') {
            onQuotaError();
        } else {
            setError(err.message);
        }
    }, [onQuotaError]);

    const renderContent = () => {
        if (selectedPlaylist) {
            return (
                <YouTubePlaylistDetailView
                    playlist={selectedPlaylist}
                    isNight={isNight}
                    onBack={() => setSelectedPlaylist(null)}
                    onPlayTrack={handlePlayYouTubeTrack}
                    onQuotaError={handlePlaylistQuotaError}
                />
            );
        }
        
        if (isHomeDataLoading) {
            return (
                <>
                    <SkeletonCarousel isNight={isNight} />
                    <SkeletonCarousel isNight={isNight} />
                    <SkeletonCarousel isNight={isNight} />
                </>
            );
        }
    
        if (error || youtubeHomeError) {
            return <div className="flex-grow flex justify-center items-center text-red-400 p-4 text-center">{error || youtubeHomeError}</div>;
        }

        if (submittedQuery) {
            if (isSearching) {
                 return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`} /></div>;
            }
            if (searchResults.length > 0) {
                 return <ContentCarousel title={`Risultati per "${submittedQuery}"`} items={searchResults} isNight={isNight} onSelectItem={handleSelectItem} keyPrefix="yt-search" />;
            }
            return <div className="flex-grow flex justify-center items-center text-lg">Nessun risultato per "{submittedQuery}"</div>
        }

        return (
            <>
                <ContentCarousel title="Classifiche Musicali Italia" items={homeData.musicCharts || []} isNight={isNight} onSelectItem={handleSelectItem} keyPrefix="yt-charts" />
                <ContentCarousel title="Playlist Pop del Momento" items={homeData.popPlaylists || []} isNight={isNight} onSelectItem={handleSelectItem} keyPrefix="yt-pop" />
                <ContentCarousel title="Successi Italiani" items={homeData.italianPlaylists || []} isNight={isNight} onSelectItem={handleSelectItem} keyPrefix="yt-italian" />
                <ContentCarousel title="Workout Hits" items={homeData.workoutPlaylists || []} isNight={isNight} onSelectItem={handleSelectItem} keyPrefix="yt-workout" />
                <ContentCarousel title="Live Performance" items={homeData.livePerformances || []} isNight={isNight} onSelectItem={handleSelectItem} keyPrefix="yt-live" />
                <ContentCarousel title="Acoustic Sessions" items={homeData.acousticSessions || []} isNight={isNight} onSelectItem={handleSelectItem} keyPrefix="yt-acoustic" />
            </>
        )
    };

    return (
        <div 
            className="spotify-app-panel w-2/3 flex shadow-2xl"
            style={{
                transform: `translateX(${translateX}%)`,
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="youtube-music-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div 
              className={`w-full h-full flex flex-col relative backdrop-blur-lg`}
              style={{ backgroundColor: 'var(--spotify-panel-bg)' }}
            >
                <header className="px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <img 
                            src={isNight ? logoUrlDark : logoUrlLight} 
                            alt="YouTube Music Logo" 
                            className="h-7"
                        />
                         <h1 id="youtube-music-app-title" className="sr-only">YouTube Music</h1>
                    </div>
                     <form onSubmit={handleSearchSubmit} className="relative flex-grow max-w-sm">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Cerca un video..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-11 pr-10 py-3 rounded-full text-sm font-medium transition-colors duration-300 placeholder:text-zinc-400 border border-transparent focus:outline-none ${isNight ? 'bg-white/10 focus:border-white/20' : 'bg-black/5 focus:border-black/20'}`}
                            style={{ color: 'var(--text-primary)' }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setSubmittedQuery(''); setSearchResults([]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20"
                                aria-label="Clear search"
                            >
                                <FiX className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            </button>
                        )}
                    </form>
                </header>
                <div className="flex-grow flex flex-col overflow-y-auto hide-scrollbar relative">
                     {renderContent()}
                     <QuotaErrorModal
                        isOpen={homeDataQuotaExceeded && !isQuotaModalDismissed}
                        onClose={() => setIsQuotaModalDismissed(true)}
                        isNight={isNight}
                     />
                </div>
            </div>
        </div>
    );
};

export default YouTubeMusicApp;