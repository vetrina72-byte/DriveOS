
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
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
    isMapsLayered,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    isNight: boolean;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
    isMapsLayered?: boolean;
}) => {
    const { 
        isAuthenticated, user, error, play, isPlayerReady, triggerDataRefresh, 
        triggerHomeContentFetch, resetHomeContent, homeContentLoading, homeContentError,
        continueListeningItems, newReleases, userPlaylists, madeForYouPlaylists,
        topArtists, chartsPlaylists, genresCategories, recommendedShows,
        partyPlaylists, topTracks, artistRadioTracks, trackRecommendations, savedAlbums, madeForYou
    } = useAuth();
    
    const [animationType, setAnimationType] = useState<'x' | 'y'>('x');
    const [transformValue, setTransformValue] = useState(100);
    const animationFrameId = useRef<number | null>(null);
    
    const [view, setView] = useState<ViewState>({ type: 'home' });
    const [viewHistory, setViewHistory] = useState<ViewState[]>([]);

    // Increased speeds for snappier UI and to reduce visual glitches
    const openingBoxSpeed = 6.5; 
    const closingBoxSpeed = 12.0;

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                triggerHomeContentFetch();
            }, 400);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            const timer = setTimeout(() => {
                setView({ type: 'home' });
                setViewHistory([]);
                // Data is no longer reset here to allow background updates and persistence
            }, 500); 
            return () => clearTimeout(timer);
        }
    }, [isOpen, triggerHomeContentFetch, resetHomeContent]);
    
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
            // FIX: Add a more robust, case-insensitive check for the "New Releases" category.
            if (item.id === 'new-releases' || item.name?.toLowerCase() === 'nuove uscite') {
                changeView({ type: 'new-releases' });
            } else {
                changeView({ type: 'categoryPlaylists', id: item.id, title: item.name });
            }
        } else if (item.type === 'track') {
            if (!isPlayerReady) return;
            // For single tracks, the item itself is what we want to see in "Continue Listening"
            play({ uris: [item.uri] }, item);
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
        if (isOpen) {
            setAnimationType(isMapsLayered ? 'y' : 'x');
        }
    }, [isOpen, isMapsLayered]);

    useEffect(() => {
        let lastTime = performance.now();
        const animate = (now: number) => {
            const delta = (now - lastTime) / 1000;
            lastTime = now;
            setTransformValue(currentVal => {
                const target = isOpen ? 0 : 100;
                const speed = isOpen ? openingBoxSpeed : closingBoxSpeed;
                const damp = 1 - Math.exp(-speed * delta);
                const newVal = currentVal + (target - currentVal) * damp;
                if (Math.abs(target - newVal) < 0.1) {
                    if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                    return target;
                }
                return newVal;
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
                    {view.type === 'home' && (
                        <ContentArea
                            isNight={isNight}
                            onSelectItem={handleSelectItem}
                            loading={homeContentLoading}
                            error={homeContentError}
                            user={user}
                            continueListeningItems={continueListeningItems}
                            newReleases={newReleases}
                            userPlaylists={userPlaylists}
                            madeForYouPlaylists={madeForYouPlaylists}
                            topArtists={topArtists}
                            chartsPlaylists={chartsPlaylists}
                            genresCategories={genresCategories}
                            recommendedShows={recommendedShows}
                            partyPlaylists={partyPlaylists}
                            topTracks={topTracks}
                            artistRadioTracks={artistRadioTracks}
                            trackRecommendations={trackRecommendations}
                            savedAlbums={savedAlbums}
                            madeForYou={madeForYou}
                        />
                    )}
                    {view.type === 'playlists' && <PlaylistListView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'artists' && <ArtistListView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'albums' && <AlbumGridView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'podcasts' && <PodcastGridView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'recently-played' && <RecentlyPlayedView isNight={isNight} onPlay={(opts) => play(opts)} />}
                    {view.type === 'search' && <SearchResultsView query={view.query!} isNight={isNight} onSelectItem={handleSelectItem} onPlay={(opts, item) => play(opts, item)} />}
                    {view.type === 'genres' && <GenresView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'new-releases' && <NewReleasesView isNight={isNight} onSelectItem={handleSelectItem} />}
                    {view.type === 'categoryPlaylists' && <CategoryPlaylistsView categoryId={view.id!} title={view.title!} isNight={isNight} onSelectItem={handleSelectItem} onBack={handleBack} />}

                    {(view.type === 'playlist' || view.type === 'album') && (
                        <PlaylistDetailView
                            itemId={view.id!}
                            itemType={view.type}
                            isNight={isNight}
                            onPlay={(opts, item) => play(opts, item)}
                        />
                    )}
                    {view.type === 'artist' && (
                        <ArtistDetailView
                            artistId={view.id!}
                            isNight={isNight}
                            onPlay={(opts, item) => play(opts, item)}
                            onSelectItem={handleSelectItem}
                            onFollowChange={triggerDataRefresh}
                        />
                    )}
                     {view.type === 'show' && (
                        <ShowDetailView
                            showId={view.id!}
                            isNight={isNight}
                            onPlay={(opts) => play(opts)}
                        />
                    )}
                </div>
            );
        }
        
        return <SpotifyLogin />;
    };

    const transform = animationType === 'y'
        ? `translateY(${transformValue}%)`
        : `translateX(${transformValue}%)`;

    return (
        <div 
            className={`spotify-app-panel w-2/3 flex shadow-2xl`}
            style={{
                transform: transform,
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
                willChange: 'transform', // CRITICAL for smooth animation without artifacts
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
                <h1 id="spotify-app-title" className="sr-only">Spotify App</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden relative">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default React.memo(SpotifyPlayer);
