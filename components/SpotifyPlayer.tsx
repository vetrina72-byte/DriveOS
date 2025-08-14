
import React, { useState, useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import SpotifyLogin from './SpotifyLogin';
import TopNavBar from './TopNavBar';
import ContentArea from './ContentArea';
import { SpotifyItem } from './PlaylistItem';
import PlaylistDetailView from './PlaylistDetailView';
import ArtistListView from './ArtistListView';
import PlaylistListView from './PlaylistListView';
import ArtistDetailView from './ArtistDetailView';
import SearchResultsView from './SearchResultsView';
import AlbumGridView from './AlbumGridView';
import PodcastGridView from './PodcastGridView';
import RecentlyPlayedView from './RecentlyPlayedView';
import ShowDetailView from './ShowDetailView';


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
    | 'genres';

export interface ViewState {
  type: ViewType;
  id?: string;
  query?: string;
}

const PlaceholderView = ({ name, isNight }: { name: string, isNight: boolean }) => (
    <div className={`flex-grow flex justify-center items-center text-xl ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`}>
        {name} (Not Implemented)
    </div>
);


export default function SpotifyApp({ 
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
}) {
    const { isAuthenticated, user, error, play } = useAuth();
    
    const [translateX, setTranslateX] = useState(100);
    const animationFrameId = useRef<number | null>(null);
    
    const [view, setView] = useState<ViewState>({ type: 'home' });
    const [viewHistory, setViewHistory] = useState<ViewState[]>([]);

    const openingBoxSpeed = 4.5;
    const closingBoxSpeed = 8.6;

    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => {
                setView({ type: 'home' });
                setViewHistory([]);
            }, 500); 
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

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

    const handleSelectItem = (item: SpotifyItem) => {
        if (item.type === 'playlist' || item.type === 'album' || item.type === 'artist' || item.type === 'show') {
            changeView({ type: item.type, id: item.id });
        } else if (item.type === 'track') {
            play({ uris: [item.uri] });
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

    const bgColor = isNight ? 'bg-[#2d3436]/95' : 'bg-[#fdf6e3]/95';
    const buttonBg = isNight ? 'bg-black/50 hover:bg-red-500/80' : 'bg-white/50 hover:bg-red-500/80';

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
            const isDetailView = ['playlist', 'album', 'artist', 'show'].includes(view.type);
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
                    {view.type === 'home' && <ContentArea isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'playlists' && <PlaylistListView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'artists' && <ArtistListView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'albums' && <AlbumGridView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'podcasts' && <PodcastGridView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'recently-played' && <RecentlyPlayedView isNight={isNight} onPlay={play} />}
                    {view.type === 'search' && <SearchResultsView query={view.query!} isNight={isNight} onSelectItem={handleSelectItem} onPlay={play} />}
                    
                    {/* Placeholder Views */}
                    {view.type === 'genres' && <PlaceholderView name="Generi e Mood" isNight={isNight} />}

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
            className={`fixed right-0 w-2/3 shadow-2xl z-20 flex`}
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
            <div className={`w-full h-full flex flex-col relative ${bgColor} backdrop-blur-lg`}>
                <header className="absolute top-0 right-0 p-4 z-30">
                    <button className={`p-2 rounded-full transition-colors ${buttonBg}`} onClick={onClose} aria-label="Close Spotify">
                        <FiX className="h-5 w-5 text-white"/>
                    </button>
                </header>
                <h1 id="spotify-app-title" className="sr-only">Spotify App</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden">
                     {renderContent()}
                </div>
            </div>
        </div>
    );
}
