# Performance Engineering: Deep Audit e Piano di Ottimizzazione all'Apertura delle App

## 1. Analisi del Momento Critico: "Open App"

### La Sequenza Temporale e la Sovrapposizione dei Carichi (0 - 580 ms)

Quando l'utente tocca un'icona nella Dock (es. Spotify):

```text
FRAME 0 ms (Click)
├── 3D Canvas: calcolo quaternioni e inizio interpolazione camera/modello (WebGL)
├── Music Player: calcolo traiettoria fluida verso sinistra (RAF)
├── Drawer: inizio traslazione translateX da 100% a 0% (RAF)
└── React: montaggio immediato del componente dell'App (<SpotifyPlayer />, <ContentArea />)

FRAME 0 - 200 ms (Transizione Iniziale)
├── 3D Canvas esegue 12 frame WebGL (Texture pass, Shadow map pass, MeshReflector pass)
├── DOM: ContentArea monta contemporaneamente 14 caroselli e oltre 250 card PlaylistItem
├── Browser: creazione di ~1.500 nodi DOM in memoria
└── Memory: istanziazione di 14 listener e calcolo iniziale delle classi CSS

FRAME 200 - 580 ms (Picco di Concorrenza)
├── Rete: arrivo delle risposte HTTP dei contenuti home
├── React Main Thread: esecuzione di re-render a cascata per i dati ricevuti
├── Browser: avvio download di decine di immagini di copertina
├── CPU/GPU: decodifica bitmap sRGB delle immagini concorrente al rendering WebGL
└── RISULTATO: saturazione del Main Thread → Drop da 60 FPS a 20 FPS (Micro-scatti visibili anche su PC)
```

---

## 2. Profiling e Diagnosi dei Tre Costi

| Tipo di Costo | Definizione | Dove si concentra nel progetto |
| :--- | :--- | :--- |
| **A. Tempo di Caricamento Reale** | Tempo effettivo affinché le API rispondano con i dati | Chiamate HTTP asincrone verso Spotify/Radio Browser/YouTube (dipendenti dalla rete) |
| **B. Picco Iniziale (Spike)** | Lavoro computazionale concentrato nei primi 500 ms | Creazione massiva di 250+ card DOM, decodifica simultanea di immagini, re-render a raffica |
| **C. Costo Continuo** | Carico residuo dopo che l'app è aperta e ferma | RAF loops in background, `ResizeObserver`, listener non passivi, `nowPlaying` re-renders |

---

## 3. Audit Approfondito App-per-App

---

### SPOTIFY (Priorità Massima)

#### 1. Componenti Principali
- `components/SpotifyPlayer.tsx` (Host Drawer & Physics)
- `components/ContentArea.tsx` (Container Home con Hero DJ & 14 Caroselli)
- `components/ContentCarousel.tsx` (Carosello orizzontale scrollabile)
- `components/PlaylistItem.tsx` (Card singola playlist/album/artista/brano)
- `context/AuthContext.tsx` (Gestione token, sessione e fetch dati Home)

#### 2. Caricamento Dati
- `fetchData()` in `AuthContext.tsx` invia 12 richieste HTTP contemporanee (`/me/playlists`, `/me/top/artists`, `/browse/categories/...`, etc.).
- Se avviato durante la transizione (prima dei 580 ms), la ricezione dati contende la CPU con l'interpolazione della telecamera 3D.

#### 3. Rendering e Virtual DOM
- `ContentArea.tsx` renderizza 14 sezioni carosello. Se ciascuna ha 15-20 elementi, vengono creati **280 componenti `PlaylistItem` contemporaneamente**.
- Ogni `PlaylistItem` contiene 6 nodi DOM (wrapper, container aspect-ratio, img, fallback icon, titolo h3, descrizione p) = **~1.680 nodi DOM** iniettati nel documento.
- `ContentArea` è agganciato al contesto globale `nowPlaying`: ad ogni aggiornamento di stato del player (secondo per secondo o cambio traccia), tutti i 14 caroselli e le 280 card venivano rivalutati.

