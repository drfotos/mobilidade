"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, LogOut, Search, Check, Navigation } from "lucide-react";
import { getSession, supaQuery, callFunction, signOut } from "@/lib/supa";
import { getSupabase } from "@/lib/supabase-client";

interface LatLng { lat: number; lng: number; }

export const dynamic = "force-dynamic";

export default function PassengerApp() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originAddress, setOriginAddress] = useState("");
  const [originConfirmed, setOriginConfirmed] = useState(false);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<LatLng | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [fare, setFare] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentMethods, setPaymentMethods] = useState<any>({ cash: true, credit_card: false, pix: false, machine: false });
  const [requesting, setRequesting] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const supabaseRef = useRef<any>(null);

  useEffect(() => {
    async function init() {
      const session = getSession();
      if (!session) return router.push("/auth/login");
      const cId = session.user.app_metadata?.company_id;
      if (!cId) return router.push("/auth/login");

      try {
        const u = await supaQuery(`users?select=id&auth_user_id=eq.${session.user.id}`);
        if (u?.[0]?.id) setUserId(u[0].id);
        const cats = await supaQuery(`categories?select=*&company_id=eq.${cId}&active=eq.true`);
        setCategories(cats || []);
        if (cats && cats[0]) setSelectedCategory(cats[0]);
        const comp = await supaQuery(`companies?select=settings&id=eq.${cId}`);
        if (comp?.[0]?.settings?.payment_methods) setPaymentMethods(comp[0].settings.payment_methods);
      } catch (err) { console.error("init:", err); }
      setLoading(false);

      const supabase = getSupabase();
      supabaseRef.current = supabase;
      const channel = supabase.channel("passenger-ride")
        .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, (payload: any) => {
          if (payload.new) setActiveRide(payload.new);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
    init();
  }, [router]);

  // Initialize map
  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [-23.5505, -46.6333],
          zoom: 14,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        // On move, update origin (but only if not confirmed yet)
        map.on("moveend", () => {
          if (originConfirmed) return; // Don't update if already confirmed
          const c = map.getCenter();
          const newPos = { lat: c.lat, lng: c.lng };
          setOrigin(newPos);
          reverseGeocode(newPos.lat, newPos.lng);
        });

        mapRef.current = map;
        setMapReady(true);

        setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 100);
        setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 500);
        setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 1500);

        // Get current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              map.setView(newPos, 15);
              setOrigin(newPos);
              reverseGeocode(newPos.lat, newPos.lng);
            },
            () => {
              const def = { lat: -23.5505, lng: -46.6333 };
              setOrigin(def);
              reverseGeocode(def.lat, def.lng);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
          );
        }
      } catch (err) { console.error("Map init:", err); }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [loading]);

  // Listen for originConfirmed changes to re-bind moveend
  useEffect(() => {
    if (!mapRef.current) return;
    // Re-bind moveend with current originConfirmed value
    mapRef.current.off("moveend");
    mapRef.current.on("moveend", () => {
      if (originConfirmed) return;
      const c = mapRef.current.getCenter();
      setOrigin({ lat: c.lat, lng: c.lng });
      reverseGeocode(c.lat, c.lng);
    });
  }, [originConfirmed]);

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
        headers: { "User-Agent": "MobilerPremium/1.0" },
      });
      const data = await res.json();
      setOriginAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch { setOriginAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
  }

  function confirmOrigin() {
    setOriginConfirmed(true);
    // Disable map dragging
    if (mapRef.current) mapRef.current.dragging.disable();
  }

  function editOrigin() {
    setOriginConfirmed(false);
    setDestination("");
    setDestinationCoords(null);
    setFare(null);
    if (destMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }
    if (mapRef.current) mapRef.current.dragging.enable();
  }

  async function searchDestination(query: string) {
    if (query.length < 4) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=br&limit=1`, {
        headers: { "User-Agent": "MobilerPremium/1.0" },
      });
      const data = await res.json();
      if (data[0] && mapRef.current) {
        const c = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setDestinationCoords(c);
        setDestination(data[0].display_name);
        calculateFare(c);

        const L = (await import("leaflet")).default;
        if (destMarkerRef.current) mapRef.current.removeLayer(destMarkerRef.current);
        destMarkerRef.current = L.marker(c).addTo(mapRef.current).bindPopup("📍 Destino").openPopup();

        if (origin) {
          const bounds = L.latLngBounds([origin, c]);
          mapRef.current.fitBounds(bounds, { padding: [60, 60] });
          setTimeout(() => mapRef.current?.invalidateSize(), 100);
        }
      }
    } catch (err) { console.error("search:", err); }
  }

  async function calculateFare(dest: LatLng) {
    if (!origin || !selectedCategory) return;
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;
      const baseFee = Number(selectedCategory.base_fee) || Number(selectedCategory.base_fare) || 0;
      const perKm = Number(selectedCategory.per_km) || 0;
      const perMin = Number(selectedCategory.per_min) || 0;
      const minFare = Number(selectedCategory.min_fare) || 0;
      let subtotal = baseFee + perKm * distanceKm + perMin * durationMin;
      const total = Math.max(subtotal, minFare);
      setFare(+total.toFixed(2));
    } catch (err) { console.error("fare:", err); }
  }

  async function requestRide() {
    if (!origin || !destinationCoords || !selectedCategory || !userId) return;
    try {
      const zoneData = await callFunction("check-zone", { lat: origin.lat, lng: origin.lng });
      if (zoneData.in_zone === false) {
        alert(`🚫 ${zoneData.message || "Zona não habilitada"}`);
        return;
      }
    } catch (err) { console.warn("Zone check:", err); }

    setRequesting(true);
    try {
      const data = await callFunction("create-ride", {
        origin, destination: destinationCoords,
        originAddress, destinationAddress: destination,
        categoryId: selectedCategory.id, paymentMethod,
      });
      if (data.ride) setActiveRide(data.ride);
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setRequesting(false); }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  return (
    <div className="fixed inset-0 bg-slate-950 text-white overflow-hidden">
      {/* Map */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ width: "100vw", height: "100vh", background: "#1e293b" }} />

      {/* Center pin (CSS only — always visible, doesn't depend on Leaflet icons) */}
      {!activeRide && (
        <div className="absolute top-1/2 left-1/2 z-10 pointer-events-none" style={{ transform: "translate(-50%, -100%)" }}>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 bg-cyan-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="w-1 h-3 bg-cyan-500" />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="text-sm font-medium">Passageiro</div>
          <button onClick={signOut} className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {/* Bottom panel */}
      {!activeRide && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-900 rounded-t-2xl border-t border-slate-800 max-h-[70vh] overflow-y-auto">
          <div className="max-w-md mx-auto p-4 space-y-3">

            {/* STEP 1: Origin */}
            <div className={`bg-slate-800 rounded-lg p-3 ${originConfirmed ? "opacity-90" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">Endereço de partida</div>
                  <div className="text-sm truncate">{originAddress || "Arraste o mapa para escolher..."}</div>
                </div>
                {originConfirmed && (
                  <button onClick={editOrigin} className="text-xs text-cyan-400 hover:text-cyan-300 flex-shrink-0">Editar</button>
                )}
              </div>
              {!originConfirmed && (
                <button
                  onClick={confirmOrigin}
                  disabled={!origin}
                  className="w-full mt-3 py-2.5 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  <Check className="w-4 h-4" /> Confirmar partida
                </button>
              )}
              {originConfirmed && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                  <Check className="w-3 h-3" /> Partida confirmada
                </div>
              )}
            </div>

            {/* STEP 2: Destination (only after origin confirmed) */}
            {originConfirmed && (
              <>
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchDestination(destination)}
                      placeholder="Para onde?"
                      className="flex-1 bg-transparent text-sm outline-none text-white"
                      autoFocus
                    />
                  </div>
                  {destinationCoords && (
                    <div className="text-xs text-slate-400 truncate pl-6">{destination}</div>
                  )}
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 px-1 mb-2">Categoria</div>
                    <div className="grid grid-cols-2 gap-2">
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCategory(c); if (destinationCoords) calculateFare(destinationCoords); }}
                          className={`p-3 rounded-lg border text-left transition-colors ${selectedCategory?.id === c.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700 bg-slate-800 hover:border-slate-600"}`}
                        >
                          <div className="font-semibold text-sm" style={{ color: c.color || "#06B6D4" }}>{c.name}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {fare && selectedCategory?.id === c.id ? <span className="text-cyan-400 font-bold">R$ {fare.toFixed(2)}</span> : <span>Base R$ {Number(c.base_fee || c.base_fare || 0).toFixed(2)}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment */}
                <div>
                  <div className="text-xs text-slate-400 px-1 mb-1">Pagamento</div>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-sm text-white">
                    {paymentMethods.cash && <option value="cash">💵 Dinheiro</option>}
                    {paymentMethods.pix && <option value="pix">📱 PIX</option>}
                    {paymentMethods.credit_card && <option value="credit_card">💳 Cartão</option>}
                    {paymentMethods.machine && <option value="machine">🏪 Maquininha</option>}
                  </select>
                </div>

                {/* Request */}
                <button
                  onClick={requestRide}
                  disabled={!destinationCoords || !selectedCategory || requesting}
                  className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Solicitando...</> : fare ? `Solicitar por R$ ${fare.toFixed(2)}` : "Solicitar corrida"}
                </button>
              </>
            )}

            {/* Hint when origin not confirmed */}
            {!originConfirmed && (
              <div className="text-center text-xs text-slate-500">
                Arraste o mapa para posicionar o pin no seu local de partida
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active ride */}
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
