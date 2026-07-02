"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogOut, MapPin, Navigation, Check, X } from "lucide-react";
import { enableDriverPwaFeatures } from "@saas/pwa-helpers";
import { getSession, supaQuery, supaUpdate, callFunction, signOut } from "@/lib/supa";
import { getSupabase } from "@/lib/supabase-client";

export default function DriverApp() {
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [online, setOnline] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState("aguardando");
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const cleanupPwaRef = useRef<(() => void) | null>(null);
  const driverRef = useRef<any>(null);
  const positionRef = useRef<{ lat: number; lng: number } | null>(null);
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function init() {
      const session = getSession();
      if (!session) return router.push("/auth/login");
      const role = session.user.app_metadata?.role;
      const companyId = session.user.app_metadata?.company_id;
      if (role !== "driver" || !companyId) { signOut(); return; }

      try {
        const u = await supaQuery(`users?select=id,drivers!inner(id,status,cnh_category,total_rides,rating)&auth_user_id=eq.${session.user.id}`);
        const drv = u?.[0]?.drivers?.[0];
        if (!drv) { alert("Perfil de motorista não encontrado."); return; }
        if (drv.status === "pending") { alert("Cadastro pendente."); return router.push("/auth/login"); }
        if (drv.status === "suspended") { alert("Cadastro suspenso."); return router.push("/auth/login"); }
        setDriver(drv);
        driverRef.current = drv;
        setLoading(false);
      } catch (err) {
        console.error("init:", err);
        setLoading(false);
        return;
      }

      // Start GPS IMMEDIATELY on page load
      startGPS();

      // Realtime for ride updates
      const supabase = getSupabase();
      const channel = supabase.channel("rides-available")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "rides", filter: `company_id=eq.${companyId}` }, (payload: any) => {
          if (payload.new.status === "solicitada") setAvailableRides((prev) => [payload.new, ...prev].slice(0, 5));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${driverRef.current?.id}` }, (payload: any) => setActiveRide(payload.new))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
        if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
        if (cleanupPwaRef.current) cleanupPwaRef.current();
      };
    }
    init();
  }, [router]);

  function startGPS() {
    if (!navigator.geolocation) { setGpsStatus("unsupported"); return; }
    setGpsStatus("searching");

    // First: get a single position quickly
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        positionRef.current = newPos;
        setPosition(newPos);
        setGpsStatus("ok");
      },
      (err) => {
        console.error("GPS getCurrentPosition error:", err);
        setGpsStatus("error:" + (err.message || "Permissão negada"));
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 30000 }
    );

    // Then: watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        positionRef.current = newPos;
        setPosition(newPos);
        setGpsStatus("ok");
        if (driverRef.current) sendPosition(newPos);
      },
      (err) => {
        console.error("GPS watchPosition error:", err);
        if (err.code === 1) setGpsStatus("error:Permissão de localização negada. Habilite nas configurações do navegador.");
        else if (err.code === 3) setGpsStatus("error:Timeout do GPS. Tente fora de ambientes fechados.");
        else setGpsStatus("error:" + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  }

  async function sendPosition(pos: { lat: number; lng: number }) {
    try { await callFunction("update-driver-position", pos); } catch (err) { console.error("sendPosition:", err); }
  }

  async function toggleOnline() {
    if (!driver) return;

    if (!online) {
      // Check GPS
      if (!positionRef.current) {
        // Try one more time
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            positionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setPosition(positionRef.current);
            setGpsStatus("ok");
            toggleOnline();
          },
          () => alert("⚠️ Não foi possível obter sua localização.\n\nVerifique:\n1. GPS ligado\n2. Permissão de localização concedida ao navegador\n3. Não estar em ambiente fechado"),
          { enableHighAccuracy: true, timeout: 15000 }
        );
        return;
      }

      // Check zone (but don't block if it fails)
      try {
        const zone = await callFunction("check-zone", { lat: positionRef.current.lat, lng: positionRef.current.lng });
        if (!zone.in_zone) {
          alert(`🚫 ${zone.message || "Zona não habilitada — você está fora da área de operação"}`);
          return;
        }
      } catch (err) {
        console.warn("Zone check failed, allowing:", err);
      }

      // Activate PWA features (Wake Lock etc)
      try { cleanupPwaRef.current = await enableDriverPwaFeatures(); } catch (err) { console.warn("PWA features:", err); }

      // Start sending position every 5 seconds
      sendIntervalRef.current = setInterval(() => {
        if (positionRef.current) sendPosition(positionRef.current);
      }, 5000);

      // Send immediately
      sendPosition(positionRef.current);
    } else {
      // Going offline
      if (sendIntervalRef.current) { clearInterval(sendIntervalRef.current); sendIntervalRef.current = null; }
      if (cleanupPwaRef.current) { cleanupPwaRef.current(); cleanupPwaRef.current = null; }
    }

    const newStatus = online ? "offline" : "active";
    try {
      await supaUpdate("drivers", `id=eq.${driver.id}`, { status: newStatus });
      setOnline(!online);
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function acceptRide(rideId: string) {
    try {
      const data = await callFunction("accept-ride", { ride_id: rideId });
      setActiveRide(data.ride);
      setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function advanceRide(rideId: string, newStatus: string) {
    try {
      await supaUpdate("rides", `id=eq.${rideId}`, { status: newStatus });
      const data = await supaQuery(`rides?select=*&id=eq.${rideId}`);
      setActiveRide(data?.[0] || null);
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function finishRide(rideId: string) {
    try {
      const data = await callFunction("finish-ride-payment", {
        ride_id: rideId,
        actual_distance_m: activeRide?.estimated_distance_m,
        actual_duration_s: activeRide?.estimated_duration_s,
        tip_amount: 0, wait_minutes: 0,
      });
      const fare = data.fare_breakdown?.total || data.fare || 0;
      alert(`✓ Corrida finalizada!\n\nValor: R$ ${Number(fare).toFixed(2)}`);
      setActiveRide(null);
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function handleSignOut() {
    if (online) { try { await supaUpdate("drivers", `id=eq.${driver?.id}`, { status: "offline" }); } catch {} }
    signOut();
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            <span className="text-sm font-medium">{online ? "Online" : "Offline"}</span>
          </div>
          <button onClick={handleSignOut} className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* GPS status */}
        {gpsStatus !== "ok" && (
          <div className={`rounded-md px-4 py-3 text-sm text-center ${gpsStatus === "searching" || gpsStatus === "aguardando" ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300"}`}>
            {gpsStatus === "searching" && "📍 Obtendo localização do GPS..."}
            {gpsStatus === "aguardando" && "📍 Aguardando GPS..."}
            {gpsStatus === "unsupported" && "⚠️ GPS não suportado neste dispositivo"}
            {gpsStatus?.startsWith("error") && `⚠️ ${gpsStatus.slice(6)}`}
          </div>
        )}

        {!activeRide && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 text-center">
            <div className="text-sm text-slate-400 mb-2">Status atual</div>
            <div className="text-2xl font-bold mb-4">{online ? "🟢 Online" : "🔴 Offline"}</div>
            <button onClick={toggleOnline} className={`w-full py-3 rounded-md font-semibold ${online ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>{online ? "Ficar offline" : "Ficar online"}</button>
            {position && <div className="mt-4 text-xs text-slate-500 flex items-center justify-center gap-2"><MapPin className="w-3 h-3" />{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</div>}
          </div>
        )}
        {activeRide && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6">
            <div className="text-sm text-cyan-300 mb-2">Corrida ativa</div>
            <div className="text-lg font-bold mb-4">Status: {activeRide.status}</div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5" /><div className="flex-1"><div className="text-xs text-slate-400">Origem</div><div>{activeRide.origin_address}</div></div></div>
              <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-red-400 mt-1.5" /><div className="flex-1"><div className="text-xs text-slate-400">Destino</div><div>{activeRide.destination_address}</div></div></div>
            </div>
            <div className="text-2xl font-bold text-cyan-400 mb-4">R$ {activeRide.fare ? Number(activeRide.fare).toFixed(2) : "..."}</div>
            <div className="flex flex-col gap-2">
              {activeRide.status === "aceita" && <button onClick={() => advanceRide(activeRide.id, "chegando")} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 flex items-center justify-center gap-2"><Navigation className="w-4 h-4" /> A caminho do embarque</button>}
              {activeRide.status === "chegando" && <button onClick={() => advanceRide(activeRide.id, "embarque")} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">Cheguei no local</button>}
              {activeRide.status === "embarque" && <button onClick={() => advanceRide(activeRide.id, "em_andamento")} className="w-full py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">Passageiro embarcou — iniciar</button>}
              {activeRide.status === "em_andamento" && <button onClick={() => finishRide(activeRide.id)} className="w-full py-3 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600">Finalizar corrida</button>}
            </div>
          </div>
        )}
        {!activeRide && online && (
          <div className="space-y-3">
            <div className="text-sm text-slate-400">Corridas disponíveis ({availableRides.length})</div>
            {availableRides.length === 0 && <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 text-center text-slate-500 text-sm">Aguardando corridas...</div>}
            {availableRides.map((r) => (
              <div key={r.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <div className="flex items-start justify-between mb-3"><div className="flex-1"><div className="text-xs text-slate-400">Origem</div><div className="text-sm">{r.origin_address}</div></div><div className="text-lg font-bold text-cyan-400">R$ {Number(r.fare).toFixed(2)}</div></div>
                <div className="mb-3"><div className="text-xs text-slate-400">Destino</div><div className="text-sm">{r.destination_address}</div></div>
                <div className="flex gap-2">
                  <button onClick={() => acceptRide(r.id)} className="flex-1 py-2 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Aceitar</button>
                  <button onClick={() => setAvailableRides((prev) => prev.filter((x) => x.id !== r.id))} className="px-4 py-2 rounded-md bg-slate-800 text-slate-400 hover:bg-slate-700"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!online && !activeRide && <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center text-slate-500">Fique online para começar a receber corridas.</div>}
      </main>
    </div>
  );
}
