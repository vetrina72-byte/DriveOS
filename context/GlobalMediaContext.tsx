import React, { createContext, useContext, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getDeviceId, getPlayerInstance } from '../lib/spotify-player';
import apiClient from '../spotifyClient';
import YouTube from 'react-youtube';
import type { YouTubeTrackInfo } from '../types';

interface GlobalMediaContextType {
    globalTogglePlay: () => void;
    globalNextTrack: () => void;
    globalPrevTrack: () => void;
    isRadioPlaying: boolean;
    isYouTubePlaying: boolean;
    youTubeProgress: { position: number, duration: number };
    isYouTubeSeeking: boolean;
    handleSeekYouTube: (position: number) => void;
    handleYouTubeSeekStart: () => void;
    handleYouTubeSeekEnd: (position: number) => void;
}

const GlobalMediaContext = createContext<GlobalMediaContextType | undefined>(undefined);

export const GlobalMediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { nowPlaying, setNowPlaying, pauseSpotify, play, playYouTube } = useAuth();
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const hlsRef = useRef<any>(null);
    const youtubePlayerRef = useRef<any>(null);
    const progressIntervalRef = useRef<number | null>(null);
    const hasEndedRef = useRef(false);

    const [isRadioPlaying, setIsRadioPlaying] = useState(false);
    const [isYouTubePlaying, setIsYouTubePlaying] = useState(false);
    const [youTubeProgress, setYouTubeProgress] = useState({ position: 0, duration: 1 });
    const [isYouTubeSeeking, setIsYouTubeSeeking] = useState(false);
    const [currentYouTubeVideoId, setCurrentYouTubeVideoId] = useState<string | undefined>();

    const { radioStation, radioContext, source, youtubeTrack, youtubePlaylist, spotifyState } = nowPlaying;
    const isPlayerActive = spotifyState && spotifyState.track_window.current_track;

    const globalNextTrack = useCallback(async () => {
        if (source === 'spotify' || !source) {
            try {
                if (!isPlayerActive) throw new Error("NO_ACTIVE_DEVICE");
                await getPlayerInstance()?.nextTrack();
            } catch (e) {
                const deviceId = getDeviceId();
                if (deviceId) {
                    apiClient.post(`/me/player/next?device_id=${deviceId}`).catch(console.error);
                }
            }
        } else if (source === 'radio') {
            if (!radioContext?.length || !radioStation) return;
            const currentIndex = radioContext.findIndex(s => s.stationuuid === radioStation.stationuuid);
            if (currentIndex === -1) return;
            const nextIndex = (currentIndex + 1) % radioContext.length;
            setNowPlaying(prev => ({ ...prev, radioStation: radioContext[nextIndex] }));
        } else if (source === 'youtube' && youtubePlayerRef.current && youtubePlaylist) {
            const currentTrackIndex = youtubePlaylist.findIndex(track => track.videoId === youtubeTrack?.videoId);
            if (currentTrackIndex > -1 && currentTrackIndex < youtubePlaylist.length - 1) {
                const nextTrack = youtubePlaylist[currentTrackIndex + 1];
                playYouTube(nextTrack, youtubePlaylist);
            }
        }
    }, [source, isPlayerActive, radioContext, radioStation, setNowPlaying, youtubePlaylist, youtubeTrack, playYouTube]);

    const globalPrevTrack = useCallback(async () => {
        if (source === 'spotify' || !source) {
            try {
                if (!isPlayerActive) throw new Error("NO_ACTIVE_DEVICE");
                await getPlayerInstance()?.previousTrack();
            } catch (e) {
                const deviceId = getDeviceId();
                if (deviceId) {
                    apiClient.post(`/me/player/previous?device_id=${deviceId}`).catch(console.error);
                }
            }
        } else if (source === 'radio') {
            if (!radioContext?.length || !radioStation) return;
            const currentIndex = radioContext.findIndex(s => s.stationuuid === radioStation.stationuuid);
            if (currentIndex === -1) return;
            const prevIndex = (currentIndex - 1 + radioContext.length) % radioContext.length;
            setNowPlaying(prev => ({ ...prev, radioStation: radioContext[prevIndex] }));
        } else if (source === 'youtube' && youtubePlayerRef.current && youtubePlaylist) {
            const currentTrackIndex = youtubePlaylist.findIndex(track => track.videoId === youtubeTrack?.videoId);
            if (currentTrackIndex > 0) {
                const prevTrack = youtubePlaylist[currentTrackIndex - 1];
                playYouTube(prevTrack, youtubePlaylist);
            }
        }
    }, [source, isPlayerActive, radioContext, radioStation, setNowPlaying, youtubePlaylist, youtubeTrack, playYouTube]);

    const globalTogglePlay = useCallback(async () => {
        if (source === 'spotify' || !source) {
            if (spotifyState?.paused || !isPlayerActive || !source) {
                try {
                    if (!isPlayerActive) throw new Error("NO_ACTIVE_DEVICE");
                    if (!source) {
                        setNowPlaying(s => ({ ...s, source: 'spotify' }));
                    }
                    play({});
                } catch (e) {
                    const deviceId = getDeviceId();
                    if (deviceId) {
                        const lastCtx = localStorage.getItem("spotify_last_context");
                        const lastUr = localStorage.getItem("spotify_last_track");
                        const lastPos = localStorage.getItem("spotify_last_position");
                        const body: any = {};
                        if (lastCtx && lastCtx !== "undefined") body.context_uri = lastCtx;
                        else if (lastUr && lastUr !== "undefined") body.uris = [lastUr];
                        if (lastPos && lastPos !== "undefined") body.position_ms = parseInt(lastPos, 10);
                        
                        apiClient.put(`/me/player/play?device_id=${deviceId}`, body).catch(console.error);
                        if (!source) setNowPlaying(s => ({ ...s, source: 'spotify' }));
                    }
                }
            } else {
                try {
                    pauseSpotify();
                    if (!isPlayerActive) throw new Error("NO_ACTIVE_DEVICE");
                } catch (e) {
                    const deviceId = getDeviceId();
                    if (deviceId) apiClient.put(`/me/player/pause?device_id=${deviceId}`).catch(console.error);
                }
            }
        } else if (source === 'radio') {
            const audio = audioRef.current;
            if (audio) {
                if (audio.paused) audio.play().catch(console.error);
                else audio.pause();
            }
        } else if (source === 'youtube' && youtubePlayerRef.current) {
            const state = youtubePlayerRef.current.getPlayerState();
            if (state === 1) youtubePlayerRef.current.pauseVideo();
            else youtubePlayerRef.current.playVideo();
        }
    }, [source, spotifyState, isPlayerActive, play, pauseSpotify]);

    // Handle Hardware Media Keys and Steering Wheel keys globally
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'MediaPlayPause') {
                globalTogglePlay();
                e.preventDefault();
            } else if (e.key === 'MediaTrackNext') {
                globalNextTrack();
                e.preventDefault();
            } else if (e.key === 'MediaTrackPrevious') {
                globalPrevTrack();
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [globalTogglePlay, globalNextTrack, globalPrevTrack]);

    // Format YouTube
    useEffect(() => {
        if (source === 'youtube' && youtubeTrack) {
            setCurrentYouTubeVideoId(youtubeTrack.videoId);
            hasEndedRef.current = false;
        }
    }, [youtubeTrack, source]);

    const handleYoutubeReady = (event: any) => {
        youtubePlayerRef.current = event.target;
        setNowPlaying(s => ({ ...s, isLoading: false }));
        if (source === 'youtube') event.target.playVideo();
    };

    const handleYoutubeStateChange = (event: any) => {
        const state = event.data;
        const playerIsPlaying = state === 1;
        setIsYouTubePlaying(playerIsPlaying);
        if (playerIsPlaying) {
            hasEndedRef.current = false;
            setNowPlaying(s => ({ ...s, isLoading: false }));
        }
    };

    const handleYouTubeEnd = () => {
        if (!hasEndedRef.current) {
            hasEndedRef.current = true;
            globalNextTrack();
        }
    };

    useEffect(() => {
        if (isYouTubePlaying && !isYouTubeSeeking) {
            progressIntervalRef.current = window.setInterval(() => {
                if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
                    setYouTubeProgress({
                        position: youtubePlayerRef.current.getCurrentTime(),
                        duration: youtubePlayerRef.current.getDuration() || 1
                    });
                }
            }, 1000);
        } else if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    }, [isYouTubePlaying, isYouTubeSeeking]);

    // Format Radio
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const cleanup = () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
        };

        if (source === 'radio' && radioStation?.url_resolved) {
            setNowPlaying(s => ({ ...s, isLoading: true }));
            const streamUrl = radioStation.url_resolved;
            cleanup();

            if (window.Hls?.isSupported() && streamUrl.includes('.m3u8')) {
                const hls = new window.Hls();
                hlsRef.current = hls;
                hls.loadSource(streamUrl);
                hls.attachMedia(audio);
                hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                    audio.play().catch(console.error);
                });
            } else {
                audio.src = streamUrl;
                audio.play().catch(console.error);
            }
        } else if (source !== 'radio') {
            cleanup();
            setIsRadioPlaying(false);
        }
    }, [radioStation, source, setNowPlaying]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const handlePlay = () => { setIsRadioPlaying(true); setNowPlaying(s => ({ ...s, isLoading: false })); };
        const handlePause = () => setIsRadioPlaying(false);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('canplay', handlePlay); 
        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('canplay', handlePlay);
        };
    }, [setNowPlaying]);

    const handleSeekYouTube = useCallback((pos: number) => {
        setYouTubeProgress(prev => ({ ...prev, position: pos }));
        if (youtubePlayerRef.current) youtubePlayerRef.current.seekTo(pos);
    }, []);

    const handleYouTubeSeekStart = useCallback(() => setIsYouTubeSeeking(true), []);
    const handleYouTubeSeekEnd = useCallback(() => {
        setIsYouTubeSeeking(false);
    }, []);

    const contextValue = useMemo(() => ({
        globalTogglePlay, globalNextTrack, globalPrevTrack,
        isRadioPlaying, isYouTubePlaying, youTubeProgress, isYouTubeSeeking,
        handleSeekYouTube, handleYouTubeSeekStart, handleYouTubeSeekEnd
    }), [globalTogglePlay, globalNextTrack, globalPrevTrack, isRadioPlaying, isYouTubePlaying, youTubeProgress, isYouTubeSeeking, handleSeekYouTube, handleYouTubeSeekStart, handleYouTubeSeekEnd]);

    return (
        <GlobalMediaContext.Provider value={contextValue}>
            {children}
            {/* INVISIBLE DOM ELEMENTS AT ROOT LEVEL */}
            <audio ref={audioRef} playsInline crossOrigin="anonymous" />
            <div style={{ display: 'none' }}>
                {currentYouTubeVideoId && (
                    <YouTube
                        videoId={currentYouTubeVideoId}
                        opts={{ height: '195', width: '320', playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1 } }}
                        onReady={handleYoutubeReady}
                        onStateChange={handleYoutubeStateChange}
                        onEnd={handleYouTubeEnd}
                    />
                )}
            </div>
        </GlobalMediaContext.Provider>
    );
};

export const useGlobalMedia = () => {
    const ctx = useContext(GlobalMediaContext);
    if (!ctx) throw new Error("useGlobalMedia must be used within GlobalMediaProvider");
    return ctx;
};
