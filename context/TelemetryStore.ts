export const TelemetryStore = {
  position: null as {lat: number, lng: number} | null,
  bearing: 0,
  simulatedRemainingDistance: null as number | null,
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
  setPosition(pos: {lat: number, lng: number}) {
    this.position = pos;
    this.notify();
  },
  setBearing(b: number) {
    this.bearing = b;
    this.notify();
  },
  setSimulatedRemainingDistance(dist: number | null) {
    this.simulatedRemainingDistance = dist;
    this.notify();
  },
  notify() {
    this.listeners.forEach(l => l());
  }
};
