# Piano di Ottimizzazione Scena 3D: Sincronizzazione Animazione e Fit Intelligente nel Resize

## Sintesi degli Obiettivi
1. **Sincronizzazione temporale perfetta della scena 3D con interfaccia e player**:
   - Uniformare la durata della transizione della camera e del modello 3D alla durata reale già utilizzata dal Music Player e dall'apertura delle app (**420ms**), condividendo la stessa curva di easing (`cubic-bezier(0.16, 1, 0.3, 1)`), in modo che camera, player e app terminino contemporaneamente.
2. **Preservazione della presenza visiva del modello 3D durante il resize (No "Shrink to Fit" cieco)**:
   - Utilizzare il **Current Screen Size (Desktop)** come baseline di riferimento.
   - Eliminare le formule di riduzione lineare aggressiva (`W / 1180`, dimezzamento fisso a `0.50` e arretramento forzato della camera).
   - Introdurre un adattamento basato sull'aspect ratio e sull'area visibile reale della canvas 3D che mantenga la presenza visiva percepita del modello, leggermente più presente su tablet, riducendo le dimensioni solo ed esclusivamente quando geometricamente necessario per evitare clipping sui bordi della scena.

---

## 1. Analisi dello Stato Attuale: Cause e Numeri

### A. Timing di Animazione Attuale (Perché la camera è troppo lenta)
- In `components/MusicPlayer.tsx` (linea 915):
  $$\text{duration}_{\text{player}} = 420\text{ ms}$$
- In `components/VehicleCanvas.tsx` (linea 1036):
  $$\text{duration}_{\text{camera}} = 0.90\text{ s} = 900\text{ ms}$$
- In `components/MapsContainer.tsx` (linea 689):
  $$\text{duration}_{\text{maps}} = 900\text{ ms}$$
- **Discrepanza riscontrata**:
  Il Music Player completa il suo movimento in **420ms**. La camera 3D impiega **900ms** (più del doppio). Quando il player è già fermo in posizione e l'app ha quasi completato il render, la camera 3D continua a muoversi per un altro mezzo secondo, creando una sensazione di lentezza e asincronia visiva.

### B. Scala e Posizionamento del Modello 3D Attuale (Perché il modello diventa minuscolo)
- **Stato Home** (`localHomeConfig` in `VehicleCanvas.tsx`, linee 527-535):
  ```ts
  if (W < 1180) {
    const scaleFactor = Math.max(0.55, W / 1180);
    baseModelScale = homeConfig.modelScale * scaleFactor;
  }
  ```
  Appena la larghezza scende sotto 1180px, la scala base ($2.68$) viene moltiplicata per $W / 1180$. A 800px la macchina viene rimpicciolita al 67%, pur essendoci ancora tutto lo spazio verticale e orizzontale necessario.
- **Stato App Aperta** (`localAppOpenConfig`, linee 569-590):
  ```ts
  let scaleFactor = 1.0;
  if (W < 1180) {
    scaleFactor = isNarrowMobile ? 0.42 : (isPortrait ? 0.46 : 0.50);
  }
  const tabletScale = appOpenConfig.modelScale * scaleFactor;
  const camDeltaZ = (cameraPos.z - cameraTarget.z) * (W < 1180 ? 1.15 : 1.0);
  ```
  Su tablet/resize, la scala viene letteralmente dimezzata ($0.50 \times 1.51 = 0.755$) e la telecamera viene contestualmente allontanata del 15% (`camDeltaZ * 1.15`). Questo duplice fattore trasforma l'auto in un modellino minuscolo disperso nello spazio.

---

## 2. Soluzione Proposta

### Parte 1: Sincronizzazione del Timing a 420ms
- Impostare in `components/VehicleCanvas.tsx`:
  $$\text{duration} = 0.42\text{ s (420 ms)}$$
  sia per l'apertura che per la chiusura dell'app in modalità automatica (`transitionMode.current === "auto"`).
