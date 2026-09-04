
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

            player.addListener('ready', async (details) => {
                console.log('[Spotify SDK] Ready with Device ID', details.device_id);
                spotifyDeviceId = details.device_id;
                playerReady = true;

                // --- AUTO-TRANSFER DEVICE ---
                try {
                    const token = await options.getAccessToken();
                    if (token) {
                        await fetch('https://api.spotify.com/v1/me/player', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ device_ids: [details.device_id], play: false })
                        });
                        console.log('[Spotify SDK] Auto-transferred active device on connect');
                    }
                } catch (e) {
                    console.error('[Spotify SDK] Failed to auto-transfer device', e);
                }

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
            
            player.addListener('player_state_changed', (state) => {
                // Se lo stato è nullo ma sappiamo di aver appena forzato un cambio traccia (Optimistic Update), 
                // l'handler ignorerà l'evento per non far lampeggiare l'UI.
                if (!state || (!state.track_window?.current_track && !(state as any)?.item)) {
                    options.onStateChange(state);
                    return; 
                }

                // Se arriva uno stato valido, togliamo il flag di loading e aggiorniamo
                options.onStateChange({
                    ...state,
                    isLoading: false 
                } as any);
            });

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
            const targetHead = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
            if (targetHead) {
                targetHead.appendChild(script);
            }
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

// Helper to reconnect and wait for a new Device ID
async function reconnectAndGetDeviceId(player: SpotifyPlayer): Promise<string | null> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Spotify SDK] Timeout waiting for device_id after reconnect');
            resolve(null);
        }, 4000); // 4 second timeout

        const onReady = (details: { device_id: string }) => {
            clearTimeout(timeout);
            player.removeListener('ready', onReady);
            console.log('[Spotify SDK] Reconnected successfully, new ID:', details.device_id);
            resolve(details.device_id);
        };

        player.addListener('ready', onReady);
        player.disconnect(); // Force disconnect first to ensure clean state
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
 * Executes a play command safely, handling device activation and token refresh automatically.
 */
export async function safePlay(options: PlayOptions, attemptRefresh: () => Promise<boolean>): Promise<boolean> {
    const sessionId = getSessionId();
    const getToken = () => localStorage.getItem('accessToken') || localStorage.getItem('spotify_access_token') || '';
    
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

    const doPlay = async (): Promise<{ ok: boolean, status: number }> => {
        const token = getToken();
        const playRequest = { deviceId: spotifyDeviceId, accessToken: token, body: { ...options } };

        try {
            const res = await fetch('/api/play', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-session-id': sessionId || '',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(playRequest)
            });

            if (res.ok || res.status === 204) return { ok: true, status: res.status };
            
            // Direct API fallback if proxy returns error (other than 401 which will trigger refresh first)
            if (token && res.status !== 401) {
                const directUrl = spotifyDeviceId ? `https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}` : 'https://api.spotify.com/v1/me/player/play';
                const directRes = await fetch(directUrl, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `Bearer ${token}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify(options || {})
                });
                if (directRes.ok || directRes.status === 204) {
                    return { ok: true, status: directRes.status };
                }
            }

            return { ok: res.ok, status: res.status };
        } catch (e) {
            console.error('[safePlay] Network error during play:', e);
            // Direct API fallback on network error
            try {
                const directToken = getToken();
                if (directToken) {
                    const directUrl = spotifyDeviceId ? `https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}` : 'https://api.spotify.com/v1/me/player/play';
                    const directRes = await fetch(directUrl, {
                        method: 'PUT',
                        headers: { 
                            'Authorization': `Bearer ${directToken}`, 
                            'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify(options || {})
                    });
                    if (directRes.ok || directRes.status === 204) {
                        return { ok: true, status: directRes.status };
                    }
                }
            } catch (err) {}
            return { ok: false, status: 500 };
        }
    };

    // 2. Check token expiration before playing
    const expiresAt = Number(localStorage.getItem('expiresAt') || localStorage.getItem('spotify_token_expiry') || '0');
    if (expiresAt > 0 && expiresAt <= Date.now() + 5000) {
        console.log('[safePlay] Token is close to expiring, refreshing prior to play call...');
        await attemptRefresh().catch(() => false);
    }

    // 3. Attempt playback
    let result = await doPlay();

    if (result.ok) return true;

    // 4. Handle 401 (Token Expired or Invalid) -> await refresh Promise and retry immediately
    if (result.status === 401) {
        console.log('[safePlay] Token expired (401). Refreshing token and awaiting resolution...');
        const refreshed = await attemptRefresh();
        if (refreshed) {
            console.log('[safePlay] Token refreshed successfully. Retrying play with updated token...');
            await new Promise(r => setTimeout(r, 150));
            result = await doPlay();
            if (result.ok) return true;
        } else {
            console.warn('[safePlay] Token refresh attempt returned false.');
        }
    }

    // 5. Handle 404 (Device Not Found / Inactive)
    if (result.status === 404) {
        console.log('[safePlay] Device 404 (Inactive). Attempting transfer/wake-up...');
        const token = getToken();
        
        try {
            const transferRes = await fetch('/api/transfer-player', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId || '',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ sessionId, device_id: spotifyDeviceId, accessToken: token })
            });

            if (transferRes.ok) {
                // Wait a moment for Spotify backend to register the transfer
                await new Promise(r => setTimeout(r, 400));
                console.log('[safePlay] Transfer successful. Retrying play...');
                result = await doPlay();
                if (result.ok) return true;
            } else {
                console.error('[safePlay] Transfer failed. Attempting hard reconnect...');
                
                // If transfer failed, the device ID might be truly dead/rotated.
                if (spotifyPlayer) {
                    const newId = await reconnectAndGetDeviceId(spotifyPlayer);
                    if (newId) {
                        spotifyDeviceId = newId;
                        
                        // Force transfer to new ID
                        const freshToken = getToken();
                        await fetch('/api/transfer-player', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'x-session-id': sessionId || '',
                                ...(freshToken ? { 'Authorization': `Bearer ${freshToken}` } : {})
                            },
                            body: JSON.stringify({ sessionId, device_id: newId, accessToken: freshToken })
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

    // 6. Secondary 401 retry if transfer exposed an expired token
    if (result.status === 401) {
        console.log('[safePlay] Secondary 401 encountered, refreshing...');
        const refreshed = await attemptRefresh();
        if (refreshed) {
            result = await doPlay();
            if (result.ok) return true;
        }
    }

    console.error(`[safePlay] Final failure. Status: ${result.status}`);
    return false;
}
