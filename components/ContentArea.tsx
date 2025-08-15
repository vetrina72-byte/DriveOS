import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

// Helper for dynamic greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
};

const processRecentPlays = async (items: any[]): Promise<SpotifyItem[]> => {
    const contextUris = new Set<string>();
    const albumIds: string[] = [];
    const playlistIds: string[] = [];

    items.forEach((item: any) => {
        if (item.context?.uri && !contextUris.has(item.context.uri)) {
            contextUris.add(item.context.uri);
            const [, , type, id] = item.context.uri.split(':');
            if (type === 'album') albumIds.push(id);
            if (type === 'playlist') playlistIds.push(id);
        }
    });

    const contextDetails = new Map<string, SpotifyItem>();
    const contextPromises = [];

    if (albumIds.length > 0) {
        contextPromises.push(
            apiClient.get(`/albums?ids=${albumIds.join(',')}`).then(res => {
                res.data.albums.forEach((album: any) => contextDetails.set(album.uri, album));
            }).catch(e => console.error("Failed to fetch album details", e))
        );
    }
    if (playlistIds.length > 0) {
        const playlistDetailPromises = playlistIds.map(id => 
            apiClient.get(`/playlists/${id}`).then(res => {
                contextDetails.set(res.data.uri, res.data);
            }).catch(e => console.error(`Failed to fetch playlist ${id}`, e))
        );
        contextPromises.push(Promise.all(playlistDetailPromises));
    }

    await Promise.all(contextPromises);

    const unifiedList: SpotifyItem[] = [];
    const addedUris = new Set<string>();

    for (const item of items) {
        if (item.context?.uri && (item.context.type === 'album' || item.context.type === 'playlist')) {
            const contextUri = item.context.uri;
            if (!addedUris.has(contextUri)) {
                const details = contextDetails.get(contextUri);
                if (details) {
                    unifiedList.push(details);
                    addedUris.add(contextUri);
                }
            }
        }
    }
    return unifiedList;
};

// Main Component
const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user, refreshTrigger } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // States for each curated section
  const [resumeItems, setResumeItems] = useState<SpotifyItem[]>([]);
  const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<SpotifyItem[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<SpotifyItem[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyItem[]>([]);
  
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // Reset states
    setResumeItems([]);
    setNewReleases([]);
    setUserPlaylists([]);
    setFeaturedPlaylists([]);
    setTopArtists([]);

    try {
      const randomOffset = Math.floor(Math.random() * 20);
      const promises = [
        apiClient.get('/me/player/recently-played?limit=50'),
        apiClient.get(`/browse/new-releases?country=IT&limit=10&offset=${randomOffset}`),
        apiClient.get('/me/playlists?limit=10'),
        apiClient.get('/browse/featured-playlists?country=IT&limit=10'),
        apiClient.get('/me/top/artists?time_range=medium_term&limit=10')
      ];

      const results = await Promise.allSettled(promises);

      const [
          recentlyPlayedRes,
          newReleasesRes,
          userPlaylistsRes,
          featuredPlaylistsRes,
          topArtistsRes
      ] = results;

      if (recentlyPlayedRes.status === 'fulfilled' && recentlyPlayedRes.value.data.items) {
          const processedItems = await processRecentPlays(recentlyPlayedRes.value.data.items);
          setResumeItems(processedItems);
      }
      if (newReleasesRes.status === 'fulfilled' && newReleasesRes.value.data.albums) {
          setNewReleases(newReleasesRes.value.data.albums.items);
      }
      if (userPlaylistsRes.status === 'fulfilled' && userPlaylistsRes.value.data.items) {
          setUserPlaylists(userPlaylistsRes.value.data.items);
      }
      if (featuredPlaylistsRes.status === 'fulfilled' && featuredPlaylistsRes.value.data.playlists) {
          setFeaturedPlaylists(featuredPlaylistsRes.value.data.playlists.items);
      }
      if (topArtistsRes.status === 'fulfilled' && topArtistsRes.value.data.items) {
          setTopArtists(topArtistsRes.value.data.items);
      }

    } catch (err: any) {
        console.error("Critical error fetching home content:", err);
        setError("Could not load content. Please try again later.");
    } finally {
        setLoading(false);
    }
}, [user]);

  useEffect(() => {
      if (user && startFetching) {
          fetchData();
      } else {
          setLoading(!startFetching);
      }
  }, [user, startFetching, fetchData, refreshTrigger]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  const greeting = getGreeting();

  if (loading) {
      return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
      return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <h1 
        className="text-3xl font-bold mb-8 px-6"
        style={{ color: 'var(--heading-color)' }}
      >
        {greeting}, {user?.display_name}!
      </h1>
      
      {resumeItems.length > 0 && (
          <ContentCarousel title="Riprendi da dove hai lasciato" items={resumeItems} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="resume-listening" />
      )}
      {userPlaylists.length > 0 && (
          <ContentCarousel title="Le tue playlist" items={userPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="user-playlists" />
      )}
      {topArtists.length > 0 && (
          <ContentCarousel title="I tuoi artisti del momento" items={topArtists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-artists" />
      )}
      {newReleases.length > 0 && (
          <ContentCarousel title="Nuove uscite" items={newReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new-releases" />
      )}
      {featuredPlaylists.length > 0 && (
          <ContentCarousel title="Playlist in primo piano" items={featuredPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="featured-playlists" />
      )}
    </div>
  );
};

export default ContentArea;