import { YouTubeTrackInfo } from '../types';

export interface DemoMediaItem {
  id: string;
  name: string;
  uri: string;
  images: { url: string }[];
  description?: string;
  type: 'track' | 'playlist' | 'artist' | 'album' | 'show' | 'episode';
}

// Check if Youtube key is present and is not a default placeholder
export function isDemoMode(apiKey: string): boolean {
  return !apiKey || apiKey.includes('placeholder') || apiKey === 'your_youtube_api_key_placeholder' || apiKey.startsWith('AIzaSy_Mock') || apiKey === 'DEVELOPMENT_DEMO_KEY' || apiKey === '';
}

// Curated copyright-free or ambient tracks for actual YouTube player streaming
export const MOCK_TRACKS_POOL: Record<string, YouTubeTrackInfo[]> = {
  // Music Charts
  'music-charts': [
    { videoId: 'jfKfPfyJRdk', title: 'Lofi Hip Hop Radio - Beats to Relax/Study', channelTitle: 'Lofi Girl', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
    { videoId: '4xDzrJKXOOY', title: 'Synthwave Chill Beats for Highway Cruising', channelTitle: 'RetroSynth', thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg' },
    { videoId: '5qap5aO4i9A', title: 'Deep Focus Ambient - Pure Space Waves', channelTitle: 'Cosmic Sound', thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg' },
    { videoId: 'Dx5_WbM0g7s', title: 'Coffee Shop Acoustic Chill', channelTitle: 'Acoustic Vibe', thumbnail: 'https://i.ytimg.com/vi/Dx5_WbM0g7s/hqdefault.jpg' },
  ],
  // Pop Playlists
  'pop-playlist-1': [
    { videoId: 't3UjK780Fno', title: 'Synth Retro Pop Anthems', channelTitle: 'Pop Vibes', thumbnail: 'https://i.ytimg.com/vi/t3UjK780Fno/hqdefault.jpg' },
    { videoId: 'M9X_H6C8hK0', title: 'Infinite Horizons - Neon Dreams', channelTitle: 'Vapor Wave', thumbnail: 'https://i.ytimg.com/vi/M9X_H6C8hK0/hqdefault.jpg' },
    { videoId: '8S0u8Xy18F0', title: 'City Lights - Chillout Session', channelTitle: 'Urban Beats', thumbnail: 'https://i.ytimg.com/vi/8S0u8Xy18F0/hqdefault.jpg' },
  ],
  // Live Performances
  'live-performances': [
    { videoId: 'S6Dby0jS_vE', title: 'Sunset Live Acoustic Session (Acoustic Cover)', channelTitle: 'Unplugged Live', thumbnail: 'https://i.ytimg.com/vi/S6Dby0jS_vE/hqdefault.jpg' },
    { videoId: 'Z6xN_h7L460', title: 'Grand Piano Ambient Symphony', channelTitle: 'Classical Echoes', thumbnail: 'https://i.ytimg.com/vi/Z6xN_h7L460/hqdefault.jpg' },
  ],
  // Italian Playlists
  'italian-playlists': [
    { videoId: '3KzD8a6R_N0', title: 'Bella Ciao - Slow Harmonics Acoustic', channelTitle: 'Italian Guitar', thumbnail: 'https://i.ytimg.com/vi/3KzD8a6R_N0/hqdefault.jpg' },
    { videoId: 'G8s4tM8uCko', title: 'Roma Tramonto - Ambient Mandolin Duet', channelTitle: 'Tradizione Italica', thumbnail: 'https://i.ytimg.com/vi/G8s4tM8uCko/hqdefault.jpg' },
  ],
  // Workout Playlists
  'workout-playlists': [
    { videoId: 'p3pRE7m0t_o', title: 'High Octane Power Beats - Workout Mix', channelTitle: 'Aero Club', thumbnail: 'https://i.ytimg.com/vi/p3pRE7m0t_o/hqdefault.jpg' },
    { videoId: 'Z_8k9L6y_S8', title: 'Running Cadence 140 BPM', channelTitle: 'Treadmill Runners', thumbnail: 'https://i.ytimg.com/vi/Z_8k9L6y_S8/hqdefault.jpg' },
  ],
  // Acoustic Sessions
  'acoustic-sessions': [
    { videoId: 'Dx5_WbM0g7s', title: 'Fingerstyle Acoustic Melodies', channelTitle: 'String Theory', thumbnail: 'https://i.ytimg.com/vi/Dx5_WbM0g7s/hqdefault.jpg' },
    { videoId: 'S6Dby0jS_vE', title: 'Campfire Harmonies (Covers)', channelTitle: 'Woodland Sessions', thumbnail: 'https://i.ytimg.com/vi/S6Dby0jS_vE/hqdefault.jpg' },
  ],
};

// Return fallback home data parsed as DemoMediaItem categories
export const getYouTubeMockHomeData = (): Record<string, DemoMediaItem[]> => {
  return {
    musicCharts: [
      { id: 'music-charts', name: 'Hit Parade Globale - Offline Demo', uri: 'youtube:playlist:music-charts', images: [{ url: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' }], description: 'I brani più caldi per la guida', type: 'playlist' },
      { id: 'jfKfPfyJRdk', name: 'Lofi Hip Hop Radio', uri: 'youtube:track:jfKfPfyJRdk', images: [{ url: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' }], description: 'Lofi Girl', type: 'track' },
      { id: '4xDzrJKXOOY', name: 'Synthwave Chill Beats', uri: 'youtube:track:4xDzrJKXOOY', images: [{ url: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg' }], description: 'RetroSynth', type: 'track' }
    ],
    popPlaylists: [
      { id: 'pop-playlist-1', name: 'Pop Hits Compilation', uri: 'youtube:playlist:pop-playlist-1', images: [{ url: 'https://i.ytimg.com/vi/t3UjK780Fno/hqdefault.jpg' }], description: 'Selezione pop fresca e carica', type: 'playlist' }
    ],
    livePerformances: [
      { id: 'live-performances', name: 'Concerti Live Unplugged', uri: 'youtube:playlist:live-performances', images: [{ url: 'https://i.ytimg.com/vi/S6Dby0jS_vE/hqdefault.jpg' }], description: 'Esibizioni live mozzafiato', type: 'playlist' }
    ],
    italianPlaylists: [
      { id: 'italian-playlists', name: 'Melodie d\'Italia', uri: 'youtube:playlist:italian-playlists', images: [{ url: 'https://i.ytimg.com/vi/3KzD8a6R_N0/hqdefault.jpg' }], description: 'I grandi classici strumentali italiani', type: 'playlist' }
    ],
    workoutPlaylists: [
      { id: 'workout-playlists', name: 'Allenamento Cardio Mix', uri: 'youtube:playlist:workout-playlists', images: [{ url: 'https://i.ytimg.com/vi/p3pRE7m0t_o/hqdefault.jpg' }], description: 'Energia ed adrenalina pura', type: 'playlist' }
    ],
    acousticSessions: [
      { id: 'acoustic-sessions', name: 'Acustica d\'Autore', uri: 'youtube:playlist:acoustic-sessions', images: [{ url: 'https://i.ytimg.com/vi/Dx5_WbM0g7s/hqdefault.jpg' }], description: 'Solo chitarre e calore acustico', type: 'playlist' }
    ]
  };
};

export function getPlaylistTracksMock(playlistId: string): YouTubeTrackInfo[] {
  // Return matched mock playlist, or look for standard fallback or mock search terms
  if (MOCK_TRACKS_POOL[playlistId]) {
    return MOCK_TRACKS_POOL[playlistId];
  }
  
  // Default general generic tracks list in case ID doesn't match directly
  return [
    { videoId: 'jfKfPfyJRdk', title: `Traccia Demo 1 (${playlistId})`, channelTitle: 'DriveOS Creator', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
    { videoId: '4xDzrJKXOOY', title: `Traccia Demo 2 (${playlistId})`, channelTitle: 'DriveOS Creator', thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg' },
    { videoId: '5qap5aO4i9A', title: `Traccia Demo 3 (${playlistId})`, channelTitle: 'DriveOS Creator', thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg' }
  ];
}
