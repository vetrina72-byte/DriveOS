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

// Main Component
const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user } = useAuth();
  
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
          const recentItems = recentlyPlayedRes.value.data.items;

          const uniqueContextUris = [...new Set(recentItems.map((item: any) => item.context?.uri).filter(Boolean))];
          const albumUris: string[] = [], playlistUris: string[] = [];
          uniqueContextUris.forEach((uri: string) => {
              const [, , type, id] = uri.split(':');
              if (type === 'album') albumUris.push(id);
              if (type === 'playlist') playlistUris.push(id);
          });
          
          const contextDetails = new Map<string, SpotifyItem>();
          if (albumUris.length > 0) {
              const albumsRes = await apiClient.get(`/albums?ids=${albumUris.join(',')}`);
              albumsRes.data.albums.forEach((album: any) => contextDetails.set(album.uri, album));
          }
          if (playlistUris.length > 0) {
              const playlistPromises = playlistUris.map(id => apiClient.get(`/playlists/${id}`).catch(() => null));
              const playlistResults = await Promise.all(playlistPromises);
              playlistResults.forEach(res => { if (res) contextDetails.set(res.data.uri, res.data) });
          }

          const unifiedList: SpotifyItem[] = [];
          const addedIdsOrUris = new Set<string>();
          for (const item of recentItems) {
              if (item.context && (item.context.type === 'album' || item.context.type === 'playlist')) {
                  const contextUri = item.context.uri;
                  if (!addedIdsOrUris.has(contextUri)) {
                      const details = contextDetails.get(contextUri);
                      if (details) {
                          unifiedList.push(details);
                          addedIdsOrUris.add(contextUri);
                      }
                  }
              } else if (item.track) {
                  const trackId = item.track.id;
                  if (trackId && !addedIdsOrUris.has(trackId)) {
                      unifiedList.push(item.track);
                      addedIdsOrUris.add(trackId);
                  }
              }
          }
          setResumeItems(unifiedList);
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
  }, [user, startFetching, fetchData]);
  
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
      <h1 className="text-3xl font-bold mb-8 px-6">{greeting}, {user?.display_name}!</h1>
      
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