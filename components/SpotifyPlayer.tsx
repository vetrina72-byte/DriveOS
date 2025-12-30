
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
    
    // --- PHYSICS ENGINE REFS ---
    const panelRef = useRef<HTMLDivElement>(null);
    
    // Single source of truth for the animation physics
    const physics = useRef({
        currentX: 100,      // Current translateX percentage (0 = open, 100 = closed)
        targetX: 100,       // Target translateX percentage
        isDragging: false,
        dragStartX: 0,      // Screen pixel X where drag started
        dragStartCurrentX: 0, // currentX value at the moment drag started
        panelWidth: 0,      // Cached panel width in pixels
        animationId: 0
    });

    const [view, setView] = useState<ViewState>({ type: 'home' });
    const [viewHistory, setViewHistory] = useState<ViewState[]>([]);

    // Constants
    const ANIMATION_SPEED = 0.18; // Lerp factor
    const CLOSE_THRESHOLD_PERCENT = 25; // Drag past 25% to close

    // --- MAIN LOOP ---
    useEffect(() => {
        const update = () => {
            const state = physics.current;
            const panel = panelRef.current;

            // 1. Update Physics
            if (!state.isDragging) {
                // Smoothly interpolate towards target
                const diff = state.targetX - state.currentX;
                if (Math.abs(diff) > 0.01) {
                    state.currentX += diff * ANIMATION_SPEED;
                } else {
                    state.currentX = state.targetX;
                }
            }
            // If dragging, currentX is updated directly in pointerMove

            // 2. Render
            if (panel) {
                const isVertical = isMapsLayered;
                // Clamp visual output to avoid floating point jitter at 0 or 100
                // but only strictly clamp if not dragging to allow elastic feeling (optional, here we strict clamp)
                let visualX = state.currentX;
                if (!state.isDragging) {
                    if (visualX < 0.01) visualX = 0;
                    if (visualX > 99.9) visualX = 100;
                }

                if (isVertical) {
                    panel.style.transform = `translateY(${visualX}%)`;
                } else {
                    panel.style.transform = `translateX(${visualX}%)`;
                }
                
                // Opacity fade optimization: slightly fade out when closing
                // opacity = 1 when x=0, opacity=0.5 when x=100
                // panel.style.opacity = `${1 - (visualX / 200)}`; 
            }

            state.animationId = requestAnimationFrame(update);
        };

        physics.current.animationId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(physics.current.animationId);
    }, [isMapsLayered]);

    // --- SYNC REACT PROP TO PHYSICS TARGET ---
    useEffect(() => {
        const state = physics.current;
        
        // Only update target if not dragging (drag rules all)
        if (!state.isDragging) {
            if (isOpen) {
                state.targetX = 0;
                const timer = setTimeout(() => triggerHomeContentFetch(), 400);
                return () => clearTimeout(timer);
            } else {
                state.targetX = 100;
                const timer = setTimeout(() => {
                    setView({ type: 'home' });
                    setViewHistory([]);
                }, 500);
                return () => clearTimeout(timer);
            }
        } else {
            // Edge case: Prop changed WHILE dragging.
            // We ignore it for now, the drag release logic will decide the final state.
        }
    }, [isOpen, triggerHomeContentFetch]);

    // --- INTERACTION HANDLERS ---
    const handlePointerDown = (e: React.PointerEvent) => {
        // Allow interaction even if currently animating (catch mid-flight)
        if (!panelRef.current) return;
        
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        
        const state = physics.current;
        state.isDragging = true;
        state.dragStartX = e.clientX;
        state.dragStartCurrentX = state.currentX; // Capture exact current position
        state.panelWidth = panelRef.current.offsetWidth || window.innerWidth * 0.66;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const state = physics.current;
        if (!state.isDragging) return;
        e.stopPropagation();

        const deltaPx = e.clientX - state.dragStartX;
        const deltaPercent = (deltaPx / state.panelWidth) * 100;
        
        // Calculate raw new position
        let newPercent = state.dragStartCurrentX + deltaPercent;
        
        // Constraint: Cannot go below 0 (Widening/Left)
        if (newPercent < 0) newPercent = 0;
        
        // Constraint: No upper limit technically needed, but visual clamping at 100 is fine
        // Letting it go >100 adds rubber banding which might feel weird for a closing drawer
        // Let's allow it slightly for feedback but mostly it implies closing.
        
        state.currentX = newPercent;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.releasePointerCapture(e.pointerId);
        
        const state = physics.current;
        state.isDragging = false;

        // Decision Logic
        // If we are significantly past 25%, close it.
        // Also consider velocity? Simple threshold is usually more robust for UI.
        
        if (state.currentX > CLOSE_THRESHOLD_PERCENT) {
            // Close
            state.targetX = 100;
            if (isOpen) onClose(); // Tell React
        } else {
            // Re-open (Snap back)
            state.targetX = 0;
            // No need to call onOpen since isOpen is presumably true, 
            // but if it wasn't, the useEffect would have handled it.
        }
    };

    // --- VIEW LOGIC (Unchanged) ---
    const changeView = (newView: ViewState) => {
        setViewHistory(prev => [...prev, view]);
        setView(newView);
    };

    const handleNavigate = (type: ViewType) => changeView({ type });
    const handleSearch = (query: string) => changeView({ type: 'search', query });

    const handleSelectItem = (item: MediaItem) => {
        if (item.id === 'liked-songs') { changeView({ type: 'playlist', id: 'liked-songs' }); return; }
        if (['playlist', 'album', 'artist', 'show'].includes(item.type)) { changeView({ type: item.type as any, id: item.id }); }
        else if (item.type === 'category') {
            if (item.id === 'new-releases' || item.name?.toLowerCase() === 'nuove uscite') changeView({ type: 'new-releases' });
            else changeView({ type: 'categoryPlaylists', id: item.id, title: item.name });
        } else if (item.type === 'track' && isPlayerReady) { play({ uris: [item.uri] }, item); }
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

    const renderContent = () => {
        if (error) return (<div className={`text-center flex flex-col items-center gap-4 ${isNight ? 'text-red-400' : 'text-red-600'}`}><p>Error: {error}</p><SpotifyLogin isNight={isNight} /></div>);
        if (isAuthenticated && user) {
            const isDetailView = ['playlist', 'album', 'artist', 'show', 'categoryPlaylists', 'search', 'new-releases'].includes(view.type);
            return (
                <div className="flex flex-col w-full h-full">
                    <TopNavBar isNight={isNight} activeView={view.type} onNavigate={handleNavigate} onSearch={handleSearch} onBack={handleBack} showBackButton={isDetailView} />
                    {view.type === 'home' && (
                        <ContentArea isNight={isNight} onSelectItem={handleSelectItem} loading={homeContentLoading} error={homeContentError} user={user}
                            continueListeningItems={continueListeningItems} newReleases={newReleases} userPlaylists={userPlaylists} madeForYouPlaylists={madeForYouPlaylists}
                            topArtists={topArtists} chartsPlaylists={chartsPlaylists} genresCategories={genresCategories} recommendedShows={recommendedShows}
                            partyPlaylists={partyPlaylists} topTracks={topTracks} artistRadioTracks={artistRadioTracks} trackRecommendations={trackRecommendations} savedAlbums={savedAlbums} madeForYou={madeForYou} />
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
                    {(view.type === 'playlist' || view.type === 'album') && <PlaylistDetailView itemId={view.id!} itemType={view.type as any} isNight={isNight} onPlay={(opts, item) => play(opts, item)} />}
                    {view.type === 'artist' && <ArtistDetailView artistId={view.id!} isNight={isNight} onPlay={(opts, item) => play(opts, item)} onSelectItem={handleSelectItem} onFollowChange={triggerDataRefresh} />}
                    {view.type === 'show' && <ShowDetailView showId={view.id!} isNight={isNight} onPlay={(opts) => play(opts)} />}
                </div>
            );
        }
        return <SpotifyLogin isNight={isNight} />;
    };

    // Styling
    const backgroundColor = isNight ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const handleColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';

    return (
        <div 
            ref={panelRef}
            className={`spotify-app-panel w-2/3 flex shadow-2xl`}
            style={{
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
                // Transform managed directly by ref in animation loop
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotify-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div 
              className={`w-full h-full flex flex-col relative backdrop-blur-lg`}
              style={{ backgroundColor }}
            >
                {/* --- DRAG HANDLE --- */}
                <div
                    className="absolute top-0 bottom-0 -left-10 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-50 touch-none group"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    aria-label="Drag to close"
                >
                    {/* Visual Pill */}
                    <div 
                        className={`w-1 h-32 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 ${handleColorClass}`} 
                    />
                </div>
                {/* ------------------- */}

                <h1 id="spotify-app-title" className="sr-only">Spotify App</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden relative">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default React.memo(SpotifyPlayer);
