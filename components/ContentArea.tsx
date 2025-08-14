import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

interface SpotifyUser {
    display_name: string;
}

const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<SpotifyUser | null>(null);
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
    if (!isAuthenticated || !startFetching) {
      setLoading(!startFetching);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const topArtistsRes = await apiClient.get('/me/top/artists?limit=10&time_range=short_term');
        const artistsForCarousel = topArtistsRes.data.items;
        setTopArtists(artistsForCarousel);
        
        const artistSeed = artistsForCarousel.slice(0, 2).map((a: SpotifyItem) => a.id).join(',');

        const promises = [
            apiClient.get('/me'),
            apiClient.get('/me/playlists?limit=10'),
            apiClient.get('/me/player/recently-played?limit=10'),
            apiClient.get('/me/top/tracks?limit=10&time_range=medium_term'),
            apiClient.get('/browse/new-releases?country=IT&limit=10'),
            apiClient.get('/browse/featured-playlists?limit=10&country=IT'),
            apiClient.get('/recommendations?seed_genres=pop,rock,italian,indie&limit=10'),
        ];

        if (artistSeed) {
            promises.push(apiClient.get(`/recommendations?seed_artists=${artistSeed}&limit=10`));
        }

        const results = await Promise.all(promises.map(p => p.catch(e => e)));
        
        const [
            userRes,
            playlistsRes,
            recentRes,
            topTracksRes,
            newReleasesRes,
            featuredPlaylistsRes,
            genreRecsRes,
            artistRecsRes
        ] = results;

        if (userRes && !userRes.isAxiosError) setUser(userRes.data);
        if (playlistsRes && !playlistsRes.isAxiosError) setMyPlaylists(playlistsRes.data.items);
        if (recentRes && !recentRes.isAxiosError) setRecentlyPlayed(recentRes.data.items.map((item: any) => item.track).filter(Boolean));
        if (topTracksRes && !topTracksRes.isAxiosError) setTopTracks(topTracksRes.data.items);
        if (newReleasesRes && !newReleasesRes.isAxiosError) setNewReleases(newReleasesRes.data.albums.items);
        if (featuredPlaylistsRes && !featuredPlaylistsRes.isAxiosError) setFeaturedPlaylists(featuredPlaylistsRes.data.playlists.items);
        if (genreRecsRes && !genreRecsRes.isAxiosError) setGenreRecommendations(genreRecsRes.data.tracks);
        if (artistRecsRes && !artistRecsRes.isAxiosError) setArtistRecommendations(artistRecsRes.data.tracks);

      } catch (err: any) {
        console.error('Failed to fetch home page data', err);
        setError('Could not load content.');
        setUser(null);
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
  }, [isAuthenticated, startFetching]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour >= 4 && hour < 18 ? 'Buongiorno' : 'Buonasera';
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
        items={artistRecommendations} 
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
        items={genreRecommendations} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="genre-recs" 
      />}
    </div>
  );
};

export default ContentArea;
