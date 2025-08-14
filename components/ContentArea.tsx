
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

interface FetchedData {
  greetings: SpotifyItem[];
  userPlaylists: SpotifyItem[];
  recentlyPlayed: SpotifyItem[];
  topMixes: SpotifyItem[];
}

const ContentArea = ({ isNight, onItemSelect, activeCategory }: { isNight: boolean, onItemSelect: (item: SpotifyItem) => void, activeCategory: string }) => {
  const { isAuthenticated } = useAuth();

  const [data, setData] = useState<FetchedData>({
    greetings: [],
    userPlaylists: [],
    recentlyPlayed: [],
    topMixes: [],
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
        const [playlistsRes, recentRes, featuredPlaylistsRes, recommendationsRes] = await Promise.all([
          apiClient.get('/me/playlists?limit=10'),
          apiClient.get('/me/player/recently-played?limit=10'),
          apiClient.get('/browse/featured-playlists?limit=10&country=IT'),
          apiClient.get('/recommendations?limit=10&seed_genres=pop,rock,electronic'),
        ]);

        const playlists = playlistsRes.data.items;
        const recentTracks = recentRes.data.items.map((item: any) => ({
            ...item.track,
            type: 'track',
            images: item.track.album.images,
        }));
        
        setData({
          greetings: featuredPlaylistsRes.data.playlists.items.slice(0,6),
          userPlaylists: playlists,
          recentlyPlayed: recentTracks,
          topMixes: recommendationsRes.data.tracks.map((track:any) => ({
            ...track,
            type: 'track',
            images: track.album.images
          })),
        });

      } catch (error: any) {
        console.error('Failed to load content in ContentArea:', error);
        setError("Impossibile caricare il contenuto.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, activeCategory]);

  const themeColor = isNight ? 'text-zinc-300' : 'text-zinc-600';
  
  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return "Buongiorno";
      if (hour < 18) return "Buon pomeriggio";
      return "Buonasera";
  }

  if (loading) {
    return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
    return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto w-full">
      <ContentCarousel title={getGreeting()} items={data.greetings} isNight={isNight} onItemSelect={onItemSelect} />
      <ContentCarousel title="Ritorna in" items={data.recentlyPlayed} isNight={isNight} onItemSelect={onItemSelect} />
      <ContentCarousel title="I tuoi mix preferiti" items={data.topMixes} isNight={isNight} onItemSelect={onItemSelect} />
      <ContentCarousel title="Le Tue Playlist" items={data.userPlaylists} isNight={isNight} onItemSelect={onItemSelect} />
    </div>
  );
};

export default ContentArea;