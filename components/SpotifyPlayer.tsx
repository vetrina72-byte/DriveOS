
import React, { useState, useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import SpotifyLogin from './SpotifyLogin';
import TopNavBar from './TopNavBar';
import ContentArea from './ContentArea';

export default function SpotifyApp({ 
    isOpen, 
    onClose, 
    isNight,
    spotifyPlayerTop,
    spotifyPlayerBottom,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    isNight: boolean;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
}) {
    const { isAuthenticated, user, error } = useAuth();
    
    const [translateX, setTranslateX] = useState(100);
    const animationFrameId = useRef<number | null>(null);

    const openingBoxSpeed = 4.5;
    const closingBoxSpeed = 8.6;

    useEffect(() => {
        let lastTime = performance.now();
        const animate = (now: number) => {
            const delta = (now - lastTime) / 1000;
            lastTime = now;
            setTranslateX(currentX => {
                const target = isOpen ? 0 : 100;
                const speed = isOpen ? openingBoxSpeed : closingBoxSpeed;
                const damp = 1 - Math.exp(-speed * delta);
                const newX = currentX + (target - currentX) * damp;
                if (Math.abs(target - newX) < 0.1) {
                    if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                    return target;
                }
                return newX;
            });
            animationFrameId.current = requestAnimationFrame(animate);
        };
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = requestAnimationFrame(animate);
        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, [isOpen, openingBoxSpeed, closingBoxSpeed]);

    const bgColor = isNight ? 'bg-black/80' : 'bg-gray-100/80';
    const buttonBg = isNight ? 'bg-black/50 hover:bg-red-500/80' : 'bg-white/50 hover:bg-red-500/80';

    const renderContent = () => {
        if (error) {
            return (
                <div className={`text-center flex flex-col items-center gap-4 ${isNight ? 'text-red-400' : 'text-red-600'}`}>
                    <p>Error: {error}</p>
                    <SpotifyLogin />
                </div>
            );
        }

        if (isAuthenticated && user) {
            return (
                <div className="flex flex-col w-full h-full">
                    <TopNavBar isNight={isNight} />
                    <ContentArea isNight={isNight} />
                </div>
            );
        }
        
        return <SpotifyLogin />;
    };

    return (
        <div 
            className={`fixed right-0 w-2/3 shadow-2xl z-20 flex`}
            style={{
                transform: `translateX(${translateX}%)`,
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotify-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div className={`w-full h-full flex flex-col relative ${bgColor} backdrop-blur-lg`}>
                <header className="absolute top-0 right-0 p-4 z-20">
                    <button className={`p-2 rounded-full transition-colors ${buttonBg}`} onClick={onClose} aria-label="Close Spotify">
                        <FiX className="h-5 w-5 text-white"/>
                    </button>
                </header>
                <h1 id="spotify-app-title" className="sr-only">Spotify App</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden">
                     {renderContent()}
                </div>
            </div>
        </div>
    );
}