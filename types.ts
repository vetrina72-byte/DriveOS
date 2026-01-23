import type { Dispatch } from 'react';
import type { SpotifyPlayerState } from '@/globals';

export enum DriveMode {
  Park = 'P',
  Reverse = 'R',
  Neutral = 'N',
  Drive = 'D',
}

export interface ClimateState {
  insideTemp: number;
  outsideTemp: number;
  acOn: boolean;
  frontDefrost: boolean;
  rearDefrost: boolean;
  fanSpeed: number;
  driverSeatHeater: number;
  passengerSeatHeater: number;
  autoOn: boolean;
}

export interface VehicleState {
  driveMode: DriveMode;
  battery: {
    level: number; // percentage
    status: 'Charging' | 'Discharging' | 'Idle';
    power: number; // kW
    voltage: number; // V
    current: number; // A
  };
  climate: ClimateState;
  lightsOn: boolean;
  profile: string;
}

export type Action =
  | { type: 'SET_DRIVE_MODE'; payload: DriveMode }
  | { type: 'SET_BATTERY_LEVEL'; payload: number }
  | { type: 'SET_CLIMATE'; payload: Partial<ClimateState> }
  | { type: 'SIMULATE_UPDATE' }
  | { type: 'TOGGLE_LIGHTS' }
  | { type: 'SET_PROFILE', payload: string};


export interface VehicleContextType {
  state: VehicleState;
  dispatch: Dispatch<Action>;
}

export type TempUnit = 'C' | 'F';

export interface WeatherData {
    locationName: string;
    current: {
        temperature: number;
        condition: string;
        high: number;
        low: number;
    };
    hourly: {
        time: string;
        dt: number; // Unix timestamp
        temperature: number;
        condition: string;
    }[];
    details: {
        chanceOfRain: number;
        humidity: number;
        wind: string;
        sunrise: string; // e.g., "06:30"
        sunset: string;  // e.g., "20:15"
    };
    lastUpdated: Date;
}

export interface WeatherParams {
  rainDensity: number; // 0-1
  rainSpeed: number;
  snowDensity: number; // 0-1
  snowSpeed: number;
  hailDensity: number; // 0-1
  fogNear: number;
  fogFar: number;
}

export interface RadioStation {
    stationuuid: string;
    name: string;
    url_resolved: string;
    favicon: string;
    tags: string;
    codec: string;
}

export interface YouTubeTrackInfo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  playlistId?: string;
}

export interface NowPlayingState {
  source: 'spotify' | 'radio' | 'youtube' | null;
  spotifyState: SpotifyPlayerState | null;
  radioStation: RadioStation | null;
  radioContext: RadioStation[];
  youtubeTrack: YouTubeTrackInfo | null;
  youtubePlaylist?: YouTubeTrackInfo[];
  isLoading?: boolean;
}

// Export PlayOptions to be used by the spotify-player utility
export interface PlayOptions {
    uris?: string[];
    context_uri?: string;
    offset?: {
        position?: number;
        uri?: string;
    };
    position_ms?: number;
}