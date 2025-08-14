
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

const likedSongsSpecialItem: SpotifyItem = {
    id: 'liked-songs',
    name: 'Brani che ti piacciono',
    type: 'playlist',
    uri: 'special:liked-songs', // This is a special identifier
    description: 'I brani che hai salvato.',
};

const DYNAMIC_CATEGORIES = ['party', 'workout', 'chill', 'focus', 'mood', 'rock', 'pop', 'indie_alt'];

const getDayOfWeekInItalian = () => {
    return new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(new Date());
};

const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user } = useAuth();
  
  // States for all carousels
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
  const [recentlyPlayedContexts, setRecentlyPlayedContexts] = useState<SpotifyItem[]>([]);
  const [genreRecommendations, setGenreRecommendations] = useState<SpotifyItem[]>([]);
  const [userMixes, setUserMixes] = useState<SpotifyItem[]>([]);
  const [topTracksLongTerm, setTopTracksLongTerm] = useState<SpotifyItem[]>([]);
  const [spotifyMadePlaylists, setSpotifyMadePlaylists] = useState<SpotifyItem[]>([]);
  const [artistRecommendations, setArtistRecommendations] = useState<SpotifyItem[]>([]);
  const [topHitsPlaylists, setTopHitsPlaylists] = useState<SpotifyItem[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<{ mainArtistName: string; artists: SpotifyItem[] } | null>(null);
  const [dynamicCategoryPlaylists, setDynamicCategoryPlaylists] = useState<{ title: string; items: SpotifyItem[] }[]>([]);

  const processRecentlyPlayed = useCallback(async (items: any[]) => {
      const uniqueContexts = new Map<string, { id: string; type: 'playlist' | 'album' }>();
      let likedSongsPlayed = false;

      for (const item of items) {
          if (item.context && (item.context.type === 'playlist' || item.context.type === 'album')) {
              if (!uniqueContexts.has(item.context.uri)) {
                  uniqueContexts.set(item.context.uri, {
                      id: item.context.uri.split(':').pop()!,
                      type: item.context.type,
                  });
              }
          } else if (!item.context) {
              likedSongsPlayed = true;
          }
      }

      const contextFetchPromises = Array.from(uniqueContexts.values()).map(ctx =>
          apiClient.get(`/${ctx.type}s/${ctx.id}`).catch(() => null)
      );

      const contextDetailsResponses = await Promise.all(contextFetchPromises);
      let validContexts: SpotifyItem[] = contextDetailsResponses.map(res => res?.data).filter(Boolean);

      if (likedSongsPlayed) {
          validContexts.unshift(likedSongsSpecialItem);
      }

      setRecentlyPlayedContexts(validContexts.slice(0, 10)); // Limit to 10 items
  }, []);

  const fetchData = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
          const [
              recentRes,
              topArtistsRes,
              topTracksRes,
              newReleasesRes,
              userPlaylistsRes,
              topHitsRes,
          ] = await Promise.all([
              apiClient.get('/me/player/recently-played?limit=25'),
              apiClient.get('/me/top/artists?limit=5&time_range=short_term'),
              apiClient.get('/me/top/tracks?limit=20&time_range=long_term'),
              apiClient.get('/browse/new-releases?country=IT&limit=20'),
              apiClient.get('/me/playlists?limit=50'),
              apiClient.get('/browse/categories/toplists/playlists?country=IT&limit=20'),
          ].map(p => p.catch(e => e)));

          // Process primary results
          if (newReleasesRes && !newReleasesRes.isAxiosError) setNewReleases(newReleasesRes.data.albums.items);
          if (topTracksRes && !topTracksRes.isAxiosError) setTopTracksLongTerm(topTracksRes.data.items);
          if (topHitsRes && !topHitsRes.isAxiosError) setTopHitsPlaylists(topHitsRes.data.playlists.items);

          if (userPlaylistsRes && !userPlaylistsRes.isAxiosError) {
              const allPlaylists = userPlaylistsRes.data.items;
              setUserMixes(allPlaylists.filter((p: SpotifyItem) => p.name.toLowerCase().includes('mix')));
              setSpotifyMadePlaylists(allPlaylists.filter((p: any) => p.owner.id === 'spotify'));
          }
          
          const dependentPromises = [];

          if (recentRes && !recentRes.isAxiosError) {
              dependentPromises.push(processRecentlyPlayed(recentRes.data.items));
          }

          const topArtists = topArtistsRes?.data?.items;
          if (topArtists && topArtists.length > 0) {
              const artistSeed = topArtists.slice(0, 2).map((a: SpotifyItem) => a.id).join(',');
              dependentPromises.push(
                  apiClient.get(`/recommendations?seed_artists=${artistSeed}&limit=10`)
                      .then(res => setArtistRecommendations(res.data.tracks.map((track: any) => ({ ...track, images: track.album?.images }))))
                      .catch(() => {})
              );
              dependentPromises.push(
                  apiClient.get(`/artists/${topArtists[0].id}/related-artists`)
                      .then(res => setRelatedArtists({ mainArtistName: topArtists[0].name, artists: res.data.artists }))
                      .catch(() => {})
              );
          }
          
          dependentPromises.push(
              apiClient.get('/recommendations?seed_genres=pop,rock,italian,indie&limit=10')
                  .then(res => setGenreRecommendations(res.data.tracks.map((track: any) => ({ ...track, images: track.album?.images }))))
                  .catch(() => {})
          );

          const shuffledCategories = DYNAMIC_CATEGORIES.sort(() => 0.5 - Math.random());
          const dynamicCategoryPromises = shuffledCategories.slice(0, 2).map(catId =>
              apiClient.get(`/browse/categories/${catId}/playlists?country=IT&limit=10`)
                  .then(res => ({
                      title: catId.charAt(0).toUpperCase() + catId.slice(1),
                      items: res.data.playlists.items,
                  }))
                  .catch(() => null)
          );
          dependentPromises.push(
              Promise.all(dynamicCategoryPromises).then(results => setDynamicCategoryPlaylists(results.filter(Boolean) as any))
          );
          
          await Promise.all(dependentPromises);

      } catch (err: any) {
          console.error('Failed to fetch home page data', err);
          setError('Could not load content.');
      } finally {
          setLoading(false);
      }
  }, [user, processRecentlyPlayed]);

  useEffect(() => {
      if (user && startFetching) {
          fetchData();
      } else {
          setLoading(!startFetching);
      }
  }, [user, startFetching, fetchData]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  
  const greeting = user ? `${new Date().getHours() < 18 ? 'Buon' : 'Buona'} ${new Date().getHours() < 12 ? 'giorno' : new Date().getHours() < 18 ? 'pomeriggio' : 'serata'}` : 'Ciao';

  const dayOfWeek = useMemo(getDayOfWeekInItalian, []);

  if (loading) {
      return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
      return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <h1 className="text-3xl font-bold mb-8 px-6">{greeting}, {user?.display_name}!</h1>
      
      {newReleases.length > 0 && <ContentCarousel title={`Le novità di questo ${dayOfWeek}`} items={newReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new" />}
      {recentlyPlayedContexts.length > 0 && <ContentCarousel title="Ritorna ad ascoltare" items={recentlyPlayedContexts} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="recent-context" />}
      {genreRecommendations.length > 0 && <ContentCarousel title="Le tue stazioni consigliate" items={genreRecommendations} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="genre-recs" />}
      {userMixes.length > 0 && <ContentCarousel title="I tuoi mix preferiti" items={userMixes} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="mixes" />}
      {topTracksLongTerm.length > 0 && <ContentCarousel title="Un tuffo nel passato" items={topTracksLongTerm} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-tracks" />}
      {spotifyMadePlaylists.length > 0 && <ContentCarousel title={`Creato per ${user?.display_name}`} items={spotifyMadePlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="made-for-you" />}
      {artistRecommendations.length > 0 && <ContentCarousel title="Altro di ciò che ti piace" items={artistRecommendations} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="artist-recs" />}
      {topHitsPlaylists.length > 0 && <ContentCarousel title="I più grandi successi di oggi" items={topHitsPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-hits" />}
      {relatedArtists && relatedArtists.artists.length > 0 && <ContentCarousel title={`Per i fan di ${relatedArtists.mainArtistName}`} items={relatedArtists.artists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="related-artists" />}
      {dynamicCategoryPlaylists.map(list => (
        list.items.length > 0 && <ContentCarousel key={list.title} title={list.title} items={list.items} isNight={isNight} onSelectItem={onSelectItem} keyPrefix={`dyn-${list.title}`} />
      ))}
    </div>
  );
};

export default ContentArea;
