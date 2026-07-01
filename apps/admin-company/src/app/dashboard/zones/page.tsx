"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, MapPin } from "lucide-react";
import { getSession, supaQuery, supaUpdate, supaDelete, callFunction } from "@/lib/supa";

declare global { interface Window { L?: any } }

// Página usa Leaflet (window) — não pré-renderizar
export const dynamic = "force-dynamic";

export default function ZonesPage() {
  const router = useRouter();
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [polygon, setPolygon] = useState<{lat:number,lng:number}[]>([]);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  async function load() {
    const session = getSession();
    if (!session) return router.push("/auth/login");
    const companyId = session.user.app_metadata?.company_id;
    try {
      const data = await supaQuery(`zones?select=*&company_id=eq.${companyId}&order=created_at.asc`);
      setZones(data || []);
    } catch (err) {
      console.error("load zones error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [router]);

  useEffect(() => {
    if (!showForm || !mapContainerRef.current || mapInstance) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const m = L.map(mapContainerRef.current!).setView([-23.5505, -46.6333], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(m);
      const points: {lat:number,lng:number}[] = [];
      let polygonLayer: any = null;
      let polyline: any = null;
      m.on("click", (e: any) => {
        points.push({ lat: e.latlng.lat, lng: e.latlng.lng });
        if (polyline) m.removeLayer(polyline);
        if (polygonLayer) m.removeLayer(polygonLayer);
        if (points.length >= 3) {
          polygonLayer = L.polygon(points, { color: "#06B6D4", fillColor: "#06B6D4", fillOpacity: 0.2 }).addTo(m);
        } else {
          polyline = L.polyline(points, { color: "#06B6D4" }).addTo(m);
        }
        setPolygon([...points]);
      });
      setMapInstance(m);
    })();
  }, [showForm, mapInstance]);

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    if (polygon.length < 3) { alert("Desenhe pelo menos 3 pontos no mapa"); return; }
    try {
      await callFunction("create-zone", { name, polygon, city, state });
      setShowForm(false); setPolygon([]); setName(""); setCity(""); setState("");
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function deleteZone(id: string) {
    if (!confirm("Excluir zona?")) return;
    try {
      await supaDelete("zones", `id=eq.${id}`);
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await supaUpdate("zones", `id=eq.${id}`, { active: !active });
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600"><Plus className="w-4 h-4" /> Nova zona</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Zonas de operação</h1>
        <p className="text-sm text-slate-600 mb-6">Desenhe no mapa as áreas onde sua operação atende. Fora da zona, passageiros não conseguem pedir e motoristas não ficam online.</p>

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h2 className="font-semibold text-slate-900 mb-4">Desenhar nova zona</h2>
            <div ref={mapContainerRef} className="w-full h-96 rounded-md border border-slate-300 mb-4" />
            <p className="text-xs text-slate-500 mb-4">Clique no mapa para adicionar pontos (mínimo 3). A zona é o polígono fechado.</p>
            <form onSubmit={createZone} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Nome da zona</label><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Centro, Zona Sul" className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cidade</label><input value={city} onChange={(e) => setCity(e.target.value)} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label><input value={state} onChange={(e) => setState(e.target.value)} placeholder="SP" className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
              <div className="md:col-span-3 flex gap-2">
                <button type="submit" disabled={polygon.length < 3} className="px-4 py-2 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50">Criar zona ({polygon.length} pontos)</button>
                <button type="button" onClick={() => { setShowForm(false); setPolygon([]); }} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700">Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((z) => (
            <div key={z.id} className={`bg-white rounded-xl border ${z.active ? "border-slate-200" : "border-slate-200 opacity-60"} p-5`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center"><MapPin className="w-5 h-5 text-cyan-500" /></div>
                  <div><div className="font-semibold text-slate-900">{z.name}</div><div className="text-xs text-slate-500">{z.city || "—"}{z.state ? ` / ${z.state}` : ""}</div></div>
                </div>
                <button onClick={() => deleteZone(z.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              <button onClick={() => toggleActive(z.id, z.active)} className="w-full px-3 py-1.5 rounded text-xs font-medium border border-slate-300 hover:bg-slate-50">{z.active ? "Desativar" : "Ativar"}</button>
            </div>
          ))}
          {zones.length === 0 && <div className="md:col-span-3 text-center py-12 text-slate-500">Nenhuma zona. Clique em "Nova zona" para desenhar no mapa.</div>}
        </div>
      </main>
    </div>
  );
}
