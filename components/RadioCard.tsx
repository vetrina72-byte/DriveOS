import React, { useState } from 'react';
import type { RadioStation } from '../types';
import { FiRadio, FiPlay } from 'react-icons/fi';

interface RadioCardProps {
    station: RadioStation;
    onPlay: (station: RadioStation) => void;
    isNight: boolean;
}

const RadioCard: React.FC<RadioCardProps> = ({ station, onPlay, isNight }) => {
    const [imageError, setImageError] = useState(!station.favicon);
    
    const textColorPrimary = isNight ? 'text-white' : 'text-zinc-800';
    const textColorSecondary = isNight ? 'text-[#b3b3b3]' : 'text-zinc-500';
    const bgColor = isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10';
    const placeholderBg = isNight ? 'bg-zinc-800' : 'bg-zinc-200';
    const placeholderIconColor = isNight ? 'text-zinc-500' : 'text-zinc-600';
    const tag = station.tags ? station.tags.split(',')[0].trim() : 'Live Radio';

    return (
        <div 
            onClick={() => onPlay(station)}
            className={`p-2.5 sm:p-3 squircle-card rounded-2xl transition-all duration-200 w-full mx-auto ${bgColor} cursor-pointer border border-white/5 hover:border-white/20 hover:scale-[1.02] group relative flex flex-col`}
            style={{ contain: 'layout paint' }}
        >
            <div className={`relative w-full aspect-square mb-2 sm:mb-2.5 overflow-hidden squircle-card rounded-xl ${isNight ? 'bg-zinc-900/80' : 'bg-zinc-100'} p-2 flex items-center justify-center shadow-inner`}>
                {station.favicon && !imageError ? (
                    <img
                        src={station.favicon}
                        alt={station.name}
                        loading="lazy"
                        decoding="async"
                        onError={() => setImageError(true)}
                        className="w-full h-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className={`w-full h-full flex items-center justify-center ${placeholderBg} rounded-lg`}>
                        <FiRadio className={`w-8 h-8 sm:w-10 sm:h-10 ${placeholderIconColor}`} />
                    </div>
                )}

                {/* Persistent play button - always visible, neutral automotive styling */}
                <div 
                    className={`absolute bottom-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full ${
                        isNight 
                            ? 'bg-zinc-800/90 text-white border border-white/20' 
                            : 'bg-white/95 text-zinc-900 border border-black/10'
                    } shadow-md backdrop-blur-sm flex items-center justify-center transition-all duration-200 group-hover:scale-110 active:scale-95 pointer-events-none`}
                    aria-hidden="true"
                >
                    <FiPlay className="w-3.5 h-3.5 fill-current ml-0.5" />
                </div>
            </div>

            <h3 className={`font-semibold truncate text-xs sm:text-sm ${textColorPrimary}`}>
                {station.name}
            </h3>
            <p className={`text-[11px] sm:text-xs truncate capitalize ${textColorSecondary}`}>
                Radio • {tag}
            </p>
        </div>
    );
};

export default React.memo(RadioCard);