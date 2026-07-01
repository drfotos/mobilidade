"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Loader2, LogOut, MapPin, Navigation, Check, X, AlertTriangle } from "lucide-react";
import { enableDriverPwaFeatures, isIOS } from "@saas/pwa-helpers";

export default function DriverApp() {
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [online, setOnline] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [zoneStatus, setZoneStatus] = useState<{ inZone: boolean; message: string | null }>({ inZone: false, message: null });
  const [pwaFeaturesActive, setPwaFeaturesActive] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const supabaseRef = useRef<any>(null);
  const cleanupPwaRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    async function init() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      supabaseRef.current = supabase;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      if (!session) return router.push("/auth/login");
      const role = session.user.app_metadata?.role;
      const companyId = session.user.app_metadata?.company_id;
      if (role !== "driver" || !companyId) { await supabase.auth.signOut(); return router.push("/auth/login"); }

      const { data: u } = await supabase.from("users").select("id, drivers!inner(id, status, cnh_category, total_rides, rating)").eq("auth_user_id", session.user.id).maybeSingle();
      if (!u?.drivers?.[0]) { alert("Perfil de motorista não encontrado. Contate sua empresa."); return; }
      const drv = u.drivers[0];
      if (drv.status === "pending") { alert("Cadastro pendente. Aguarde aprovação."); return router.push("/auth/login"); }
      if (drv.status === "suspended") { alert("Cadastro suspenso."); return router.push("/auth/login"); }
      setDriver(drv);
      setLoading(false);

      const channel = supabase.channel("rides-available")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "rides", filter: `company_id=eq.${companyId}` }, (payload: any) => {
          if (payload.new.status === "solicitada") setAvailableRides((prev) => [payload.new, ...prev].slice(0, 5));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${drv.id}` }, (payload: any) => setActiveRide(payload.new))
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
    init();
  }, [router]);

  useEffect(() => {
    if (!online || !driver) return;
    if (!navigator.geolocation) { alert("GPS não suportado"); setOnline(false); return; }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setPosition(newPos); sendPosition(newPos); },
      (err) => { console.error("Geolocation error:", err); alert("Erro GPS. Verifique permissões."); setOnline(false); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [online, driver]);

  async function sendPosition(pos: { lat: number; lng: number }) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session) return;
      await fetch(`${url}/functions/v1/update-driver-position`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: key },
        body: JSON.stringify(pos),
      });
    } catch (err) { console.error("sendPosition error:", err); }
  }

  async function checkZoneStatus(lat: number, lng: number): Promise<{ inZone: boolean; message: string | null }> {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session) return { inZone: false, message: "Sessão inválida" };
      const res = await fetch(`${url}/functions/v1/check-zone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: key },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) return { inZone: false, message: data.error };
      return { inZone: data.in_zone === true, message: data.message };
    } catch (err) {
      console.error("checkZone error:", err);
      return { inZone: false, message: "Erro ao verificar zona" };
    }
  }

  async function toggleOnline() {
    if (!driver) return;

    // Se vai ficar online, valida zona primeiro
    if (!online) {
      if (!position) {
        alert("Aguardando GPS... tente novamente em alguns segundos.");
        return;
      }
      const zone = await checkZoneStatus(position.lat, position.lng);
      setZoneStatus(zone);
      if (!zone.inZone) {
        alert(`🚫 ${zone.message || "Zona não habilitada — você está fora da área de operação"}`);
        return;
      }

      // Ativa PWA features (Wake Lock + audio silencioso + storage)
      try {
        cleanupPwaRef.current = await enableDriverPwaFeatures();
        setPwaFeaturesActive(true);
        if (isIOS()) {
          console.log("[driver] iOS detectado — Wake Lock + áudio silencioso ativos");
        }
      } catch (err) {
        console.warn("[driver] PWA features falharam (não crítico):", err);
      }
    } else {
      // Ficando offline — libera recursos PWA
      if (cleanupPwaRef.current) {
        cleanupPwaRef.current();
        cleanupPwaRef.current = null;
        setPwaFeaturesActive(false);
      }
    }

    const newStatus = online ? "offline" : "active";
    const { error } = await supabaseRef.current.from("drivers").update({ status: newStatus }).eq("id", driver.id);
    if (error) { alert("Erro: " + error.message); return; }
    setOnline(!online);
  }

  async function acceptRide(rideId: string) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      const res = await fetch(`${url}/functions/v1/accept-ride`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({ ride_id: rideId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveRide(data.ride);
      setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
    } catch (err) { alert("Erro ao aceitar: " + (err as Error).message); }
  }

  async function advanceRide(rideId: string, newStatus: string) {
    const { error } = await supabaseRef.current.from("rides").update({ status: newStatus }).eq("id", rideId);
    if (error) return alert("Erro: " + error.message);
    const { data } = await supabaseRef.current.from("rides").select("*").eq("id", rideId).maybeSingle();
    setActiveRide(data);
  }

  async function finishRide(rideId: string) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      // Usa nova edge function com precificação completa (bandeirada + km + min + paradas + gorjeta)
      const res = await fetch(`${url}/functions/v1/finish-ride-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({
          ride_id: rideId,
          actual_distance_m: activeRide?.estimated_distance_m,
          actual_duration_s: activeRide?.estimated_duration_s,
          tip_amount: 0, // gorjeta é adicionada pelo passageiro depois
          wait_minutes: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const fare = data.fare_breakdown?.total || data.fare || 0;
      alert(`✓ Corrida finalizada!\n\nValor: R$ ${Number(fare).toFixed(2)}\n\nPassageiro será redirecionado para avaliação.`);
      setActiveRide(null);
    } catch (err) { alert("Erro ao finalizar: " + (err as Error).message); }
  }

  async function signOut() {
    if (online) await toggleOnline();
    await supabaseRef.current.auth.signOut();
    router.push("/auth/login");
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
          <button onClick={signOut} className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {!activeRide && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 text-center">
            <div className="text-sm text-slate-400 mb-2">Status atual</div>
            <div className="text-2xl font-bold mb-4">{online ? "🟢 Online" : "🔴 Offline"}</div>
            <button onClick={toggleOnline} className={`w-full py-3 rounded-md font-semibold ${online ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>{online ? "Ficar offline" : "Ficar online"}</button>
            {online && position && <div className="mt-4 text-xs text-slate-500 flex items-center justify-center gap-2"><MapPin className="w-3 h-3" />{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</div>}
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
