import re

with open('services/SearchService.ts', 'r') as f:
    content = f.read()

photon_provider = """
export class PhotonSearchProvider implements ISearchProvider {
  async search(query: string, referencePos?: { lat: number; lng: number }): Promise<LocationInfo[]> {
    try {
      const loc = referencePos ? `&lat=${referencePos.lat}&lon=${referencePos.lng}` : '';
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=it&limit=12${loc}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      
      return (data.features || []).map((f: any) => {
        const p = f.properties;
        // Priority for name: explicit name, or street name, or city name
        const name = p.name || p.street || p.city || p.state || '';
        
        const addressParts = [];
        if (p.name && p.street) addressParts.push(p.street + (p.housenumber ? ' ' + p.housenumber : ''));
        else if (p.housenumber && p.street) addressParts.push(p.street + ' ' + p.housenumber);
        
        if (p.city && p.city !== name) addressParts.push(p.city);
        else if (p.town && p.town !== name) addressParts.push(p.town);
        else if (p.village && p.village !== name) addressParts.push(p.village);
        
        if (p.state && p.state !== name && !addressParts.includes(p.state)) addressParts.push(p.state);
        
        const isShop = p.osm_key === 'shop' || p.osm_key === 'amenity' || p.osm_key === 'tourism' || p.osm_key === 'leisure';
        
        return {
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          name: name,
          address: addressParts.join(', '),
          isShop: isShop,
          osm_key: p.osm_key,
          osm_value: p.osm_value,
          type: p.osm_value
        };
      }).filter((r: any) => r.lat && r.lng && r.name);
    } catch (e) {
      console.error('Photon search error:', e);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null> {
    try {
      const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=it`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.features || data.features.length === 0) return null;
      
      const p = data.features[0].properties;
      const name = p.name || p.street || p.city || '';
      return {
        lat: data.features[0].geometry.coordinates[1],
        lng: data.features[0].geometry.coordinates[0],
        name: name,
        address: [p.city || p.town, p.state].filter(Boolean).join(', ')
      };
    } catch(e) {
      return null;
    }
  }
}
"""

content = content.replace("export class GeoapifySearchProvider", photon_provider + "\nexport class GeoapifySearchProvider")

content = content.replace(
"""export const globalSearchService = new SearchService(
  new GeoapifySearchProvider(GEOAPIFY_KEY),
  new NominatimSearchProvider()
);""",
"""export const globalSearchService = new SearchService(
  new PhotonSearchProvider(),
  new GeoapifySearchProvider(GEOAPIFY_KEY)
);""")

with open('services/SearchService.ts', 'w') as f:
    f.write(content)
