import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';
import { getSessionId } from './sessionId';
import type { PlayOptions } from '../types';

let spotifyPlayer: SpotifyPlayer | null = null;
let spotifyDeviceId: string | null = null;
let playerReady = false;
let initPromise: Promise<SpotifyPlayer> | null = null;

interface InitOptions {
    name: string;
    getAccessToken: () => Promise<string>;
    onReady: (details: { device_id: string }) => void;
    onNotReady: (details: { device_id: string }) => void;
    onStateChange: (state: SpotifyPlayerState | null) => void;
    onAuthError: (message: string) => void;
    onAccountError: (message: string) => void;
    onPlaybackError: (message: string) => void;
}

export function initSpotifyPlayerOnce(options: InitOptions) {
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve, reject) => {
        if (spotifyPlayer) return resolve(spotifyPlayer);

        window.onSpotifyWebPlaybackSDKReady = () => {
            if (spotifyPlayer) {
                spotifyPlayer.connect().then(() => resolve(spotifyPlayer!)).catch(reject);
                return;
            }
            
            const player = new window.Spotify.Player({
                name: options.name,
                getOAuthToken: cb => options.getAccessToken().then(token => cb(token)),
            });

            player.addListener('ready', (details) => {
                spotifyDeviceId = details.device_id;
                playerReady = true;
                options.onReady(details);
                resolve(player);
            });

            player.addListener('not_ready', (details) => {
                playerReady = false;
                options.onNotReady(details);
            });
            
            player.addListener('player_state_changed', options.onStateChange);

            player.addListener('initialization_error', ({ message }) => {
                reject(new Error(message));
            });

            player.addListener('authentication_error', ({ message }) => {
                options.onAuthError(message);
            });

            player.addListener('account_error', ({ message }) => {
                options.onAccountError(message);
            });

            player.addListener('playback_error', ({ message }) => {
                options.onPlaybackError(message);
            });

            player.connect().catch(err => {
                reject(err);
            });

            spotifyPlayer = player;
        };

        if (!document.getElementById('spotify-sdk')) {
            const script = document.createElement('script');
            script.id = 'spotify-sdk';
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            document.head.appendChild(script);
        } else if (window.Spotify) {
            window.onSpotifyWebPlaybackSDKReady();
        }
    });

    return initPromise;
}

export function getPlayerInstance(): SpotifyPlayer | null {
    return spotifyPlayer;
}

export function getDeviceId(): string | null {
    return spotifyDeviceId;
}

function throttle<T extends (...args: any[]) => any>(func: T, wait = 150) {
    let last = 0;
    let timeout: number | null = null;
    let lastArgs: Parameters<T> | null = null;
  
    return function throttled(...args: Parameters<T>) {
      const now = Date.now();
      lastArgs = args;
      const invoke = () => {
        last = Date.now();
        timeout = null;
        if (lastArgs) {
            const argsToUse = lastArgs;
            lastArgs = null;
            func(...argsToUse);
        }
      };
      if (now - last >= wait) {
        invoke();
      } else if (!timeout) {
        timeout = window.setTimeout(invoke, wait - (now - last));
      }
    };
  }

async function setVolumeSafe(volume: number) {
  if (!playerReady || !spotifyPlayer) return false;
  try {
    await spotifyPlayer.setVolume(volume);
    return true;
  } catch (err) {
    try {
      const sessionId = getSessionId();
      const resp = await fetch('/api/transfer-player', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
      });
      if (resp.ok) {
        await new Promise(r => setTimeout(r, 250));
        await spotifyPlayer.setVolume(volume);
        return true;
      }
      return false;
    } catch (ex) { return false; }
  }
}

export const setVolumeThrottled = throttle((volume: number) => {
  setVolumeSafe(volume).catch(()=>{});
}, 150);

export async function setVolumeFinal(volume: number) {
  return await setVolumeSafe(volume);
}

export async function safePlay(options: PlayOptions, attemptRefresh: () => Promise<boolean>): Promise<boolean> {
    if (!playerReady || !spotifyDeviceId) return false;
    const sessionId = getSessionId();
    const playRequest = { deviceId: spotifyDeviceId, body: { ...options } };
    const tryPlay = () => fetch('/api/play', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify(playRequest)
    });
    let response = await tryPlay();
    if (response.ok) return true;
    if (response.status === 404) {
        const transferResponse = await fetch('/api/transfer-player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
        });
        if (transferResponse.ok) {
            await new Promise(r => setTimeout(r, 300));
            const retryResponse = await tryPlay();
            if (retryResponse.ok) return true;
        }
    }
    if (response.status === 401 || response.status === 400) {
        const refreshed = await attemptRefresh();
        if (refreshed) {
            const retryResponse = await tryPlay();
            if (retryResponse.ok) return true;
        }
    }
    return false;
}