- Allineare anche `components/MapsContainer.tsx` e `components/SpotifyPlayer.tsx` su una durata di **420ms** (o derivata da `sceneTransitionSpeed` tarata a 0.42s).
- **Risultato**:
  $$\text{Player (420ms)} \quad \longleftrightarrow \quad \text{App Slide (420ms)} \quad \longleftrightarrow \quad \text{Camera 3D (420ms)}$$
  I tre componenti partono insieme sul frame 0, interpolano con la stessa curva `cubicBezierEase` e terminano contemporaneamente al frame 420ms.

---

### Parte 2: Fit Intelligente del Modello 3D nel Resize
Utilizzare come baseline immutabile il **Current Screen Size** (`homeConfig.modelScale = 2.68`, `appOpenConfig.modelScale = 1.51`, $A_{\text{ref}} \approx 16/9 \approx 1.77$):

#### A. Stato Home (Nessuna app aperta)
- **Principio**: La telecamera Three.js PerspectiveCamera usa un FOV verticale fisso ($48^\circ$). Quando la finestra viene ridimensionata orizzontalmente o verticalmente, l'altezza visibile in unità Three.js resta invariata; cambia solo l'apertura orizzontale in funzione dell'aspect ratio $A = W / H$.
- **Formula di presenza visiva**:
  - Non ridurre la scala per schermi medi o tablet orizzontali.
  - Mantenere la scala nominale $2.68$ (o leggermente superiore, es. $2.75$ per accentuare la presenza visiva desiderata dall'utente).
  - Intervenire con un fattore di contenimento solo se l'aspect ratio si restringe drasticamente (es. $A < 1.25$ o mobile portrait) per garantire un margine di sicurezza del 10% dai bordi della canvas, senza mai far scendere la scala a valori minimi arbitrari:
    $$\text{scaleFactor} = \min\left(1.05, \, \max\left(0.85, \, \frac{A}{1.35}\right)\right)$$
  - Centratura dinamica `modelPos.x` per mantenere la vettura al centro del cono visivo utile.

#### B. Stato App Aperta (Pannello a destra, auto a sinistra)
- **Principio**: Con l'app aperta, la colonna visibile a sinistra occupa $1/3$ della larghezza dello schermo.
- **Correzione**:
  - Eliminare il crollo a $0.50$ e l'allontanamento della camera `camDeltaZ * 1.15`.
  - Mantenere la telecamera alla distanza corretta ($camDeltaZ \times 1.0$) e una scala del modello solida (intorno a $1.35 - 1.45$ invece di $0.75$), calcolando il posizionamento $X$ in modo che l'auto sia centrata nel terzo sinistro dello schermo con margini equilibrati sia dal bordo sinistro dell'infotainment che dalla boundary dell'app aperta a destra.
  - L'auto rimane ben visibile, dettagliata e proporzionata, con presenza scenica adeguata e senza uscire dai bordi.

---

## 3. Piano dei File da Modificare

1. **`components/VehicleCanvas.tsx`**:
   - Aggiornare `duration = 0.42` (420ms) nel loop di animazione automatica (`linea 1036`).
   - Sostituire le formule di scaling forzato in `localHomeConfig` (linee 520-557) e `localAppOpenConfig` (linee 559-610) con la logica di conservazione della presenza basata sull'aspect ratio e sull'area visibile reale.
2. **`components/MapsContainer.tsx`**:
   - Uniformare la durata di transizione del pannello drawer a `420ms` per sincronia perfetta con la camera e il player.

---

## 4. Verifica e Risultati Attesi
- **Sincronia**: Al click sull'icona di un'app, l'app scorre da destra, il player si sposta verso sinistra e la camera 3D ruota/zooma terminando il moto nello stesso istante esatto (420ms).
- **Scala Home nel resize**: La vettura non si riduce al 50-60% durante il resize della finestra, ma mantiene la grandezza e la presenza dello schermo desktop grande.
- **Scala App Open nel resize**: L'auto nella colonna sinistra mantiene una dimensione chiara e leggibile senza diventare un modellino minuscolo.
- **Integrità del Music Player**: Nessun tocco alle formule e alle boundary del player musicale già consolidate.
