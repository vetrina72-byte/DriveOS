import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

// Helper for dynamic greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
};

const processRecentPlays = async (items: any[]): Promise<SpotifyItem[]> => {
    const unifiedList: SpotifyItem[] = [];
    const addedUris = new Set<string>();
    const contextDetailsCache = new Map<string, SpotifyItem>();

    // Special item for "Liked Songs"
    const likedSongsItem: SpotifyItem = {
        id: 'liked-songs',
        name: 'Brani che ti piacciono',
        type: 'playlist',
        uri: 'special:liked-songs', // Use a unique URI for our internal tracking
        description: 'La tua collezione personale di brani preferiti.',
        images: [{ url: 'liked-songs-cover' }],
    };

    // Pre-fetch all unique contexts to avoid duplicate fetches and improve efficiency
    const contextUrisToFetch = [...new Set(
        items.filter(item => item.context?.uri && (item.context.type === 'album' || item.context.type === 'playlist'))
             .map(item => item.context.uri)
    )] as string[];

    if (contextUrisToFetch.length > 0) {
        const albumIds = contextUrisToFetch.filter(uri => uri.includes(':album:')).map(uri => uri.split(':')[2]);
        const playlistIds = contextUrisToFetch.filter(uri => uri.includes(':playlist:')).map(uri => uri.split(':')[2]);

        const promises = [];
        if (albumIds.length > 0) {
            promises.push(
                apiClient.get(`/albums?ids=${albumIds.join(',')}`).then(res => {
                    res.data.albums.forEach((album: any) => {
                        if (album) contextDetailsCache.set(album.uri, album);
                    });
                }).catch(e => console.error("Failed fetching album details", e))
            );
        }
         if (playlistIds.length > 0) {
            const playlistPromises = playlistIds.map(id => 
                apiClient.get(`/playlists/${id}`).then(res => {
                    contextDetailsCache.set(res.data.uri, res.data);
                }).catch(e => console.error(`Failed to fetch playlist ${id}`, e))
            );
            promises.push(Promise.all(playlistPromises));
        }
        await Promise.all(promises);
    }

    // Iterate through the original recently played items to build the final list
    for (const item of items) {
        if (!item.track) continue;

        let itemToAdd: SpotifyItem | null = null;

        // CRITICAL FIX: Explicitly check for "Liked Songs" context first.
        if (item.context?.type === 'collection') {
            itemToAdd = likedSongsItem;
        } 
        // If the track was played in a valid context (album/playlist) that we successfully fetched, use the context.
        else if (item.context?.uri && contextDetailsCache.has(item.context.uri)) {
            itemToAdd = contextDetailsCache.get(item.context.uri)!;
        } else {
            // Otherwise, fallback to showing the track itself.
            itemToAdd = item.track;
        }

        // Add the determined item to our list, ensuring no duplicates.
        if (itemToAdd && itemToAdd.uri && !addedUris.has(itemToAdd.uri)) {
            unifiedList.push(itemToAdd);
            addedUris.add(itemToAdd.uri);
        }
    }
    
    return unifiedList.slice(0, 10); // Limit to a reasonable number of items
};


