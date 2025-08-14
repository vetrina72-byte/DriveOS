import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

// Special item for "Liked Songs"
const likedSongsSpecialItem: SpotifyItem = {
    id: 'liked-songs',
    name: 'Brani che ti piacciono',
    type: 'playlist',
    uri: 'special:liked-songs',
    description: 'I brani che hai salvato.',
};

// Helper to get day of the week in Italian
const getDayOfWeekInItalian = () => {
    return new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(new Date());
};

// Helper for dynamic greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
};

// Main Component
const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // States for ALL 12 carousels
  const [recentlyPlayedContexts, setRecentlyPlayedContexts] = useState<SpotifyItem[]>([]);
  const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
  const [genreRecommendations, setGenreRecommendations] = useState<SpotifyItem[]>([]);
  const [userMixes, setUserMixes] = useState<SpotifyItem[]>([]);
  const [topTracksLongTerm, setTopTracksLongTerm] = useState<SpotifyItem[]>([]);
  const [spotifyMadePlaylists, setSpotifyMadePlaylists] = useState<SpotifyItem[]>([]);
  const [runningEraPlaylists, setRunningEraPlaylists] = useState<SpotifyItem[]>([]);
  const [artistRecommendations, setArtistRecommendations] = useState<SpotifyItem[]>([]);
  const [topHitsPlaylists, setTopHitsPlaylists] = useState<SpotifyItem[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<{ mainArtistName: string; artists: SpotifyItem[] } | null>(null);
  const [basedOnRecentPlaylists, setBasedOnRecentPlaylists] = useState<SpotifyItem[]>([]);
  const [partyPlaylists, setPartyPlaylists] = useState<SpotifyItem[]>([]);

  // Memoized processing for recently played items to extract contexts
  const processRecentlyPlayed = useCallback(async (items: any[]) => {
      // Logic to find unique album/playlist contexts from recently played tracks
      const uniqueContexts = new Map<string, { id: string; type: 'playlist' | 'album' }>();
      let likedSongsPlayed = false;

      for (const item of items) {
          if (item.context && (item.context.type === 'playlist' || item.context.type === 'album')) {
              if (!uniqueContexts.has(item.context.uri)) {
                  uniqueContexts.set(item.context.uri, {
                      id: item.context.uri.split(':').pop()!,
                      type: item.context.type,
                  });
              }
          } else if (!item.context) { // A track played without context is often a liked song
              likedSongsPlayed = true;
          }
      }

      // Fetch full details for each unique context
      const contextFetchPromises = Array.from(uniqueContexts.values()).map(ctx =>
          apiClient.get(`/${ctx.type}s/${ctx.id}`).catch(() => null)
      );

      const contextDetailsResponses = await Promise.all(contextFetchPromises);
      let validContexts: SpotifyItem[] = contextDetailsResponses.map(res => res?.data).filter(Boolean);

      // Add the special "Liked Songs" item if applicable
      if (likedSongsPlayed) {
          validContexts.unshift(likedSongsSpecialItem);
      }

      setRecentlyPlayedContexts(validContexts.slice(0, 10)); // Limit to a reasonable number
  }, []);

  // The main data fetching function
  const fetchData = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
          // Promise.all for non-dependent API calls
          const [
              recentRes,
              newReleasesRes,
              topArtistsRes,
              userPlaylistsRes,
              topTracksRes,
              topHitsRes,
              workoutPlaylistsRes,
              partyPlaylistsRes,
          ] = await Promise.all([
              apiClient.get('/me/player/recently-played?limit=50'),
              apiClient.get('/browse/new-releases?country=IT&limit=20'),
              apiClient.get('/me/top/artists?limit=5&time_range=medium_term'),
              apiClient.get('/me/playlists?limit=50'),
              apiClient.get('/me/top/tracks?limit=20&time_range=long_term'),
              apiClient.get('/browse/categories/toplists/playlists?country=IT&limit=10'),
              apiClient.get('/browse/categories/workout/playlists?country=IT&limit=10'),
              apiClient.get('/browse/categories/party/playlists?country=IT&limit=10'),
          ].map(p => p.catch(e => e))); // This ensures one failure doesn't stop others

          // Process results from the first batch
          if (newReleasesRes && !newReleasesRes.isAxiosError) setNewReleases(newReleasesRes.data.albums.items);
          if (topTracksRes && !topTracksRes.isAxiosError) {
              // BUG FIX: Ensure track items have album art for PlaylistItem
              const mappedTracks = topTracksRes.data.items.map((track: any) => ({ ...track, images: track.album?.images }));
              setTopTracksLongTerm(mappedTracks);
          }
          if (topHitsRes && !topHitsRes.isAxiosError) setTopHitsPlaylists(topHitsRes.data.playlists.items);
          if (workoutPlaylistsRes && !workoutPlaylistsRes.isAxiosError) setRunningEraPlaylists(workoutPlaylistsRes.data.playlists.items);
          if (partyPlaylistsRes && !partyPlaylistsRes.isAxiosError) setPartyPlaylists(partyPlaylistsRes.data.playlists.items);

          if (userPlaylistsRes && !userPlaylistsRes.isAxiosError) {
              const allPlaylists = userPlaylistsRes.data.items;
              setUserMixes(allPlaylists.filter((p: SpotifyItem) => p.name.toLowerCase().includes('mix')));
              setSpotifyMadePlaylists(allPlaylists.filter((p: any) => p.owner.id === 'spotify'));
          }
          
          // Batch of dependent API calls
          const dependentPromises = [];

          // Process recently played for contexts and recommendations
          if (recentRes && !recentRes.isAxiosError && recentRes.data.items) {
              dependentPromises.push(processRecentlyPlayed(recentRes.data.items));
              const recentTrackIds = recentRes.data.items.map((item: any) => item.track?.id).filter(Boolean).slice(0, 5).join(',');
              if (recentTrackIds) {
                  dependentPromises.push(
                      apiClient.get(`/recommendations?seed_tracks=${recentTrackIds}&limit=10`)
                          .then(res => setBasedOnRecentPlaylists(res.data.tracks.map((track: any) => ({ ...track, images: track.album?.images }))))
                          .catch(() => {}) // Don't let this specific one fail the batch
                  );
              }
          }

          // Process top artists for recommendations and related artists
          const topArtists = topArtistsRes?.data?.items;
          if (topArtists && topArtists.length > 0) {
              const artistSeed = topArtists.slice(0, 1).map((a: SpotifyItem) => a.id).join(',');
              dependentPromises.push(
                  apiClient.get(`/recommendations?seed_artists=${artistSeed}&limit=10`)
                      .then(res => setArtistRecommendations(res.data.tracks.map((track: any) => ({ ...track, images: track.album?.images }))))
                      .catch(() => {})
              );
              dependentPromises.push(
                  apiClient.get(`/artists/${topArtists[0].id}/related-artists`)
                      .then(res => setRelatedArtists({ mainArtistName: topArtists[0].name, artists: res.data.artists }))
                      .catch(() => {})
              );
          }
          
          // Get generic recommendations based on genres
          dependentPromises.push(
              apiClient.get('/recommendations?seed_genres=pop,rock,italian,indie&limit=10')
                  .then(res => setGenreRecommendations(res.data.tracks.map((track: any) => ({ ...track, images: track.album?.images }))))
                  .catch(() => {})
          );
          
          await Promise.all(dependentPromises);

      } catch (err: any) {
          console.error('Failed to fetch home page data', err);
          setError('Could not load content.');
          // Reset all states on critical error to prevent crashes
          setRecentlyPlayedContexts([]);
          setNewReleases([]);
          setGenreRecommendations([]);
          setUserMixes([]);
          setTopTracksLongTerm([]);
          setSpotifyMadePlaylists([]);
          setRunningEraPlaylists([]);
          setArtistRecommendations([]);
          setTopHitsPlaylists([]);
          setRelatedArtists(null);
          setBasedOnRecentPlaylists([]);
          setPartyPlaylists([]);
      } finally {
          setLoading(false);
      }
  }, [user, processRecentlyPlayed]);

  // Effect to trigger data fetching
  useEffect(() => {
      if (user && startFetching) {
          fetchData();
      } else {
          setLoading(!startFetching);
      }
  }, [user, startFetching, fetchData]);
  
  // UI related constants
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  const greeting = getGreeting();
  const dayOfWeek = useMemo(getDayOfWeekInItalian, []);

  // Loading state
  if (loading) {
      return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  // Error state
  if (error) {
      return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  // Structure the carousels exactly as requested
  const carousels = [
    { title: "Ritorna ad ascoltare", items: recentlyPlayedContexts, keyPrefix: "recent-context" },
    { title: `Le novità di questo ${dayOfWeek}`, items: newReleases, keyPrefix: "new-releases" },
    { title: "Le tue stazioni consigliate", items: genreRecommendations, keyPrefix: "genre-recs" },
    { title: "I tuoi mix preferiti", items: userMixes, keyPrefix: "user-mixes" },
    { title: "Un tuffo nel passato", items: topTracksLongTerm, keyPrefix: "top-tracks" },
    user?.display_name && { title: `Creato per ${user.display_name}`, items: spotifyMadePlaylists, keyPrefix: "made-for-you" },
    { title: "Nella tua running era", items: runningEraPlaylists, keyPrefix: "running" },
    { title: "Altro di ciò che ti piace", items: artistRecommendations, keyPrefix: "artist-recs" },
    { title: "I più grandi successi di oggi", items: topHitsPlaylists, keyPrefix: "top-hits" },
    relatedArtists && { title: `Per i fan di ${relatedArtists.mainArtistName}`, items: relatedArtists.artists.map(a => ({...a, description: 'Artista'})), keyPrefix: "related-artists" },
    { title: "In base a ciò che hai ascoltato di recente", items: basedOnRecentPlaylists, keyPrefix: "based-on-recent" },
    { title: "Party", items: partyPlaylists, keyPrefix: "party" }
  ].filter(Boolean) as { title: string; items: SpotifyItem[]; keyPrefix: string; }[]; // Filter out false values (e.g., if user is not defined)

  // Render the component
  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      {/* Dynamic Greeting */}
      <h1 className="text-3xl font-bold mb-8 px-6">{greeting}, {user?.display_name}!</h1>
      
      {/* Render all carousels conditionally */}
      {carousels.map(carousel => (
        carousel.items && carousel.items.length > 0 && (
            <ContentCarousel 
                key={carousel.keyPrefix}
                title={carousel.title} 
                items={carousel.items} 
                isNight={isNight} 
                onSelectItem={onSelectItem} 
                keyPrefix={carousel.keyPrefix}
            />
        )
      ))}
    </div>
  );
};

export default ContentArea;
