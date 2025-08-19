import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';
import { FiPlay, FiLoader, FiMusic, FiAlertTriangle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import ContentCarousel from './ContentCarousel';

interface Artist {
    id: string;
    name: string;
    images: { url: string }[];
    followers: { total: number };
}

interface Track {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
    duration_ms: number;
    uri: string;
    explicit: boolean;
}

interface Album extends SpotifyItem {
    type: 'album';
}


interface ArtistDetailViewProps {
    artistId: string;
    isNight: boolean;
    onPlay: (options: { uris?: string[], context_uri?: string, offset?: any }) => void;
    onSelectItem: (item: SpotifyItem) => void;
}

const AnimatedEqualizer = ({ className }: { className?: string; }) => (
    <div className={`flex items-end justify-center w-4 h-4 gap-0.5 ${className}`}>
      <style>{`
        @keyframes equalizer-bar {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
      `}</style>
      <span className="w-1 bg-current" style={{ animation: 'equalizer-bar 1.2s ease-in-out infinite', animationDelay: '0s' }}></span>
      <span className="w-1 bg-current" style={{ animation: 'equalizer-bar 1.2s ease-in-out infinite', animationDelay: '-0.2s' }}></span>
      <span className="w-1 bg-current" style={{ animation: 'equalizer-bar 1.2s ease-in-out infinite', animationDelay: '-0.4s' }}></span>
      <span className="w-1 bg-current" style={{ animation: 'equalizer-bar 1.2s ease-in-out infinite', animationDelay: '-0.6s' }}></span>
    </div>
);

const formatFollowers = (count: number) => {
    return new Intl.NumberFormat('it-IT').format(count);
};

const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({ artistId, isNight, onPlay, onSelectItem }) => {
    const [artist, setArtist] = useState<Artist | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [singles, setSingles] = useState<Album[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { playerState } = useAuth();

    const isPlayingContext = playerState && !playerState.paused;
    const currentTrackId = playerState?.track_window.current_track?.id;

    const fetchDetails = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setTracks([]);
        setAlbums([]);
        setSingles([]);

        try {
            const [
                artistRes,
                topTracksRes,
                albumsRes,
                singlesRes,
            ] = await Promise.allSettled([
                apiClient.get(`/artists/${artistId}`),
                apiClient.get(`/artists/${artistId}/top-tracks?market=IT`),
                apiClient.get(`/artists/${artistId}/albums?include_groups=album&limit=20&market=IT`),
                apiClient.get(`/artists/${artistId}/albums?include_groups=single,appears_on&limit=20&market=IT`),
            ]);

            if (artistRes.status === 'rejected') {
                console.error("Failed to fetch artist details:", artistRes.reason);
                throw new Error("Impossibile caricare i dati dell'artista.");
            }
            setArtist(artistRes.value.data);

            if (topTracksRes.status === 'fulfilled' && topTracksRes.value.data.tracks) {
                setTracks(topTracksRes.value.data.tracks);
            }

            const albumItems: Album[] = albumsRes.status === 'fulfilled' && albumsRes.value.data.items ? albumsRes.value.data.items : [];
            const singleItems: Album[] = singlesRes.status === 'fulfilled' && singlesRes.value.data.items ? singlesRes.value.data.items : [];

            // De-duplicate using Map based on item ID
            const uniqueAlbums = [...new Map(albumItems.map((item) => [item.id, item])).values()];
            const uniqueSingles = [...new Map(singleItems.map((item) => [item.id, item])).values()];
            
            const albumIds = new Set(uniqueAlbums.map(a => a.id));
            const filteredSingles = uniqueSingles.filter(s => !albumIds.has(s.id));

            setAlbums(uniqueAlbums);
            setSingles(filteredSingles);

        } catch (err: any) {
            console.error("Error loading artist details:", err);
            setError("Impossibile caricare i dettagli dell'artista in questo momento.");
        } finally {
            setIsLoading(false);
        }
    }, [artistId]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);
    
    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-black',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10',
    };

    if (isLoading) {
        const loadingIndicatorText = isNight ? 'text-zinc-400' : 'text-zinc-600';
        return (
            <div className="flex-grow flex flex-col justify-center items-center">
                <FiLoader className={`animate-spin text-4xl ${loadingIndicatorText}`} />
                <p className={`mt-4 ${loadingIndicatorText}`}>Caricamento dettagli artista...</p>
            </div>
        );
    }

    if (error) {
        const errorButtonClasses = isNight
            ? 'mt-6 px-6 py-2 bg-blue-500/60 hover:bg-blue-500/80 text-white rounded-full font-semibold transition-colors'
            : 'mt-6 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-semibold transition-colors';
        return (
          <div className="flex-grow flex flex-col justify-center items-center text-center p-4">
            <FiAlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <p className={`font-semibold ${theme.textPrimary}`}>{error}</p>
            <button onClick={fetchDetails} className={errorButtonClasses}>Riprova</button>
          </div>
        );
    }

    if (!artist) {
        return <div className="flex-grow flex justify-center items-center text-red-400">Artist not found.</div>;
    }
    
    const trackUris = tracks.map(t => t.uri);

    return (
        <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
            <header className="flex items-end gap-6 mb-6 pt-4 px-6">
                {artist.images?.[0]?.url ? (
                    <img src={artist.images[0].url} alt={artist.name} className="w-48 h-48 rounded-full object-cover shadow-2xl" />
                ) : (
                    <div className="w-48 h-48 rounded-full bg-zinc-800 flex items-center justify-center shadow-2xl">
                        <FiMusic className="w-24 h-24 text-zinc-500" />
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <h1 className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)'}}>{artist.name}</h1>
                    <p className={`text-sm ${theme.textSecondary}`}>{formatFollowers(artist.followers.total)} followers</p>
                    {tracks.length > 0 && (
                        <button onClick={() => onPlay({ uris: trackUris })} className="mt-4 bg-green-500 text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                            <FiPlay className="w-7 h-7 ml-1" />
                        </button>
                    )}
                </div>
            </header>

            {tracks.length > 0 && (
                <div className="px-6">
                    <h2 className={`text-2xl font-bold mb-4 ${theme.textPrimary}`}>Popolari</h2>
                    <div className="flex flex-col">
                        {tracks.slice(0, 5).map((track, index) => {
                            const isPlaying = isPlayingContext && track.id === currentTrackId;
                            const activeColor = isNight ? 'text-green-400' : 'text-green-600';

                            return (
                                <div 
                                    key={track.id + index}
                                    onClick={() => onPlay({ uris: trackUris, offset: { position: index } })}
                                    className={`flex items-center gap-4 p-2 px-4 rounded-md cursor-pointer ${theme.hover}`}
                                >
                                    <div className="w-8 text-center font-medium">
                                        {isPlaying ? (
                                            <AnimatedEqualizer className={`mx-auto ${activeColor}`} />
                                        ) : (
                                            <span className={theme.textSecondary}>{index + 1}</span>
                                        )}
                                    </div>
                                    <img 
                                      src={track.album.images?.[2]?.url || track.album.images?.[0]?.url} 
                                      alt={track.album.name} 
                                      className="w-10 h-10 rounded flex-shrink-0 object-cover" 
                                    />
                                    <div className="flex-grow flex flex-col overflow-hidden">
                                        <span className={`truncate font-bold ${isPlaying ? activeColor : theme.textPrimary}`}>{track.name}</span>
                                        {track.explicit && <span className="text-xs text-zinc-400">Explicit</span>}
                                    </div>
                                    <div className={`flex-shrink-0 text-sm font-medium text-right ${theme.textSecondary}`}>{formatDuration(track.duration_ms)}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {albums.length > 0 && (
                <ContentCarousel 
                    title="Album"
                    items={albums}
                    isNight={isNight}
                    onSelectItem={onSelectItem}
                    keyPrefix={`artist-albums-${artistId}`}
                />
            )}

            {singles.length > 0 && (
                <ContentCarousel 
                    title="Singoli ed EP"
                    items={singles}
                    isNight={isNight}
                    onSelectItem={onSelectItem}
                    keyPrefix={`artist-singles-${artistId}`}
                />
            )}
        </div>
    );
};

export default ArtistDetailView;