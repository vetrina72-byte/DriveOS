import re

with open("services/SearchService.ts", "r") as f:
    content = f.read()

mapbox_impl = """export class MapboxSearchProvider implements ISearchProvider {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  async search(query: string, referencePos?: { lat: number; lng: number }): Promise<LocationInfo[]> {
    if (!this.apiKey) return [];
    try {
      // Use Mapbox Geocoding v5 which supports POIs, categories, addresses.
      // Prioritize results near the vehicle.
      const proximity = referencePos ? `&proximity=${referencePos.lng},${referencePos.lat}` : '';
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.apiKey}&country=it&limit=10${proximity}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.features || []).map((f: any) => {
        const isPoi = f.id.startsWith('poi');
        const category = f.properties?.category || '';
        const isShop = category.includes('shop') || category.includes('food') || category.includes('restaurant') || category.includes('gas');
        
        return {
          lat: f.center[1],
          lng: f.center[0],
          name: f.text,
          address: f.place_name.split(',').slice(1).join(',').trim() || f.place_name,
          isShop: isShop,
          type: category || (isPoi ? 'poi' : 'address')
        };
      }).filter((r: any) => r.lat && r.lng && r.name);
    } catch (e) {
      console.error('Mapbox search error:', e);
      return [];
    }
  }
  
  async reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null> {
    if (!this.apiKey) return null;
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.apiKey}&types=address,poi&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.features || !data.features.length) return null;
      const f = data.features[0];
      return {
        lat: f.center[1],
        lng: f.center[0],
        name: f.text,
        address: f.place_name.split(',').slice(1).join(',').trim() || f.place_name
      };
    } catch(e) {
      return null;
    }
  }
}"""

content = re.sub(r'export class MapboxSearchProvider implements ISearchProvider \{.*?\n\}', mapbox_impl, content, flags=re.DOTALL)

# Update the singleton to use Mapbox if available
singleton_update = """// Singleton instance
const GEOAPIFY_KEY = '0d2c9c7f72c0477eb3260838db72a383';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const globalSearchService = new SearchService(
  MAPBOX_TOKEN ? new MapboxSearchProvider(MAPBOX_TOKEN) : new GeoapifySearchProvider(GEOAPIFY_KEY),
  new PhotonSearchProvider()
);"""

content = re.sub(r'// Singleton instance.*', singleton_update, content, flags=re.DOTALL)

with open("services/SearchService.ts", "w") as f:
    f.write(content)
