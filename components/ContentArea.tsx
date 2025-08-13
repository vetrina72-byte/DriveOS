
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

interface FetchedData {
  userPlaylists: SpotifyItem[];
  recentlyPlayed: SpotifyItem[];
  savedAlbums: SpotifyItem[];
}

const ContentArea = ({ isNight }: { isNight: boolean }) => {
  const { play, isAuthenticated } = useAuth();

  const [data, setData] = useState<FetchedData>({
    userPlaylists: [],
    recentlyPlayed: [],
    savedAlbums: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch data if the user is authenticated.
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const results = await Promise.all([
          apiClient.get('/me/playlists?limit=10'),
          apiClient.get('/me/player/recently-played?limit=10'),
          apiClient.get('/me/albums?limit=10'),
        ]);

        const playlists = results[0].data.items;
        const recentTracks = results[1].data.items.map((item: any) => ({
            ...item.track,
            images: item.track.album.images,
        }));
        const savedAlbums = results[2].data.items.map((item: any) => item.album);
        
        setData({
          userPlaylists: playlists,
          recentlyPlayed: recentTracks,
          savedAlbums: savedAlbums,
        });

      } catch (error: any) {
        console.error('Failed to load content in ContentArea:', error);
        setError("Could not load content.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]); // Rerunning the effect when authentication state changes.

  const themeColor = isNight ? 'text-zinc-300' : 'text-zinc-600';

  if (loading) {
    return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
    return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto carousel-scrollbar-hidden pb-6">
      <ContentCarousel title="Le Tue Playlist" items={data.userPlaylists} isNight={isNight} onPlay={play} />
      <ContentCarousel title="Ascoltati di Recente" items={data.recentlyPlayed} isNight={isNight} onPlay={play} />
      <ContentCarousel title="I Tuoi Album Salvati" items={data.savedAlbums} isNight={isNight} onPlay={play} />
    </div>
  );
};

export default ContentArea;
