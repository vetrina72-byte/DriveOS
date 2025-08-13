import React, { useState, useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import SpotifyLogin from './SpotifyLogin';

export default function SpotifyPlayer({ 
    isOpen, 
    onClose, 
    spotifyPlayerTop,
    spotifyPlayerBottom,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
}) {
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
  const [translateX, setTranslateX] = useState(100); // Start closed (100%)
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


  return (
    <div 
        className={`fixed right-0 w-2/3 text-white shadow-2xl z-20 flex`}
        style={{
            transform: `translateX(${translateX}%)`,
            top: `${spotifyPlayerTop}px`,
            bottom: `${spotifyPlayerBottom}px`,
        }}
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotify-player-title"
        onClick={stopPropagation}
    >
        <div className="w-full h-full flex flex-col relative bg-black">
            <header className="absolute top-0 right-0 p-4 z-20">
                <button className="p-2 bg-black/50 rounded-full hover:bg-red-500/80 transition-colors" onClick={onClose} aria-label="Close Spotify">
                    <FiX className="h-5 w-5"/>
                </button>
            </header>
            <h1 id="spotify-player-title" className="sr-only">Spotify Login</h1>
            <div className="flex-grow flex justify-center items-center overflow-hidden">
                 <SpotifyLogin />
            </div>
        </div>
    </div>
  );
}
