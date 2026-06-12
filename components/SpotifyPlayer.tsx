
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useUIConfig } from '../context/UIConfigContext';
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
    onDragProgress,
    layeredAppTopOffset = 0,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    isNight: boolean;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
    isMapsLayered?: boolean;
    onDragProgress?: (progress: number | null) => void;
    layeredAppTopOffset?: number;
}) => {
    const { 
        isAuthenticated, user, error, play, isPlayerReady, triggerDataRefresh, 
        triggerHomeContentFetch, resetHomeContent, homeContentLoading, homeContentError,
        continueListeningItems, newReleases, userPlaylists, madeForYouPlaylists,
        topArtists, chartsPlaylists, genresCategories, recommendedShows,
        partyPlaylists, topTracks, artistRadioTracks, trackRecommendations, savedAlbums, madeForYou
    } = useAuth();

    const { sceneTransitionSpeed = 1.10 } = useUIConfig();
    
    // --- STATE & REFS ---
    const panelRef = useRef<HTMLDivElement>(null);
    
    // We need a local state to track if we are in "Vertical Mode" (Layered) or "Side Mode".
    // Crucially, we only update this when isOpen is true. 
    // If isOpen becomes false (closing), we keep the *last* known mode so the exit animation 
    // happens in the correct direction (Down vs Right), ignoring the parent resetting props.
    const [renderLayered, setRenderLayered] = useState(isMapsLayered);
    const isVerticalRef = useRef(isMapsLayered);

    useEffect(() => {
        if (isOpen) {
            setRenderLayered(!!isMapsLayered);
            isVerticalRef.current = !!isMapsLayered;
        }
    }, [isMapsLayered, isOpen]);

    // Single source of truth for the animation physics
    const physics = useRef({
        currentPercent: 100, // 0 = open, 100 = closed
        targetPercent: 100,
        startPercent: 100,
        animStartTime: 0,
        isDragging: false,
        isInteracting: false, // NEW: Tracks if user interaction sequence is active (drag + settle)
        dragStart: 0,        // Pixel value (X or Y depending on mode)
        dragStartPercent: 0, // Percent value at start of drag
        panelDimension: 0,   // Width or Height in pixels
        animationId: 0
    });

    const [view, setView] = useState<ViewState>({ type: 'home' });
    const [viewHistory, setViewHistory] = useState<ViewState[]>([]);

    // Constants
    const CLOSE_THRESHOLD_PERCENT = 20; // Drag past 20% to close

    // --- MAIN LOOP ---
    useEffect(() => {
        const update = () => {
            const state = physics.current;
            const panel = panelRef.current;
            const isVertical = isVerticalRef.current; // Read from ref for atomic updates in loop

            // 1. Update Physics
            if (!state.isDragging) {
                if (state.animStartTime > 0) {
                    const elapsed = performance.now() - state.animStartTime;
                    const duration = sceneTransitionSpeed * 1000; // ms
                    const t = Math.min(elapsed / duration, 1.0);
                    // power4.out easing
                    const easeT = 1 - Math.pow(1 - t, 4);
                    state.currentPercent = state.startPercent + (state.targetPercent - state.startPercent) * easeT;
                } else {
                    state.currentPercent = state.targetPercent;
                }
            }

            // 2. Report Progress to 3D Scene (Seamless Handoff Logic)
            if (state.isInteracting) {
                // Determine visual progress (clamped for 3D scene safety)
                let visualProgress = state.currentPercent / 100;
                visualProgress = Math.max(0, Math.min(1, visualProgress));
                
                onDragProgress?.(visualProgress);

                // Check if settled (animation finished)
                // We use a threshold of 0.5% to consider it "done" for the 3D scene handoff
                if (!state.isDragging && Math.abs(state.targetPercent - state.currentPercent) < 0.5) {
                    state.isInteracting = false;
                    onDragProgress?.(null); // Release control to auto-animation
                }
            }

            // 3. Render
            if (panel) {
                // Clamp visual output for CSS
                let visualPercent = state.currentPercent;
                if (!state.isDragging) {
                    if (visualPercent < 0.01) visualPercent = 0;
                    if (visualPercent > 99.9) visualPercent = 100;
                }

                // If Layered -> Vertical Translation (Y) -> Close Downwards
                // If Normal -> Horizontal Translation (X) -> Close Rightwards
                if (isVertical) {
                    panel.style.transform = `translateY(${visualPercent}%)`;
                } else {
                    panel.style.transform = `translateX(${visualPercent}%)`;
                }
            }

            state.animationId = requestAnimationFrame(update);
        };

        physics.current.animationId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(physics.current.animationId);
    }, [onDragProgress]); 

    // --- SYNC REACT PROP TO PHYSICS TARGET ---
    useEffect(() => {
        const state = physics.current;
        
        // Only update target if not dragging
        if (!state.isDragging) {
            const newTargetPercent = isOpen ? 0 : 100;
            if (state.targetPercent !== newTargetPercent || state.animStartTime === 0) {
                state.startPercent = state.currentPercent;
                state.targetPercent = newTargetPercent;
                state.animStartTime = performance.now();
                // state.isInteracting = true; // REMOVED: Prevent emitting onDragProgress during click transitions
            }
            
            if (isOpen) {
                const timer = setTimeout(() => triggerHomeContentFetch(), sceneTransitionSpeed * 1000);
                return () => clearTimeout(timer);
            } else {
                const timer = setTimeout(() => {
                    setView({ type: 'home' });
                    setViewHistory([]);
                }, sceneTransitionSpeed * 1000); // Changed to match transition speed duration
                return () => clearTimeout(timer);
            }
        }
    }, [isOpen, triggerHomeContentFetch]);

    // --- INTERACTION HANDLERS ---
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!panelRef.current) return;
        
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        
        const state = physics.current;
        state.isDragging = true;
        state.isInteracting = true; // Start interacting sequence
        
        // Use the latched renderLayered state to decide axis interaction
        if (renderLayered) {
            // Vertical Dragging (Top Handle)
            state.dragStart = e.clientY;
            state.panelDimension = panelRef.current.offsetHeight || window.innerHeight;
        } else {
            // Horizontal Dragging (Left Handle)
            state.dragStart = e.clientX;
            state.panelDimension = panelRef.current.offsetWidth || window.innerWidth * 0.66;
        }
        
        state.dragStartPercent = state.currentPercent; 
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const state = physics.current;
        if (!state.isDragging) return;
        e.stopPropagation();

        const currentPos = renderLayered ? e.clientY : e.clientX;
        const deltaPx = currentPos - state.dragStart;
        const deltaPercent = (deltaPx / state.panelDimension) * 100;
        
        let newPercent = state.dragStartPercent + deltaPercent;
        
        // Constraint: Cannot go below 0 (Fully Open state)
        // Closing means going towards 100% (Positive)
        if (newPercent < 0) newPercent = 0;
        
        state.currentPercent = newPercent;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.releasePointerCapture(e.pointerId);
        
        const state = physics.current;
        state.isDragging = false;
        // DO NOT call onDragProgress(null) here. 
        // The loop will handle it once the animation settles.

        // Decision Logic
        if (state.currentPercent > CLOSE_THRESHOLD_PERCENT) {
            // Close
            state.startPercent = state.currentPercent;
            state.targetPercent = 100;
            state.animStartTime = performance.now();
            if (isOpen) onClose(); 
        } else {
            // Re-open (Snap back)
            state.startPercent = state.currentPercent;
            state.targetPercent = 0;
            state.animStartTime = performance.now();
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
    const backgroundColor = isNight ? '#000000' : '#f7f7f7';
    const handleColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';

    // --- CONDITIONAL HANDLE STYLES & POSITIONING ---
    // Rule: Handle must always be OUTSIDE the box.
    // Rule: If renderLayered (Spotify over Maps) -> Handle on TOP, Horizontal Pill.
    // Rule: If !renderLayered (Spotify alone) -> Handle on LEFT, Vertical Pill.
    
    const handleContainerClass = renderLayered
        ? `absolute -top-12 left-0 right-0 h-12 flex items-end justify-center pb-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`
        : `absolute top-0 bottom-0 -left-12 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`;

    const handlePillClass = renderLayered
        ? `w-16 h-1.5 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-110 ${handleColorClass}` // Horizontal Pill
        : `w-1.5 h-16 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 ${handleColorClass}`; // Vertical Pill

    // --- PORTAL LOGIC ---
    // If we are layered, we try to find the anchor container inside Maps.
    // If found, we render via Portal. If not, we render normally (fallback).
    const portalTarget = renderLayered ? document.getElementById('maps-anchored-container') : null;

    const mainContent = (
        <div 
            ref={panelRef}
            className={`spotify-app-panel shadow-2xl flex ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} ${renderLayered ? 'absolute left-0 right-0 w-full' : 'fixed w-[85%] sm:w-[75%] md:w-1/2 lg:w-[65%] xl:w-[60%] right-0'}`}
            style={{
                top: renderLayered ? `${layeredAppTopOffset}px` : `${(spotifyPlayerTop) / 16}rem`,
                // FIX: When layered inside Maps, bottom must be 0 to fill the Maps container fully.
                // Maps container already has a bottom offset (e.g. 80px), so setting bottom:0 here
                // ensures Spotify ends exactly where Maps ends, avoiding the double-gap issue.
                bottom: renderLayered ? 0 : `${(spotifyPlayerBottom) / 16}rem`,
                // Note: When portaled, transform is relative to the Maps panel (which is already moving X).
                // So the transform here is ONLY for the vertical open/close animation.
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotify-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div 
              className={`w-full h-full flex flex-col relative rounded-t-[2rem]`}
              style={{ backgroundColor }}
            >
                {/* --- DRAG HANDLE (CONDITIONAL POS) --- */}
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

                <h1 id="spotify-app-title" className="sr-only">Spotify App</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden relative">
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

export default React.memo(SpotifyPlayer);
