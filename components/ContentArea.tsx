
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

// Main Component
const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // States for each curated section
  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifyItem[]>([]);
  const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<SpotifyItem[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyItem[]>([]);
  const [toplistsPlaylists, setToplistsPlaylists] = useState<SpotifyItem[]>([]);
  const [workoutPlaylists, setWorkoutPlaylists] = useState<SpotifyItem[]>([]);
  const [partyPlaylists, setPartyPlaylists] = useState<SpotifyItem[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<{ artistName: string; items: SpotifyItem[] }>({ artistName: '', items: [] });
  const [recommendations, setRecommendations] = useState<SpotifyItem[]>([]);
  
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // Reset all states to prevent showing old data on re-fetch
    setRecentlyPlayed([]);
    setNewReleases([]);
    setUserPlaylists([]);
    setTopTracks([]);
    setToplistsPlaylists([]);
    setWorkoutPlaylists([]);
    setPartyPlaylists([]);
    setRelatedArtists({ artistName: '', items: [] });
    setRecommendations([]);

    try {
        const promises = [
            apiClient.get('/me/player/recently-played?limit=10'),
            apiClient.get('/browse/new-releases?country=IT&limit=10'),
            apiClient.get('/me/top/artists?limit=1'),
            apiClient.get('/me/playlists?limit=20'),
            apiClient.get('/me/top/tracks?limit=10&time_range=long_term'),
            apiClient.get('/browse/categories/toplists/playlists?country=IT&limit=10'),
            apiClient.get('/browse/categories/workout/playlists?country=IT&limit=10'),
            apiClient.get('/browse/categories/party/playlists?country=IT&limit=10'),
        ];

        const results = await Promise.allSettled(promises);

        const [
            recentlyPlayedRes,
            newReleasesRes,
            topArtistsRes,
            userPlaylistsRes,
            topTracksRes,
            toplistsPlaylistsRes,
            workoutPlaylistsRes,
            partyPlaylistsRes,
        ] = results;

        // Process results safely
        if (recentlyPlayedRes.status === 'fulfilled' && recentlyPlayedRes.value.data) {
            setRecentlyPlayed(recentlyPlayedRes.value.data.items.map((item: any) => item.track).filter(Boolean));
        } else {
            console.warn('Failed to fetch recently played:', recentlyPlayedRes.status === 'rejected' && recentlyPlayedRes.reason);
            setRecentlyPlayed([]);
        }

        if (newReleasesRes.status === 'fulfilled' && newReleasesRes.value.data) {
            setNewReleases(newReleasesRes.value.data.albums.items);
        } else {
            console.warn('Failed to fetch new releases:', newReleasesRes.status === 'rejected' && newReleasesRes.reason);
            setNewReleases([]);
        }

        if (userPlaylistsRes.status === 'fulfilled' && userPlaylistsRes.value.data) {
            setUserPlaylists(userPlaylistsRes.value.data.items);
        } else {
            console.warn('Failed to fetch user playlists:', userPlaylistsRes.status === 'rejected' && userPlaylistsRes.reason);
            setUserPlaylists([]);
        }
        
        if (topTracksRes.status === 'fulfilled' && topTracksRes.value.data) {
            setTopTracks(topTracksRes.value.data.items);
        } else {
            console.warn('Failed to fetch top tracks:', topTracksRes.status === 'rejected' && topTracksRes.reason);
            setTopTracks([]);
        }

        if (toplistsPlaylistsRes.status === 'fulfilled' && toplistsPlaylistsRes.value.data) {
            setToplistsPlaylists(toplistsPlaylistsRes.value.data.playlists.items);
        } else {
            console.warn('Failed to fetch toplists:', toplistsPlaylistsRes.status === 'rejected' && toplistsPlaylistsRes.reason);
            setToplistsPlaylists([]);
        }

        if (workoutPlaylistsRes.status === 'fulfilled' && workoutPlaylistsRes.value.data) {
            setWorkoutPlaylists(workoutPlaylistsRes.value.data.playlists.items);
        } else {
            console.warn('Failed to fetch workout playlists:', workoutPlaylistsRes.status === 'rejected' && workoutPlaylistsRes.reason);
            setWorkoutPlaylists([]);
        }

        if (partyPlaylistsRes.status === 'fulfilled' && partyPlaylistsRes.value.data) {
            setPartyPlaylists(partyPlaylistsRes.value.data.playlists.items);
        } else {
            console.warn('Failed to fetch party playlists:', partyPlaylistsRes.status === 'rejected' && partyPlaylistsRes.reason);
            setPartyPlaylists([]);
        }

        // --- Dependent API Calls ---

        // 1. Fetch related artists based on the user's top artist
        if (topArtistsRes.status === 'fulfilled' && topArtistsRes.value.data) {
            const topArtist = topArtistsRes.value.data?.items?.[0];
            if (topArtist) {
                try {
                    const relatedArtistsRes = await apiClient.get(`/artists/${topArtist.id}/related-artists`);
                    setRelatedArtists({
                        artistName: topArtist.name,
                        items: relatedArtistsRes.data.artists,
                    });
                } catch (e) {
                    console.warn('Failed to fetch related artists', e);
                    setRelatedArtists({ artistName: '', items: [] });
                }
            }
        } else {
             console.warn('Could not get top artist to find related artists:', topArtistsRes.status === 'rejected' && topArtistsRes.reason);
             setRelatedArtists({ artistName: '', items: [] });
        }


        // 2. Fetch recommendations based on recently played tracks
        if (recentlyPlayedRes.status === 'fulfilled' && recentlyPlayedRes.value.data) {
            const recentTrackIds = recentlyPlayedRes.value.data.items
                .map((item: any) => item.track?.id)
                .filter(Boolean)
                .slice(0, 2);
            
            if (recentTrackIds && recentTrackIds.length > 0) {
                try {
                    const recommendationsRes = await apiClient.get(`/recommendations?seed_tracks=${recentTrackIds.join(',')}&limit=10`);
                    setRecommendations(recommendationsRes.data.tracks);
                } catch (e) {
                    console.warn('Failed to fetch recommendations', e);
                    setRecommendations([]);
                }
            }
        } else {
            setRecommendations([]);
        }

    } catch (err: any) {
        // This catch block will now only catch truly critical errors, not individual API failures.
        console.error("Errore critico non gestito durante il caricamento della Home:", err);
        setError("Impossibile caricare i contenuti. Riprova più tardi.");
    } finally {
        setLoading(false);
    }
}, [user]);

  useEffect(() => {
      if (user && startFetching) {
          fetchData();
      } else {
          setLoading(!startFetching);
      }
  }, [user, startFetching, fetchData]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  const greeting = getGreeting();
  const dayOfWeek = new Date().toLocaleDateString('it-IT', { weekday: 'long' });

  // Filtered playlists from the main userPlaylists call
  const spotifyPlaylists = userPlaylists.filter(p => p.owner?.display_name === 'Spotify');
  const userMixes = userPlaylists.filter(p => p.name.toLowerCase().includes('mix'));

  if (loading) {
      return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
      return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <h1 className="text-3xl font-bold mb-8 px-6">{greeting}, {user?.display_name}!</h1>
      
      {recentlyPlayed.length > 0 && (
          <ContentCarousel title="Ritorna ad ascoltare" items={recentlyPlayed} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="recently-played" />
      )}
      {newReleases.length > 0 && (
          <ContentCarousel title={`Le novità del ${dayOfWeek}`} items={newReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new-releases" />
      )}
      {userMixes.length > 0 && (
          <ContentCarousel title="I tuoi mix preferiti" items={userMixes} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="user-mixes" />
      )}
      {topTracks.length > 0 && (
          <ContentCarousel title="Un tuffo nel passato" items={topTracks} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-tracks" />
      )}
      {spotifyPlaylists.length > 0 && (
          <ContentCarousel title={`Creato per ${user?.display_name}`} items={spotifyPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="spotify-playlists" />
      )}
      {workoutPlaylists.length > 0 && (
          <ContentCarousel title="Nella tua running era" items={workoutPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="workout" />
      )}
      {relatedArtists.items.length > 0 && (
          <ContentCarousel title={`Per i fan di ${relatedArtists.artistName}`} items={relatedArtists.items} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="related-artists" />
      )}
      {toplistsPlaylists.length > 0 && (
          <ContentCarousel title="I più grandi successi di oggi" items={toplistsPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="toplists" />
      )}
      {recommendations.length > 0 && (
          <ContentCarousel title="In base a ciò che hai ascoltato di recente" items={recommendations} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="recommendations" />
      )}
      {partyPlaylists.length > 0 && (
          <ContentCarousel title="Party" items={partyPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="party" />
      )}
      {userPlaylists.length > 0 && (
          <ContentCarousel title="Le tue playlist" items={userPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="user-playlists" />
      )}
    </div>
  );
};

export default ContentArea;
