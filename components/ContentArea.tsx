import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { isAuthenticated } = useAuth();
  const [myPlaylists, setMyPlaylists] = useState<SpotifyItem[]>([]);
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
        console.log("INIZIO TEST CHIAMATA API...");
        // L'endpoint DEVE iniziare con '/' e NON deve contenere '/v1/'
        const response = await apiClient.get('/me/playlists?limit=5');
    
        console.log('%cSUCCESSO! Dati ricevuti:', 'color: green; font-weight: bold;', response.data);
        // Imposta uno stato per vedere il risultato, es:
        setMyPlaylists(response.data.items);
      } catch (error: any) {
        console.error('%cERRORE NEL TEST API:', 'color: red; font-weight: bold;', error);
        if (error.response) {
          console.error('Dettagli errore:', {
            status: error.response.status,
            url: error.config.url, // Questo ci mostrerà l'URL finale chiamato
            data: error.response.data
          });
        }
        setError("Test API fallito. Controlla la console.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, startFetching]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

  if (loading) {
    return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
    return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <ContentCarousel 
        title="Risultato Test API" 
        items={myPlaylists} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="test" 
      />
    </div>
  );
};

export default ContentArea;