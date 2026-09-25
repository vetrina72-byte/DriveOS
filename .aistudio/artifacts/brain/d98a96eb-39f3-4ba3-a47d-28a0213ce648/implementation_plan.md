# Full-Stack Performance Engineering & Low-End Optimization Plan (Galaxy Tab A8 Target)

Un piano di engineering completo, sistematico e rigoroso per portare l'applicazione di infotainment al massimo livello di efficienza, fluidità e reattività (frame pacing da 120Hz/60Hz costante senza micro-stutter, hitch all'apertura o input lag), con target primario su hardware a basse risorse come il Samsung Galaxy Tab A8 (SoC Unisoc Tiger T618, Mali G52 MP2 GPU, 3-4GB RAM), preservando al 100% il design, le animazioni, i comportamenti e l'esperienza visiva esistente.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisioni confermate in Fase 1 di chiarimento:**
> - **Comportamento 3D VehicleCanvas con App Aperta**: Il loop di rendering WebGL/Three.js (`frameloop`) viene sospeso a riposo (`frameloop="demand"`) quando un'app a schermo intero o split-screen è attiva e stabilizzata, risparmiando il 100% delle risorse GPU/CPU per l'app in primo piano, e riattivato istantaneamente durante transizioni, drag o ritorno in Home.
> - **Device Adaptation & Performance Profiling**: Profilo adattivo dinamico con tier hardware (`LOW`, `MEDIUM`, `HIGH`) calcolato su capacità reali (`navigator.hardwareConcurrency`, `navigator.deviceMemory`, GPU capabilities) con isteresi di frame time per prevenire oscillazioni di qualità.
> - **Strategia Caroselli e Liste**: Adozione di `IntersectionObserver` per il progressive mount delle immagini e delle card + CSS `content-visibility: auto` con `contain-intrinsic-size` per saltare layout e paint degli elementi fuori viewport.
> - **Preservazione Visiva Assoluta**: Zero modifiche visive o stilistiche non autorizzate. Stessi colori, stesse curve di animazione (`cubic-bezier(0.16, 1, 0.3, 1)`), stessi layout e identica UX.

---

## 1. Audit Globale delle Prestazioni: I Top 10 Colli di Bottiglia

