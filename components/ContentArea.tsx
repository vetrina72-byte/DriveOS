import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

// Helper for dynamic greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
};

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
  const [partyPlaylists, setPartyPlaylists] = useState<SpotifyItem[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyItem[]>([]);
  const [artistRadioTracks, setArtistRadioTracks] = useState<SpotifyItem[]>([]);
  const [trackRecommendations, setTrackRecommendations] = useState<SpotifyItem[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<SpotifyItem[]>([]);
  const [madeForYou, setMadeForYou] = useState<SpotifyItem[]>([]);

  
  const fetchData = useCallback(async () => {
    if (!user) return;
    if (!hasFetchedOnce) {
        setLoading(true);
    }
    setError(null);

    try {
      const randomOffset = Math.floor(Math.random() * 20);
      
      const promises = [
        apiClient.get('/me/player/recently-played?limit=50'),
        apiClient.get('/me/playlists?limit=10'),
        apiClient.get('/me/top/artists?time_range=medium_term&limit=10'),
        apiClient.get(`/browse/categories/0JQ5DAqbMKF2JckPAnMAhA/playlists?country=IT&limit=10`), // Existing "Made For You"
        apiClient.get('/browse/categories/toplists/playlists?country=IT&limit=10'),
        apiClient.get(`/browse/new-releases?country=IT&limit=10&offset=${randomOffset}`),
        apiClient.get('/browse/categories?country=IT&limit=20'),
        apiClient.get('/search?q=podcast&type=show&market=IT&limit=10'),
        apiClient.get('/browse/categories/party/playlists?country=IT&limit=10'),
        apiClient.get('/me/top/tracks?limit=20&time_range=long_term'),
        apiClient.get('/me/albums?limit=10'),
        apiClient.get('/browse/categories/0JQ5DAt0tbjZptfcdMSKl3/playlists?country=IT&limit=10'), // New "Realizzato per te"
      ];

      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.log(`API call at index ${index} failed:`, result.reason.response?.data || result.reason.message);
        }
      });

      const [
          recentlyPlayedRes,
          userPlaylistsRes,
          topArtistsRes,
          madeForYouPlaylistsRes,
          chartsRes,
          newReleasesRes,
          genresRes,
          showsRes,
          partyPlaylistsRes,
          topTracksRes,
          savedAlbumsRes,
          madeForYouRes,
      ] = results;

      if (recentlyPlayedRes.status === 'fulfilled' && recentlyPlayedRes.value.data.items) {
          const processedItems = await processRecentPlays(recentlyPlayedRes.value.data.items);
          setContinueListeningItems(processedItems);
      }
      if (userPlaylistsRes.status === 'fulfilled' && userPlaylistsRes.value.data.items) {
          setUserPlaylists(userPlaylistsRes.value.data.items);
      }
      if (topArtistsRes.status === 'fulfilled' && topArtistsRes.value.data.items) {
          const artists = topArtistsRes.value.data.items;
          setTopArtists(artists);
          if (artists.length > 0) {
              const topArtistId = artists[0].id;
              apiClient.get(`/recommendations?seed_artists=${topArtistId}&limit=20`)
                  .then(res => setArtistRadioTracks(res.data.tracks.filter(Boolean)))
                  .catch(e => console.error("Failed to fetch artist radio", e));
          }
      }
       if (madeForYouPlaylistsRes.status === 'fulfilled' && madeForYouPlaylistsRes.value.data.playlists) {
          setMadeForYouPlaylists(madeForYouPlaylistsRes.value.data.playlists.items);
      }
       if (madeForYouRes.status === 'fulfilled' && madeForYouRes.value.data.playlists) {
          setMadeForYou(madeForYouRes.value.data.playlists.items);
      }
      if (chartsRes.status === 'fulfilled' && chartsRes.value.data.playlists) {
          setChartsPlaylists(chartsRes.value.data.playlists.items);
      }
       if (partyPlaylistsRes.status === 'fulfilled' && partyPlaylistsRes.value.data.playlists) {
          setPartyPlaylists(partyPlaylistsRes.value.data.playlists.items);
      }
      if (newReleasesRes.status === 'fulfilled' && newReleasesRes.value.data.albums) {
          setNewReleases(newReleasesRes.value.data.albums.items);
      }
      if (genresRes.status === 'fulfilled' && genresRes.value.data.categories) {
           const mappedCategories = genresRes.value.data.categories.items.map((cat: any) => {
                // Sanitize the name to create better search terms for Unsplash.
                const searchKeywords = cat.name.toLowerCase()
                    .replace(/ & /g, ' and ') // Replace "&" with "and"
                    .replace(/[/ ]/g, '-');    // Replace slashes and spaces with hyphens
                
                // Construct the dynamic image URL.
                const imageUrl = `https://source.unsplash.com/400x400/?${searchKeywords},music`;
                
                return {
                    id: cat.id,
                    name: cat.name,
                    uri: cat.href,
                    type: 'category',
                    customImageUrl: imageUrl,
                };
            });
          setGenresCategories(mappedCategories);
      }
      if (showsRes.status === 'fulfilled' && showsRes.value.data.shows) {
          setRecommendedShows(showsRes.value.data.shows.items);
      }
      
      if (topTracksRes.status === 'fulfilled' && topTracksRes.value.data.items) {
          const tracks = topTracksRes.value.data.items;
          setTopTracks(tracks);
          if (tracks.length >= 2) {
              const seedTrackIds = tracks.slice(0, 2).map((track: SpotifyItem) => track.id).join(',');
              apiClient.get(`/recommendations?seed_tracks=${seedTrackIds}&limit=20`)
                  .then(res => setTrackRecommendations(res.data.tracks.filter(Boolean)))
                  .catch(e => console.error("Failed to fetch track recommendations", e));
          }
      }
      if (savedAlbumsRes.status === 'fulfilled' && savedAlbumsRes.value.data.items) {
          const albums = savedAlbumsRes.value.data.items.map((item: any) => item.album).filter(Boolean);
          setSavedAlbums(albums);
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
      return (
          <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
              <h1 className="text-3xl font-bold mb-8 px-6 text-transparent animate-pulse bg-gray-600/20 w-1/2 rounded-md h-9">.</h1>
              <SkeletonCarousel isNight={isNight} />
              <SkeletonCarousel isNight={isNight} />
              <SkeletonCarousel isNight={isNight} />
          </div>
      );
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
          <div key={`${refreshTrigger}-cl`} className="animate-fadeInUp" style={{ animationDelay: '100ms' }}>
              <ContentCarousel title="Continua ad ascoltare" items={continueListeningItems} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="continue-listening" />
          </div>
      )}
       {madeForYou.length > 0 && (
          <div key={`${refreshTrigger}-mfy-new`} className="animate-fadeInUp" style={{ animationDelay: '120ms' }}>
              <ContentCarousel title="Realizzato per te" items={madeForYou} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="made-for-you-new" />
          </div>
      )}
       {madeForYouPlaylists.length > 0 && (
          <div key={`${refreshTrigger}-mfy`} className="animate-fadeInUp" style={{ animationDelay: '150ms' }}>
              <ContentCarousel title="Le playlist create per te" items={madeForYouPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="made-for-you" />
          </div>
      )}
      {userPlaylists.length > 0 && (
          <div key={`${refreshTrigger}-up`} className="animate-fadeInUp" style={{ animationDelay: '200ms' }}>
              <ContentCarousel title="Le tue playlist" items={userPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="user-playlists" />
          </div>
      )}
      {chartsPlaylists.length > 0 && (
           <div key={`${refreshTrigger}-ch`} className="animate-fadeInUp" style={{ animationDelay: '250ms' }}>
              <ContentCarousel title="Classifiche" items={chartsPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="charts" />
          </div>
      )}
      {partyPlaylists.length > 0 && (
        <div key={`${refreshTrigger}-pp`} className="animate-fadeInUp" style={{ animationDelay: '280ms' }}>
            <ContentCarousel 
                title="Musica da cantare" 
                items={partyPlaylists} 
                isNight={isNight} 
                onSelectItem={onSelectItem} 
                keyPrefix="party-playlists" 
            />
        </div>
      )}
      {topArtists.length > 0 && (
          <div key={`${refreshTrigger}-ta`} className="animate-fadeInUp" style={{ animationDelay: '300ms' }}>
              <ContentCarousel title="I tuoi artisti del momento" items={topArtists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-artists" />
          </div>
      )}
      {newReleases.length > 0 && (
          <div key={`${refreshTrigger}-nr`} className="animate-fadeInUp" style={{ animationDelay: '350ms' }}>
              <ContentCarousel title="Nuove uscite" items={newReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new-releases" />
          </div>
      )}
      {recommendedShows.length > 0 && (
           <div key={`${refreshTrigger}-rs`} className="animate-fadeInUp" style={{ animationDelay: '400ms' }}>
              <ContentCarousel title="Podcast consigliati" items={recommendedShows} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="rec-shows" />
          </div>
      )}
      {topTracks.length > 0 && (
          <div key={`${refreshTrigger}-top-tracks`} className="animate-fadeInUp" style={{ animationDelay: '500ms' }}>
              <ContentCarousel title="Un tuffo nel passato" items={topTracks} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-tracks" />
          </div>
      )}
      {artistRadioTracks.length > 0 && topArtists.length > 0 && (
          <div key={`${refreshTrigger}-artist-radio`} className="animate-fadeInUp" style={{ animationDelay: '550ms' }}>
              <ContentCarousel title={`Radio di ${topArtists[0].name}`} items={artistRadioTracks} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="artist-radio" />
          </div>
      )}
      {trackRecommendations.length > 0 && (
          <div key={`${refreshTrigger}-track-recs`} className="animate-fadeInUp" style={{ animationDelay: '600ms' }}>
              <ContentCarousel title="Potrebbe piacerti anche" items={trackRecommendations} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="track-recs" />
          </div>
      )}
      {savedAlbums.length > 0 && (
          <div key={`${refreshTrigger}-saved-albums`} className="animate-fadeInUp" style={{ animationDelay: '650ms' }}>
              <ContentCarousel title="I tuoi album salvati" items={savedAlbums} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="saved-albums" />
          </div>
      )}
      {genresCategories.length > 0 && (
          <div key={`${refreshTrigger}-gc`} className="animate-fadeInUp" style={{ animationDelay: '450ms' }}>
              <ContentCarousel title="Esplora per generi e mood" items={genresCategories} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="genres" />
          </div>
      )}
    </div>
  );
};

export default ContentArea;