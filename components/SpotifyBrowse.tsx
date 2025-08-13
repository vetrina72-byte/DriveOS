

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Carousel, { CarouselItem } from './Carousel';
import { FiLoader } from 'react-icons/fi';
import PlaylistView from './PlaylistView';
import ArtistView from './ArtistView';

const NAV_ITEMS = ["Home", "Playlist", "Artisti", "Album", "Podcast"];

interface PlaylistItem {
    id: string;
    uri: string;
    name: string;
    description: string;
    images: { url: string }[];
    owner: { display_name: string };
    type: 'playlist';
}

interface RecentlyPlayedItem {
    track: {
        id: string;
        uri: string;
        name: string;
        album: {
            uri: string;
            images: { url: string }[];
        };
        artists: { name: string, id: string, uri: string }[];
    };
}

type View = { type: 'home' } | { type: 'playlist'; id: string; name: string; } | { type: 'artist'; id: string; name: string };

export default function SpotifyBrowse({ initialView }: { initialView: any | null }) {
    const { accessToken, user } = useAuth();
    const [activeNav, setActiveNav] = useState("Home");
    const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
    const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewStack, setViewStack] = useState<View[]>([initialView || { type: 'home' }]);

    const currentView = viewStack[viewStack.length - 1];

    const navigateTo = useCallback((view: View) => {
        setViewStack(prev => [...prev, view]);
    }, []);

    const navigateBack = useCallback(() => {
        if (viewStack.length > 1) {
            setViewStack(prev => prev.slice(0, -1));
        }
    }, [viewStack.length]);
    
    const handleItemClick = useCallback((item: CarouselItem) => {
        if (item.type === 'playlist' || item.type === 'artist') {
            navigateTo({
                type: item.type,
                id: item.id,
                name: item.name
            });
        }
    }, [navigateTo]);


    useEffect(() => {
        if (!accessToken || currentView.type !== 'home') return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [playlistsRes, recentlyPlayedRes] = await Promise.all([
                    axios.get('https://api.spotify.com/v1/me/playlists?limit=20', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    }),
                    axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=20', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    })
                ]);
                
                const typedPlaylists = playlistsRes.data.items.map((p: any) => ({ ...p, type: 'playlist' }));
                setPlaylists(typedPlaylists);

                const uniqueTracks: { [key: string]: any } = {};
                recentlyPlayedRes.data.items.forEach((item: RecentlyPlayedItem) => {
                    if (!uniqueTracks[item.track.id]) {
                        uniqueTracks[item.track.id] = {
                            id: item.track.id,
                            uri: item.track.album.uri,
                            name: item.track.name,
                            images: item.track.album.images,
                            description: item.track.artists.map(a => a.name).join(', '),
                            type: 'album',
                        };
                    }
                });
                setRecentlyPlayed(Object.values(uniqueTracks));

            } catch (error) {
                console.error("Failed to fetch Spotify data", error);
            } finally {
                setIsLoading(false);
            }
        };
        if(playlists.length === 0) {
            fetchData();
        } else {
            setIsLoading(false);
        }
    }, [accessToken, currentView.type, playlists.length]);

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Buongiorno";
        if (hour < 18) return "Buon pomeriggio";
        return "Buonasera";
    };

    const renderHomeView = () => (
        <main className="flex-grow overflow-y-auto px-6 pb-6 space-y-8 animate-fade-in">
            {isLoading ? (
                 <div className="flex justify-center items-center h-full">
                    <FiLoader className="animate-spin text-zinc-400 text-4xl" />
                </div>
            ) : (
                <>
                    <Carousel title={greeting()} items={recentlyPlayed.slice(0, 6)} onItemClick={handleItemClick} />
                    <Carousel title="Ritorna ad ascoltare" items={recentlyPlayed} onItemClick={handleItemClick} />
                    <Carousel title="Le tue playlist" items={playlists} onItemClick={handleItemClick} />
                </>
            )}
        </main>
    );

    const renderCurrentView = () => {
        switch (currentView.type) {
            case 'playlist':
                return <PlaylistView playlistId={currentView.id} onBack={navigateBack} onNavigate={navigateTo} />;
            case 'artist':
                return <ArtistView artistId={currentView.id} onBack={navigateBack} />;
            case 'home':
            default:
                return renderHomeView();
        }
    }

    return (
        <div className="w-full h-full flex flex-col">
            <header className="flex-shrink-0 p-4 pt-6 pl-6 flex items-center justify-between">
                <nav className="flex items-center gap-4">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item}
                            onClick={() => setActiveNav(item)}
                            className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${
                                activeNav === item 
                                ? 'bg-white text-black' 
                                : 'bg-transparent text-zinc-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {item}
                        </button>
                    ))}
                </nav>
            </header>
            
            {renderCurrentView()}
        </div>
    );
}