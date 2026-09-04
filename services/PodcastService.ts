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

    /**
     * Retrieves the playback status of an episode, checking both Spotify API resume_point
     * and local fallback storage.
     */
    static getEpisodeStatus(episode: Episode): { fully_played: boolean; resume_position_ms: number; progress_percent: number } {
        let fullyPlayed = Boolean(episode.resume_point?.fully_played);
        let resumeMs = episode.resume_point?.resume_position_ms || 0;

        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const stored = JSON.parse(raw);
                const localEp = stored[episode.id];
                if (localEp) {
                    if (localEp.fully_played) fullyPlayed = true;
                    if (localEp.resume_position_ms > resumeMs) {
                        resumeMs = localEp.resume_position_ms;
                    }
                }
            }
        } catch (e) {}

        const duration = episode.duration_ms || 1;
        let percent = 0;
        if (fullyPlayed) {
            percent = 100;
        } else if (resumeMs > 0 && duration > 0) {
            percent = Math.min(99, Math.max(1, Math.round((resumeMs / duration) * 100)));
        }

        return {
            fully_played: fullyPlayed,
            resume_position_ms: resumeMs,
            progress_percent: percent
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
            const isCompleted = fullyPlayed || (durationMs > 0 && positionMs >= durationMs * 0.95);
            data[episodeId] = {
                resume_position_ms: positionMs,
                fully_played: isCompleted,
                updated_at: Date.now()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
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