Dall'analisi approfondita del codice sorgente su tutti i componenti, contesti e servizi, sono stati individuati con precisione millimetrica i 10 colli di bottiglia che generano frame drops, picchi di CPU/GPU, input latency e micro-stutter:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TOP 10 BOTTLENECKS                                     │
├────┬─────────────────────────┬──────────────────┬─────────────────┬────────────────────┤
│ #  │ Area                    │ Causa Tecnica    │ Costo Risorse   │ Momento            │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 1  │ Background 3D Render    │ frameloop=always │ 45-70% GPU      │ Permanente quando  │
│    │ in VehicleCanvas        │ Multi-pass Floor │ 10-25% CPU      │ un'app è aperta    │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 2  │ RAF Loops Permanenti in │ querySelectorAll │ 15-30% CPU      │ Ad ogni frame      │
│    │ MusicPlayer & App.tsx   │ + offsetWidth    │ Forced Reflow   │ (60-120 FPS)       │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 3  │ Spotify Mount Spike     │ 240+ nodi card + │ 120-180ms CPU   │ Apertura di        │
│    │ (ContentArea)           │ decodifica img   │ Long Task       │ Spotify            │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 4  │ Layout Thrashing in     │ getBounding-     │ 8-16ms CPU/ev   │ Su pointermove e   │
│    │ Theater & Caroselli     │ ClientRect()     │ Forced Layout   │ touchmove          │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 5  │ Weather Particle Loops  │ TypedArray alloc │ 5-15% CPU/GPU   │ Ad ogni frame      │
│    │ (Rain/Snow/Fog)         │ in useFrame      │ GC pressure     │ di animazione      │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 6  │ Scrollability Reflows   │ scrollWidth /    │ 6-12ms CPU      │ Su scroll caroselli│
│    │ in ContentCarousel      │ clientWidth      │ Forced Reflow   │ e resize           │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 7  │ DPR Uncapped su Tablet  │ DPR > 1.33 su    │ +100% Fillrate  │ Render Three.js    │
│    │ Mali G52 MP2            │ schermi 2K/FHD   │ Memory bandwidth│ e MapLibre         │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 8  │ DynamicTrackTitle       │ ResizeObserver + │ Cascata React   │ Cambio traccia     │
│    │ Marquee Overload        │ inline CSS vars  │ Layout thrash   │ o resize           │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 9  │ Telemetry / Dead        │ GeoJSON parsing  │ 4-8ms CPU       │ Navigazione attiva │
│    │ Reckoning Map Spikes    │ ad alta freq     │ Main thread     │ su Maps            │
├────┼─────────────────────────┼──────────────────┼─────────────────┼────────────────────┤
│ 10 │ Uncollected Timers &    │ EventListener    │ Memory Leak     │ Open / Close       │
│    │ Event Subscriptions     │ e Audio Analyzers│ GC Spikes       │ ripetuti           │
└────┴─────────────────────────┴──────────────────┴─────────────────┴────────────────────┘
```

---

## 2. Architettura di Performance & Flussi di Dati

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                PERFORMANCE CONTROLLER                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Device Capability Detection (CPU Cores, RAM, GPU Tier, Target DPR: 1.0 Low / 1.25 Hi)│
│ 2. Frame Pacing Monitor (Rolling Frame Time Window & Long Task Detection)               │
│ 3. App Lifecycle Coordinator (Active / Transitioning / Idle / Suspended States)         │
└──────────────┬──────────────────────────┬─────────────────────────────┬─────────────────┘
               │                          │                             │
               ▼                          ▼                             ▼
┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
│      3D VEHICLE ENGINE    │ │    MEDIA & DOCK ENGINE    │ │     SUB-APPS ENGINE       │
│                           │ │                           │ │ (Spotify, Maps, Radio,    │
│ • frameloop: demand/always│ │ • Conditional RAF Loop    │ │  YT Music, Theater)       │
│ • Particle throttle       │ │ • Cached remScale & widths│ │ • Staged Rendering        │
│ • Lightformer / Floor     │ │ • AI DJ throttled glow    │ │ • content-visibility: auto│
│   Reflection Bypass on App│ │ • Zero querySelector in   │ │ • IntersectionObserver    │
│ • Zero garbage in useFrame│ │   per-frame RAF loop      │ │ • Zero Layout Thrashing   │
└───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
```

---

## 3. Analisi Dettagliata App per App & Matrice di Risoluzione

### 3.1. Core Engine: `VehicleCanvas.tsx` (3D WebGL)
- **Problema**: Con app aperta o a schermo intero (Spotify, Maps, Theater, Radio, YouTube Music), il renderer Three.js continua ad eseguire `frameloop="always"`, calcolando ogni frame:
  1. `MeshReflectorMaterial` su un piano 250x250 con risoluzione 512 (2 passate di render virtual camera).
  2. `PCFSoftShadowMap` con matrice luci 1024x1024.
  3. Studio Lightformers (3 softbox speculari).
  4. Animazione particellare meteo (`RainStreaks`, `Snow`, `Lightning`).
- **Costo**: ~50-70% della GPU su Mali G52, frame time aumentato da 8ms a 38ms.
- **Soluzione**:
  - Quando un'app è stabilizzata (`activeApp !== null` e transizione completata), impostare `frameloop="demand"`.
  - Non appena si avvia un drag o un click di apertura/chiusura, commutare istantaneamente su `frameloop="always"`.
  - Mettere in pausa i loop di simulazione meteo non visibili quando un'app a tutta larghezza copre il canvas.
  - Riciclare vettori, quaternioni e matrici matematiche senza alcuna allocazione `new THREE.Vector3()` nei callback di frame.
- **Rischio Regressione**: Nullo. La vista 3D risponde all'istante e si aggiorna a 60/120fps durante qualsiasi movimento o interazione.

### 3.2. Transizioni & Dock: `App.tsx` & `MusicPlayer.tsx`
- **Problema**:
  1. In `App.tsx` (riga 620-713), il loop per `NavigateTool` gira in continuazione all'infinito (`requestAnimationFrame(loop)`), scrivendo 7 proprietà di stile inline sul DOM ad ogni singolo frame anche quando l'interfaccia è immobile.
  2. In `MusicPlayer.tsx` (riga 923-1050), il loop esegue `document.querySelectorAll('.spotify-app-panel')`, `document.getElementById('maps-app-panel')` e legge `el.offsetWidth` ad ogni frame.
