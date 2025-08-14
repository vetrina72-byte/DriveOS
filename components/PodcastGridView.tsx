
import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader } from 'react-icons/fi';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';

const PodcastGridView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [shows, setShows] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchShows = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/me/shows?limit=50');
                // The API returns SavedShowObjects, we need to map to the show property
                setShows(response.data.items.map((item: any) => item.show));
            } catch (err) {
                console.error('Failed to fetch podcasts/shows', err);
                setError('Could not load your podcasts.');
            } finally {
                setLoading(false);
            }
        };
        fetchShows();
    }, []);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6">
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>I tuoi Podcast</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {shows.map((show, index) => (
                    <PlaylistItem key={`podcast-grid-${show.id}-${index}`} item={show} isNight={isNight} onSelectItem={onSelectItem} />
                ))}
            </div>
        </div>
    );
};

export default PodcastGridView;
