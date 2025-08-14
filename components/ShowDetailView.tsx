
import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiPlay, FiLoader } from 'react-icons/fi';

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
        textPrimary: isNight ? 'text-white' : 'text-zinc-800',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10',
        border: isNight ? 'border-white/10' : 'border-black/10',
    };

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} /></div>;
    }

    if (error || !show) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error || 'Show not found.'}</div>;
    }
    
    const sanitizedShowDescription = show.description.replace(/<[^>]*>?/gm, '');

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6">
            {/* Header */}
            <header className="flex items-end gap-6 mb-6 pt-4">
                <img src={show.images[0].url} alt={show.name} className="w-48 h-48 rounded-md object-cover shadow-2xl" />
                <div className="flex flex-col gap-3 self-end">
                    <span className="text-sm font-bold uppercase">Podcast</span>
                    <h1 className="text-5xl font-bold tracking-tight">{show.name}</h1>
                    <p className={`text-lg font-semibold ${theme.textPrimary}`}>{show.publisher}</p>
                </div>
            </header>
            
            <p className={`mb-6 ${theme.textSecondary}`}>{sanitizedShowDescription}</p>

            {/* Episode List Header */}
            <h2 className={`text-2xl font-bold mb-4 ${theme.textPrimary}`}>Episodi</h2>
            
            {/* Episode List */}
            <div className="flex flex-col gap-2">
                {episodes.map((episode) => (
                    <div 
                        key={episode.id}
                        onClick={() => onPlay({ uris: [episode.uri] })}
                        className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center p-2 px-4 rounded-md cursor-pointer ${theme.hover}`}
                    >
                        <img src={episode.images[0].url} alt={episode.name} className="w-16 h-16 rounded object-cover"/>
                        <div className="flex flex-col overflow-hidden">
                            <span className={`font-medium truncate ${theme.textPrimary}`}>{episode.name}</span>
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
                ))}
            </div>
        </div>
    );
};

export default ShowDetailView;
