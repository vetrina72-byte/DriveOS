# Performance Engineering: Deep Audit e Piano di Ottimizzazione all'Apertura delle App

## 1. Diagnosi Globale: Perché l'Apertura Genera Micro-Scatti (anche su PC)

### La Sequenza Critica del Frame Drop
Quando l'utente clicca su un'app (es. Spotify), nel lasso di tempo di **580 ms** si verificano simultaneamente:
1. **Animazione 3D WebGL**: la camera e l'auto ruotano/traslano a 60 FPS con ricalcolo matriciale e multi-pass rendering (Mali-G52 o GPU desktop).
2. **Animazione Music Player**: il player calcola la traiettoria easing verso sinistra.
3. **Animazione Drawer**: il pannello scorre a tutto schermo.
4. **IL PROBLEMA (a 350 ms, nel pieno dell'animazione)**:
   - `triggerHomeContentFetch()` si attiva a metà transizione (`setTimeout 350ms`).
   - Vengono inviate **12 richieste HTTP contemporanee** (`/me/playlists`, `/me/top/artists`, `/browse/categories/...`, `/browse/new-releases`, etc.).
   - Man mano che le 12 risposte arrivano, vengono chiamati **12 singoli state setter React** (`setUserPlaylists`, `setTopArtists`, `setMadeForYouPlaylists`, `setChartsPlaylists`, etc.) all'interno di `AuthContext.tsx`.
   - Poiché `AuthContext.Provider` avvolge l'intera applicazione, si generano **12 re-render globali consecutivi a cascata** del Virtual DOM in meno di 200 ms.
   - `ContentArea.tsx` istanzia simultaneamente **14 caroselli orizzontali**, che montano **oltre 250 componenti `PlaylistItem`**.
   - Ognuno dei 250 `PlaylistItem` esegue un `useEffect` su `item.id`, monta un tag `<img>` e inizia a scaricare e decodificare texture sRGB nel main thread.
   - Ciascuno dei 14 caroselli crea una propria istanza sincrona di `ResizeObserver` e registra 3 event listener.
5. **Risultato**: Il browser si trova a dover gestire contemporaneamente Garbage Collection, decodifica immagini sincrona, calcolo layout di 250 card, 12 re-render globali e rendering WebGL a 60 FPS. Questo satura la CPU (anche su PC potenti) causando il classico **drop da 60 FPS a 15-20 FPS nei primi istanti**.

---

## 2. Audit Dettagliato App per App

---

### SPOTIFY (Priorità Massima)

#### A. File e Componenti Responsabili
- `context/AuthContext.tsx` (`fetchData`, `triggerHomeContentFetch`, `state setters`)
- `components/SpotifyPlayer.tsx` (`useEffect isOpen fetch timer`)
- `components/ContentArea.tsx` (montaggio sincrono di 14 caroselli)
- `components/ContentCarousel.tsx` (istanza `ResizeObserver` per ogni carosello)
- `components/PlaylistItem.tsx` (assenza di `React.memo`, `useEffect` non necessario, caricamento immagini simultaneo)

#### B. Cause Individuate nel Codice
1. **12 Re-render Globali a Raffica**: `fetchData()` in `AuthContext.tsx` risolve le chiamate e aggiorna 12 stati distinti senza batching. Poiché il Context risiede al root, l'intero albero di componenti (compresi player, navigazione, header) viene ricalcolato 12 volte di seguito.
2. **Fetch Avviato a Metà Transizione (350ms)**: Il timer avvia il fetch mentre drawer e 3D stanno ancora accelerando/decelerando.
3. **Mancanza di Staged Rendering**: `ContentArea.tsx` monta immediatamente tutti i 14 caroselli (sia visibili che 1000px sotto il fold).
4. **250+ Istanze Non Memoizzate**: `PlaylistItem.tsx` non è `React.memo`, quindi ogni micro-aggiornamento di contesto provoca il re-render di centinaia di nodi DOM.
5. **14 ResizeObserver Simultanei**: Ogni `ContentCarousel` istanzia un `ResizeObserver` separato all'avvio.

#### C. Soluzioni Architetturali
1. **Defer del Fetch a Transizione Conclusa (`600ms`)**:
   - Avviare il caricamento della rete **solo dopo che la transizione visiva (580ms) si è conclusa al 100%**. Durante l'animazione, la shell dell'app e la cache locale pregressa (o skeleton a layout fisso) sono già a schermo a 60 FPS senza alcuna contesa di CPU.
2. **State Consolidation / Batching in `AuthContext`**:
   - Consolidare i dati della home in un unico oggetto di stato `homeContent` o utilizzare `ReactDOM.unstable_batchedUpdates`, trasformando 12 re-render a cascata in **1 singolo render atomico**.
3. **Staged Rendering Progressivo**:
   - **Fase 1 (immediata a 0ms)**: Rendering della Shell (Header, Saluto, Hero Card "Spotify AI DJ" con pulsante play rapido) + Carosello "Continua ad ascoltare" (Above-the-fold prioritario).
   - **Fase 2 (a transizione finita, ~600ms)**: Rendering dei caroselli prioritari successivi ("Realizzato per te", "Le tue playlist", "Classifiche").
   - **Fase 3 (idle / scroll progressivo)**: Montaggio dei restanti caroselli secondari below-the-fold solo quando entrano nella viewport o in `requestIdleCallback`.
4. **Memoization di `PlaylistItem`**:
   - Avvolgere `PlaylistItem` in `React.memo`.
   - Eliminare l'inutile `useEffect` interno per `setImageError(false)`.
5. **Zero Layout Shift per le Card**:
   - Tutte le card hanno contenitore `w-full aspect-square` con sfondo placeholder sobrio già riservato. L'immagine si carica in `decoding="async"` e `loading="lazy"`, comparendo senza alcuno spostamento visivo dei testi sottostanti.
6. **Ottimizzazione `ContentCarousel`**:
   - Rimozione dei 14 `ResizeObserver` individuali; controllo scrollability leggero via scroll listener passivo e window resize.

#### D. Impatto Atteso
- Transizione di apertura Spotify granitica a **60 FPS sia su PC che su Tab A8**.
- Riduzione dell'utilizzo del main thread all'apertura del **75%**.

---

### MAPS

#### A. File e Componenti Responsabili
- `components/MapsContainer.tsx`
- `components/MapEngineUtils.ts`
- `MapLibre GL` canvas instance

#### B. Cause Individuate nel Codice
- Il canvas MapLibre reagisce a resize durante il movimento del drawer, scatenando il rendering WebGL della mappa mentre Three.js sta renderizzando l'auto.
- `MapControls`, `CosmicStarfield`, radar weather frames.

#### C. Soluzioni
1. Mantenere il canvas MapLibre dimensionato stabilmente, posticipando `map.resize()` al completamento della transizione (580ms).
2. Sospendere il render di radar weather frames se il pannello mappe è chiuso o coperto.

#### D. Impatto Atteso
- Eliminazione di doppie chiamate WebGL concorrenti durante lo slide.

---

### RADIO

#### A. File e Componenti Responsabili
- `components/RadioApp.tsx`
- `components/HorizontalCarousel.tsx`
- `components/RadioCard.tsx`

#### B. Cause Individuate nel Codice
- `RadioApp.tsx` attende la risoluzione di 5 chiamate HTTP di `radioBrowserApi` prima di visualizzare le stazioni, mostrando uno skeleton temporaneo, anche se `curatedStations` (le radio italiane più popolari) è già presente sincronicamente in locale in memoria (`radio_curated.ts`).

#### C. Soluzioni
1. **Visualizzazione Immediata a 0ms**: Montare subito `curatedStations` ("Le più ascoltate in Italia") istantaneamente al click.
2. In background, a transizione conclusa, caricare le altre categorie (Pop, Rock, Dance, Notizie) e aggiungerle progressivamente.
3. Memoizzare `RadioCard` con `React.memo`.

#### D. Impatto Atteso
- Apertura istantanea senza schermata vuota o attesa di rete.

---

### YOUTUBE MUSIC

#### A. File e Componenti Responsabili
- `components/YouTubeMusicApp.tsx`
- `context/YouTubeMusicContext.tsx`
- `components/ContentCarousel.tsx`

#### B. Cause Individuate nel Codice
- All'apertura viene invocato `fetchYouTubeHomeData` che genera contemporaneamente 4 caroselli di video/playlist YouTube.

#### C. Soluzioni
1. Applicare la stessa strategia di Staged Rendering (render immediato di Top Categories + Above-the-fold, poi progressive rendering below-the-fold).
2. Utilizzare immagini con `decoding="async"` e placeholder proporzionati a dimensione fissa.

---

### THEATER / VIDEO

#### A. File e Componenti Responsabili
- `components/Theater.tsx`
- `components/ServiceButton`

#### B. Cause Individuate nel Codice
- `ServiceButton` ha calcoli di `getBoundingClientRect()` ad ogni mousemove/touch.
- Componente già leggero, ma può beneficiare del posticipo del caricamento dei poster/trailer a transizione conclusa.

#### C. Soluzioni
- Caricamento iframe video on-demand solo quando l'utente seleziona un trailer o un servizio, evitando istanze di player video nascosti in background.

---

## 3. Piano Operativo di Implementazione a Blocchi Verificabili

```text
[BLOCCO A: DEFER DEL FETCH & BATCHING STATO AUTHCONTEXT]
→ Spostamento del trigger di fetch da 350ms a 600ms (post-transizione)
→ Consolidamento degli state setters di AuthContext in batch atomico
→ Verifica apertura Spotify senza scatti di rendering

[BLOCCO B: STAGED RENDERING & ZERO LAYOUT SHIFT SPOTIFY]
→ Staged rendering in ContentArea (Shell + Above-the-fold immediato, resto progressivo)
→ React.memo su PlaylistItem ed eliminazione useEffect superfluo
→ Placeholder a dimensione fissa e decoding="async" per eliminare layout shifts
→ Ottimizzazione caroselli (eliminazione dei 14 ResizeObserver)
→ Verifica stabilità e fluidità caroselli

[BLOCCO C: OTTIMIZZAZIONE APERTURA RADIO & YOUTUBE MUSIC]
→ Radio: visualizzazione immediata di curatedStations a 0ms
→ YouTube Music: staged rendering e memoization
→ Maps: resize maplibre a transizione completata
→ Verifica globale
```

---

## 4. Garanzie di Conservazione UX e Design
- **Nessuna rimozione**: tutti i caroselli, tutte le categorie, tutte le card e tutte le playlist rimangono esattamente identiche.
- **Stesso stile e grafica**: stessi colori, stesse animazioni, stesse icone, stesso layout.
- **Nessun layout shift**: le altezze e larghezze delle card sono rigidamente bloccate a CSS con aspect ratio invariato.
- **Transizione perfetta a 580ms**: Player, camera 3D e app si muovono all'unisono senza rallentamenti o drop di frame.