// Main Component
const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user, refreshTrigger } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  
  // States for each curated section
  const [continueListeningItems, setContinueListeningItems] = useState<SpotifyItem[]>([]);
  const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<SpotifyItem[]>([]);
  const [madeForYouPlaylists, setMadeForYouPlaylists] = useState<SpotifyItem[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyItem[]>([]);
  const [chartsPlaylists, setChartsPlaylists] = useState<SpotifyItem[]>([]);
  const [genresCategories, setGenresCategories] = useState<SpotifyItem[]>([]);
  const [recommendedShows, setRecommendedShows] = useState<SpotifyItem[]>([]);

  
  const fetchData = useCallback(async () => {
    if (!user) return;
    if (!hasFetchedOnce) {
        setLoading(true);
    }
    setError(null);

    // Reset states to ensure fresh data on re-fetch
    setContinueListeningItems([]);
    setNewReleases([]);
    setUserPlaylists([]);
    setMadeForYouPlaylists([]);
    setTopArtists([]);
    setChartsPlaylists([]);
    setGenresCategories([]);
    setRecommendedShows([]);


    try {
      const randomOffset = Math.floor(Math.random() * 20);
      const madeForYouCategoryId = '0JQ5DAqbMKF2JckPAnMAhA';
      
      const promises = [
        apiClient.get('/me/player/recently-played?limit=50'), // For Continue Listening
        apiClient.get('/me/playlists?limit=10'), // For User Playlists
        apiClient.get('/me/top/artists?time_range=medium_term&limit=10'), // For Top Artists
        apiClient.get(`/browse/categories/${madeForYouCategoryId}/playlists?country=IT&limit=10`), // For Made For You
        apiClient.get('/browse/categories/toplists/playlists?country=IT&limit=10'), // For Charts
        apiClient.get(`/browse/new-releases?country=IT&limit=10&offset=${randomOffset}`), // For New Releases
        apiClient.get('/browse/categories?country=IT&limit=20'), // For Genres
        apiClient.get('/search?q=podcast&type=show&market=IT&limit=10') // For Podcasts
      ];

      const results = await Promise.allSettled(promises);

      const [
          recentlyPlayedRes,
          userPlaylistsRes,
          topArtistsRes,
          madeForYouRes,
          chartsRes,
          newReleasesRes,
          genresRes,
          showsRes
      ] = results;

      if (recentlyPlayedRes.status === 'fulfilled' && recentlyPlayedRes.value.data.items) {
          const processedItems = await processRecentPlays(recentlyPlayedRes.value.data.items);
          setContinueListeningItems(processedItems);
      }
      if (userPlaylistsRes.status === 'fulfilled' && userPlaylistsRes.value.data.items) {
          setUserPlaylists(userPlaylistsRes.value.data.items);
      }
      if (topArtistsRes.status === 'fulfilled' && topArtistsRes.value.data.items) {
          setTopArtists(topArtistsRes.value.data.items);
      }
       if (madeForYouRes.status === 'fulfilled' && madeForYouRes.value.data.playlists) {
          setMadeForYouPlaylists(madeForYouRes.value.data.playlists.items);
      }
      if (chartsRes.status === 'fulfilled' && chartsRes.value.data.playlists) {
          setChartsPlaylists(chartsRes.value.data.playlists.items);
      }
      if (newReleasesRes.status === 'fulfilled' && newReleasesRes.value.data.albums) {
          setNewReleases(newReleasesRes.value.data.albums.items);
      }
      if (genresRes.status === 'fulfilled' && genresRes.value.data.categories) {
           const mappedCategories = genresRes.value.data.categories.items.map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                uri: cat.href,
                images: cat.icons,
                type: 'category',
            }));
          setGenresCategories(mappedCategories);
      }
      if (showsRes.status === 'fulfilled' && showsRes.value.data.shows) {
          setRecommendedShows(showsRes.value.data.shows.items);
      }

    } catch (err: any) {
        console.error("Critical error fetching home content:", err);
        setError("Could not load content. Please try again later.");
    } finally {
        setLoading(false);
        setHasFetchedOnce(true);
    }
}, [user, hasFetchedOnce]);

  useEffect(() => {
      if (user && startFetching) {
          fetchData();
      }
  }, [user, startFetching, fetchData, refreshTrigger]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  const greeting = getGreeting();

  if (loading) {
      return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
      return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <h1 
        className="text-3xl font-bold mb-8 px-6"
        style={{ color: 'var(--heading-color)' }}
      >
        {greeting}, {user?.display_name}!
      </h1>
      
      {continueListeningItems.length > 0 && (
          <ContentCarousel title="Continua ad ascoltare" items={continueListeningItems} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="continue-listening" />
      )}
       {madeForYouPlaylists.length > 0 && (
          <ContentCarousel title="Le playlist create per te" items={madeForYouPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="made-for-you" />
      )}
      {userPlaylists.length > 0 && (
          <ContentCarousel title="Le tue playlist" items={userPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="user-playlists" />
      )}
      {chartsPlaylists.length > 0 && (
          <ContentCarousel title="Classifiche" items={chartsPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="charts" />
      )}
      {topArtists.length > 0 && (
          <ContentCarousel title="I tuoi artisti del momento" items={topArtists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-artists" />
      )}
      {newReleases.length > 0 && (
          <ContentCarousel title="Nuove uscite" items={newReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new-releases" />
      )}
      {recommendedShows.length > 0 && (
          <ContentCarousel title="Podcast consigliati" items={recommendedShows} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="rec-shows" />
      )}
      {genresCategories.length > 0 && (
          <ContentCarousel title="Esplora per generi e mood" items={genresCategories} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="genres" />
      )}
    </div>
  );
};

export default ContentArea;
