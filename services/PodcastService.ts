import apiClient from '../spotifyClient';

export interface Episode {
    id: string;
    title: string;
    description: string;
    duration_ms: number;
    release_date: string;
    uri: string;
    image: string;
}

export class PodcastService {
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
                image: ep.images?.[0]?.url ?? ep.show?.images?.[0]?.url ?? '/placeholder-podcast.png'
            }));
    }
}