#### 4. Immagini e Media
- 280 tag `<img>` richiedono simultaneamente le immagini di copertina.
- La decodifica delle immagini JPEG/PNG su main thread compete direttamente con il ciclo di rasterizzazione WebGL.

#### 5. Scroll e Listener
- `ContentCarousel.tsx` istanziava 14 `ResizeObserver` separati e 14 scroll listener per determinare la visibilità delle frecce di scorrimento.

#### 6. Problemi Individuati
1. Montaggio simultaneo di tutti i caroselli (anche quelli 1.200px sotto il fold dello schermo).
2. Mancanza di isolamento tra lo stato del player (`nowPlaying` per l'AI DJ card) e i caroselli sottostanti.
3. Decodifica concorrente di troppe immagini durante il movimento del drawer.

#### 7. Soluzione Proposta
1. **Staged Progressive Rendering**:
   - *Fase 1 (0 ms)*: Shell immediata (Header, Saluto, Hero Card DJ) + i primi 3 caroselli visibili above-the-fold (*Continua ad ascoltare*, *Realizzato per te*, *Le tue playlist*).
   - *Fase 2 (post-transizione, ~600 ms)*: Inserimento progressivo dei caroselli successivi (*Classifiche*, *Musica da cantare*, *Artisti del momento*, *Nuove uscite*).
   - *Fase 3 (idle / on-demand)*: Inserimento dei caroselli secondari below-the-fold (*Podcast*, *Generi*, *Album salvati*).
2. **Isolamento Componente `SpotifyDjHeroCard`**:
   - Estrarre la Hero Card dell'AI DJ in un componente separato memoizzato che ascolta `nowPlaying`, evitando il re-render di `ContentArea` e dei caroselli durante la riproduzione musicale.
3. **Memoization Pura di `PlaylistItem`**:
   - `React.memo` su `PlaylistItem` con props primitive/stabili.
4. **Zero Layout Shift**:
   - Contenitore rigidamente vincolato con classe `aspect-square`, placeholder CSS neutro con transizione d'opacità per l'immagine solo ad avvenuta decodifica asincrona (`decoding="async"`).

#### 8. Rischio di Regressione
- **Basso**: Il contenuto visivo, le copertine, i titoli e la navigazione rimangono identici al 100%.

#### 9. Priorità
- **Massima (P0)**.

---

### MAPS

#### 1. Componenti Principali
- `components/MapsContainer.tsx`
- `components/NavigateTool.tsx`, `components/SearchPanel.tsx`, `components/TripStatsHUD.tsx`
- Canvas MapLibre GL + RadarService + Starfield

#### 2. Caricamento Dati & Rendering
- Inizializzazione motore cartografico vettoriale MapLibre GL.
- Calcolo dei percorsi e overlay del traffico/meteo.

#### 3. Problemi Individuati
- Durante lo scorrimento del drawer (0 - 580 ms), MapLibre potrebbe tentare di ridimensionare il proprio canvas o ricalcolare le matrici dei tile vettoriali in parallelo a Three.js.
- Il loop RAF di `MapsContainer` prima continuava all'infinito (ora risolto con il gated RAF).

#### 4. Soluzione Proposta
1. Mantenere il canvas MapLibre stabile durante lo scorrimento e invocare `map.resize()` **solo al termine dei 580 ms di transizione**.
2. Sospendere il loop radar meteo quando il pannello Mappe non è visibile.

#### 5. Rischio di Regressione
- **Nullo**.

#### 6. Priorità
- **Alta (P1)**.

---

### RADIO

#### 1. Componenti Principali
- `components/RadioApp.tsx`
- `components/HorizontalCarousel.tsx`, `components/RadioCard.tsx`
- `radio_curated.ts` (dataset locale sincrono)

#### 2. Caricamento Dati & Rendering
- `RadioApp` scarica categorie live da `radio-browser.info` tramite 5 richieste HTTP.
- Possiede già in memoria locale `curatedStations` (le 20 stazioni radio italiane più popolari).

#### 3. Problemi Individuati
- Inizializzare `categories` come array vuoto costringeva l'app a mostrare skeleton generici per 500-1000 ms, ritardando il *First Meaningful Paint*.

#### 4. Soluzione Proposta
1. **Instant Paint a 0 ms**: Inizializzare lo stato direttamente con `curatedStations` in modo che "Le più ascoltate in Italia" sia renderizzato al primo frame senza attese di rete.
2. Caricare in background le altre categorie (Pop, Rock, Dance, Notizie) e aggiungerle in coda senza bloccare l'interfaccia.
3. `React.memo` su `RadioCard` con `decoding="async"` e fallback favicon.

#### 5. Rischio di Regressione
- **Nullo**.

#### 6. Priorità
- **Media (P2)**.

---

### YOUTUBE MUSIC

#### 1. Componenti Principali
- `components/YouTubeMusicApp.tsx`
- `context/YouTubeMusicContext.tsx`
- `components/ContentCarousel.tsx`

#### 2. Caricamento Dati & Rendering
- Query verso YouTube Music Data API / fallback demo con generazione di caroselli video e playlist.

#### 3. Problemi Individuati
- Come per Spotify, caricare contemporaneamente tutte le playlist YouTube può causare un burst di immagini non necessario durante lo slide.

#### 4. Soluzione Proposta
1. Staged rendering progressivo dei caroselli di YouTube Music.
2. Contenitori aspect ratio 16:9 / 1:1 rigidi per prevenire layout shift.

#### 5. Rischio di Regressione
- **Nullo**.

#### 6. Priorità
- **Media (P2)**.

---

### THEATER / VIDEO

#### 1. Componenti Principali
- `components/Theater.tsx`
- `components/ServiceButton`

#### 2. Caricamento Dati & Rendering
- Griglia di pulsanti per i servizi streaming con effetto 3D glare su mousemove/touch.

#### 3. Problemi Individuati
- Se venissero montati iframe o video player prima dell'interazione esplicita dell'utente, occuperebbero decoder hardware GPU.

#### 4. Soluzione Proposta
- Mantenere i video iframe instanziati rigorosamente *on-demand* al click dell'utente.

#### 5. Rischio di Regressione
- **Nullo**.

#### 6. Priorità
- **Bassa (P3)**.

---

## 4. Prestazioni Globali & Budget di Rendering

### Performance Budget Obiettivo
- **Transizione Open App**: **0 long tasks > 50 ms** nel lasso 0 - 580 ms. Frame rate minimo **55-60 FPS**.
- **First Meaningful Content (FMC)**: **< 100 ms** (Shell + Top Carousels già visibili).
- **Layout Shift (CLS)**: **0.00** (tutti i contenitori di immagini hanno dimensione esatta pre-allocata).
- **CPU a Riposo**: **0%** (tutti i loop RAF e observer dormono quando non vi sono animazioni in corso).

---

## 5. Piano di Implementazione a Fasi

```text
[FASE 1: SPOTIFY ARCHITECTURAL OPTIMIZATION]
1. Isolamento di SpotifyDjHeroCard da ContentArea per azzerare re-render durante la riproduzione.
2. Staged Progressive Rendering in ContentArea (Stadio 1 immediato, Stadio 2 a 600ms, Stadio 3 on-demand).
3. Memoization di PlaylistItem con decoding="async" e zero layout shift.
4. Centralizzazione dei listener di scorrimento in ContentCarousel.

[FASE 2: MAPS & RADIO SMOOTHING]
1. Posticipo del map.resize() al termine della transizione (580ms).
2. Instant-mount di curatedStations in RadioApp per First Meaningful Content a 0ms.

[FASE 3: YOUTUBE MUSIC & THEATER ALIGNMENT]
1. Staged rendering in YouTubeMusicApp.
2. Verifica assenza di decoder attivi in background in Theater.

[FASE 4: VERIFICA PRESTAZIONI SU PC E GALAXY TAB A8]
1. Test di apertura ripetuta di tutte le app.
2. Verifica transizioni fluide a 60 FPS in lockstep tra Camera 3D, Player e Drawer.
3. Controllo assenza totale di regressioni grafiche o funzionali.
```
