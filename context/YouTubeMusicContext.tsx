import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { SpotifyItem as MediaItem } from '../components/PlaylistItem';
import { isDemoMode, getYouTubeMockHomeData } from '../lib/youtubeDemoFallback';

export interface YouTubeApiItem {
  id: string | { videoId?: string; playlistId?: string; kind?: string };
  kind?: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { high?: { url: string }; default?: { url: string } };
  };
}

export const mapYouTubeItemToMediaItem = (item: YouTubeApiItem): MediaItem | null => {
    if (!item || !item.snippet) return null;

    const id = typeof item.id === 'string' ? item.id : item.id?.videoId || item.id?.playlistId;
    if (!id) return null;

    let type = 'track';
    if (item.kind === 'youtube#playlist' || (typeof item.id === 'object' && item.id?.kind === 'youtube#playlist')) {
        type = 'playlist';
    }

    return {
        id,
        name: item.snippet.title,
        uri: `youtube:${type}:${id}`,
        images: [item.snippet.thumbnails.high || item.snippet.thumbnails.default] as any[],
        description: item.snippet.channelTitle,
        type: type as "track" | "playlist",
    };
};

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || "DEVELOPMENT_DEMO_KEY";

interface YouTubeMusicContextData {
  youtubeHomeData: { [key: string]: MediaItem[] };
  youtubeHomeIsLoading: boolean;
  youtubeHomeError: string | null;
  youtubeHomeQuotaExceeded: boolean;
  fetchYouTubeHomeData: () => Promise<void>;
  handleGenericQuotaError: () => void;
  mapYouTubeItemToMediaItem: (item: YouTubeApiItem) => MediaItem | null;
}

const YouTubeMusicContext = createContext<YouTubeMusicContextData | undefined>(undefined);

export const YouTubeMusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [youtubeHomeData, setYoutubeHomeData] = useState<{[key: string]: MediaItem[]}>({});
  const [youtubeHomeIsLoading, setYoutubeHomeIsLoading] = useState(true);
  const [youtubeHomeError, setYoutubeHomeError] = useState<string | null>(null);
  const [youtubeHomeQuotaExceeded, setYoutubeHomeQuotaExceeded] = useState(false);
  const retryIntervalRef = useRef<number | null>(null);

  const fetchYouTubeHomeData = useCallback(async () => {
    if (Object.keys(youtubeHomeData).length > 0 && !youtubeHomeQuotaExceeded) return;
    setYoutubeHomeIsLoading(true); setYoutubeHomeError(null);
    
    if (isDemoMode(YOUTUBE_API_KEY)) {
        setTimeout(() => {
            setYoutubeHomeData(getYouTubeMockHomeData() as any);
            setYoutubeHomeQuotaExceeded(false);
            setYoutubeHomeIsLoading(false);
        }, 300);
        return;
    }
    
    try {
        const endpoints = [ 
            `videos?part=snippet&chart=mostPopular&regionCode=IT&videoCategoryId=10&maxResults=10`, 
            `search?part=snippet&q=official pop hits playlist&type=playlist&maxResults=10`, 
            `search?part=snippet&q=live performance full concert&type=video&videoCategoryId=10&maxResults=10`, 
            `search?part=snippet&q=musica italiana playlist&type=playlist&maxResults=10`, 
            `search?part=snippet&q=workout music playlist&type=playlist&maxResults=10`, 
            `search?part=snippet&q=acoustic sessions live&type=video&maxResults=10` 
        ];
        
        const responses = await Promise.all(endpoints.map(ep => fetch(`https://www.googleapis.com/youtube/v3/${ep}&key=${YOUTUBE_API_KEY}`)));
        
        for (const res of responses) { 
            if (!res.ok) { 
                const errorData = await res.json(); 
                if (errorData.error?.message.toLowerCase().includes('quota')) throw new Error("quotaExceeded"); 
                throw new Error(errorData.error?.message); 
            } 
        }
        
        const data = await Promise.all(responses.map(res => res.json()));
        
        setYoutubeHomeData({ 
            musicCharts: data[0].items.map(mapYouTubeItemToMediaItem).filter(Boolean) as MediaItem[], 
            popPlaylists: data[1].items.map(mapYouTubeItemToMediaItem).filter(Boolean) as MediaItem[], 
            livePerformances: data[2].items.map(mapYouTubeItemToMediaItem).filter(Boolean) as MediaItem[], 
            italianPlaylists: data[3].items.map(mapYouTubeItemToMediaItem).filter(Boolean) as MediaItem[], 
            workoutPlaylists: data[4].items.map(mapYouTubeItemToMediaItem).filter(Boolean) as MediaItem[], 
            acousticSessions: data[5].items.map(mapYouTubeItemToMediaItem).filter(Boolean) as MediaItem[] 
        });
        setYoutubeHomeQuotaExceeded(false);
    } catch (err: any) { 
        if (err.message === 'quotaExceeded') setYoutubeHomeQuotaExceeded(true); 
        else setYoutubeHomeError(err.message); 
    } finally { 
        setYoutubeHomeIsLoading(false); 
    }
  }, [youtubeHomeData, youtubeHomeQuotaExceeded]);

  useEffect(() => { 
      if (youtubeHomeQuotaExceeded) { 
          if (retryIntervalRef.current) clearInterval(retryIntervalRef.current); 
          retryIntervalRef.current = window.setInterval(() => fetchYouTubeHomeData(), 15 * 60 * 1000); 
      } else if (retryIntervalRef.current) { 
          clearInterval(retryIntervalRef.current); 
          retryIntervalRef.current = null; 
      } 
      return () => { if (retryIntervalRef.current) clearInterval(retryIntervalRef.current); }; 
  }, [youtubeHomeQuotaExceeded, fetchYouTubeHomeData]);

  const handleGenericQuotaError = useCallback(() => setYoutubeHomeQuotaExceeded(true), []);

  return (
    <YouTubeMusicContext.Provider
      value={{
        youtubeHomeData,
        youtubeHomeIsLoading,
        youtubeHomeError,
        youtubeHomeQuotaExceeded,
        fetchYouTubeHomeData,
        handleGenericQuotaError,
        mapYouTubeItemToMediaItem
      }}
    >
      {children}
    </YouTubeMusicContext.Provider>
  );
};

export const useYouTubeMusic = () => {
  const context = useContext(YouTubeMusicContext);
  if (context === undefined) {
    throw new Error('useYouTubeMusic must be used within a YouTubeMusicProvider');
  }
  return context;
};
