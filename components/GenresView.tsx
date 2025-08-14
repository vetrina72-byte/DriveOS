
import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader } from 'react-icons/fi';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';

const GenresView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [categories, setCategories] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch a large list of categories available in Italy
                const response = await apiClient.get('/browse/categories', {
                    params: {
                        country: 'IT',
                        limit: 50,
                    }
                });
                // Map the response to our SpotifyItem structure
                const mappedCategories = response.data.categories.items.map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    uri: cat.href, // Not a playable URI, but good for reference
                    images: cat.icons,
                    type: 'category',
                }));
                setCategories(mappedCategories);
            } catch (err) {
                console.error('Failed to fetch categories', err);
                setError('Could not load genres.');
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>Generi e Mood</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {categories.map((category, index) => (
                     <PlaylistItem 
                        key={`genre-${category.id}-${index}`} 
                        item={{...category, description: 'Genere'}} 
                        isNight={isNight} 
                        // Currently, clicking a category does nothing. This can be extended later.
                        onSelectItem={() => { console.log('Category selected:', category.name); }}
                     />
                ))}
            </div>
        </div>
    );
};

export default GenresView;
