const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const STORAGE_KEY = "sb-vlkrlpcniippudhgggwt-auth-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored).access_token || null;
  } catch { return null; }
}

export function getSession(): { token: string; user: any } | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const s = JSON.parse(stored);
    return s.access_token && s.user ? { token: s.access_token, user: s.user } : null;
  } catch { return null; }
}

export async function supaQuery(path: string): Promise<any> {
  const token = getToken(); if (!token) throw new Error("No session");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Query ${res.status}: ${path}`);
  return res.json();
}

export async function supaInsert(table: string, data: any): Promise<any> {
  const token = getToken(); if (!token) throw new Error("No session");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Insert ${res.status}`);
  return res.json();
}

export async function supaUpdate(table: string, filter: string, data: any): Promise<any> {
  const token = getToken(); if (!token) throw new Error("No session");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update ${res.status}`);
  return res.json();
}

export async function supaDelete(table: string, filter: string): Promise<void> {
  const token = getToken(); if (!token) throw new Error("No session");
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
}

export async function callFunction(name: string, body: any): Promise<any> {
  const token = getToken(); if (!token) throw new Error("No session");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Function ${name} failed`);
  return data;
}

export function signOut() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/auth/login";
  }
}
