
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
                console.log('[Spotify SDK] Ready with Device ID', details.device_id);
                spotifyDeviceId = details.device_id;
                playerReady = true;
                options.onReady(details);
                resolve(player);
            });

            player.addListener('not_ready', (details) => {
                console.warn('[Spotify SDK] Device ID has gone offline', details.device_id);
                playerReady = false;
                // Important: clear the device ID so we know we need to reconnect/transfer later
                if (spotifyDeviceId === details.device_id) {
                    spotifyDeviceId = null; 
                }
                options.onNotReady(details);
            });
            
            player.addListener('player_state_changed', options.onStateChange);

            player.addListener('initialization_error', ({ message }) => {
                console.error('[Spotify SDK] Initialization Error', message);
                reject(new Error(message));
            });

            player.addListener('authentication_error', ({ message }) => {
                console.error('[Spotify SDK] Auth Error', message);
                options.onAuthError(message);
            });

            player.addListener('account_error', ({ message }) => {
                console.error('[Spotify SDK] Account Error', message);
                options.onAccountError(message);
            });

            player.addListener('playback_error', ({ message }) => {
                console.error('[Spotify SDK] Playback Error', message);
                options.onPlaybackError(message);
            });

            player.connect().then(success => {
                if (success) {
                    console.log('[Spotify SDK] Connected successfully!');
                }
            }).catch(err => {
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
    return false;
  }
}

export const setVolumeThrottled = throttle((volume: number) => {
  setVolumeSafe(volume).catch(()=>{});
}, 150);

export async function setVolumeFinal(volume: number) {
  return await setVolumeSafe(volume);
}

/**
 * Executes a play command safely, handling device activation and token refresh automatically.
 */
export async function safePlay(options: PlayOptions, attemptRefresh: () => Promise<boolean>): Promise<boolean> {
    const sessionId = getSessionId();
    
    // 1. Check if we have a device ID from the SDK.
    if (!spotifyDeviceId) {
        console.warn('[safePlay] No local device ID found. SDK might not be ready.');
        // We can't play if we don't know our own device ID.
        return false;
    }

    const playRequest = { deviceId: spotifyDeviceId, body: { ...options } };

    const doPlay = async (): Promise<{ ok: boolean, status: number }> => {
        try {
            const res = await fetch('/api/play', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
                body: JSON.stringify(playRequest)
            });
            return { ok: res.ok, status: res.status };
        } catch (e) {
            console.error('[safePlay] Network error during play:', e);
            return { ok: false, status: 500 };
        }
    };

    // 2. Attempt playback
    let result = await doPlay();

    if (result.ok) return true;

    // 3. Handle 404 (Device Not Found / Inactive)
    if (result.status === 404) {
        console.log('[safePlay] Device 404 (Inactive). Attempting transfer/wake-up...');
        
        try {
            const transferRes = await fetch('/api/transfer-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
            });

            if (transferRes.ok) {
                // Wait a moment for Spotify backend to register the transfer
                await new Promise(r => setTimeout(r, 500));
                console.log('[safePlay] Transfer successful. Retrying play...');
                result = await doPlay();
                if (result.ok) return true;
            } else {
                console.error('[safePlay] Transfer failed.');
            }
        } catch (e) {
            console.error('[safePlay] Error during transfer:', e);
        }
    }

    // 4. Handle 401 (Token Expired)
    if (result.status === 401) {
        console.log('[safePlay] Token expired (401). Refreshing...');
        const refreshed = await attemptRefresh();
        if (refreshed) {
            // Retry once with new token (handled implicitly by backend/session manager, 
            // but we need to ensure the proxy uses the fresh data, which it pulls from Redis/Session)
            await new Promise(r => setTimeout(r, 200)); // Small grace period
            result = await doPlay();
            if (result.ok) return true;
        }
    }

    console.error(`[safePlay] Final failure. Status: ${result.status}`);
    return false;
}
