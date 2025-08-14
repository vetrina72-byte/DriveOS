
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
        const results = await Promise.all([
          apiClient.get('/me/playlists', { params: { limit: 10 } }),
          apiClient.get('/me/player/recently-played', { params: { limit: 10 } }),
          apiClient.get('/browse/featured-playlists', { params: { limit: 10, country: 'IT' } }),
          apiClient.get('/recommendations', { params: { limit: 10, seed_genres: 'pop,rock,electronic' } }),
        ]);
        
        console.log('%c[DEBUG] 4. DATI GREZZI RICEVUTI:', 'color: #00e676; font-weight: bold;', {
          playlistsResponse: results[0],
          recentResponse: results[1],
          featuredPlaylistsResponse: results[2],
          recommendationsResponse: results[3]
        });

        // Controlla se i dati principali esistono
        const playlists = results[0]?.data?.items;
        const recentItems = results[1]?.data?.items;
        const featuredPlaylists = results[2]?.data?.playlists?.items;
        const recommendations = results[3]?.data?.tracks;

        console.log('%c[DEBUG] 5. DATI ESTRATTI:', 'color: #00e676; font-weight: bold;', {
          extractedPlaylists: playlists,
          extractedRecent: recentItems,
          extractedFeatured: featuredPlaylists,
          extractedRecommendations: recommendations
        });
        
        if (!playlists || playlists.length === 0) {
          console.warn('%c[AVVISO] Le playlist dell\'utente sono vuote o non definite.', 'color: orange;');
        }
        if (!recentItems || recentItems.length === 0) {
          console.warn('%c[AVVISO] Gli ascolti recenti sono vuoti o non definiti.', 'color: orange;');
        }
        if (!featuredPlaylists || featuredPlaylists.length === 0) {
          console.warn('%c[AVVISO] Le playlist in primo piano sono vuote o non definite.', 'color: orange;');
        }
        if (!recommendations || recommendations.length === 0) {
          console.warn('%c[AVVISO] Le raccomandazioni sono vuote o non definite.', 'color: orange;');
        }

        const recentTracks = recentItems ? recentItems.map((item: any) => ({
            ...item.track,
            type: 'track',
            images: item.track.album.images,
        })) : [];
        
        const topMixes = recommendations ? recommendations.map((track:any) => ({
            ...track,
            type: 'track',
            images: track.album.images
        })) : [];

        console.log('%c[DEBUG] 6. Sto per aggiornare lo stato di React con i dati estratti.', 'color: #00e676; font-weight: bold;');

        setData({
          greetings: featuredPlaylists ? featuredPlaylists.slice(0,6) : [],
          userPlaylists: playlists || [],
          recentlyPlayed: recentTracks,
          topMixes: topMixes,
        });

      } catch (error: any) {
        console.error('%c[ERRORE] Qualcosa è andato storto nel blocco try-catch:', 'color: red; font-weight: bold;', error);
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
