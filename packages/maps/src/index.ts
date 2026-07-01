export interface LatLng { lat: number; lng: number; }
export interface Route { distance_m: number; duration_s: number; geometry: LatLng[]; }
export interface GeocodeResult { display_name: string; lat: number; lng: number; type?: string; address?: { road?: string; suburb?: string; city?: string; state?: string; postcode?: string; country?: string; }; }
export type MapProviderName = 'osm' | 'google' | 'mapbox' | 'here' | 'tomtom';

export interface MapProvider {
  name: MapProviderName;
  getRoute(origin: LatLng, destination: LatLng, stops?: LatLng[]): Promise<Route>;
  geocode(address: string, opts?: { country?: string }): Promise<GeocodeResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<GeocodeResult>;
  getTileUrl(): string;
  getAttribution(): string;
}

const OSRM_URL = process.env.NEXT_PUBLIC_OSRM_URL || 'https://router.project-osrm.org';
const NOMINATIM_URL = process.env.NEXT_PUBLIC_NOMINATIM_URL || 'https://nominatim.openstreetmap.org';

export class OSMProvider implements MapProvider {
  name: MapProviderName = 'osm';
  async getRoute(origin: LatLng, destination: LatLng, stops?: LatLng[]): Promise<Route> {
    const coords = [origin, ...(stops || []), destination].map((p) => `${p.lng},${p.lat}`).join(';');
    const res = await fetch(`${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('Nenhuma rota encontrada');
    return { distance_m: route.distance, duration_s: route.duration, geometry: route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) };
  }
  async geocode(address: string, opts?: { country?: string }): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({ q: address, format: 'json', addressdetails: '1', limit: '5' });
    if (opts?.country) params.set('countrycodes', opts.country);
    const res = await fetch(`${NOMINATIM_URL}/search?${params}`, { headers: { 'User-Agent': 'MobilerPremium/1.0' } });
    if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
    return (await res.json()).map((r: any) => ({ display_name: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon), type: r.type, address: r.address }));
  }
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    const res = await fetch(`${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, { headers: { 'User-Agent': 'MobilerPremium/1.0' } });
    if (!res.ok) throw new Error(`Nominatim reverse error: ${res.status}`);
    const r = await res.json();
    return { display_name: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: r.address };
  }
  getTileUrl(): string { return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'; }
  getAttribution(): string { return '© OpenStreetMap contributors'; }
}

export function getMapProvider(name: MapProviderName = 'osm'): MapProvider {
  return new OSMProvider();
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180, Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatLatLng(p: LatLng, precision = 5): string {
  return `${p.lat.toFixed(precision)}, ${p.lng.toFixed(precision)}`;
}
