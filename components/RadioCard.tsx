import React, { useState, useEffect } from 'react';
import type { RadioStation } from '../types';
import { FiRadio } from 'react-icons/fi';

interface RadioCardProps {
    station: RadioStation;
    onPlay: (station: RadioStation) => void;
    isNight: boolean;
}

const RadioCard: React.FC<RadioCardProps> = ({ station, onPlay, isNight }) => {
    const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

    useEffect(() => {
        if (!station.favicon) {
            setImageStatus('error');
            return;
        }

        setImageStatus('loading');
        const img = new Image();
        img.src = station.favicon;

        const handleLoad = () => setImageStatus('loaded');
        const handleError = () => setImageStatus('error');

        img.addEventListener('load', handleLoad);
        img.addEventListener('error', handleError);

        return () => {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
        };
    }, [station.favicon]);
    
    const bgColor = isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10';
    const placeholderBg = isNight ? 'bg-zinc-800' : 'bg-zinc-300';
    const placeholderIconColor = isNight ? 'text-zinc-500' : 'text-zinc-600';

    return (
        <div className="w-full max-w-[11rem] mx-auto flex-shrink-0">
            <div 
                className={`p-3 rounded-lg w-full h-full flex flex-col transition-all duration-300 ${bgColor}`}
            >
                <button
                    onClick={() => onPlay(station)}
                    className="relative w-full aspect-square mb-3 cursor-pointer group"
                    aria-label={`Play ${station.name}`}
                >
                    {imageStatus === 'loaded' ? (
                        <img
                            src={station.favicon}
                            alt={station.name}
                            className={`w-full h-full rounded-md object-contain shadow-lg ${isNight ? 'bg-zinc-800' : 'bg-white'}`}
                        />
                    ) : (
                         <div className={`w-full h-full rounded-md flex items-center justify-center ${placeholderBg}`}>
                           <FiRadio className={`w-10 h-10 ${placeholderIconColor}`} />
                        </div>
                    )}
                </button>
                <h3 className={`font-bold truncate ${isNight ? 'text-white' : 'text-zinc-800'}`}>{station.name}</h3>
                <p className={`text-sm truncate ${isNight ? 'text-[#b3b3b3]' : 'text-zinc-500'}`}>{station.tags.split(',')[0]}</p>
            </div>
        </div>
    );
};

export default RadioCard;