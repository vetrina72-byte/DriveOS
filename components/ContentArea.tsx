import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user } = useAuth();
  const [myPlaylists, setMyPlaylists] = useState<SpotifyItem[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifyItem[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyItem[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyItem[]>([]);
  const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<SpotifyItem[]>([]);
  const [genreRecommendations, setGenreRecommendations] = useState<SpotifyItem[]>([]);
  const [artistRecommendations, setArtistRecommendations] = useState<SpotifyItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !startFetching) {
      setLoading(!startFetching);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const topArtistsResponse = await apiClient.get('/me/top/artists?limit=10&time_range=short_term');
        const artistsForSeed = topArtistsResponse.data.items;
        setTopArtists(artistsForSeed);
        
        const artistSeed = artistsForSeed.slice(0, 2).map((a: SpotifyItem) => a.id).join(',');

        const promises = [
          apiClient.get('/me/playlists?limit=10'), // 0
          apiClient.get('/me/player/recently-played?limit=10'), // 1
          apiClient.get('/me/top/tracks?limit=10&time_range=medium_term'), // 2
          apiClient.get('/browse/new-releases?country=IT&limit=10'), // 3
          apiClient.get('/browse/featured-playlists?limit=10&country=IT'), // 4
          apiClient.get('/recommendations?seed_genres=pop,rock,italian,indie&limit=10'), // 5
        ];
        
        if (artistSeed) {
          promises.push(apiClient.get(`/recommendations?seed_artists=${artistSeed}&limit=10`)); // 6
        }

        const results = await Promise.all(promises.map(p => p.catch(e => e)));
        
        const [
            playlistsRes,
            recentRes,
            topTracksRes,
            newReleasesRes,
            featuredPlaylistsRes,
            genreRecsRes,
            artistRecsRes
        ] = results;

        if (playlistsRes && !playlistsRes.isAxiosError) setMyPlaylists(playlistsRes.data.items);
        
        if (recentRes && !recentRes.isAxiosError) {
          const processedRecents = recentRes.data.items.map((item: any) => {
            if (!item.track) return null;
            let contextText = `Dall'album: ${item.track.album.name}`;
            if (item.context && item.context.type === 'playlist') {
                // In a real app, we might fetch the playlist name here, but for speed we'll use a generic text.
                contextText = 'Da una delle tue playlist';
            }
            return {
              ...item.track,
              images: item.track.album?.images,
              description: contextText // Use description to show context
            };
          }).filter(Boolean);
          setRecentlyPlayed(processedRecents);
        }

        if (topTracksRes && !topTracksRes.isAxiosError) {
            const normalizedTracks = topTracksRes.data.items.map((track: any) => ({
                ...track,
                images: track.album?.images,
            }));
            setTopTracks(normalizedTracks);
        }

        if (newReleasesRes && !newReleasesRes.isAxiosError) setNewReleases(newReleasesRes.data.albums.items);
        if (featuredPlaylistsRes && !featuredPlaylistsRes.isAxiosError) setFeaturedPlaylists(featuredPlaylistsRes.data.playlists.items);
        if (genreRecsRes && !genreRecsRes.isAxiosError) setGenreRecommendations(genreRecsRes.data.tracks);
        if (artistRecsRes && !artistRecsRes.isAxiosError) setArtistRecommendations(artistRecsRes.data.tracks);

      } catch (err: any) {
        console.error('Failed to fetch home page data', err);
        setError('Could not load content.');
        setMyPlaylists([]);
        setRecentlyPlayed([]);
        setTopArtists([]);
        setTopTracks([]);
        setNewReleases([]);
        setFeaturedPlaylists([]);
        setGenreRecommendations([]);
        setArtistRecommendations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, startFetching]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Buongiorno';
    if (hour >= 12 && hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };
  
  const greeting = user ? `${getGreeting()}, ${user.display_name}` : getGreeting();

  if (loading) {
    return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
    return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      {featuredPlaylists.length > 0 && <ContentCarousel 
        title={greeting}
        items={featuredPlaylists} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="greeting" 
      />}
      {recentlyPlayed.length > 0 && <ContentCarousel 
        title="Ritorna ad ascoltare"
        items={recentlyPlayed} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="recent" 
      />}
       {newReleases.length > 0 && <ContentCarousel 
        title="I più grandi successi di oggi"
        items={newReleases} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="new" 
      />}
       {myPlaylists.length > 0 && <ContentCarousel 
        title="Creato per te"
        items={myPlaylists} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="my-playlists" 
      />}
      {artistRecommendations.length > 0 && <ContentCarousel 
        title="Altro di ciò che ti piace"
        items={artistRecommendations.map((t: any) => ({...t, images: t.album?.images}))}
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="artist-recs" 
      />}
      {topArtists.length > 0 && <ContentCarousel 
        title="I tuoi artisti del momento"
        items={topArtists.map(item => ({...item, description: "Artista"}))} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="top-artists" 
      />}
      {topTracks.length > 0 && <ContentCarousel 
        title="Un tuffo nel passato"
        items={topTracks} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="top-tracks" 
      />}
      {genreRecommendations.length > 0 && <ContentCarousel 
        title="Stazioni consigliate"
        items={genreRecommendations.map((t: any) => ({...t, images: t.album?.images}))} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="genre-recs" 
      />}
    </div>
  );
};

export default ContentArea;