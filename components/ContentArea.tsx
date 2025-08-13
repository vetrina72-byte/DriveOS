
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';

interface FetchedData {
  featuredPlaylists: SpotifyItem[];
  userPlaylists: SpotifyItem[];
  recentlyPlayed: SpotifyItem[];
}

const ContentArea = ({ isNight }: { isNight: boolean }) => {
  const { accessToken, play } = useAuth();
  const [data, setData] = useState<FetchedData>({
    featuredPlaylists: [],
    userPlaylists: [],
    recentlyPlayed: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      const headers = { Authorization: `Bearer ${accessToken}` };
      
      try {
        const [featuredRes, playlistsRes, recentRes] = await Promise.all([
          axios.get('https://api.spotify.com/v1/browse/featured-playlists', { headers, params: { limit: 10 } }),
          axios.get('https://api.spotify.com/v1/me/playlists', { headers, params: { limit: 10 } }),
          axios.get('https://api.spotify.com/v1/me/player/recently-played', { headers, params: { limit: 10 } }),
        ]);

        setData({
          featuredPlaylists: featuredRes.data.playlists.items,
          userPlaylists: playlistsRes.data.items,
          recentlyPlayed: recentRes.data.items.map((item: any) => item.track),
        });
      } catch (e) {
        console.error("Failed to fetch Spotify content", e);
        setError("Could not load content.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken]);

  const themeColor = isNight ? 'text-zinc-300' : 'text-zinc-600';

  if (loading) {
    return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
    return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto carousel-scrollbar-hidden pb-6">
      <ContentCarousel title="Featured Playlists" items={data.featuredPlaylists} isNight={isNight} onPlay={play} />
      <ContentCarousel title="Your Playlists" items={data.userPlaylists} isNight={isNight} onPlay={play} />
      <ContentCarousel title="Recently Played" items={data.recentlyPlayed} isNight={isNight} onPlay={play} />
    </div>
  );
};

export default ContentArea;
