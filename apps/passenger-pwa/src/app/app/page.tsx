"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, LogOut, Check, X } from "lucide-react";
import { getSession, supaQuery, supaUpdate, callFunction, signOut } from "@/lib/supa";
import { getSupabase } from "@/lib/supabase-client";

interface LatLng { lat: number; lng: number; }
export const dynamic = "force-dynamic";

type Step = "origin" | "destination" | "categories" | "active";

export default function PassengerApp() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("origin");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originAddress, setOriginAddress] = useState("");
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [fares, setFares] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentMethods, setPaymentMethods] = useState<any>({ cash: true });
  const [requesting, setRequesting] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const rideIdRef = useRef<string | null>(null);

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
        if (cats?.[0]) setSelectedCategory(cats[0]);
        const comp = await supaQuery(`companies?select=settings&id=eq.${cId}`);
        if (comp?.[0]?.settings?.payment_methods) setPaymentMethods(comp[0].settings.payment_methods);
        if (u?.[0]?.id) {
          const rides = await supaQuery(`rides?select=*&passenger_id=eq.${u[0].id}&status=in.(solicitada,aceita,chegando,em_andamento)&order=created_at.desc&limit=1`);
          if (rides?.[0]) { setActiveRide(rides[0]); rideIdRef.current = rides[0].id; setStep("active"); }
        }
      } catch (err) { console.error("init:", err); }
      setLoading(false);
      const supabase = getSupabase();
      const channel = supabase.channel("passenger-ride")
        .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, (payload: any) => {
          if (payload.new && rideIdRef.current && payload.new.id === rideIdRef.current) setActiveRide(payload.new);
        }).subscribe();
      const pollInterval = setInterval(async () => {
        if (!rideIdRef.current) return;
        try {
          const rides = await supaQuery(`rides?select=*&id=eq.${rideIdRef.current}&limit=1`);
          if (rides?.[0]) setActiveRide((prev: any) => (prev && prev.status === rides[0].status ? prev : rides[0]));
        } catch (err) { console.error("Polling:", err); }
      }, 3000);
      return () => { supabase.removeChannel(channel); clearInterval(pollInterval); };
    }
    init();
  }, [router]);

  // Initialize map — ONCE, no invalidateSize on moveend
  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !mapContainerRef.current) return;
        const map = L.map(mapContainerRef.current, {
          center: [-14.2350, -51.9253], // Centro do Brasil
          zoom: 4, // Zoom baixo: mostra Brasil inteiro
          zoomControl: false,
          attributionControl: true,
          worldCopyJump: true,
          minZoom: 3,
        });
        // OpenStreetMap tiles direto do servidor oficial (mais estável no Brasil)
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
          keepBuffer: 20, // Pré-carrega 20 tiles além do viewport
          updateWhenZooming: false,
          crossOrigin: true,
        }).addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);

        map.on("moveend", () => {
          if (step === "active") return;
          const c = map.getCenter();
          if (step === "origin") { setOrigin({ lat: c.lat, lng: c.lng }); reverseGeocode(c.lat, c.lng, setOriginAddress); }
          else if (step === "destination") { setDestination({ lat: c.lat, lng: c.lng }); reverseGeocode(c.lat, c.lng, setDestinationAddress); }
        });
        mapRef.current = map;
        // Only invalidateSize on initial load — NOT on every moveend
        setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 200);
        setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 800);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              // Fly to user's real location with city-level zoom
              map.flyTo([p.lat, p.lng], 14, { duration: 1.5 });
              setOrigin(p);
              reverseGeocode(p.lat, p.lng, setOriginAddress);
            },
            () => {
              // No GPS — stay at Brazil view, user can drag
              const d = { lat: -23.5505, lng: -46.6333 };
              setOrigin(d);
              reverseGeocode(d.lat, d.lng, setOriginAddress);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
          );
        }
      } catch (err) { console.error("Map:", err); }
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [loading]);

  // Re-bind moveend when step changes + invalidateSize once (panel height changed)
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.off("moveend");
    mapRef.current.on("moveend", () => {
      if (step === "active") return;
      const c = mapRef.current.getCenter();
      if (step === "origin") { setOrigin({ lat: c.lat, lng: c.lng }); reverseGeocode(c.lat, c.lng, setOriginAddress); }
      else if (step === "destination") { setDestination({ lat: c.lat, lng: c.lng }); reverseGeocode(c.lat, c.lng, setDestinationAddress); }
    });
    // ONE invalidateSize when step changes (panel resized) — with small delay for CSS transition
    setTimeout(() => mapRef.current?.invalidateSize(), 350);
  }, [step]);

  async function reverseGeocode(lat: number, lng: number, setter: (s: string) => void) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { "User-Agent": "MobilerPremium/1.0" } });
      const data = await res.json();
      setter(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch { setter(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
  }

  function confirmOrigin() {
    if (mapRef.current && origin) {
      (async () => {
        const L = (await import("leaflet")).default;
        L.circleMarker([origin.lat, origin.lng], { radius: 8, color: "#10b981", fillColor: "#10b981", fillOpacity: 1, weight: 3 }).addTo(mapRef.current).bindPopup("📍 Partida");
      })();
    }
    setStep("destination");
  }

  function confirmDestination() {
    if (!origin || !destination) return;
    if (mapRef.current) {
      (async () => {
        const L = (await import("leaflet")).default;
        L.circleMarker([destination.lat, destination.lng], { radius: 8, color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1, weight: 3 }).addTo(mapRef.current).bindPopup("🏁 Destino");
        L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], { color: "#06B6D4", weight: 3, dashArray: "5, 10" }).addTo(mapRef.current);
        const midLat = (origin.lat + destination.lat) / 2;
        const midLng = (origin.lng + destination.lng) / 2;
        mapRef.current.panTo([midLat, midLng]);
      })();
    }
    calculateAllFares();
    setStep("categories");
  }

  async function calculateAllFares() {
    if (!origin || !destination || !categories.length) return;
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;
      const distanceKm = route.distance / 1000, durationMin = route.duration / 60;
      const newFares: Record<string, number> = {};
      for (const cat of categories) {
        const baseFee = Number(cat.base_fee) || Number(cat.base_fare) || 0;
        const perKm = Number(cat.per_km) || 0, perMin = Number(cat.per_min) || 0;
        const minFare = Number(cat.min_fare) || 0;
        newFares[cat.id] = +Math.max(baseFee + perKm * distanceKm + perMin * durationMin, minFare).toFixed(2);
      }
      setFares(newFares);
    } catch (err) { console.error("Fares:", err); }
  }

  function editOrigin() { setStep("origin"); setDestination(null); setDestinationAddress(""); setFares({}); }
  function editDestination() { setStep("destination"); setFares({}); }

  async function requestRide() {
    if (!origin || !destination || !selectedCategory || !userId) return;
    try {
      const zoneData = await callFunction("check-zone", { lat: origin.lat, lng: origin.lng });
      if (zoneData.in_zone === false) { alert(`🚫 ${zoneData.message || "Zona não habilitada"}`); return; }
    } catch (err) { console.warn("Zone:", err); }
    setRequesting(true);
    try {
      const data = await callFunction("create-ride", { origin, destination, originAddress, destinationAddress, categoryId: selectedCategory.id, paymentMethod });
      if (data.ride) { setActiveRide(data.ride); rideIdRef.current = data.ride.id; setStep("active"); }
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setRequesting(false); }
  }

  async function cancelRide() {
    if (!activeRide) return;
    if (!confirm("Cancelar esta corrida?")) return;
    try {
      await supaUpdate("rides", `id=eq.${activeRide.id}`, { status: "cancelada" });
      setActiveRide(null); rideIdRef.current = null; setStep("origin");
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;
  const pinColor = step === "destination" ? "#ef4444" : step === "categories" || step === "active" ? "transparent" : "#06B6D4";

  return (
    <div className="fixed inset-0 bg-slate-950 text-white overflow-hidden">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ width: "100vw", height: "100vh", background: "#1e293b" }} />
      {(step === "origin" || step === "destination") && (
        <div className="absolute top-1/2 left-1/2 z-10 pointer-events-none" style={{ transform: "translate(-50%, -100%)" }}>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full border-4 border-white shadow-xl flex items-center justify-center" style={{ background: pinColor }}>
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="w-1 h-3" style={{ background: pinColor }} />
          </div>
        </div>
      )}
      {(step === "origin" || step === "destination") && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 px-4 py-2 rounded-full text-sm font-medium shadow-lg">
          {step === "origin" ? "📍 Arraste para sua partida" : "🏁 Arraste para o destino"}
        </div>
      )}
      <header className="absolute top-0 left-0 right-0 z-20 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="text-sm font-medium">Passageiro</div>
          <button onClick={signOut} className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <div className={`absolute bottom-0 left-0 right-0 z-20 bg-slate-900 rounded-t-2xl border-t border-slate-800 overflow-y-auto transition-all duration-300 ${step === "origin" || step === "destination" ? "max-h-[30vh]" : "max-h-[65vh]"}`}>
        <div className="max-w-md mx-auto p-4 space-y-3">
          {/* ORIGIN */}
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0"><div className="text-xs text-slate-400">Partida</div><div className="text-sm truncate">{originAddress || "Aguardando GPS..."}</div></div>
              {step !== "origin" && <button onClick={editOrigin} className="text-xs text-cyan-400 flex-shrink-0">Editar</button>}
            </div>
            {step === "origin" && origin && (
              <button onClick={confirmOrigin} className="w-full mt-3 py-2.5 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 flex items-center justify-center gap-2 text-sm"><Check className="w-4 h-4" /> Confirmar partida</button>
            )}
          </div>
          {/* DESTINATION */}
          {step !== "origin" && (
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0"><div className="text-xs text-slate-400">Destino</div><div className="text-sm truncate">{step === "destination" ? (destinationAddress || "Arraste o mapa...") : (destinationAddress || "—")}</div></div>
                {step !== "destination" && step !== "active" && <button onClick={editDestination} className="text-xs text-cyan-400 flex-shrink-0">Editar</button>}
              </div>
              {step === "destination" && (
                <button onClick={confirmDestination} disabled={!destination} className="w-full mt-3 py-2.5 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"><Check className="w-4 h-4" /> Confirmar destino</button>
              )}
            </div>
          )}
          {/* CATEGORIES */}
          {step === "categories" && (
            <>
              {categories.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 px-1 mb-2">Categoria</div>
                  <div className="grid grid-cols-1 gap-2">
                    {categories.map((c) => (
                      <button key={c.id} onClick={() => setSelectedCategory(c)} className={`p-3 rounded-lg border text-left transition-colors flex items-center justify-between ${selectedCategory?.id === c.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700 bg-slate-800 hover:border-slate-600"}`}>
                        <div><div className="font-semibold text-sm" style={{ color: c.color || "#06B6D4" }}>{c.name}</div><div className="text-xs text-slate-400 mt-0.5">Base R$ {Number(c.base_fee || c.base_fare || 0).toFixed(2)} · {Number(c.per_km).toFixed(2)}/km</div></div>
                        {fares[c.id] && <div className={`text-lg font-bold ${selectedCategory?.id === c.id ? "text-cyan-400" : "text-slate-300"}`}>R$ {fares[c.id].toFixed(2)}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-slate-400 px-1 mb-1">Pagamento</div>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-sm text-white">
                  {paymentMethods.cash && <option value="cash">💵 Dinheiro</option>}
                  {paymentMethods.pix && <option value="pix">📱 PIX</option>}
                  {paymentMethods.credit_card && <option value="credit_card">💳 Cartão</option>}
                  {paymentMethods.machine && <option value="machine">🏪 Maquininha</option>}
                </select>
              </div>
              <button onClick={requestRide} disabled={!selectedCategory || requesting} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {requesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Solicitando...</> : selectedCategory && fares[selectedCategory.id] ? `Solicitar por R$ ${fares[selectedCategory.id].toFixed(2)}` : "Solicitar corrida"}
              </button>
            </>
          )}
          {/* ACTIVE RIDE */}
          {step === "active" && activeRide && (
            <div className="space-y-3">
              <div className="text-lg font-bold">
                {activeRide.status === "solicitada" && "⏳ Procurando motorista..."}
                {activeRide.status === "aceita" && "✓ Motorista aceitou!"}
                {activeRide.status === "chegando" && "🚗 Motorista chegando"}
                {activeRide.status === "em_andamento" && "🚗 Em andamento"}
                {activeRide.status === "finalizada" && "✓ Finalizada"}
                {activeRide.status === "cancelada" && "✗ Cancelada"}
              </div>
              <div className="text-2xl font-bold text-cyan-400">R$ {Number(activeRide.fare || 0).toFixed(2)}</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5" /><div className="flex-1 truncate">{activeRide.origin_address}</div></div>
                <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-red-400 mt-1.5" /><div className="flex-1 truncate">{activeRide.destination_address}</div></div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3 space-y-2">
                {[
                  { key: "solicitada", label: "Corrida solicitada" },
                  { key: "aceita", label: "Motorista aceitou" },
                  { key: "chegando", label: "Motorista chegou" },
                  { key: "em_andamento", label: "Em andamento" },
                  { key: "finalizada", label: "Finalizada" },
                ].map((s, i) => {
                  const order = ["solicitada", "aceita", "chegando", "em_andamento", "finalizada"];
                  const currentIdx = order.indexOf(activeRide.status);
                  const done = i < currentIdx; const current = i === currentIdx;
                  return (
                    <div key={s.key} className={`flex items-center gap-2 text-sm ${current ? "text-cyan-400" : done ? "text-slate-400" : "text-slate-600"}`}>
                      <div className={`w-4 h-4 rounded-full ${done || current ? "bg-emerald-500" : "bg-slate-600"}`} />{s.label}
                    </div>
                  );
                })}
              </div>
              {activeRide.status === "solicitada" && (
                <button onClick={cancelRide} className="w-full py-2.5 rounded-md border border-red-800 text-red-400 text-sm hover:bg-red-900/20 flex items-center justify-center gap-2"><X className="w-4 h-4" /> Cancelar Corrida</button>
              )}
              {activeRide.status === "finalizada" && (
                <button onClick={() => router.push(`/rating?ride_id=${activeRide.id}`)} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">Avaliar corrida</button>
              )}
              {activeRide.status === "cancelada" && (
                <button onClick={() => { setActiveRide(null); rideIdRef.current = null; setStep("origin"); }} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">Nova corrida</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
