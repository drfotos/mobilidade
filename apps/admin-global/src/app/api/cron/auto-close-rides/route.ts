// Vercel Cron: chama auto-close-rides a cada 30 minutos
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = "https://vlkrlpcniippudhgggwt.supabase.co/functions/v1/auto-close-rides";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey || "",
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    return NextResponse.json({ success: true, result: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
