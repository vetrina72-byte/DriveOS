import apiClient from '../spotifyClient';

export interface Episode {
    id: string;
    title: string;
    description: string;
    duration_ms: number;
    release_date: string;
    uri: string;
    image: string;
    resume_point?: {
        fully_played: boolean;
        resume_position_ms: number;
    };
}

export class PodcastService {
    /**
     * Local storage key for persisting podcast playback points across sessions
     */
    private static STORAGE_KEY = 'podcast_episodes_progress';
    private static HISTORY_STORAGE_KEY = 'podcast_listening_history';

    /**
     * Retrieves the playback status of an episode, checking both Spotify API resume_point,
     * live player state, and local fallback storage.
     */
    static getEpisodeStatus(
        episode: Episode | { id: string; duration_ms?: number; resume_point?: { fully_played?: boolean; resume_position_ms?: number } },
        playerState?: any
    ): { fully_played: boolean; resume_position_ms: number; progress_percent: number; duration_ms: number } {
        let fullyPlayed = Boolean(episode.resume_point?.fully_played);
        let resumeMs = episode.resume_point?.resume_position_ms || 0;
        let effectiveDuration = episode.duration_ms || 0;

        // 1. Check local storage for persistent progress
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const stored = JSON.parse(raw);
                const localEp = stored[episode.id];
                if (localEp) {
                    if (localEp.fully_played) fullyPlayed = true;
                    if (typeof localEp.resume_position_ms === 'number' && localEp.resume_position_ms > resumeMs) {
                        resumeMs = localEp.resume_position_ms;
                    }
                    if (localEp.duration_ms && localEp.duration_ms > 0) {
                        effectiveDuration = localEp.duration_ms;
                    }
                }
            }
        } catch (e) {}

        // 2. Real-time synchronization with active Spotify player state
        if (playerState && playerState.duration > 0) {
            const currentTrack = playerState?.track_window?.current_track ?? playerState?.item ?? null;
            const matchesCurrent = (currentTrack?.id && currentTrack.id === episode.id) ||
                                   (currentTrack?.uri && (episode as any).uri && currentTrack.uri === (episode as any).uri);
            if (matchesCurrent) {
                effectiveDuration = playerState.duration;
                const isPlaying = !playerState.paused;
                const elapsed = (isPlaying && playerState.timestamp) ? Math.max(0, Date.now() - playerState.timestamp) : 0;
                const livePos = Math.min(playerState.duration, Math.max(0, (playerState.position || 0) + elapsed));
                resumeMs = livePos;
                if (livePos >= playerState.duration - 2000) {
                    fullyPlayed = true;
                } else {
                    fullyPlayed = false;
                }
            }
        }

        const duration = effectiveDuration > 0 ? effectiveDuration : (episode.duration_ms || 1800000);
        let percent = 0;
        if (fullyPlayed) {
            percent = 100;
        } else if (resumeMs > 0 && duration > 0) {
            percent = Math.min(99, Math.max(0, Math.round((resumeMs / duration) * 100)));
        }

        return {
            fully_played: fullyPlayed,
            resume_position_ms: resumeMs,
            progress_percent: percent,
            duration_ms: duration
        };
    }

    /**
     * Saves episode playback progress locally so badges update in real-time
     */
    static saveEpisodeProgress(episodeId: string, positionMs: number, durationMs: number, fullyPlayed: boolean = false): void {
        if (!episodeId) return;
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            const effectiveDuration = durationMs > 0 ? durationMs : (data[episodeId]?.duration_ms || 0);
            const isCompleted = fullyPlayed || (effectiveDuration > 0 && positionMs >= effectiveDuration - 2000);
            data[episodeId] = {
                resume_position_ms: isCompleted ? effectiveDuration : positionMs,
                duration_ms: effectiveDuration,
                fully_played: isCompleted,
                updated_at: Date.now()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    /**
     * Records an episode as clicked/played, adding or updating it in the history list
     */
    static recordEpisodePlayed(episode: {
        id: string;
        name?: string;
        title?: string;
        description?: string;
        duration_ms?: number;
        release_date?: string;
        uri?: string;
        image?: string;
        images?: { url: string }[];
        type?: string;
        show?: {
            id?: string;
            name: string;
            publisher?: string;
            images?: { url: string }[];
        };
        resume_point?: {
            fully_played: boolean;
            resume_position_ms: number;
        };
    }, showData?: any): void {
        if (!episode?.id) return;
        try {
            const raw = localStorage.getItem(this.HISTORY_STORAGE_KEY);
            let history: any[] = raw ? JSON.parse(raw) : [];

            const status = this.getEpisodeStatus(episode as any);
            const effectiveShow = episode.show || showData || undefined;

            const itemToSave = {
                id: episode.id,
                name: episode.title || episode.name || 'Episodio',
                title: episode.title || episode.name || 'Episodio',
                description: episode.description || '',
                duration_ms: episode.duration_ms || 1800000,
                release_date: episode.release_date || '',
                uri: episode.uri || `spotify:episode:${episode.id}`,
                image: episode.image || episode.images?.[0]?.url || effectiveShow?.images?.[0]?.url || '/placeholder-podcast.png',
                images: episode.images || (episode.image ? [{ url: episode.image }] : (effectiveShow?.images || [])),
                type: 'episode',
                show: effectiveShow ? {
                    id: effectiveShow.id,
                    name: effectiveShow.name,
                    publisher: effectiveShow.publisher,
                    images: effectiveShow.images
                } : undefined,
                resume_point: {
                    fully_played: status.fully_played,
                    resume_position_ms: status.resume_position_ms > 0 ? status.resume_position_ms : 1000
                },
                last_played_at: Date.now()
            };

            const existingIdx = history.findIndex(item => item.id === episode.id);
            if (existingIdx >= 0) {
                history[existingIdx] = {
                    ...history[existingIdx],
                    ...itemToSave,
                    resume_point: {
                        fully_played: history[existingIdx].resume_point?.fully_played || itemToSave.resume_point.fully_played,
                        resume_position_ms: Math.max(history[existingIdx].resume_point?.resume_position_ms || 0, itemToSave.resume_point.resume_position_ms)
                    },
                    last_played_at: Date.now()
                };
            } else {
                history.unshift(itemToSave);
            }

            if (history.length > 50) history = history.slice(0, 50);
            localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(history));

            this.saveEpisodeProgress(
                episode.id, 
                itemToSave.resume_point.resume_position_ms, 
                episode.duration_ms || 0, 
                itemToSave.resume_point.fully_played
            );

            window.dispatchEvent(new CustomEvent('podcast_history_updated', { detail: { id: episode.id } }));
        } catch (e) {
            console.error("[PodcastService] Error recording episode played:", e);
        }
    }

    /**
     * Updates episode progress from live player state
     */
    static updateEpisodeProgress(episodeId: string, positionMs: number, durationMs: number, fullyPlayed: boolean = false): void {
        if (!episodeId) return;
        this.saveEpisodeProgress(episodeId, positionMs, durationMs, fullyPlayed);

        try {
            const raw = localStorage.getItem(this.HISTORY_STORAGE_KEY);
            if (!raw) return;
            let history: any[] = JSON.parse(raw);
            const idx = history.findIndex(item => item.id === episodeId);
            if (idx >= 0) {
                const effectiveDuration = durationMs > 0 ? durationMs : (history[idx].duration_ms || 1800000);
                const isCompleted = fullyPlayed || (effectiveDuration > 0 && positionMs >= effectiveDuration - 2000);
                history[idx].resume_point = {
                    resume_position_ms: isCompleted ? effectiveDuration : positionMs,
                    fully_played: isCompleted
                };
                if (durationMs > 0) {
                    history[idx].duration_ms = durationMs;
                }
                history[idx].last_played_at = Date.now();
                localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(history));
                window.dispatchEvent(new CustomEvent('podcast_history_updated', { detail: { id: episodeId, positionMs, durationMs } }));
            }
        } catch (e) {}
    }

    /**
     * Marks an episode as completely listened
     */
    static markEpisodeCompleted(episodeId: string, durationMs?: number): void {
        if (!episodeId) return;
        const dur = durationMs || 1000;
        this.saveEpisodeProgress(episodeId, dur, dur, true);
        try {
            const raw = localStorage.getItem(this.HISTORY_STORAGE_KEY);
            if (raw) {
                let history: any[] = JSON.parse(raw);
                const idx = history.findIndex(item => item.id === episodeId);
                if (idx >= 0) {
                    history[idx].resume_point = {
                        resume_position_ms: dur,
                        fully_played: true
                    };
                    history[idx].last_played_at = Date.now();
                    localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(history));
                }
            }
            window.dispatchEvent(new CustomEvent('podcast_history_updated', { detail: { id: episodeId } }));
        } catch (e) {}
    }

    /**
     * Toggles whether an episode is marked as completed or in progress
     */
    static toggleEpisodeCompleted(episodeId: string, durationMs?: number): void {
        if (!episodeId) return;
        try {
            const current = this.getEpisodeStatus({ id: episodeId, duration_ms: durationMs });
            const newCompleted = !current.fully_played;
            const dur = durationMs || 1000;
            const pos = newCompleted ? dur : 1000;

            this.saveEpisodeProgress(episodeId, pos, dur, newCompleted);

            const raw = localStorage.getItem(this.HISTORY_STORAGE_KEY);
            if (raw) {
                let history: any[] = JSON.parse(raw);
                const idx = history.findIndex(item => item.id === episodeId);
                if (idx >= 0) {
                    history[idx].resume_point = {
                        resume_position_ms: pos,
                        fully_played: newCompleted
                    };
                    history[idx].last_played_at = Date.now();
                    localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(history));
                }
            }
            window.dispatchEvent(new CustomEvent('podcast_history_updated', { detail: { id: episodeId } }));
        } catch (e) {}
    }

    /**
     * Returns the list of listened or clicked episodes, sorted by most recent
     */
    static getListeningHistory(): any[] {
        try {
            const raw = localStorage.getItem(this.HISTORY_STORAGE_KEY);
            if (!raw) return [];
            let history: any[] = JSON.parse(raw);
            if (!Array.isArray(history)) return [];

            return history.map(item => {
                const status = this.getEpisodeStatus(item);
                return {
                    ...item,
                    resume_point: {
                        fully_played: status.fully_played,
                        resume_position_ms: status.resume_position_ms
                    }
                };
            }).sort((a, b) => (b.last_played_at || 0) - (a.last_played_at || 0));
        } catch (e) {
            return [];
        }
    }

    /**
     * RISOLUTORE UNIFICATO DI ENTITÀ PODCAST
     * Gestisce sia ID Show diretti, sia URI Spotify, sia Playlist di Podcast.
     */
    static async getEpisodesWithOffset(rawId: string, offset: number): Promise<Episode[]> {
        return this.getEpisodes(rawId, offset);
    }

    static async getEpisodes(rawId: string, offset: number = 0): Promise<Episode[]> {
        if (!rawId) return [];

        // 1. Sanitize dell'ID (rimozione di prefissi spotify:show: o spotify:playlist:)
        const cleanId = rawId.replace(/^spotify:(show|playlist|episode):/, '').trim();

        console.log(`[PodcastService] Avvio recupero per ID: "${cleanId}" (Originale: "${rawId}", Offset: ${offset})`);

        let userCountry = 'IT';
        try {
            const meRes = await apiClient.get('/me');
            if (meRes.data && meRes.data.country) {
                userCountry = meRes.data.country;
            }
        } catch (e) {
            console.warn("[PodcastService] Impossibile recuperare il profilo utente per il market:", e);
        }

        // 2. TENTATIVO A: Endpoint Show Ufficiale (/shows/{id}/episodes)
        try {
            const showRes = await apiClient.get(`/shows/${cleanId}/episodes`, {
                params: { market: userCountry, limit: 50, offset }
            });
            const items = showRes.data?.items ?? [];
            if (items.length > 0) {
                console.log(`[PodcastService] Successo da /shows/${cleanId}/episodes:`, items.length);
                return this.mapEpisodes(items);
            }
        } catch (err: any) {
            console.warn(`[PodcastService] Tentativo /shows/${cleanId}/episodes fallito (Status ${err?.response?.status})`);
        }

        // 3. TENTATIVO B: Dettaglio Show Generale (/shows/{id}) - solo se offset 0
        if (offset === 0) {
            try {
                const detailRes = await apiClient.get(`/shows/${cleanId}`, {
                    params: { market: userCountry }
                });
                const items = detailRes.data?.episodes?.items ?? [];
                if (items.length > 0) {
                    console.log(`[PodcastService] Successo da /shows/${cleanId}:`, items.length);
                    return this.mapEpisodes(items);
                }
            } catch (err: any) {
                console.warn(`[PodcastService] Tentativo /shows/${cleanId} fallito (Status ${err?.response?.status})`);
            }
        }

        // 4. TENTATIVO C: Fallback per Playlist di Podcast (/playlists/{id}/tracks)
        // Se l'ID apparteneva a una Playlist "Da Scoprire" anziché a uno Show
        try {
            const playlistRes = await apiClient.get(`/playlists/${cleanId}/tracks`, {
                params: { market: userCountry, limit: 50, offset }
            });
            const tracks = playlistRes.data?.items?.map((item: any) => item.track ?? item.episode) ?? [];
            if (tracks.length > 0) {
                console.log(`[PodcastService] Successo da /playlists/${cleanId}/tracks:`, tracks.length);
                return this.mapEpisodes(tracks);
            }
        } catch (err: any) {
            console.warn(`[PodcastService] Tentativo /playlists/${cleanId}/tracks fallito (Status ${err?.response?.status})`);
        }

        console.error(`[PodcastService] IMPOSSIBILE RECUPERARE EPISODI per l'ID: ${cleanId}`);
        return [];
    }

    private static mapEpisodes(items: any[]): Episode[] {
        return items
            .filter(Boolean)
            .map(ep => ({
                id: ep.id ?? Math.random().toString(),
                title: ep.name ?? 'Episodio senza titolo',
                description: (ep.description ?? ep.html_description ?? '').replace(/<[^>]*>?/gm, ''),
                duration_ms: ep.duration_ms ?? 0,
                release_date: ep.release_date ?? '',
                uri: ep.uri ?? `spotify:episode:${ep.id}`,
                image: ep.images?.[0]?.url ?? ep.show?.images?.[0]?.url ?? '/placeholder-podcast.png',
                resume_point: ep.resume_point ? {
                    fully_played: Boolean(ep.resume_point.fully_played),
                    resume_position_ms: ep.resume_point.resume_position_ms || 0
                } : undefined
            }));
    }
}
