import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader } from 'react-icons/fi';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      ease: "easeOut",
      duration: 0.3
    }
  }
};

const genreImageMap: Record<string, string> = {
    'pop': 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'rock': 'https://images.pexels.com/photos/167491/pexels-photo-167491.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'hiphop': 'https://images.pexels.com/photos/894156/pexels-photo-894156.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'dance': 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'latin': 'https://images.pexels.com/photos/2085739/pexels-photo-2085739.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'indie_alt': 'https://images.pexels.com/photos/33597/guitar-classical-guitar-acoustic-guitar-electric-guitar.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'mood': 'https://images.pexels.com/photos/1423600/pexels-photo-1423600.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'party': 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'gaming': 'https://images.pexels.com/photos/4009626/pexels-photo-4009626.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'chill': 'https://images.pexels.com/photos/1563256/pexels-photo-1563256.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'decades': 'https://images.pexels.com/photos/1626481/pexels-photo-1626481.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'rnb': 'https://images.pexels.com/photos/3775164/pexels-photo-3775164.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'jazz': 'https://images.pexels.com/photos/164936/pexels-photo-164936.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'classical': 'https://images.pexels.com/photos/164789/pexels-photo-164789.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'metal': 'https://images.pexels.com/photos/167635/pexels-photo-167635.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'k-pop': 'https://images.pexels.com/photos/787961/pexels-photo-787961.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'country': 'https://images.pexels.com/photos/1484516/pexels-photo-1484516.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'folk_acoustic': 'https://images.pexels.com/photos/1654883/pexels-photo-1654883.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'blues': 'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'romance': 'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'soul': 'https://images.pexels.com/photos/3756785/pexels-photo-3756785.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'funk': 'https://images.pexels.com/photos/258602/pexels-photo-258602.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'focus': 'https://images.pexels.com/photos/5439433/pexels-photo-5439433.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'workout': 'https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'sleep': 'https://images.pexels.com/photos/935743/pexels-photo-935743.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'default': 'https://images.pexels.com/photos/374631/pexels-photo-374631.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
};

const getGenreImage = (categoryId: string): string => {
    return genreImageMap[categoryId] || genreImageMap['default'];
};


const GenresView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [categories, setCategories] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/browse/categories', {
                    params: {
                        country: 'IT',
                        limit: 50,
                    }
                });

                const categoriesToExclude = ["Realizzato per te", "Nuove uscite", "Sanremo", "Classifiche", "Allenamento", "Cucina e cena"];
                const filteredCategories = response.data.categories.items.filter(
                    (category: any) => !categoriesToExclude.includes(category.name)
                );

                const mappedCategories = filteredCategories.map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    uri: cat.href,
                    type: 'category',
                    customImageUrl: getGenreImage(cat.id),
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
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
                {categories.map((category, index) => (
                     <motion.div variants={itemVariants} key={`genre-${category.id}-${index}`}>
                       <PlaylistItem 
                          item={category} 
                          isNight={isNight} 
                          onSelectItem={onSelectItem}
                       />
                     </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

export default GenresView;