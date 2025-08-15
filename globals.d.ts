
// This file extends the global Window object to include properties from the Web Speech API,
// and the Spotify Web Playback SDK.

// --- Web Speech API ---

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;

  start(): void;
  stop(): void;
  abort(): void;

  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

// --- Spotify Web Playback SDK ---

export interface SpotifyPlayerOptions {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
}

export interface SpotifyTrack {
    name: string;
    uri: string;
    id: string | null;
    type: 'track' | 'episode' | 'ad';
    media_type: 'audio' | 'video';
    is_playable: boolean;
    album: {
        uri: string;
        name: string;
        images: { url: string }[];
    };
    artists: { uri: string; name: string; }[];
}

export interface SpotifyPlayerState {
    context: {
        uri: string | null;
        metadata: any | null;
    };
    disallows: {
        pausing?: boolean;
        peeking_next?: boolean;
        peeking_prev?: boolean;
        resuming?: boolean;
        seeking?: boolean;
        skipping_next?: boolean;
        skipping_prev?: boolean;
    };
    duration: number;
    paused: boolean;
    position: number;
    repeat_mode: 0 | 1 | 2;
    shuffle: boolean;
    track_window: {
        current_track: SpotifyTrack | null;
        previous_tracks: SpotifyTrack[];
        next_tracks: SpotifyTrack[];
    };
    timestamp: number;
}


export interface SpotifyPlayer {
    _options: SpotifyPlayerOptions;
    connect: () => Promise<boolean>;
    activateElement: () => Promise<boolean>;
    disconnect: () => void;
    getCurrentState: () => Promise<SpotifyPlayerState | null>;
    getVolume: () => Promise<number>;
    nextTrack: () => Promise<void>;
    previousTrack: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    seek: (pos_ms: number) => Promise<void>;
    setVolume: (volume: number) => Promise<void>;
    togglePlay: () => Promise<void>;
    on(event: 'ready' | 'not_ready', cb: (data: { device_id: string }) => void): void;
    on(event: 'player_state_changed', cb: (state: SpotifyPlayerState | null) => void): void;
    on(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb: (error: { message: string }) => void): void;
    removeListener(event: 'ready' | 'not_ready' | 'player_state_changed' | 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb?: (...args: any[]) => void): boolean;
}


declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
        Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer;
    };
  }
}

// This empty export statement is crucial. It turns this file into a module,
// which allows the `declare global` block to correctly augment the global Window interface.
export {};