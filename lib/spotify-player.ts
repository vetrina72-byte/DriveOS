
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

/**
 * Directly seek using the SDK WebSocket connection.
 * This is significantly faster than the REST API.
 */
export async function seekLocal(position_ms: number): Promise<void> {
    if (spotifyPlayer) {
        return spotifyPlayer.seek(position_ms);
    }
    return Promise.reject("No local player");
}

/**
 * Wakes up the player element (useful for mobile/tablet browsers requiring user gesture)
 */
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
 * Executes a play command safely, ensuring we target the specific active device ID
 * to prevent latency and 404 errors.
 */
export async function safePlay(options: PlayOptions, attemptRefresh: () => Promise<boolean>): Promise<boolean> {
    const sessionId = getSessionId();
    
    // 1. Check if we have a device ID. If not, try to wake up the player.
    if (!spotifyDeviceId) {
        console.warn('[safePlay] No local device ID. Player might be asleep. Attempting to wake up...');
        if (spotifyPlayer) {
            const newId = await reconnectAndGetDeviceId(spotifyPlayer);
            if (newId) {
                spotifyDeviceId = newId;
            } else {
                console.error('[safePlay] Failed to wake up player.');
                return false;
            }
        } else {
            console.error('[safePlay] Player instance missing.');
            return false;
        }
    }

    // 2. FORCE ACTIVATION - This is crucial for "First Play Responsiveness"
    // Browsers block audio if not triggered by a user gesture. 
    if (spotifyPlayer) {
        try {
            await spotifyPlayer.activateElement();
        } catch (e) {
            console.warn("[safePlay] activateElement failed (non-fatal)", e);
        }
    }

    // 3. AGGRESSIVE TRANSFER FOR COLD START
    // If we have a device ID but haven't successfully played yet (cold start),
    // Force a transfer first. This fixes the "multiple clicks needed" issue.
    const currentState = await spotifyPlayer?.getCurrentState().catch(() => null);
    
    // If local state is null (never played) or we aren't active, assume we need to transfer.
    if (!currentState) {
        console.log('[safePlay] Cold start detected. Forcing transfer to local device first...');
        try {
            await fetch('/api/transfer-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
                body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
            });
            // Small wait to allow the backend to register the device switch
            await new Promise(r => setTimeout(r, 200)); 
        } catch (e) {
            console.error("[safePlay] Pre-transfer failed", e);
        }
    }

    // 4. CONSTRUCT REQUEST
    const playRequest = { deviceId: spotifyDeviceId, body: { ...options } };

    const doPlay = async (): Promise<{ ok: boolean, status: number }> => {
        try {
            console.log('[safePlay] Initiating Play on Device:', spotifyDeviceId);
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

    // 5. Attempt playback
    let result = await doPlay();

    if (result.ok) return true;

    // 6. Handle 404 (Device Not Found / Inactive) - Retry logic
    if (result.status === 404) {
        console.log('[safePlay] Device 404. Attempting transfer/wake-up...');
        
        try {
            // Force transfer to this ID explicitly
            const transferRes = await fetch('/api/transfer-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
                body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
            });

            if (transferRes.ok) {
                await new Promise(r => setTimeout(r, 300));
                console.log('[safePlay] Transfer successful. Retrying play...');
                result = await doPlay();
                if (result.ok) return true;
            } else {
                console.error('[safePlay] Transfer failed. Attempting hard reconnect...');
                if (spotifyPlayer) {
                    const newId = await reconnectAndGetDeviceId(spotifyPlayer);
                    if (newId) {
                        spotifyDeviceId = newId;
                        playRequest.deviceId = newId;
                        
                        await fetch('/api/transfer-player', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
                            body: JSON.stringify({ sessionId, device_id: newId })
                        });
                        
                        await new Promise(r => setTimeout(r, 300));
                        result = await doPlay();
                        if (result.ok) return true;
                    }
                }
            }
        } catch (e) {
            console.error('[safePlay] Error during transfer/reconnect:', e);
        }
    }

    // 7. Handle 401 (Token Expired)
    if (result.status === 401) {
        console.log('[safePlay] Token expired (401). Refreshing...');
        const refreshed = await attemptRefresh();
        if (refreshed) {
            await new Promise(r => setTimeout(r, 200)); 
            result = await doPlay();
            if (result.ok) return true;
        }
    }

    console.error(`[safePlay] Final failure. Status: ${result.status}`);
    return false;
}
