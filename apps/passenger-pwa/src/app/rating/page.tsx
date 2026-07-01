"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Star, Loader2, Check } from "lucide-react";

export default function RatePage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><RateInner /></Suspense>;
}

function RateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get("ride_id");
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (stars === 0) return;
    setSubmitting(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/auth/login");
      const res = await fetch(`${url}/functions/v1/rate-ride`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: key },
        body: JSON.stringify({ ride_id: rideId, stars }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      setTimeout(() => router.push("/app"), 2000);
    } catch (err) {
      alert("Erro: " + (err as Error).message);
    } finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8" /></div>
          <h1 className="text-xl font-bold mb-2">Obrigado pela avaliação!</h1>
          <p className="text-sm text-slate-400">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Avalie sua corrida</h1>
          <p className="text-sm text-slate-400 mb-8">Sua avaliação é anônima e ajuda a melhorar o serviço.</p>

          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setStars(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} className="p-2">
                <Star className={`w-12 h-12 transition-colors ${(hover || stars) >= s ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
              </button>
            ))}
          </div>

          <div className="text-sm text-slate-400 mb-8">
            {stars === 0 && "Selecione de 1 a 5 estrelas"}
            {stars === 1 && "😡 Muito ruim"}
            {stars === 2 && "😐 Ruim"}
            {stars === 3 && "🙂 Regular"}
            {stars === 4 && "😀 Bom"}
            {stars === 5 && "🤩 Excelente!"}
          </div>

          <button onClick={submit} disabled={stars === 0 || submitting} className="w-full h-12 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Enviar avaliação
          </button>
        </div>
      </main>
    </div>
  );
}
