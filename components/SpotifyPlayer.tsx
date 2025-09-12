import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiLoader } from 'react-icons/fi';
import SpotifyLogin from './SpotifyLogin';
import TopNavBar from './TopNavBar';
import ContentArea from './ContentArea';
import { SpotifyItem as MediaItem } from './PlaylistItem';
import PlaylistDetailView from './PlaylistDetailView';
import ArtistListView from './ArtistListView';
import PlaylistListView from './PlaylistListView';
import ArtistDetailView from './ArtistDetailView';
import SearchResultsView from './SearchResultsView';
import AlbumGridView from './AlbumGridView';
import PodcastGridView from './PodcastGridView';
import RecentlyPlayedView from './RecentlyPlayedView';
import ShowDetailView from './ShowDetailView';
import GenresView from './GenresView';
import CategoryPlaylistsView from './CategoryPlaylistsView';
import NewReleasesView from './NewReleasesView';


export type ViewType = 
    | 'home' 
    | 'playlists' 
    | 'artists' 
    | 'search' 
    | 'playlist' 
    | 'album' 
    | 'artist'
    | 'show'
    | 'recently-played'
    | 'albums'
    | 'podcasts'
    | 'genres'
    | 'categoryPlaylists'
    | 'new-releases';

export interface ViewState {
  type: ViewType;
  id?: string;
  query?: string;
  title?: string;
}

const SpotifyPlayer = ({ 
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
    const { isAuthenticated, user, error, play, isPlayerReady } = useAuth();
    
    const [translateX, setTranslateX] = useState(100);
    const animationFrameId = useRef<number | null>(null);
    const [startFetching, setStartFetching] = useState(false);
    
    const [view, setView] = useState<ViewState>({ type: 'home' });
    const [viewHistory, setViewHistory] = useState<ViewState[]>([]);

    const openingBoxSpeed = 4.5;
    const closingBoxSpeed = 8.6;

    useEffect(() => {
        if (isOpen && !startFetching) {
            // Delay fetching to allow the opening animation to be smooth
            const timer = setTimeout(() => {
                setStartFetching(true);
            }, 400);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            const timer = setTimeout(() => {
                setView({ type: 'home' });
                setViewHistory([]);
                setStartFetching(false); // Reset for next open
            }, 500); 
            return () => clearTimeout(timer);
        }
    }, [isOpen, startFetching]);

    const changeView = (newView: ViewState) => {
        setViewHistory(prev => [...prev, view]);
        setView(newView);
    };

    const handleNavigate = (type: ViewType) => {
        changeView({ type });
    };

    const handleSearch = (query: string) => {
        changeView({ type: 'search', query });
    };

    const handleSelectItem = (item: MediaItem) => {
        if (item.id === 'liked-songs') {
             changeView({ type: 'playlist', id: 'liked-songs' });
             return;
        }
        
        if (item.type === 'playlist' || item.type === 'album' || item.type === 'artist' || item.type === 'show') {
            changeView({ type: item.type, id: item.id });
        } else if (item.type === 'category') {
            // Handle special categories that link to full views, not just playlist searches
            if (item.id === 'new-releases') {
                changeView({ type: 'new-releases' });
            } else {
                changeView({ type: 'categoryPlaylists', id: item.id, title: item.name });
            }
        } else if (item.type === 'track') {
            if (!isPlayerReady) {
                console.warn("Player not ready. Playback blocked.");
                return;
            }
            if (item.context?.uri) {
                // If the track has context (album/playlist), play the context starting from this track
                play({
                    context_uri: item.context.uri,
                    offset: {
                        uri: item.uri,
                    },
                });
            } else {
                 play({ uris: [item.uri] });
            }
        }
    };

    const handleBack = () => {
        const lastView = viewHistory[viewHistory.length - 1];
        if (lastView) {
            setView(lastView);
            setViewHistory(prev => prev.slice(0, -1));
        } else {
            setView({ type: 'home' });
        }
    };

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

    const renderContent = () => {
        if (error) {
            return (
                <div className={`text-center flex flex-col items-center gap-4 ${isNight ? 'text-red-400' : 'text-red-600'}`}>
                    <p>Error: {error}</p>
                    <SpotifyLogin />
                </div>
            );
        }

        if (isAuthenticated && user) {
            const isDetailView = ['playlist', 'album', 'artist', 'show', 'categoryPlaylists', 'search', 'new-releases'].includes(view.type);
            return (
                <div className="flex flex-col w-full h-full">
                    <TopNavBar 
                        isNight={isNight} 
                        activeView={view.type} 
                        onNavigate={handleNavigate}
                        onSearch={handleSearch}
                        onBack={handleBack} 
                        showBackButton={isDetailView} 
                    />
                    {view.type === 'home' && <ContentArea isNight={isNight} onSelectItem={handleSelectItem} startFetching={startFetching} />}
                    {view.type === 'playlists' && <PlaylistListView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'artists' && <ArtistListView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'albums' && <AlbumGridView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'podcasts' && <PodcastGridView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'recently-played' && <RecentlyPlayedView isNight={isNight} onPlay={play} />}
                    {view.type === 'search' && <SearchResultsView query={view.query!} isNight={isNight} onSelectItem={handleSelectItem} onPlay={play} />}
                    {view.type === 'genres' && <GenresView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'new-releases' && <NewReleasesView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'categoryPlaylists' && <CategoryPlaylistsView categoryId={view.id!} title={view.title!} isNight={isNight} onSelectItem={handleSelectItem} onBack={handleBack} />}

                    {(view.type === 'playlist' || view.type === 'album') && (
                        <PlaylistDetailView
                            itemId={view.id!}
                            itemType={view.type}
                            isNight={isNight}
                            onPlay={play}
                        />
                    )}
                    {view.type === 'artist' && (
                        <ArtistDetailView
                            artistId={view.id!}
                            isNight={isNight}
                            onPlay={play}
                            onSelectItem={handleSelectItem}
                        />
                    )}
                     {view.type === 'show' && (
                        <ShowDetailView
                            showId={view.id!}
                            isNight={isNight}
                            onPlay={play}
                        />
                    )}
                </div>
            );
        }
        
        return <SpotifyLogin />;
    };

    return (
        <div 
            className={`spotify-app-panel flex shadow-2xl`}
            style={{
                transform: `translateX(${translateX}%)`,
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotify-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div 
              className={`w-full h-full flex flex-col relative backdrop-blur-lg`}
              style={{ backgroundColor: 'var(--spotify-panel-bg)' }}
            >
                {/* The close button has been removed from the header */}
                <h1 id="spotify-app-title" className="sr-only">Spotify App</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden relative">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default React.memo(SpotifyPlayer);