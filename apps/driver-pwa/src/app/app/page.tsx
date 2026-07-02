"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Check, X, MapPin, Navigation, Phone, Plus, ChevronRight } from "lucide-react";
import { getSession, supaQuery, supaUpdate, callFunction, signOut } from "@/lib/supa";
import { getSupabase } from "@/lib/supabase-client";

type DriverView = "loading" | "offline" | "available" | "in_ride" | "finished";

export default function DriverApp() {
  const router = useRouter();
  const [view, setView] = useState<DriverView>("loading");
  const [driver, setDriver] = useState<any>(null);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [passenger, setPassenger] = useState<any>(null);
  const [extras, setExtras] = useState({ toll: 0, wait: 0, stop: 0, other: 0 });
  const [showExtras, setShowExtras] = useState(false);
  const driverRef = useRef<any>(null);
  const companyIdRef = useRef<string>("");

  useEffect(() => {
    async function init() {
      const session = getSession();
      if (!session) return router.push("/auth/login");
      const role = session.user.app_metadata?.role;
      const companyId = session.user.app_metadata?.company_id;
      if (role !== "driver" || !companyId) { signOut(); return; }
      companyIdRef.current = companyId;

      try {
        const u = await supaQuery(`users?select=id,drivers!inner(id,status,cnh_category,total_rides,rating)&auth_user_id=eq.${session.user.id}`);
        const drv = u?.[0]?.drivers?.[0];
        if (!drv) { alert("Perfil não encontrado."); return; }
        if (drv.status === "pending") { alert("Cadastro pendente."); return router.push("/auth/login"); }
        if (drv.status === "suspended") { alert("Cadastro suspenso."); return router.push("/auth/login"); }
        setDriver(drv);
        driverRef.current = drv;

        // Check if driver has active ride
        const rides = await supaQuery(`rides?select=*&driver_id=eq.${drv.id}&status=in.(aceita,chegando,embarque,em_andamento)&order=created_at.desc&limit=1`);
        if (rides && rides[0]) {
          setActiveRide(rides[0]);
          await loadPassenger(rides[0].passenger_id);
          setView("in_ride");
        } else {
          // Check if driver was online
          setView(drv.status === "active" ? "available" : "offline");
        }
      } catch (err) {
        console.error("init:", err);
        setView("offline");
      }

      // Realtime: listen for new rides + updates to active ride
      const supabase = getSupabase();
      const channel = supabase.channel("driver-dispatch")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "rides", filter: `company_id=eq.${companyId}` }, (payload: any) => {
          if (payload.new.status === "solicitada" && driverRef.current?.status === "active") {
            setAvailableRides((prev) => {
              if (prev.find(r => r.id === payload.new.id)) return prev;
              return [payload.new, ...prev].slice(0, 10);
            });
          }
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${driverRef.current?.id}` }, (payload: any) => {
          const updated = payload.new;
          if (["aceita", "chegando", "embarque", "em_andamento"].includes(updated.status)) {
            setActiveRide(updated);
            setView("in_ride");
          }
          if (updated.status === "finalizada") {
            setActiveRide(updated);
            setView("finished");
          }
        })
        // Also listen for status changes on available rides (someone else accepted)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `company_id=eq.${companyId}` }, (payload: any) => {
          if (payload.new.status !== "solicitada") {
            // Remove from available list
            setAvailableRides((prev) => prev.filter(r => r.id !== payload.new.id));
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
    init();
  }, [router]);

  async function loadPassenger(passengerId: string) {
    try {
      const p = await supaQuery(`users?select=name,phone&id=eq.${passengerId}`);
      setPassenger(p?.[0] || null);
    } catch {}
  }

  async function toggleOnline() {
    if (!driver) return;
    const newStatus = view === "offline" ? "active" : "offline";
    try {
      await supaUpdate("drivers", `id=eq.${driver.id}`, { status: newStatus });
      setDriver({ ...driver, status: newStatus });
      driverRef.current = { ...driverRef.current, status: newStatus };
      setView(newStatus === "active" ? "available" : "offline");

      // If going online, fetch current available rides
      if (newStatus === "active") {
        const rides = await supaQuery(`rides?select=*&company_id=eq.${companyIdRef.current}&status=eq.solicitada&order=created_at.desc&limit=10`);
        setAvailableRides(rides || []);
      } else {
        setAvailableRides([]);
      }
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function acceptRide(rideId: string) {
    try {
      const data = await callFunction("accept-ride", { ride_id: rideId });
      setActiveRide(data.ride);
      // Usa passageiro retornado pela edge function (evita query extra)
      if (data.passenger) setPassenger(data.passenger);
      else await loadPassenger(data.ride.passenger_id);
      setAvailableRides([]);
      setView("in_ride");
    } catch (err) {
      // "Corrida já aceita" — remove from list
      setAvailableRides((prev) => prev.filter(r => r.id !== rideId));
      alert((err as Error).message || "Corrida não disponível");
    }
  }

  async function updateRideStatus(newStatus: string) {
    if (!activeRide) return;
    try {
      await supaUpdate("rides", `id=eq.${activeRide.id}`, { status: newStatus });
      const updated = { ...activeRide, status: newStatus };
      setActiveRide(updated);
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function cancelRide() {
    if (!activeRide) return;
    if (!confirm("Tem certeza que deseja cancelar esta corrida?")) return;
    try {
      await supaUpdate("rides", `id=eq.${activeRide.id}`, { status: "cancelada", driver_id: null });
      setActiveRide(null);
      setPassenger(null);
      setView(driverRef.current?.status === "active" ? "available" : "offline");
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function finishRide() {
    if (!activeRide) return;
    try {
      const totalExtras = Number(extras.toll) + Number(extras.wait) + Number(extras.stop) + Number(extras.other);
      const baseFare = Number(activeRide.fare) || 0;
      const finalFare = baseFare + totalExtras;

      const data = await callFunction("finish-ride-payment", {
        ride_id: activeRide.id,
        actual_distance_m: activeRide.estimated_distance_m,
        actual_duration_s: activeRide.estimated_duration_s,
        tip_amount: 0,
        wait_minutes: 0,
        extras: { ...extras, total: totalExtras },
      });

      const total = data.fare_breakdown?.total || finalFare;
      alert(`✓ Corrida finalizada!\n\nBase: R$ ${baseFare.toFixed(2)}\nExtras: R$ ${totalExtras.toFixed(2)}\nTotal: R$ ${Number(total).toFixed(2)}`);

      setActiveRide(null);
      setPassenger(null);
      setExtras({ toll: 0, wait: 0, stop: 0, other: 0 });
      setShowExtras(false);
      setView(driverRef.current?.status === "active" ? "available" : "offline");
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  function openInWaze() {
    if (!activeRide) return;
    const lat = typeof activeRide.destination === "string"
      ? activeRide.destination.match(/-?\d+\.?\d*/g)?.[1] || -23.5505
      : -23.5505;
    const lng = typeof activeRide.destination === "string"
      ? activeRide.destination.match(/-?\d+\.?\d*/g)?.[0] || -46.6333
      : -46.6333;
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, "_blank");
  }

  function openInGoogleMaps() {
    if (!activeRide) return;
    const dest = encodeURIComponent(activeRide.destination_address || "");
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank");
  }

  function callPassenger() {
    if (passenger?.phone) window.open(`tel:${passenger.phone}`);
  }

  async function handleSignOut() {
    if (driver) { try { await supaUpdate("drivers", `id=eq.${driver.id}`, { status: "offline" }); } catch {} }
    signOut();
  }

  // ─── LOADING ─────────────────────────────────────────
  if (view === "loading") return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  // ─── OFFLINE ─────────────────────────────────────────
  if (view === "offline") {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 bg-slate-900/50">
          <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-600" />
              <span className="text-sm font-medium">Offline</span>
            </div>
            <button onClick={handleSignOut} className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-8">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
            <div className="text-3xl mb-4">🔴</div>
            <div className="text-xl font-bold mb-2">Você está offline</div>
            <p className="text-sm text-slate-400 mb-6">Fique online para receber oportunidades de corrida</p>
            <button onClick={toggleOnline} className="w-full py-3 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600">Entrar Online</button>
          </div>
        </main>
      </div>
    );
  }

  // ─── AVAILABLE (painel de oportunidades) ─────────────
  if (view === "available") {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 bg-slate-900/50 sticky top-0 z-20">
          <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium">Online</span>
            </div>
            <button onClick={toggleOnline} className="text-xs text-red-400 hover:text-red-300">Sair</button>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-4 space-y-3">
          <div className="text-sm text-slate-400">Oportunidades disponíveis ({availableRides.length})</div>
          {availableRides.length === 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center text-slate-500">
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-sm">Aguardando novas corridas...</p>
            </div>
          )}
          {availableRides.map((ride) => (
            <div key={ride.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              {/* Valor + Categoria */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-2xl font-bold text-cyan-400">R$ {Number(ride.fare).toFixed(2)}</div>
                <span className="text-xs bg-slate-800 px-2 py-1 rounded">{ride.payment_method === "cash" ? "💵 Dinheiro" : ride.payment_method === "pix" ? "📱 PIX" : ride.payment_method === "credit_card" ? "💳 Cartão" : "🏪 Maquininha"}</span>
              </div>

              {/* Origem */}
              <div className="flex items-start gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-slate-500">Origem</div>
                  <div className="text-sm">{ride.origin_address}</div>
                </div>
              </div>

              {/* Destino */}
              <div className="flex items-start gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-slate-500">Destino</div>
                  <div className="text-sm">{ride.destination_address}</div>
                </div>
              </div>

              {/* Horário */}
              <div className="text-xs text-slate-500 mb-3">
                {new Date(ride.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>

              {/* Aceitar */}
              <button onClick={() => acceptRide(ride.id)} className="w-full py-3 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Aceitar Corrida
              </button>
            </div>
          ))}
        </main>
      </div>
    );
  }

  // ─── IN RIDE ─────────────────────────────────────────
  if (view === "in_ride" && activeRide) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 bg-slate-900/50">
          <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-sm font-medium">Em Corrida</span>
            </div>
            <span className="text-xs text-slate-500">{activeRide.status}</span>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-4 space-y-4">
          {/* Valor */}
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-center">
            <div className="text-xs text-cyan-300 mb-1">Valor da corrida</div>
            <div className="text-3xl font-bold text-cyan-400">R$ {Number(activeRide.fare).toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">Valor fixo — não muda</div>
          </div>

          {/* Passageiro */}
          {passenger && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="text-xs text-slate-400 mb-2">Passageiro</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{passenger.name || "—"}</div>
                  <div className="text-sm text-slate-400">{passenger.phone || "—"}</div>
                </div>
                {passenger.phone && (
                  <button onClick={callPassenger} className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-600">
                    <Phone className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Endereços */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
              <div><div className="text-xs text-slate-400">Origem</div><div className="text-sm">{activeRide.origin_address}</div></div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400 mt-1 flex-shrink-0" />
              <div><div className="text-xs text-slate-400">Destino</div><div className="text-sm">{activeRide.destination_address}</div></div>
            </div>
          </div>

          {/* Navegação */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={openInGoogleMaps} className="py-3 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" /> Google Maps
            </button>
            <button onClick={openInWaze} className="py-3 rounded-md bg-cyan-600 text-white font-semibold hover:bg-cyan-700 flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" /> Waze
            </button>
          </div>

          {/* Status buttons */}
          <div className="space-y-2">
            {activeRide.status === "aceita" && (
              <>
                <button onClick={() => updateRideStatus("chegando")} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">
                  Cheguei no local de embarque
                </button>
                <button onClick={() => cancelRide()} className="w-full py-2 rounded-md border border-red-800 text-red-400 text-sm hover:bg-red-900/20">
                  Cancelar Corrida
                </button>
              </>
            )}
            {activeRide.status === "chegando" && (
              <button onClick={() => updateRideStatus("em_andamento")} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">
                Passageiro embarcou — Iniciar corrida
              </button>
            )}
            {activeRide.status === "em_andamento" && (
              <button onClick={() => { setShowExtras(true); }} className="w-full py-3 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
                Finalizar Corrida
              </button>
            )}
          </div>

          {/* Extras panel */}
          {showExtras && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
              <div className="font-semibold">Adicionar taxas extras (opcional)</div>

              <div>
                <label className="text-xs text-slate-400">Pedágio (R$)</label>
                <input type="number" step="0.01" value={extras.toll || ""} onChange={(e) => setExtras({ ...extras, toll: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Espera (R$)</label>
                <input type="number" step="0.01" value={extras.wait || ""} onChange={(e) => setExtras({ ...extras, wait: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Parada adicional (R$)</label>
                <input type="number" step="0.01" value={extras.stop || ""} onChange={(e) => setExtras({ ...extras, stop: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Outro (R$)</label>
                <input type="number" step="0.01" value={extras.other || ""} onChange={(e) => setExtras({ ...extras, other: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white" placeholder="0.00" />
              </div>

              {/* Total */}
              <div className="border-t border-slate-700 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Valor base</span>
                  <span>R$ {Number(activeRide.fare || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Extras</span>
                  <span>R$ {(Number(extras.toll) + Number(extras.wait) + Number(extras.stop) + Number(extras.other)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg mt-2 text-cyan-400">
                  <span>Total</span>
                  <span>R$ {(Number(activeRide.fare || 0) + Number(extras.toll) + Number(extras.wait) + Number(extras.stop) + Number(extras.other)).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowExtras(false)} className="flex-1 py-2.5 rounded-md border border-slate-700 text-slate-300">Cancelar</button>
                <button onClick={finishRide} className="flex-1 py-2.5 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600">Confirmar Finalização</button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
}
