
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

interface FetchedData {
  greetingSection: SpotifyItem[];
  recentlyPlayed: SpotifyItem[];
  topMixes: SpotifyItem[];
  topArtists: SpotifyItem[];
  newReleases: SpotifyItem[];
  radioRecs: SpotifyItem[];
  moodPlaylists: SpotifyItem[];
}

const ContentArea = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void; }) => {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<FetchedData>({
    greetingSection: [],
    recentlyPlayed: [],
    topMixes: [],
    topArtists: [],
    newReleases: [],
    radioRecs: [],
    moodPlaylists: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [
          featuredPlaylistsRes,
          recentlyPlayedRes,
          userPlaylistsRes,
          topArtistsRes,
          newReleasesRes,
          radioRecsRes,
          moodPlaylistsRes,
        ] = await Promise.allSettled([
          apiClient.get('/browse/featured-playlists?limit=10'),
          apiClient.get('/me/player/recently-played?limit=10'),
          apiClient.get('/me/playlists?limit=50'),
          apiClient.get('/me/top/artists?limit=10'),
          apiClient.get('/browse/new-releases?limit=10'),
          apiClient.get('/recommendations?seed_genres=pop,electronic,dance,latino&limit=10'),
          apiClient.get('/browse/categories/mood/playlists?limit=10'),
        ]);

        const greetingSection = featuredPlaylistsRes.status === 'fulfilled' ? featuredPlaylistsRes.value.data.playlists.items : [];
        const recentlyPlayed = recentlyPlayedRes.status === 'fulfilled' ? recentlyPlayedRes.value.data.items.map((item: any) => ({ ...item.track, images: item.track.album.images })) : [];
        const topMixes = userPlaylistsRes.status === 'fulfilled' ? userPlaylistsRes.value.data.items.filter((p: any) => p.name.toLowerCase().includes('mix')) : [];
        const topArtists = topArtistsRes.status === 'fulfilled' ? topArtistsRes.value.data.items : [];
        const newReleases = newReleasesRes.status === 'fulfilled' ? newReleasesRes.value.data.albums.items : [];
        const radioRecs = radioRecsRes.status === 'fulfilled' ? radioRecsRes.value.data.tracks.map((t: any) => ({ ...t, type: 'track' })) : [];
        const moodPlaylists = moodPlaylistsRes.status === 'fulfilled' ? moodPlaylistsRes.value.data.playlists.items : [];

        setData({ greetingSection, recentlyPlayed, topMixes, topArtists, newReleases, radioRecs, moodPlaylists });
      } catch (error: any) {
        console.error('Failed to load content in ContentArea:', error);
        setError("Could not load content.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

  if (loading) {
    return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
    return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <ContentCarousel title={getGreeting()} items={data.greetingSection} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="greeting" />
      <ContentCarousel title="Ritorna ad ascoltare" items={data.recentlyPlayed} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="recent" />
      <ContentCarousel title="I tuoi top mix" items={data.topMixes} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="mixes" />
      <ContentCarousel title="Nuove uscite" items={data.newReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new-releases" />
      <ContentCarousel title="Playlist per te" items={data.moodPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="mood-playlists" />
      <ContentCarousel title="Le tue radio" items={data.radioRecs} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="radio-recs" />
      <ContentCarousel title="I tuoi artisti preferiti" items={data.topArtists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-artists" />
    </div>
  );
};

export default ContentArea;