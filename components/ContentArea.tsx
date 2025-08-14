import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user } = useAuth();
  const [recentlyPlayedContexts, setRecentlyPlayedContexts] = useState<SpotifyItem[]>([]);
  const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<SpotifyItem[]>([]);
  const [artistRecommendations, setArtistRecommendations] = useState<SpotifyItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
        // --- Step 1: Parallel fetching of primary data ---
        const [
            recentRes,
            featuredRes,
            topArtistsRes,
            newReleasesRes,
        ] = await Promise.all([
            apiClient.get('/me/player/recently-played?limit=25'), // Fetch more to find unique contexts
            apiClient.get('/browse/featured-playlists?country=IT&limit=10'),
            apiClient.get('/me/top/artists?limit=5&time_range=short_term'),
            apiClient.get('/browse/new-releases?country=IT&limit=10'),
        ].map(p => p.catch(e => e))); // Prevent one failure from stopping all fetches

        // Process immediate results
        if (featuredRes && !featuredRes.isAxiosError) setFeaturedPlaylists(featuredRes.data.playlists.items);
        if (newReleasesRes && !newReleasesRes.isAxiosError) setNewReleases(newReleasesRes.data.albums.items);

        // --- Step 2: Process "Ritorna ad ascoltare" logic ---
        if (recentRes && !recentRes.isAxiosError) {
            const uniqueContexts = new Map<string, SpotifyItem>();
            recentRes.data.items.forEach((item: any) => {
                if (item.context && (item.context.type === 'playlist' || item.context.type === 'album')) {
                    if (!uniqueContexts.has(item.context.uri)) {
                         // We need to fetch full details for these contexts later
                        uniqueContexts.set(item.context.uri, {
                            id: item.context.uri.split(':').pop(),
                            type: item.context.type,
                            uri: item.context.uri,
                            name: '', // Will be fetched
                        });
                    }
                }
            });

            const contextFetchPromises = Array.from(uniqueContexts.values()).map(ctx => 
                apiClient.get(`/${ctx.type}s/${ctx.id}`).catch(() => null)
            );
            
            const contextDetailsResponses = await Promise.all(contextFetchPromises);
            const validContexts = contextDetailsResponses
                .map(res => res?.data)
                .filter(Boolean); // Filter out any null responses from failed fetches
            setRecentlyPlayedContexts(validContexts);
        }

        // --- Step 3: Dependent fetching for recommendations ---
        const artistsForSeed = topArtistsRes?.data?.items;
        if (artistsForSeed && artistsForSeed.length > 0) {
            const artistSeed = artistsForSeed.slice(0, 2).map((a: SpotifyItem) => a.id).join(',');
            const artistRecsRes = await apiClient.get(`/recommendations?seed_artists=${artistSeed}&limit=10`).catch(() => null);
            if (artistRecsRes && !artistRecsRes.isAxiosError) {
                 // Normalize tracks to have correct image property
                const normalizedTracks = artistRecsRes.data.tracks.map((track: any) => ({
                    ...track,
                    images: track.album?.images,
                }));
                setArtistRecommendations(normalizedTracks);
            }
        }
    } catch (err: any) {
        console.error('Failed to fetch home page data', err);
        setError('Could not load content.');
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
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Buongiorno';
    if (hour >= 12 && hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };
  
  const greeting = user ? `${getGreeting()}` : getGreeting();

  if (loading) {
    return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
    return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <h1 className="text-3xl font-bold mb-4 px-6">{greeting}, {user?.display_name}!</h1>
      
      {featuredPlaylists.length > 0 && <ContentCarousel 
        title="Playlist in evidenza"
        items={featuredPlaylists} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="featured" 
      />}

      {recentlyPlayedContexts.length > 0 && <ContentCarousel 
        title="Ritorna ad ascoltare"
        items={recentlyPlayedContexts} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="recent-context" 
      />}

       {newReleases.length > 0 && <ContentCarousel 
        title="I più grandi successi di oggi"
        items={newReleases} 
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="new" 
      />}
       
      {artistRecommendations.length > 0 && <ContentCarousel 
        title="Altro di ciò che ti piace"
        items={artistRecommendations}
        isNight={isNight} 
        onSelectItem={onSelectItem} 
        keyPrefix="artist-recs" 
      />}
    </div>
  );
};

export default ContentArea;