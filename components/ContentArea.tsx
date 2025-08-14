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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<SpotifyItem[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifyItem[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyItem[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyItem[]>([]);
  const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<SpotifyItem[]>([]);
  const [recommendationsByGenre, setRecommendationsByGenre] = useState<SpotifyItem[]>([]);
  const [recommendationsByArtist, setRecommendationsByArtist] = useState<SpotifyItem[]>([]);


  useEffect(() => {
    if (!isAuthenticated || !startFetching) {
      setLoading(!startFetching);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Step 1: Fetch primary data including top artists
        const [
            userRes,
            playlistsRes,
            recentRes,
            topArtistsRes,
            topTracksRes,
            newReleasesRes,
            featuredPlaylistsRes,
            genreRecsRes,
        ] = await Promise.all([
            apiClient.get('/me'),
            apiClient.get('/me/playlists?limit=10'),
            apiClient.get('/me/player/recently-played?limit=10'),
            apiClient.get('/me/top/artists?limit=10&time_range=short_term'),
            apiClient.get('/me/top/tracks?limit=10&time_range=medium_term'),
            apiClient.get('/browse/new-releases?country=IT&limit=10'),
            apiClient.get('/browse/featured-playlists?limit=10&country=IT'),
            apiClient.get('/recommendations?seed_genres=pop,rock,italian,indie&limit=10'),
        ]);

        setUser(userRes.data);
        setMyPlaylists(playlistsRes.data.items);
        setRecentlyPlayed(recentRes.data.items.map((item: any) => item.track).filter(Boolean));
        const fetchedTopArtists = topArtistsRes.data.items;
        setTopArtists(fetchedTopArtists);
        setTopTracks(topTracksRes.data.items);
        setNewReleases(newReleasesRes.data.albums.items);
        setFeaturedPlaylists(featuredPlaylistsRes.data.playlists.items);
        setRecommendationsByGenre(genreRecsRes.data.tracks);

        // Step 2: Fetch artist-based recommendations if top artists were found
        if (fetchedTopArtists.length > 0) {
            const artistIds = fetchedTopArtists.slice(0, 2).map((artist: any) => artist.id).join(',');
            const artistRecsRes = await apiClient.get(`/recommendations?seed_artists=${artistIds}&limit=10`);
            setRecommendationsByArtist(artistRecsRes.data.tracks);
        }

      } catch (err) {
        console.error("Failed to fetch content for Home:", err);
        setError("Impossibile caricare i contenuti. Riprova più tardi.");
        // Reset states on error
        setUser(null);
        setMyPlaylists([]);
        setRecentlyPlayed([]);
        setTopArtists([]);
        setTopTracks([]);
        setNewReleases([]);
        setFeaturedPlaylists([]);
        setRecommendationsByGenre([]);
        setRecommendationsByArtist([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, startFetching]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  const textColor = isNight ? 'text-white' : 'text-zinc-900';

  if (loading) {
    return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
    return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <h1 className={`text-3xl font-bold mb-6 px-6 ${textColor}`}>
        {getGreeting()}{user ? `, ${user.display_name}!` : '!'}
      </h1>

      {featuredPlaylists.length > 0 && <ContentCarousel title="In evidenza" items={featuredPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="featured" />}
      {recentlyPlayed.length > 0 && <ContentCarousel title="Ritorna ad ascoltare" items={recentlyPlayed} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="recent" />}
      {newReleases.length > 0 && <ContentCarousel title="I più grandi successi di oggi" items={newReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new" />}
      {myPlaylists.length > 0 && <ContentCarousel title="Creato per te" items={myPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="my-playlists" />}
      {recommendationsByArtist.length > 0 && <ContentCarousel title="Altro di ciò che ti piace" items={recommendationsByArtist} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="rec-artist" />}
      {topArtists.length > 0 && <ContentCarousel title="I tuoi artisti del momento" items={topArtists.map(a => ({...a, description: 'Artista'}))} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-artist" />}
      {topTracks.length > 0 && <ContentCarousel title="Un tuffo nel passato" items={topTracks} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-track" />}
      {recommendationsByGenre.length > 0 && <ContentCarousel title="Stazioni consigliate" items={recommendationsByGenre} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="rec-genre" />}
    </div>
  );
};

export default ContentArea;