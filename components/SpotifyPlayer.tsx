import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiLogOut } from 'react-icons/fi';
import { FaSpotify, FaUserCircle } from 'react-icons/fa';

// Define a type for the auth props passed from the main App component
interface SpotifyAuthProps {
  accessToken: string | null;
  userInfo: any;
  error: string | null;
  login: () => void;
  logout: () => void;
}

export default function SpotifyPlayer({ 
    isOpen, 
    onClose, 
    spotifyPlayerTop,
    spotifyPlayerBottom,
    auth,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
    auth: SpotifyAuthProps;
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
  
  const renderContent = () => {
    if (auth.error) {
      return (
        <div className="flex-grow flex flex-col justify-center items-center text-center p-8">
          <h2 className="text-xl font-bold text-red-500 mb-2">Authentication Error</h2>
          <p className="text-zinc-400 mb-6 max-w-sm">{auth.error}</p>
          <button
            onClick={auth.login}
            className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 px-6 rounded-full text-md transition-all duration-300 transform hover:scale-105"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (auth.accessToken && !auth.userInfo) {
      return (
        <div className="flex-grow flex flex-col justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            <p className="text-zinc-400 mt-4">Loading user profile...</p>
        </div>
      );
    }
    
    if (auth.accessToken && auth.userInfo) {
      const userImage = auth.userInfo.images?.[0]?.url;
      return (
        <div className="flex-grow flex flex-col justify-between items-center p-8 bg-gradient-to-b from-zinc-800 to-black">
            <div className="flex items-center gap-4">
                {userImage ? (
                    <img src={userImage} alt={auth.userInfo.display_name} className="w-12 h-12 rounded-full"/>
                ) : (
                    <FaUserCircle className="w-12 h-12 text-zinc-600"/>
                )}
                <div>
                    <p className="text-zinc-400 text-sm">Logged in as</p>
                    <h2 className="text-xl font-bold">{auth.userInfo.display_name}</h2>
                </div>
            </div>
            
            <div className="text-center">
                <p className="text-zinc-400">Playback controls would be here.</p>
                {/* Future implementation: Player UI */}
            </div>

            <button
                onClick={auth.logout}
                className="bg-red-600/80 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full text-md transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                aria-label="Log out from Spotify"
            >
                <FiLogOut />
                <span>Log Out</span>
            </button>
        </div>
      );
    }

    // Default: Logged out
    return (
      <div className="flex-grow flex justify-center items-center overflow-hidden">
           <button
              id="login-button"
              onClick={auth.login}
              className="bg-[#1DB954] hover:bg-[#1AA34A] text-white font-bold py-4 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-3"
              aria-label="Accedi con Spotify"
          >
              <FaSpotify className="w-6 h-6" />
              <span>Accedi con Spotify</span>
          </button>
      </div>
    );
  };


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
            <h1 id="spotify-player-title" className="sr-only">Spotify Player</h1>
            {renderContent()}
        </div>
    </div>
  );
}