import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMusic } from 'react-icons/fi';
import type { YouTubeTrackInfo } from '../types';

// Expanded and diversified pool of fallback tracks for variety.
const FALLBACK_TRACK_POOL: YouTubeTrackInfo[] = [
    // Lofi & Chill
    { videoId: 'jfKfPfyJRdk', title: 'Lofi Hip Hop Radio', channelTitle: 'Lofi Girl', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault_live.jpg' },
    { videoId: 'rUxyKA_-grg', title: 'Synthwave Radio', channelTitle: 'Lofi Girl', thumbnail: 'https://i.ytimg.com/vi/rUxyKA_-grg/hqdefault_live.jpg' },
    { videoId: '5wRWniH7rt8', title: 'Chillhop Radio', channelTitle: 'Chillhop Raccoon', thumbnail: 'https://i.ytimg.com/vi/5wRWniH7rt8/hqdefault_live.jpg' },
    
    // Genre Mixes
    { videoId: '3455n3-sO8M', title: 'Mix Pop Internazionale', channelTitle: 'Level Up', thumbnail: 'https://i.ytimg.com/vi/3455n3-sO8M/hqdefault.jpg' },
    { videoId: 'ep6581-2294', title: 'Mix Rock Classico 70s-90s', channelTitle: 'Old Music', thumbnail: 'https://i.ytimg.com/vi/ep6581-2294/hqdefault.jpg' },
    { videoId: 'G_KzP2y2l4c', title: 'Successi Italiani di Sempre', channelTitle: 'Musica, Amore e Ricordi', thumbnail: 'https://i.ytimg.com/vi/G_KzP2y2l4c/hqdefault.jpg' },
    { videoId: 'Dx5qFachdxc', title: 'Relaxing Jazz Piano Radio', channelTitle: 'Cafe Music BGM channel', thumbnail: 'https://i.ytimg.com/vi/Dx5qFachdxc/hqdefault_live.jpg' },
    { videoId: 'h_Q24a4-h_g', title: 'Gaming Music Mix (EDM, Dubstep)', channelTitle: 'Magic Music', thumbnail: 'https://i.ytimg.com/vi/h_Q24a4-h_g/hqdefault.jpg' },
    { videoId: 'pRpeEdMmmQ0', title: 'Mix Indie/Rock/Alternative', channelTitle: 'alexrainbirdMusic', thumbnail: 'https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg' },
    { videoId: '0o1-52p32sY', title: 'Grandi Successi Anni \'80', channelTitle: '80s Music', thumbnail: 'https://i.ytimg.com/vi/0o1-52p32sY/hqdefault.jpg' },
    { videoId: 'ulIhVp_wF5g', title: 'Mix Reggaeton 2024', channelTitle: 'DJ Kike', thumbnail: 'https://i.ytimg.com/vi/ulIhVp_wF5g/hqdefault.jpg' },
    { videoId: 'W-fFHeTX70Q', title: 'Musica Classica Rilassante', channelTitle: 'HALIDONMUSIC', thumbnail: 'https://i.ytimg.com/vi/W-fFHeTX70Q/hqdefault.jpg' },

    // Ambient & Focus
    { videoId: 'DWcJFNfaw9c', title: 'Musica Ambient per Dormire', channelTitle: 'Quiet Quest - Study Music', thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg' },
    { videoId: '1O-k-J-4R1Y', title: 'Beautiful Space Music', channelTitle: 'Soothing Relaxation', thumbnail: 'https://i.ytimg.com/vi/1O-k-J-4R1Y/hqdefault.jpg' },
    
    // More Playlists
    { videoId: 'q0BVR5jRX40', title: 'Top Hits Italiane', channelTitle: 'Power Hits', thumbnail: 'https://i.ytimg.com/vi/q0BVR5jRX40/hqdefault.jpg'},
    { videoId: 'bO4_9-I528Q', title: 'Acoustic Covers', channelTitle: 'Relaxing Music', thumbnail: 'https://i.ytimg.com/vi/bO4_9-I528Q/hqdefault.jpg'},
];


const AnimatedEqualizer = ({ className }: { className?: string; }) => (
    <div className={`flex items-end justify-center w-8 h-8 gap-1 ${className}`}>
      <style>{`
        @keyframes equalizer-bar-soft {
          0%, 100% { height: 15%; }
          50% { height: 85%; }
        }
      `}</style>
      <span className="w-1.5 bg-current rounded-full" style={{ animation: 'equalizer-bar-soft 1.4s ease-in-out infinite', animationDelay: '0s' }}></span>
      <span className="w-1.5 bg-current rounded-full" style={{ animation: 'equalizer-bar-soft 1.4s ease-in-out infinite', animationDelay: '-0.2s' }}></span>
      <span className="w-1.5 bg-current rounded-full" style={{ animation: 'equalizer-bar-soft 1.4s ease-in-out infinite', animationDelay: '-0.4s' }}></span>
    </div>
);

interface QuotaErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    isNight: boolean;
    onPlayTrack: (track: YouTubeTrackInfo, playlistContext: YouTubeTrackInfo[]) => void;
}

const QuotaErrorModal: React.FC<QuotaErrorModalProps> = ({ isOpen, onClose, isNight, onPlayTrack }) => {
    const [displayTracks, setDisplayTracks] = useState<YouTubeTrackInfo[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Shuffle the pool and take the first 4 tracks to display
            const shuffled = [...FALLBACK_TRACK_POOL].sort(() => 0.5 - Math.random());
            setDisplayTracks(shuffled.slice(0, 4));
        }
    }, [isOpen]);
    
    const theme = {
        bg: isNight ? 'bg-zinc-800' : 'bg-gray-100',
        textPrimary: isNight ? 'text-zinc-100' : 'text-zinc-800',
        textSecondary: isNight ? 'text-zinc-400' : 'text-zinc-500',
        border: isNight ? 'border-zinc-700' : 'border-gray-200',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
        buttonBg: isNight ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className={`w-full max-w-md p-6 rounded-2xl shadow-2xl flex flex-col gap-4 border ${theme.bg} ${theme.border}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-4">
                            <AnimatedEqualizer className={theme.textSecondary} />
                            <h2 className={`text-2xl font-bold ${theme.textPrimary}`}>Un attimo di pausa 🎶</h2>
                        </div>
                        <p className={theme.textSecondary}>
                            Alcuni brani non sono disponibili al momento. Nel frattempo, perché non ascolti una di queste playlist offline?
                        </p>

                        <div className="flex flex-col gap-2 mt-2">
                            {displayTracks.map((track) => (
                                <button
                                    key={track.videoId}
                                    onClick={() => onPlayTrack(track, displayTracks)}
                                    className={`w-full text-left p-2 rounded-lg flex items-center gap-3 transition-colors ${theme.hover}`}
                                >
                                    <img src={track.thumbnail} alt={track.title} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                                    <div className="flex-grow min-w-0">
                                        <p className={`font-semibold truncate ${theme.textPrimary}`}>{track.title}</p>
                                        <p className={`text-sm truncate ${theme.textSecondary}`}>{track.channelTitle}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={onClose}
                            className={`mt-4 w-full py-3 font-semibold rounded-lg transition-colors ${theme.buttonBg} ${theme.textPrimary}`}
                        >
                            OK
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default QuotaErrorModal;