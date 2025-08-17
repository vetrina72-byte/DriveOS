import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiPlay, FiLoader, FiMic } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

interface Show {
    id: string;
    name: string;
    publisher: string;
    description: string;
    images: { url: string }[];
    uri: string;
}

interface Episode {
    id: string;
    name: string;
    description: string;
    duration_ms: number;
    release_date: string;
    uri: string;
    images: { url: string }[];
}

interface ShowDetailViewProps {
    showId: string;
    isNight: boolean;
    onPlay: (options: { uris?: string[] }) => void;
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

const formatDuration = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
        return `${hours} h ${minutes} min`;
    }
    return `${minutes} min`;
};

const ShowDetailView: React.FC<ShowDetailViewProps> = ({ showId, isNight, onPlay }) => {
    const [show, setShow] = useState<Show | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { playerState } = useAuth();

    const isPlayingContext = playerState && !playerState.paused;
    const currentTrackId = playerState?.track_window.current_track?.id;

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch show details and episodes in parallel
                const [showRes, episodesRes] = await Promise.all([
                    apiClient.get(`/shows/${showId}`),
                    apiClient.get(`/shows/${showId}/episodes?limit=50`)
                ]);
                setShow(showRes.data);
                setEpisodes(episodesRes.data.items);
            } catch (err) {
                console.error(`Failed to fetch show details`, err);
                setError(`Could not load show details.`);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [showId]);
    
    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-black',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10',
        border: isNight ? 'border-white/10' : 'border-black/10',
        placeholderBg: isNight ? 'bg-zinc-800' : 'bg-zinc-300',
        placeholderIcon: isNight ? 'text-zinc-500' : 'text-zinc-600',
    };

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} /></div>;
    }

    if (error || !show) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error || 'Show not found.'}</div>;
    }
    
    const sanitizedShowDescription = show.description.replace(/<[^>]*>?/gm, '');

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            {/* Header */}
            <header className="flex items-end gap-6 mb-6 pt-4">
                <img src={show.images[0].url} alt={show.name} className="w-48 h-48 rounded-md object-cover shadow-2xl" />
                <div className="flex flex-col gap-3 self-end">
                    <span className="text-sm font-bold uppercase">Podcast</span>
                    <h1 className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)'}}>{show.name}</h1>
                    <p className={`text-lg font-semibold ${theme.textPrimary}`}>{show.publisher}</p>
                </div>
            </header>
            
            <p className={`mb-6 ${theme.textSecondary}`}>{sanitizedShowDescription}</p>

            {/* Episode List Header */}
            <h2 className={`text-2xl font-bold mb-4 ${theme.textPrimary}`}>Episodi</h2>
            
            {/* Episode List */}
            <div className="flex flex-col gap-2">
                {episodes.map((episode) => {
                    const isPlaying = isPlayingContext && episode.id === currentTrackId;
                    const activeColor = isNight ? 'text-green-400' : 'text-green-600';

                    return (
                        <div 
                            key={episode.id}
                            onClick={() => onPlay({ uris: [episode.uri] })}
                            className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center p-2 px-4 rounded-md cursor-pointer ${theme.hover}`}
                        >
                            {episode.images?.[0]?.url ? (
                                <img src={episode.images[0].url} alt={episode.name} className="w-16 h-16 rounded object-cover flex-shrink-0"/>
                            ) : (
                                <div className={`w-16 h-16 rounded flex items-center justify-center flex-shrink-0 ${theme.placeholderBg}`}>
                                    <FiMic className={`w-8 h-8 ${theme.placeholderIcon}`} />
                                </div>
                            )}
                            <div className="flex flex-col overflow-hidden">
                                <div className="flex items-center gap-2 min-w-0">
                                    {isPlaying && <AnimatedEqualizer className={`w-4 h-4 flex-shrink-0 ${activeColor}`} />}
                                    <span className={`font-bold truncate ${isPlaying ? activeColor : theme.textPrimary}`}>{episode.name}</span>
                                </div>
                                <span className={`text-sm mt-1 text-ellipsis overflow-hidden line-clamp-2 ${theme.textSecondary}`}>{episode.description.replace(/<[^>]*>?/gm, '')}</span>
                                <div className={`flex items-center gap-2 mt-2 text-xs ${theme.textSecondary}`}>
                                    <span>{new Date(episode.release_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    <span>•</span>
                                    <span>{formatDuration(episode.duration_ms)}</span>
                                </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); onPlay({ uris: [episode.uri] }); }} className="bg-green-500 text-black w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform flex-shrink-0">
                                <FiPlay className="w-5 h-5 ml-0.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ShowDetailView;