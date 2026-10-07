# Piano di Implementazione: Risoluzione Glitch Scena 3D e Dissolvenza Handle

Risoluzione dei due problemi segnalati relativi alla chiusura dell'app tramite la handle del drawer: la breve scossa della scena 3D al rilascio della handle a 100% chiusura e la scomparsa improvvisa della handle senza dissolvenza progressiva (fade out).

---

## 1. Risoluzione Glitch Scena 3D (Frequenza di aggiornamento `currentP`)
* **Problema:** Quando si trascina la handle fino a 100% (app completamente chiusa) e si rilascia il mouse/touch, `VehicleCanvas` rilevava un cambio di stato `isAppOpen` (da `true` a `false`), ma poiché `currentP.current` non veniva aggiornato continuamente durante il canale `drag`, `autoStartP` ripartiva da `0` (posizione app aperta), causando un salto visivo di un millisecondo prima di tornare a Home.
* **Soluzione (`VehicleCanvas.tsx`):**
  * Aggiornare continuamente `currentP.current = rawP` all'interno del canale di esecuzione `transitionMode.current === "drag"`.
  * Quando la handle viene rilasciata a 100% chiusura, `autoStartP` sarà già `1.0` (Home), eliminando qualsiasi scatto o riposizionamento temporaneo della camera 3D.

---

## 2. Dissolvenza Progressiva (Fade Out) della Handle durante il Chiusura
* **Problema:** La visibilità della handle era gestita tramite una classe binaria fissa (`isOpen ? opacity-100 : opacity-0`), causando una scomparsa di botto o disallineata rispetto al trascinamento.
* **Soluzione (`SpotifyPlayer`, `RadioApp`, `YouTubeMusicApp`, `Theater`, `DebugControls`, `MapsContainer`):**
  * Calcolare in tempo reale l'opacità e la scala della handle in base alla percentuale di chiusura visiva (`visualPercent` / `currentPercent`):
    * A 0% chiusura (app aperta): Opacità 1.0, Scala 1.0.
    * Man mano che l'app viene trascinata o scorre verso destra (da 0% a 60% chiusura): l'opacità della handle sfuma in modo fluido (`1 - visualPercent / 60`) e la scala si riduce gradualmente.
  * La handle farà un **fade out perfettamente sincronizzato** con il movimento fisico del pannello sia durante il trascinamento manuale sia durante l'animazione di chiusura automatica.

---

## 3. Verifica e Compilazione
* Eseguire `compile_applet` per verificare che la build completi senza errori.
* Verificare la fluidità della fotocamera 3D e della dissolvenza della handle sia con interazione mouse/touch che con i pulsanti della dock.
