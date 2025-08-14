
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import SpotifyLogin from './SpotifyLogin';
import TopNavBar from './TopNavBar';
import ContentArea from './ContentArea';
import PlaylistDetailView from './PlaylistDetailView';

type View = 'main' | 'playlistDetail' | 'search' | 'category';

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
    const { isAuthenticated, user, error, play } = useAuth();
    
    const [translateX, setTranslateX] = useState(100);
    const animationFrameId = useRef<number | null>(null);
    const [view, setView] = useState<View>('main');
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
    const [activeNav, setActiveNav] = useState('Home');

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

    // Reset view when the app is closed
    useEffect(() => {
        if (!isOpen) {
            // Add a small delay to allow the closing animation to finish before resetting the view
            setTimeout(() => {
                setView('main');
                setSelectedPlaylistId(null);
                setActiveNav('Home');
            }, 500);
        }
    }, [isOpen]);

    const handleItemSelect = (item: { type: string; uri: string; id: string; }) => {
        if (item.type === 'playlist' || item.type === 'album') {
            setSelectedPlaylistId(item.id);
            setView('playlistDetail');
        } else {
            play(item.uri);
        }
    };
    
    const handleNavigation = (navItem: string) => {
      // In a real app, this would change the view or fetch different data
      setActiveNav(navItem);
      setView('main'); // Go back to main view when changing category
      setSelectedPlaylistId(null);
      console.log(`Navigating to ${navItem}`);
    };

    const bgColor = isNight ? 'bg-[#282828]' : 'bg-white';
    const textColor = isNight ? 'text-white' : 'text-black';
    const buttonBg = isNight ? 'bg-black/50 hover:bg-red-500/80' : 'bg-black/10 hover:bg-red-500/80';
    const borderColor = isNight ? '' : 'border-l-2 border-gray-200';

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
            switch(view) {
                case 'main':
                    return <ContentArea isNight={isNight} onItemSelect={handleItemSelect} activeCategory={activeNav} />;
                case 'playlistDetail':
                    return <PlaylistDetailView 
                                playlistId={selectedPlaylistId!} 
                                isNight={isNight}
                                onBack={() => setView('main')}
                                onItemPlay={handleItemSelect}
                           />;
                default:
                    return <ContentArea isNight={isNight} onItemSelect={handleItemSelect} activeCategory={activeNav} />;
            }
        }
        
        return <SpotifyLogin />;
    };

    return (
        <div 
            className={`fixed right-0 shadow-2xl z-20 flex ${borderColor}`}
            style={{
                transform: `translateX(${translateX}%)`,
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
                width: '66.666667%',
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotify-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div className={`w-full h-full flex flex-col relative ${bgColor} ${textColor} backdrop-blur-lg`}>
                <header className="absolute top-0 right-0 p-4 z-30">
                    <button className={`p-2 rounded-full transition-colors ${buttonBg}`} onClick={onClose} aria-label="Close Spotify">
                        <FiX className="h-5 w-5 text-white"/>
                    </button>
                </header>
                 {isAuthenticated && (
                     <TopNavBar 
                        isNight={isNight} 
                        onNavigate={handleNavigation} 
                        activeLink={activeNav} 
                        onBack={() => setView('main')}
                        showBackButton={view === 'playlistDetail'}
                     />
                 )}
                <h1 id="spotify-app-title" className="sr-only">Spotify App</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden">
                     {renderContent()}
                </div>
            </div>
        </div>
    );
}
