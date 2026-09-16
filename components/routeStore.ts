
type LatLngTuple = [number, number];
type Subscriber = (coords: LatLngTuple[] | null) => void;

class RouteStore {
  private coords: LatLngTuple[] | null = null;
  private subscribers: Set<Subscriber> = new Set();

  getCoords = (): LatLngTuple[] | null => {
    return this.coords;
  };

  setRoute = (newCoords: LatLngTuple[] | null): void => {
    if (this.coords === null && newCoords === null) return;
    if (this.coords === newCoords) return;
    this.coords = newCoords;
    this.subscribers.forEach((callback) => callback(this.coords));
  };

  subscribe = (callback: Subscriber): (() => void) => {
    this.subscribers.add(callback);
    callback(this.coords); // Immediately notify with current value
    return () => {
      this.subscribers.delete(callback);
    };
  };
}

// Singleton instance
export const routeStore = new RouteStore();

