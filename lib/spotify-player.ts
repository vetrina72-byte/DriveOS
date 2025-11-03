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
    onPlaybackError: (message: string) => void;
}

export function initSpotifyPlayerOnce(options: InitOptions) {
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve, reject) => {
        if (spotifyPlayer) return resolve(spotifyPlayer);

        window.onSpotifyWebPlaybackSDKReady = () => {
            if (spotifyPlayer) {
                console.warn('[PLAYER] SDK ready called, but player already exists. Reconnecting.');
                spotifyPlayer.connect().then(() => resolve(spotifyPlayer!)).catch(reject);
                return;
            }
            
            console.log('[PLAYER] SDK Ready, creating new player instance.');
            const player = new window.Spotify.Player({
                name: options.name,
                getOAuthToken: cb => options.getAccessToken().then(token => cb(token)),
            });

            player.addListener('ready', (details) => {
                console.log(`🟢 [PLAYER] ready ${details.device_id}`);
                spotifyDeviceId = details.device_id;
                playerReady = true;
                options.onReady(details);
                resolve(player);
            });

            player.addListener('not_ready', (details) => {
                console.warn(`🔴 [PLAYER] not_ready ${details.device_id}`);
                playerReady = false;
                options.onNotReady(details);
            });
            
            player.addListener('player_state_changed', options.onStateChange);

            player.addListener('initialization_error', ({ message }) => {
                console.error('INIT ERROR', message);
                reject(new Error(message));
            });

            player.addListener('authentication_error', ({ message }) => {
                console.error('AUTH ERROR', message);
                options.onAuthError(message);
            });

            player.addListener('account_error', ({ message }) => console.error('ACCOUNT ERROR', message));
            player.addListener('playback_error', ({ message }) => {
                console.error('PLAYBACK ERROR', message);
                options.onPlaybackError(message);
            });

            player.connect().catch(err => {
                console.error('Connect failed', err);
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
            // If script already exists, just trigger the ready function
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

// Throttle with leading + trailing behavior
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
        // leading call
        invoke();
      } else if (!timeout) {
        // schedule trailing call
        timeout = window.setTimeout(invoke, wait - (now - last));
      }
    };
  }

const VLOG = (...args: any[]) => console.log('🔈 [VOLUME]', ...args);

// Funzione sicura che prova setVolume e fallback transfer se necessario
async function setVolumeSafe(volume: number) {
  if (!playerReady || !spotifyPlayer) {
    VLOG('player not ready - ignoring', volume);
    return false;
  }
  try {
    VLOG('live attempt', volume);
    await spotifyPlayer.setVolume(volume); // SDK call: 0..1
    VLOG('success', volume);
    return true;
  } catch (err: any) {
    VLOG('failed', err);
    // fallback: attempt transfer + retry once
    try {
      VLOG('▶️ [VOLUME] transfer attempt because setVolume failed');
      const sessionId = getSessionId();
      const resp = await fetch('/api/transfer-player', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
      });
      if (resp.ok) {
        await new Promise(r => setTimeout(r, 250)); // wait device settle
        await spotifyPlayer.setVolume(volume);
        VLOG('retry success', volume);
        return true;
      } else {
        VLOG('transfer failed', resp.status, await resp.text().catch(()=>null));
        return false;
      }
    } catch (ex: any) {
      VLOG('transfer/ex retry exception', ex);
      return false;
    }
  }
}

// Throttled version used while sliding
export const setVolumeThrottled = throttle((volume: number) => {
  setVolumeSafe(volume).catch(()=>{});
}, 150);

// Final setter (ensures the final value is applied when user releases)
export async function setVolumeFinal(volume: number) {
  return await setVolumeSafe(volume);
}

export async function safePlay(options: PlayOptions, attemptRefresh: () => Promise<boolean>): Promise<boolean> {
    if (!playerReady || !spotifyDeviceId) {
        console.warn('[PLAY] player not ready, cannot play.');
        return false;
    }
    const sessionId = getSessionId();
    
    const playRequest = {
        deviceId: spotifyDeviceId,
        body: {
            ...options
        }
    };

    const tryPlay = () => fetch('/api/play', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
        },
        body: JSON.stringify(playRequest)
    });

    let response = await tryPlay();
    if (response.ok) return true;

    console.warn(`[PLAY-WRAPPER] Play failed with status ${response.status}`);
    
    if (response.status === 404) {
        console.log('[PLAY-WRAPPER] Play returned 404 -> attempt transfer then retry');
        const transferResponse = await fetch('/api/transfer-player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
        });

        if (transferResponse.ok) {
            await new Promise(r => setTimeout(r, 300));
            const retryResponse = await tryPlay();
            if (retryResponse.ok) {
                console.log('[PLAY-WRAPPER] Retry after transfer successful.');
                return true;
            }
            console.warn(`[PLAY-WRAPPER] Retry after transfer failed with status ${retryResponse.status}`);
        } else {
            console.error('[PLAY-WRAPPER] Transfer attempt failed.');
        }
    }

    if (response.status === 401 || response.status === 400) {
        console.warn('[PLAY-WRAPPER] auth error -> attempting silent refresh');
        const refreshed = await attemptRefresh();
        if (refreshed) {
            const retryResponse = await tryPlay();
            if (retryResponse.ok) {
                 console.log('[PLAY-WRAPPER] Retry after token refresh successful.');
                 return true;
            }
             console.warn(`[PLAY-WRAPPER] Retry after refresh failed with status ${retryResponse.status}`);
        } else {
            console.error('[PLAY-WRAPPER] Token refresh failed, cannot retry play.');
        }
    }

    console.error('[PLAY-WRAPPER] final failure', response.status);
    return false;
}