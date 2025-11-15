import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
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
    const { isAuthenticated, user, error, play, isPlayerReady, triggerDataRefresh, refreshTrigger, nowPlaying } = useAuth();
    
    const [translateX, setTranslateX] = useState(100);
    const animationFrameId = useRef<number | null>(null);
    
    const [view, setView] = useState<ViewState>({ type: 'home' });
    const [viewHistory, setViewHistory] = useState<ViewState[]>([]);

    // Home Content State - Lifted from ContentArea for performance
    const [homeContentLoading, setHomeContentLoading] = useState(false);
    const [homeContentError, setHomeContentError] = useState<string | null>(null);
    const [hasFetchedHomeContent, setHasFetchedHomeContent] = useState(false);
    const [startFetching, setStartFetching] = useState(false);
    
    const [continueListeningItems, setContinueListeningItems] = useState<MediaItem[]>([]);
    const [newReleases, setNewReleases] = useState<MediaItem[]>([]);
    const [userPlaylists, setUserPlaylists] = useState<MediaItem[]>([]);
    const [madeForYouPlaylists, setMadeForYouPlaylists] = useState<MediaItem[]>([]);
    const [topArtists, setTopArtists] = useState<MediaItem[]>([]);
    const [chartsPlaylists, setChartsPlaylists] = useState<MediaItem[]>([]);
    const [genresCategories, setGenresCategories] = useState<MediaItem[]>([]);
    const [recommendedShows, setRecommendedShows] = useState<MediaItem[]>([]);
    const [partyPlaylists, setPartyPlaylists] = useState<MediaItem[]>([]);
    const [topTracks, setTopTracks] = useState<MediaItem[]>([]);
    const [artistRadioTracks, setArtistRadioTracks] = useState<MediaItem[]>([]);
    const [trackRecommendations, setTrackRecommendations] = useState<MediaItem[]>([]);
    const [savedAlbums, setSavedAlbums] = useState<MediaItem[]>([]);
    const [madeForYou, setMadeForYou] = useState<MediaItem[]>([]);


    const openingBoxSpeed = 4.365;
    const closingBoxSpeed = 8.342;

    useEffect(() => {
        if (isOpen && !startFetching) {
            const timer = setTimeout(() => {
                setStartFetching(true);
            }, 400);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            const timer = setTimeout(() => {
                setView({ type: 'home' });
                setViewHistory([]);
                setStartFetching(false);
                setHasFetchedHomeContent(false); // Reset so it refetches next time it opens
            }, 500); 
            return () => clearTimeout(timer);
        }
    }, [isOpen, startFetching]);

    // --- Data Fetching Logic (Moved from ContentArea) ---
    const processRecentPlays = useCallback(async (items: any[]): Promise<MediaItem[]> => {
        const unifiedList: MediaItem[] = [];
        const addedUris = new Set<string>();
        const contextDetailsCache = new Map<string, any>();

        const tracksWithoutContext = items.filter(item => item.track && !item.context);
        const trackIdsToCheck = tracksWithoutContext.map(item => item.track.id).filter(Boolean);
        const likedStatusMap = new Map<string, boolean>();

        if (trackIdsToCheck.length > 0) {
            for (let i = 0; i < trackIdsToCheck.length; i += 50) {
                const chunk = trackIdsToCheck.slice(i, i + 50);
                try {
                    const response = await apiClient.get(`/me/tracks/contains?ids=${chunk.join(',')}`);
                    response.data.forEach((isLiked: boolean, index: number) => {
                        likedStatusMap.set(chunk[index], isLiked);
                    });
                } catch (e) {
                    console.error("Failed to check liked status for tracks", e);
                }
            }
        }

        const likedSongsItem: MediaItem = { id: 'liked-songs', name: 'Brani che ti piacciono', type: 'playlist', uri: 'special:liked-songs', description: 'La tua collezione personale.' };

        const contextUrisToFetch = [...new Set(items.filter(item => item.context?.uri && (item.context.type === 'album' || item.context.type === 'playlist')).map(item => item.context.uri))] as string[];

        if (contextUrisToFetch.length > 0) {
            const albumIds = contextUrisToFetch.filter(uri => uri.includes(':album:')).map(uri => uri.split(':')[2]);
            const playlistIds = contextUrisToFetch.filter(uri => uri.includes(':playlist:')).map(uri => uri.split(':')[2]);
            const promises = [];
            if (albumIds.length > 0) {
                promises.push(apiClient.get(`/albums?ids=${albumIds.join(',')}`).then(res => {
                    res.data.albums.forEach((album: any) => { if (album) contextDetailsCache.set(album.uri, album); });
                }).catch(e => console.error("Failed fetching album details", e)));
            }
            if (playlistIds.length > 0) {
                const playlistPromises = playlistIds.map(id => apiClient.get(`/playlists/${id}`).then(res => {
                    contextDetailsCache.set(res.data.uri, res.data);
                }).catch(e => console.error(`Failed to fetch playlist ${id}`, e)));
                promises.push(Promise.all(playlistPromises));
            }
            await Promise.all(promises);
        }

        for (const item of items) {
            if (!item.track) continue;
            let itemToAdd: MediaItem | null = null;
            if (item.context?.type === 'collection' || likedStatusMap.get(item.track.id)) {
                itemToAdd = likedSongsItem;
            } else if (item.context?.uri && contextDetailsCache.has(item.context.uri)) {
                const contextDetails = contextDetailsCache.get(item.context.uri)!;
                if (contextDetails.type === 'playlist' && contextDetails.owner.id === 'spotify') {
                    itemToAdd = item.track;
                } else {
                    itemToAdd = contextDetails;
                }
            } else {
                itemToAdd = item.track;
            }
            if (itemToAdd?.uri && !addedUris.has(itemToAdd.uri)) {
                unifiedList.push(itemToAdd);
                addedUris.add(itemToAdd.uri);
            }
        }
        return unifiedList.slice(0, 10);
    }, []);

    const fetchRecentlyPlayed = useCallback(async () => {
        if (!user) return;
        try {
            const recents = await apiClient.get('/me/player/recently-played?limit=50');
            const processedItems = await processRecentPlays(recents.data.items);
            setContinueListeningItems(processedItems);
        } catch (err) {
            console.error("Failed to fetch recently played items", err);
        }
    }, [user, processRecentPlays]);

    const fetchData = useCallback(async () => {
        if (!user || hasFetchedHomeContent) return;
        setHomeContentLoading(true);
        setHomeContentError(null);

        try {
            const promises = [
                apiClient.get('/me/playlists?limit=10'),
                apiClient.get('/me/top/artists?time_range=medium_term&limit=10'),
                apiClient.get('/browse/categories/0JQ5DAqbMKF2JckPAnMAhA/playlists?country=IT&limit=10'),
                apiClient.get('/browse/categories/toplists/playlists?country=IT&limit=10'),
                apiClient.get(`/browse/new-releases?country=IT&limit=10`),
                apiClient.get('/browse/categories?country=IT&limit=20'),
                apiClient.get('/search?q=podcast&type=show&market=IT&limit=10'),
                apiClient.get('/browse/categories/party/playlists?country=IT&limit=10'),
                apiClient.get('/me/top/tracks?limit=20&time_range=long_term'),
                apiClient.get('/me/albums?limit=10'),
                apiClient.get('/browse/categories/0JQ5DAt0tbjZptfcdMSKl3/playlists?country=IT&limit=10'),
            ];
            const results = await Promise.allSettled(promises);
            results.forEach((result, index) => {
                if (result.status === 'rejected') console.log(`API call at index ${index} failed:`, result.reason.response?.data || result.reason.message);
            });
            const [playlists, artists, madeForYouPl, charts, newRels, genres, shows, parties, topTr, savedAlbs, madeForYouNew] = results;
            if (playlists.status === 'fulfilled') setUserPlaylists(playlists.value.data.items);
            if (artists.status === 'fulfilled') {
                const topArtistsData = artists.value.data.items;
                setTopArtists(topArtistsData);
                if (topArtistsData.length > 0) apiClient.get(`/recommendations?seed_artists=${topArtistsData[0].id}&limit=20`).then(res => setArtistRadioTracks(res.data.tracks.filter(Boolean))).catch(e => console.error("Failed to fetch artist radio", e));
            }
            if (madeForYouPl.status === 'fulfilled') setMadeForYouPlaylists(madeForYouPl.value.data.playlists.items);
            if (madeForYouNew.status === 'fulfilled') setMadeForYou(madeForYouNew.value.data.playlists.items);
            if (charts.status === 'fulfilled') setChartsPlaylists(charts.value.data.playlists.items);
            if (parties.status === 'fulfilled') setPartyPlaylists(parties.value.data.playlists.items);
            if (newRels.status === 'fulfilled') setNewReleases(newRels.value.data.albums.items);
            if (genres.status === 'fulfilled') setGenresCategories(genres.value.data.categories.items.map((c: any) => ({ ...c, type: 'category' })));
            if (shows.status === 'fulfilled') setRecommendedShows(shows.value.data.shows.items);
            if (topTr.status === 'fulfilled') {
                const tracks = topTr.value.data.items;
                setTopTracks(tracks);
                if (tracks.length >= 2) apiClient.get(`/recommendations?seed_tracks=${tracks.slice(0, 2).map((t: MediaItem) => t.id).join(',')}&limit=20`).then(res => setTrackRecommendations(res.data.tracks.filter(Boolean))).catch(e => console.error("Failed to fetch track recommendations", e));
            }
            if (savedAlbs.status === 'fulfilled') setSavedAlbums(savedAlbs.value.data.items.map((i: any) => i.album).filter(Boolean));
            setHasFetchedHomeContent(true);
        } catch (err: any) {
            setHomeContentError("Could not load content.");
        } finally {
            setHomeContentLoading(false);
        }
    }, [user, hasFetchedHomeContent]);

    useEffect(() => {
        if (user && startFetching && !hasFetchedHomeContent) {
            fetchRecentlyPlayed();
            fetchData();
        }
    }, [user, startFetching, hasFetchedHomeContent, fetchData, fetchRecentlyPlayed]);
    
    useEffect(() => {
        if (refreshTrigger > 0) {
            setHasFetchedHomeContent(false); // Allow refetch on trigger
            if (user && startFetching) {
                fetchRecentlyPlayed();
                fetchData();
            }
        }
    }, [refreshTrigger, user, startFetching, fetchData, fetchRecentlyPlayed]);

    const previousTrackUri = useRef<string | undefined>();
    const currentTrackUri = nowPlaying.spotifyState?.track_window.current_track?.uri;

    useEffect(() => {
        // Only trigger if the track URI has actually changed from the previous render
        // and if there is a new track URI (not null/undefined).
        if (currentTrackUri && currentTrackUri !== previousTrackUri.current) {
            // Only fetch if the player is open and has started fetching content.
            if (user && startFetching) {
                // A short delay gives Spotify's API time to register the new "recently played" track.
                // This is a good compromise between "immediacy" and "correctness", preventing a race condition.
                const timer = setTimeout(() => {
                    fetchRecentlyPlayed();
                }, 500);

                return () => clearTimeout(timer);
            }
        }
        
        // Update the ref for the next render.
        previousTrackUri.current = currentTrackUri;
    }, [currentTrackUri, fetchRecentlyPlayed, user, startFetching]);
    
    // --- End Data Fetching ---

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
            if (item.id === 'new-releases') {
                changeView({ type: 'new-releases' });
            } else {
                changeView({ type: 'categoryPlaylists', id: item.id, title: item.name });
            }
        } else if (item.type === 'track') {
            if (!isPlayerReady) return;
            if (item.context?.uri) {
                play({ context_uri: item.context.uri, offset: { uri: item.uri } });
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
                            onFollowChange={triggerDataRefresh}
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
                <h1 id="spotify-app-title" className="sr-only">Spotify App</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden relative">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default React.memo(SpotifyPlayer);