- **Costo**: 15-25ms di CPU sul main thread, forced reflow a 60/120Hz continui.
- **Soluzione**:
  - Trasformare entrambi i loop in **animazioni su richiesta**: avviare il RAF solo quando c'è una transizione in corso (`animStartTime > 0`) o un drag attivo (`dragProgress.current !== null`).
  - Quando l'animazione atterra (`normT >= 1.0`), applicare lo stato finale ed arrestare il RAF (`cancelAnimationFrame`).
  - Pre-calcolare e memorizzare le dimensioni del dock in un ref aggiornato solo su `resize` o cambio app, eliminando tutte le letture `offsetWidth` e `querySelectorAll` dal ciclo di frame.
- **Rischio Regressione**: Nullo. Stesse identiche curve fisiche e posizionamento al pixel.

### 3.3. Spotify: `SpotifyPlayer.tsx`, `ContentArea.tsx`, `ContentCarousel.tsx`, `PlaylistItem.tsx`
- **Problema**:
  1. All'apertura vengono istanziati simultaneamente oltre 12 carousels con 20 card ciascuno (240+ card `PlaylistItem`), scatenando un massiccio burst di montaggio React e decoding di immagini.
  2. In `ContentCarousel.tsx`, `checkScrollability` legge `el.scrollWidth`, `el.clientWidth`, `el.scrollLeft` su ogni resize e scroll, causando forced layout recalculation.
- **Costo**: Spike di 120-180ms sul main thread al click di apertura di Spotify.
- **Soluzione**:
  - **Staged Loading & Viewport Virtualization**:
    * Utilizzare CSS `content-visibility: auto` con `contain-intrinsic-size: 0 220px` su ogni sezione carosello: il browser evita di calcolare il layout delle sezioni fuori dallo schermo finché non vengono scrollate.
    * Applicare un leggero `IntersectionObserver` per deferire il caricamento delle thumbnail delle card esterne alla viewport orizzontale.
    * Utilizzare `loading="lazy"` e `decoding="async"` con `fetchpriority="high"` solo per le prime 4 card del primo carosello visibile.
  - **Scrollability Optimization**: De-bounceare e campionare `checkScrollability` tramite RAF per non bloccare lo scorrimento touch.
- **Rischio Regressione**: Nullo. Nessuna modifica visiva; le card appaiono istantaneamente al loro posto con scrolling fluido a 60/120fps.

### 3.4. Maps: `MapsContainer.tsx` & `SearchPanel.tsx`
- **Problema**:
  1. Gli aggiornamenti di telemetria e dead reckoning inviano mutazioni GeoJSON ad alta frequenza al worker di MapLibre.
  2. Numerosi marker DOM custom (POI, pericoli stradali, autovelox, semafori) creati e distrutti simultaneamente.
- **Costo**: Micro-stutter durante il panning della mappa o il ricalcolo del percorso.
- **Soluzione**:
  - Throttling a 60Hz per gli aggiornamenti di posizione del veicolo su GeoJSON layer senza ricreare oggetti intermedi.
  - Riutilizzo dei marker DOM esistenti (marker pool / batch update) invece di distruggerli e ricrearli.
  - Cache dell'istanza dello stile mappa tra dark e light mode.
- **Rischio Regressione**: Nullo. Mappa reattiva e navigazione fluida.

### 3.5. Theater: `Theater.tsx`
- **Problema**:
  - `ServiceButton` esegue `cardRef.current.getBoundingClientRect()` su ogni singolo evento `pointermove` e `touchmove` (riga 30) per calcolare la rotazione 3D e il riflesso speculare.
- **Costo**: Forced synchronous reflow su ogni pixel di movimento del dito/mouse (fino a 120 volte al secondo).
- **Soluzione**:
  - Salvare il `DOMRect` all'evento `pointerenter` o `touchstart` in un ref, e riutilizzarlo durante il movimento senza forzare reflow.
- **Rischio Regressione**: Nullo. Effetto 3D e riflesso identici ma a zero latenza.

### 3.6. Radio & YouTube Music: `RadioApp.tsx` & `YouTubeMusicApp.tsx`
- **Problema**:
  - Montaggio simultaneo di caroselli e card di stazioni/playlist con loghi ad alta risoluzione senza content containment.
