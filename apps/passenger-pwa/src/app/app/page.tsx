"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, LogOut, Search } from "lucide-react";
import { getSession, supaQuery, callFunction, signOut } from "@/lib/supa";
import { getSupabase } from "@/lib/supabase-client";
import type LType from "leaflet";
type LMap = LType.Map;
type LMarker = LType.Marker;

interface LatLng { lat: number; lng: number; }

// Leaflet usa window — não pré-renderizar
export const dynamic = "force-dynamic";

export default function PassengerApp() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [map, setMap] = useState<LMap | null>(null);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originAddress, setOriginAddress] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<LatLng | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [fare, setFare] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [requesting, setRequesting] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const session = getSession();
      if (!session) return router.push("/auth/login");
      const cId = session.user.app_metadata?.company_id;
      if (!cId) return router.push("/auth/login");
      setCompanyId(cId);

      try {
        const uData = await supaQuery(`users?select=id&auth_user_id=eq.${session.user.id}`);
        const u = uData?.[0];
        if (u) setUserId(u.id);

        const cats = await supaQuery(`categories?select=*&company_id=eq.${cId}&active=eq.true`);
        setCategories(cats || []);
        if (cats && cats[0]) setSelectedCategory(cats[0]);

        if (mapContainerRef.current && !map) {
          const L = (await import("leaflet")).default;
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          });
          const m = L.map(mapContainerRef.current).setView([-23.5505, -46.6333], 13);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(m);
          const pin = L.marker(m.getCenter(), { draggable: true }).addTo(m);
          pin.on("dragend", () => { const ll = pin.getLatLng(); setOrigin({ lat: ll.lat, lng: ll.lng }); reverseGeocode(ll.lat, ll.lng); });
          m.on("move", () => pin.setLatLng(m.getCenter()));
          m.on("moveend", () => { const c = m.getCenter(); setOrigin({ lat: c.lat, lng: c.lng }); reverseGeocode(c.lat, c.lng); });
          setMap(m);
          // Multiple invalidateSize calls to handle different render timings
          setTimeout(() => m.invalidateSize(), 100);
          setTimeout(() => m.invalidateSize(), 500);
          setTimeout(() => m.invalidateSize(), 1000);
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => { const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; m.setView(newPos, 15); setOrigin(newPos); reverseGeocode(newPos.lat, newPos.lng); },
              (err) => console.warn("Geolocation error:", err),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          }
        }
        setLoading(false);

        // Realtime via createClient (WebSocket envia o token corretamente)
        const supabase = getSupabase();
        const channel = supabase.channel("passenger-ride")
          .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `passenger_id=eq.${u?.id}` }, (payload: any) => setActiveRide(payload.new))
          .subscribe();
        return () => { supabase.removeChannel(channel); };
      } catch (err) {
        console.error("init error:", err);
        setLoading(false);
      }
    }
    init();
  }, [router, map]);

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const NOMINATIM = process.env.NEXT_PUBLIC_NOMINATIM_URL || "https://nominatim.openstreetmap.org";
      const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { "User-Agent": "MobilerPremium/1.0" } });
      const data = await res.json();
      setOriginAddress(data.display_name || `${lat}, ${lng}`);
    } catch { setOriginAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
  }

  async function searchDestination(query: string) {
    if (query.length < 4) return;
    try {
      const NOMINATIM = process.env.NEXT_PUBLIC_NOMINATIM_URL || "https://nominatim.openstreetmap.org";
      const res = await fetch(`${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&countrycodes=br&limit=1`, { headers: { "User-Agent": "MobilerPremium/1.0" } });
      const data = await res.json();
      if (data[0]) {
        const c = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setDestinationCoords(c);
        setDestination(data[0].display_name);
        calculateFare(c);
        if (map) {
          const L = (await import("leaflet")).default;
          L.marker(c).addTo(map).bindPopup("Destino").openPopup();
          const bounds = L.latLngBounds([origin, c].filter(Boolean) as LatLng[]);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    } catch (err) { console.error("searchDestination error:", err); }
  }

  async function calculateFare(dest: LatLng) {
    if (!origin || !selectedCategory) return;
    try {
      const OSRM = process.env.NEXT_PUBLIC_OSRM_URL || "https://router.project-osrm.org";
      const res = await fetch(`${OSRM}/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;
      const subtotal = Number(selectedCategory.base_fare) + Number(selectedCategory.per_km) * distanceKm + Number(selectedCategory.per_min) * durationMin;
      const total = Math.max(subtotal, Number(selectedCategory.min_fare));
      setFare(+total.toFixed(2));
    } catch (err) { console.error("calculateFare error:", err); }
  }

  async function requestRide() {
    if (!origin || !destinationCoords || !selectedCategory || !userId) return;

    // Valida zona de origem antes de pedir
    try {
      const zoneData = await callFunction("check-zone", { lat: origin.lat, lng: origin.lng });
      if (zoneData && zoneData.in_zone === false) {
        alert(`🚫 ${zoneData.message || "Zona não habilitada — não operamos nesta região"}`);
        return;
      }
    } catch (err) {
      console.warn("Zone check falhou (permitindo):", err);
    }

    setRequesting(true);
    try {
      const data = await callFunction("create-ride", {
        origin, destination: destinationCoords, originAddress, destinationAddress: destination, categoryId: selectedCategory.id, paymentMethod,
      });
      setActiveRide(data.ride);
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setRequesting(false); }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  return (
    <div className="fixed inset-0 bg-slate-950 text-white">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ width: "100%", height: "100%" }} />
      {!activeRide && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
          <div className="w-10 h-10 bg-cyan-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center"><MapPin className="w-5 h-5 text-white" /></div>
        </div>
      )}
      <header className="absolute top-0 left-0 right-0 z-20 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="text-sm font-medium">Passageiro</div>
          <button onClick={signOut} className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>
      {!activeRide && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-900 rounded-t-2xl border-t border-slate-800 p-4 max-h-[70vh] overflow-y-auto">
          <div className="max-w-md mx-auto space-y-3">
            <div className="bg-slate-800 rounded-lg p-3 flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5" />
              <div className="flex-1 min-w-0"><div className="text-xs text-slate-400">Origem</div><div className="text-sm truncate">{originAddress || "Arraste o mapa..."}</div></div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-slate-400" />
                <input value={destination} onChange={(e) => setDestination(e.target.value)} onBlur={(e) => searchDestination(e.target.value)} placeholder="Para onde?" className="flex-1 bg-transparent text-sm outline-none" />
              </div>
              {destinationCoords && <div className="text-xs text-slate-400 truncate">{destination}</div>}
            </div>
            {categories.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 px-1">Categoria</div>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <button key={c.id} onClick={() => { setSelectedCategory(c); if (destinationCoords) calculateFare(destinationCoords); }} className={`p-3 rounded-lg border text-left ${selectedCategory?.id === c.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700 bg-slate-800"}`}>
                      <div className="font-semibold text-sm" style={{ color: c.color }}>{c.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{fare && selectedCategory?.id === c.id ? <span className="text-cyan-400 font-bold">R$ {fare.toFixed(2)}</span> : <span>Base R$ {Number(c.base_fare).toFixed(2)}</span>}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-400 px-1 mb-1">Pagamento</div>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-sm">
                <option value="cash">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="credit_card">Cartão de crédito</option>
                <option value="machine">Maquininha do motorista</option>
              </select>
            </div>
            <button onClick={requestRide} disabled={!origin || !destinationCoords || !selectedCategory || requesting} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {requesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Solicitando...</> : fare ? `Solicitar por R$ ${fare.toFixed(2)}` : "Solicitar corrida"}
            </button>
          </div>
        </div>
      )}
      {activeRide && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-900 rounded-t-2xl border-t border-slate-800 p-4">
          <div className="max-w-md mx-auto">
            <div className="text-xs text-cyan-400 mb-2">Corrida {activeRide.status}</div>
            <div className="text-lg font-bold mb-3">R$ {activeRide.fare ? Number(activeRide.fare).toFixed(2) : "..."}</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5" /><div className="flex-1 truncate">{activeRide.origin_address}</div></div>
              <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-red-400 mt-1.5" /><div className="flex-1 truncate">{activeRide.destination_address}</div></div>
            </div>
            {activeRide.status === "solicitada" && <div className="mt-4 text-center text-sm text-slate-400 animate-pulse">Procurando motorista...</div>}
            {activeRide.status === "aceita" && <div className="mt-4 text-center text-sm text-cyan-400">✓ Motorista a caminho!</div>}
            {activeRide.status === "finalizada" && <div className="mt-4 text-center text-sm text-emerald-400">Corrida finalizada. Obrigado!</div>}
          </div>
        </div>
      )}
    </div>
  );
}
