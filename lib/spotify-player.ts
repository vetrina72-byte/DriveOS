import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';
import { getSessionId } from './sessionId';
import type { PlayOptions } from '../context/AuthContext';

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

let volumeTimer: number | null = null;
async function attemptTransferAndRetryVolume(volume: number): Promise<boolean> {
    try {
        console.log('▶️ [VOLUME] transfer attempt because setVolume failed');
        const sessionId = getSessionId();
        const resp = await fetch('/api/transfer-player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, device_id: spotifyDeviceId })
        });

        if (resp.ok) {
            console.log('▶️ [VOLUME] transfer ok, retrying setVolume');
            await new Promise(r => setTimeout(r, 300));
            if (spotifyPlayer) {
                await spotifyPlayer.setVolume(volume);
                console.log('🔈 [VOLUME] retry success');
                return true;
            }
            return false;
        } else {
            console.warn('▶️ [VOLUME] transfer failed', await resp.text());
            return false;
        }
    } catch (err: any) {
        console.error('▶️ [VOLUME] transfer exception', err.message);
        return false;
    }
}

export function setVolumeDebounced(volume: number): Promise<boolean> {
    const clampedVolume = Math.min(1, Math.max(0, volume));
    if (!playerReady || !spotifyPlayer) {
        console.warn('[VOLUME] player not ready - ignoring setVolume');
        return Promise.resolve(false);
    }

    return new Promise((resolve) => {
        if (volumeTimer) clearTimeout(volumeTimer);
        volumeTimer = window.setTimeout(async () => {
            try {
                console.log(`🔈 [VOLUME] attempt ${clampedVolume}`);
                await spotifyPlayer!.setVolume(clampedVolume);
                console.log(`🔈 [VOLUME] success ${clampedVolume}`);
                resolve(true);
            } catch (err: any) {
                console.warn('🔈 [VOLUME] failed', err.message);
                const ok = await attemptTransferAndRetryVolume(clampedVolume);
                resolve(ok);
            }
        }, 200);
    });
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
