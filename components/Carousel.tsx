

import React from 'react';
import { FiMusic, FiPlay } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export interface CarouselItem {
    id: string;
    uri: string;
    name: string;
    description?: string;
    images: { url: string }[];
    type?: 'track' | 'playlist' | 'album' | 'artist';
}

interface CarouselProps {
    title: string;
    items: CarouselItem[];
    onItemClick: (item: CarouselItem) => void;
}

const Card = ({ item, onItemClick }: { item: CarouselItem, onItemClick: (item: CarouselItem) => void; }) => {
    const { play } = useAuth();
    const [isHovered, setIsHovered] = React.useState(false);

    const handlePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.type === 'track') {
             play({ uris: [item.uri] });
        } else {
             play({ context_uri: item.uri });
        }
    };
    
    const handleCardClick = () => {
        if (item.type === 'playlist' || item.type === 'artist') {
            onItemClick(item);
        } else {
            // If it's a track or album, just play it
            handlePlay({ stopPropagation: () => {} } as React.MouseEvent);
        }
    };

    return (
        <div 
            className="flex-shrink-0 w-48 bg-white/5 p-4 rounded-lg hover:bg-white/10 transition-colors duration-300 group cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleCardClick}
        >
            <div className="relative mb-4">
                {item.images && item.images.length > 0 ? (
                    <img src={item.images[0].url} alt={item.name} className="w-full h-40 object-cover rounded-md shadow-lg" />
                ) : (
                    <div className="w-full h-40 bg-zinc-800 rounded-md flex items-center justify-center">
                        <FiMusic className="text-zinc-500 w-12 h-12" />
                    </div>
                )}
                 <button 
                    onClick={handlePlay}
                    className={`absolute bottom-2 right-2 bg-green-500 text-white rounded-full p-3 shadow-xl transition-all duration-300 ease-in-out
                        ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                    aria-label={`Play ${item.name}`}
                >
                    <FiPlay className="w-5 h-5 ml-0.5" />
                </button>
            </div>
            <h3 className="font-bold text-white truncate">{item.name}</h3>
            <p className="text-sm text-zinc-400 truncate">{item.description || ' '}</p>
        </div>
    );
}

const Carousel: React.FC<CarouselProps> = ({ title, items, onItemClick }) => {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <section>
            <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
            <div className="flex gap-6 overflow-x-auto pb-4 -mx-6 px-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`.flex.overflow-x-auto::-webkit-scrollbar { display: none; }`}</style>
                {items.map(item => <Card key={item.id + item.name} item={item} onItemClick={onItemClick} />)}
            </div>
        </section>
    );
};

export default Carousel;