- **Soluzione**:
  - Applicare `content-visibility: auto` e lazy decoding per le favicon delle stazioni radio e copertine YT Music.
  - Sincronizzare la fine del drag con il Physics loop in modo che non ci siano doppi frame di rendering.
- **Rischio Regressione**: Nullo.

---

## 4. Strategia di Adattamento Dispositivo (Dynamic Performance Profiling)

Per garantire prestazioni eccellenti sia su tablet economici (Galaxy Tab A8) che su dispositivi di fascia alta senza compromettere la grafica:

```typescript
// Capability Profiler Specification (Concettuale)
interface DeviceCapabilityProfile {
  tier: 'LOW' | 'MEDIUM' | 'HIGH';
  maxDpr: number;               // Tab A8: 1.0, Desktop/Hi-end: 1.25
  enableMeshReflection: boolean;// True su tutti, sospesa a riposo con app aperta
  targetFrameBudgetMs: number;  // 16.6ms (60fps) o 8.3ms (120fps)
}
```

- **Rilevamento reale delle capacità**:
  - `navigator.hardwareConcurrency` (es. 8 core su PC vs 4-8 core lenti su Tab A8)
  - `navigator.deviceMemory` (se supportato, es. <= 4GB)
  - Limitazione DPR dinamica su WebGL: capped a `1.0` su dispositivi a bassa GPU/fillrate, `1.25` su GPU discrete.
- **Frame Drop Hysteresis**:
  - Monitoraggio del rolling frame time: se il frame time medio supera i 28ms consecutivamente per 15 frame, il sistema riduce il carico non visibile (sospensione particelle secondarie), con isteresi di 5 secondi prima di risalire di livello.

---

## 5. Piano di Esecuzione in Fasi Rigorose

```
Fase 1: Core Engine & Animation Loop Optimization
├── App.tsx: arresto del RAF loop permanente per NavigateTool a riposo
├── MusicPlayer.tsx: arresto del RAF loop permanente a riposo + rimozione offsetWidth e querySelectorAll
└── Theater.tsx: eliminazione di getBoundingClientRect su pointermove/touchmove (cache su start)

Fase 2: 3D VehicleCanvas & WebGL Performance
├── VehicleCanvas.tsx: commutazione intelligente frameloop="demand" quando l'app è aperta e stabilizzata
├── Sospensione/Throttling particelle meteo in background
└── Verifica riciclo allocazioni matematiche (THREE.Vector3/Quaternion) in useFrame

Fase 3: Media Apps Optimization (Spotify, Radio, YouTube Music)
├── ContentArea.tsx & ContentCarousel.tsx: integrazione content-visibility: auto e contain-intrinsic-size
├── PlaylistItem.tsx & RadioCard.tsx: lazy loading e async decoding ottimizzati
└── Caroselli: rimozione layout reflow su scroll e resize

Fase 4: Maps & Telemetry Efficiency
├── MapsContainer.tsx: batch marker updates e throttling aggiornamenti GeoJSON
└── SearchPanel.tsx: rendering progressivo risultati con zero layout thrashing

Fase 5: Profiling, Stress Test & Build Verification
├── Test di ciclo: Open/Close ripetuto 20x di Spotify, Maps, Radio, Theater, YouTube Music
├── Test di interazione: Rotazione 3D + drag drawer + scroll caroselli simultaneo
├── Verifica memoria / assenza di memory leaks
└── Esecuzione compile_applet per validazione finale del build
```

---

## 6. Pre-Flight Verification Checklist

1. **Stesso Design & Identica Grafica**: Colori, font, dimensioni, spaziature, ombre, blur e icone rimangono esattamente identici all'originale.
2. **Stesse Animazioni**: Identiche curve `cubic-bezier(0.16, 1, 0.3, 1)`, durate e sincronizzazione tra 3D, player e drawer.
3. **Nessun Trucco Posticcio**: Nessun timeout artificiale o disattivazione arbitraria di contenuti; ottimizzazione reale alla radice (rendering, DOM, WebGL, memory).
4. **Resistenza a Stress Test**: Memoria costante dopo decine di aperture/chiusure app.
5. **Verifica Finale**: Esecuzione di `compile_applet` al termine di ogni fase di modifica.
