"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, LogOut, Search, Check, Navigation } from "lucide-react";
import { getSession, supaQuery, callFunction, signOut } from "@/lib/supa";
import { getSupabase } from "@/lib/supabase-client";

interface LatLng { lat: number; lng: number; }

export const dynamic = "force-dynamic";

type Step = "origin" | "destination" | "categories" | "requesting" | "active";

export default function PassengerApp() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [step, setStep] = useState<Step>("origin");

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originAddress, setOriginAddress] = useState("");

  const [destination, setDestination] = useState<LatLng | null>(null);
  const [destinationAddress, setDestinationAddress] = useState("");

  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [fares, setFares] = useState<Record<string, number>>({});
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
          if (payload.new) {
            setActiveRide(payload.new);
            setStep("active");
          }
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

        // On move, update pin position (origin or destination depending on step)
        map.on("moveend", () => {
          if (step === "active" || step === "requesting") return;
          const c = map.getCenter();
          const newPos = { lat: c.lat, lng: c.lng };

          if (step === "origin") {
            setOrigin(newPos);
            reverseGeocode(newPos.lat, newPos.lng, setOriginAddress);
          } else if (step === "destination") {
            setDestination(newPos);
            reverseGeocode(newPos.lat, newPos.lng, setDestinationAddress);
          }
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
              reverseGeocode(newPos.lat, newPos.lng, setOriginAddress);
            },
            () => {
              const def = { lat: -23.5505, lng: -46.6333 };
              setOrigin(def);
              reverseGeocode(def.lat, def.lng, setOriginAddress);
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

  // Re-bind moveend when step changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.off("moveend");
    mapRef.current.on("moveend", () => {
      if (step === "active" || step === "requesting") return;
      const c = mapRef.current.getCenter();
      const newPos = { lat: c.lat, lng: c.lng };

      if (step === "origin") {
        setOrigin(newPos);
        reverseGeocode(newPos.lat, newPos.lng, setOriginAddress);
      } else if (step === "destination") {
        setDestination(newPos);
        reverseGeocode(newPos.lat, newPos.lng, setDestinationAddress);
      }
    });
  }, [step]);

  async function reverseGeocode(lat: number, lng: number, setter: (s: string) => void) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
        headers: { "User-Agent": "MobilerPremium/1.0" },
      });
      const data = await res.json();
      setter(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch { setter(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
  }

  function confirmOrigin() {
    // Add origin marker on map
    if (mapRef.current && origin) {
      (async () => {
        const L = (await import("leaflet")).default;
        L.circleMarker([origin.lat, origin.lng], {
          radius: 8, color: "#10b981", fillColor: "#10b981", fillOpacity: 1, weight: 3
        }).addTo(mapRef.current).bindPopup("📍 Partida");
      })();
    }
    setStep("destination");
  }

  function confirmDestination() {
    if (!origin || !destination) return;

    // Add destination marker
    if (mapRef.current) {
      (async () => {
        const L = (await import("leaflet")).default;
        if (destMarkerRef.current) mapRef.current.removeLayer(destMarkerRef.current);
        destMarkerRef.current = L.circleMarker([destination.lat, destination.lng], {
          radius: 8, color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1, weight: 3
        }).addTo(mapRef.current).bindPopup("🏁 Destino");

        // Draw line between origin and destination
        L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], {
          color: "#06B6D4", weight: 3, dashArray: "5, 10"
        }).addTo(mapRef.current);

        // Fit bounds to show both
        const bounds = L.latLngBounds([origin, destination]);
        mapRef.current.fitBounds(bounds, { padding: [60, 200] });
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
      })();
    }

    // Calculate fares for all categories
    calculateAllFares();
    setStep("categories");
  }

  async function calculateAllFares() {
    if (!origin || !destination || categories.length === 0) return;
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;

      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;
      const newFares: Record<string, number> = {};

      for (const cat of categories) {
        const baseFee = Number(cat.base_fee) || Number(cat.base_fare) || 0;
        const perKm = Number(cat.per_km) || 0;
        const perMin = Number(cat.per_min) || 0;
        const minFare = Number(cat.min_fare) || 0;
        let subtotal = baseFee + perKm * distanceKm + perMin * durationMin;
        const total = Math.max(subtotal, minFare);
        newFares[cat.id] = +total.toFixed(2);
      }

      setFares(newFares);
    } catch (err) { console.error("calculateFares:", err); }
  }

  function editOrigin() {
    setStep("origin");
    setDestination(null);
    setDestinationAddress("");
    setFares({});
    if (destMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }
  }

  function editDestination() {
    setStep("destination");
    setFares({});
  }

  async function requestRide() {
    if (!origin || !destination || !selectedCategory || !userId) return;
    try {
      const zoneData = await callFunction("check-zone", { lat: origin.lat, lng: origin.lng });
      if (zoneData.in_zone === false) {
        alert(`🚫 ${zoneData.message || "Zona não habilitada"}`);
        return;
      }
    } catch (err) { console.warn("Zone check:", err); }

    setRequesting(true);
    setStep("requesting");
    try {
      const data = await callFunction("create-ride", {
        origin, destination,
        originAddress, destinationAddress,
        categoryId: selectedCategory.id, paymentMethod,
      });
      if (data.ride) {
        setActiveRide(data.ride);
        setStep("active");
      }
    } catch (err) {
      alert("Erro: " + (err as Error).message);
      setStep("categories");
    } finally { setRequesting(false); }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  // Pin color depends on step
  const pinColor = step === "destination" ? "#ef4444" : step === "categories" || step === "requesting" || step === "active" ? "transparent" : "#06B6D4";

  return (
    <div className="fixed inset-0 bg-slate-950 text-white overflow-hidden">
      {/* Map */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ width: "100vw", height: "100vh", background: "#1e293b" }} />

      {/* Center pin (CSS — only visible during origin/destination selection) */}
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

      {/* Step label at top */}
      {(step === "origin" || step === "destination") && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 px-4 py-2 rounded-full text-sm font-medium shadow-lg">
          {step === "origin" ? "📍 Arraste o mapa para sua partida" : "🏁 Arraste o mapa para o destino"}
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
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-900 rounded-t-2xl border-t border-slate-800 max-h-[65vh] overflow-y-auto">
        <div className="max-w-md mx-auto p-4 space-y-3">

          {/* ORIGIN */}
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-400">Partida</div>
                <div className="text-sm truncate">{originAddress || "Aguardando GPS..."}</div>
              </div>
              {step !== "origin" && (
                <button onClick={editOrigin} className="text-xs text-cyan-400 hover:text-cyan-300 flex-shrink-0">Editar</button>
              )}
            </div>
            {step === "origin" && origin && (
              <button onClick={confirmOrigin} className="w-full mt-3 py-2.5 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 flex items-center justify-center gap-2 text-sm">
                <Check className="w-4 h-4" /> Confirmar partida
              </button>
            )}
          </div>

          {/* DESTINATION */}
          {step !== "origin" && (
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">Destino</div>
                  <div className="text-sm truncate">
                    {step === "destination" ? (destinationAddress || "Arraste o mapa...") : (destinationAddress || "—")}
                  </div>
                </div>
                {step !== "destination" && step !== "active" && (
                  <button onClick={editDestination} className="text-xs text-cyan-400 hover:text-cyan-300 flex-shrink-0">Editar</button>
                )}
              </div>
              {step === "destination" && (
                <button onClick={confirmDestination} disabled={!destination} className="w-full mt-3 py-2.5 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                  <Check className="w-4 h-4" /> Confirmar destino
                </button>
              )}
            </div>
          )}

          {/* CATEGORIES + FARES */}
          {(step === "categories" || step === "requesting") && (
            <>
              {categories.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 px-1 mb-2">Escolha a categoria</div>
                  <div className="grid grid-cols-1 gap-2">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategory(c)}
                        className={`p-3 rounded-lg border text-left transition-colors flex items-center justify-between ${selectedCategory?.id === c.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700 bg-slate-800 hover:border-slate-600"}`}
                      >
                        <div>
                          <div className="font-semibold text-sm" style={{ color: c.color || "#06B6D4" }}>{c.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Base R$ {Number(c.base_fee || c.base_fare || 0).toFixed(2)} · {Number(c.per_km).toFixed(2)}/km · {Number(c.per_min).toFixed(2)}/min
                          </div>
                        </div>
                        {fares[c.id] && (
                          <div className={`text-lg font-bold ${selectedCategory?.id === c.id ? "text-cyan-400" : "text-slate-300"}`}>
                            R$ {fares[c.id].toFixed(2)}
                          </div>
                        )}
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
                disabled={!selectedCategory || requesting}
                className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {requesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Solicitando...</> : selectedCategory && fares[selectedCategory.id] ? `Solicitar por R$ ${fares[selectedCategory.id].toFixed(2)}` : "Solicitar corrida"}
              </button>
            </>
          )}

          {/* ACTIVE RIDE */}
          {step === "active" && activeRide && (
            <div className="space-y-3">
              <div className="text-xs text-cyan-400">Corrida {activeRide.status}</div>
              <div className="text-2xl font-bold">R$ {activeRide.fare ? Number(activeRide.fare).toFixed(2) : "..."}</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5" /><div className="flex-1 truncate">{activeRide.origin_address}</div></div>
                <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-red-400 mt-1.5" /><div className="flex-1 truncate">{activeRide.destination_address}</div></div>
              </div>
              {activeRide.status === "solicitada" && <div className="text-center text-sm text-slate-400 animate-pulse py-3">Procurando motorista...</div>}
              {activeRide.status === "aceita" && <div className="text-center text-sm text-cyan-400 py-3">✓ Motorista a caminho!</div>}
              {activeRide.status === "chegando" && <div className="text-center text-sm text-cyan-400 py-3">🚗 Motorista chegando!</div>}
              {activeRide.status === "em_andamento" && <div className="text-center text-sm text-cyan-400 py-3">🚗 Em andamento...</div>}
              {activeRide.status === "finalizada" && <div className="text-center text-sm text-emerald-400 py-3">✓ Corrida finalizada!</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
