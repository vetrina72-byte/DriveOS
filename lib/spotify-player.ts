
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
                volume: 0.5
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

export async function seekLocal(position_ms: number): Promise<void> {
    if (spotifyPlayer) {
        return spotifyPlayer.seek(position_ms);
    }
    return Promise.reject("No local player");
}

export async function activatePlayer(): Promise<void> {
    if (spotifyPlayer) {
        return spotifyPlayer.activateElement().then(() => {});
    }
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

// Helper to reconnect and wait for a new Device ID
async function reconnectAndGetDeviceId(player: SpotifyPlayer): Promise<string | null> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Spotify SDK] Timeout waiting for device_id after reconnect');
            resolve(null);
        }, 4000); 

        const onReady = (details: { device_id: string }) => {
            clearTimeout(timeout);
            player.removeListener('ready', onReady);
            console.log('[Spotify SDK] Reconnected successfully, new ID:', details.device_id);
            resolve(details.device_id);
        };

        player.addListener('ready', onReady);
        player.disconnect(); 
        setTimeout(() => {
            player.connect().catch(e => {
                console.error("Connect failed", e);
                clearTimeout(timeout);
                resolve(null);
            });
        }, 100);
    });
}

/**
 * Executes a play command safely with Cold Start handling.
 */
export async function safePlay(options: PlayOptions, attemptRefresh: () => Promise<boolean>): Promise<boolean> {
    const sessionId = getSessionId();
    
    // 1. Wake up logic
    if (!spotifyDeviceId) {
        console.warn('[safePlay] No local device ID. Attempting to wake up...');
        if (spotifyPlayer) {
            const newId = await reconnectAndGetDeviceId(spotifyPlayer);
            if (newId) {
                spotifyDeviceId = newId;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    // 2. FORCE ACTIVATION - Crucial for browser audio policy
    if (spotifyPlayer) {
        try {
            await spotifyPlayer.activateElement();
        } catch (e) {
            console.warn("[safePlay] activateElement warning", e);
        }
    }

    // 3. AGGRESSIVE TRANSFER (Fixes the 5s delay / double click issue)
    // If the player isn't actively playing, force a transfer to this device ID first.
    // This warms up the connection.
    try {
        const state = await spotifyPlayer?.getCurrentState();
        if (!state) {
            console.log('[safePlay] COLD START DETECTED. Transferring playback...');
            await fetch('/api/transfer-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
                body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
            });
            // Tiny delay for server propagation
            await new Promise(r => setTimeout(r, 150));
        }
    } catch(e) {
        console.warn('[safePlay] State check failed', e);
    }

    // 4. Send Play Command
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
            return { ok: false, status: 500 };
        }
    };

    let result = await doPlay();

    if (result.ok) return true;

    // Retry logic for specific errors
    if (result.status === 404) {
        // Device not found - force transfer again and retry
        console.log('[safePlay] 404 received. Retrying with transfer...');
        await fetch('/api/transfer-player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
            body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
        });
        await new Promise(r => setTimeout(r, 500));
        result = await doPlay();
        if (result.ok) return true;
    }

    if (result.status === 401) {
        console.log('[safePlay] 401 Token expired. Refreshing...');
        const refreshed = await attemptRefresh();
        if (refreshed) {
            await new Promise(r => setTimeout(r, 200)); 
            result = await doPlay();
            if (result.ok) return true;
        }
    }

    return false;
}
