
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';

interface FetchedData {
  userPlaylists: SpotifyItem[];
  recentlyPlayed: SpotifyItem[];
  savedAlbums: SpotifyItem[];
}

const ContentArea = ({ isNight }: { isNight: boolean }) => {
  const { accessToken, play } = useAuth();
  console.log('%c[DEBUG] 1. Token in ContentArea:', 'color: blue; font-weight: bold;', accessToken);

  const [data, setData] = useState<FetchedData>({
    userPlaylists: [],
    recentlyPlayed: [],
    savedAlbums: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const fetchData = async () => {
      console.log('%c[DEBUG] 2. useEffect attivato. Inizio a caricare i dati...', 'color: blue; font-weight: bold;');
      setLoading(true);
      setError(null);
      
      const headers = { Authorization: `Bearer ${accessToken}` };
      
      try {
        console.log('%c[DEBUG] 3. Sto per eseguire Promise.all con le chiamate API.', 'color: blue; font-weight: bold;');
        const results = await Promise.all([
          axios.get('https://api.spotify.com/v1/me/playlists', { headers, params: { limit: 10 } }),
          axios.get('https://api.spotify.com/v1/me/player/recently-played', { headers, params: { limit: 10 } }),
          axios.get('https://api.spotify.com/v1/me/albums', { headers, params: { limit: 10 } }),
        ]);

        console.log('%c[DEBUG] 4. Chiamate API completate con successo! Dati grezzi:', 'color: green; font-weight: bold;', results);

        const playlists = results[0].data.items;
        const recentTracks = results[1].data.items.map((item: any) => ({
            ...item.track,
            images: item.track.album.images,
        }));
        const savedAlbums = results[2].data.items.map((item: any) => item.album);

        console.log('%c[DEBUG] 5. Sto per impostare gli stati con questi dati elaborati.', 'color: green; font-weight: bold;', {
            playlists,
            recentTracks,
            savedAlbums
        });

        setData({
          userPlaylists: playlists,
          recentlyPlayed: recentTracks,
          savedAlbums: savedAlbums,
        });
      } catch (error: any) {
        console.error('%c[DEBUG] X. ERRORE CRITICO nel caricamento dati:', 'color: red; font-weight: bold;', error);
        if (error.response) {
            console.error('%c[DEBUG] X. Dettagli errore da Spotify:', 'color: red;', error.response.data);
        }
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
      <ContentCarousel title="Le Tue Playlist" items={data.userPlaylists} isNight={isNight} onPlay={play} />
      <ContentCarousel title="Ascoltati di Recente" items={data.recentlyPlayed} isNight={isNight} onPlay={play} />
      <ContentCarousel title="I Tuoi Album Salvati" items={data.savedAlbums} isNight={isNight} onPlay={play} />
    </div>
  );
};

export default ContentArea;
