declare global { interface Window { OneSignal?: any } }

let oneSignalInitialized = false;

export function initOneSignal(userId: string): void {
  if (typeof window === 'undefined' || oneSignalInitialized) return;
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) { console.warn('[notifications] NEXT_PUBLIC_ONESIGNAL_APP_ID ausente'); return; }
  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  script.defer = true;
  document.body.appendChild(script);
  script.onload = () => {
    window.OneSignal = window.OneSignal || [];
    window.OneSignal.push(() => {
      window.OneSignal.init({ appId, allowLocalhostAsSecureOrigin: true });
      window.OneSignal.setExternalUserId(userId);
    });
    oneSignalInitialized = true;
  };
}

export async function sendPushNotification(opts: { externalIds: string[]; title: string; message: string; data?: Record<string, unknown>; url?: string }): Promise<{ success: boolean; recipients: number }> {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) { console.warn('[notifications] OneSignal não configurado'); return { success: false, recipients: 0 }; }
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${apiKey}` },
    body: JSON.stringify({
      app_id: appId, include_external_user_ids: opts.externalIds,
      headings: { en: opts.title, pt: opts.title }, contents: { en: opts.message, pt: opts.message },
      data: opts.data || {}, url: opts.url,
    }),
  });
  if (!res.ok) { console.error('[notifications] OneSignal error:', await res.text()); return { success: false, recipients: 0 }; }
  const data = await res.json();
  return { success: true, recipients: data.recipients || 0 };
}

export async function sendEmail(opts: { to: string | string[]; subject: string; html: string; from?: string }): Promise<{ success: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[notifications] RESEND_API_KEY ausente'); return { success: false }; }
  const from = opts.from || process.env.EMAIL_FROM || 'no-reply@resend.dev';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) { console.error('[notifications] Resend error:', await res.text()); return { success: false }; }
  const data = await res.json();
  return { success: true, id: data.id };
}

export function welcomeEmailTemplate(opts: { appName: string; userName: string; loginUrl: string }): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px"><h1 style="color:#0f172a">Bem-vindo ao ${opts.appName}!</h1><p>Olá, ${opts.userName}.</p><p>Sua conta foi criada com sucesso.</p><a href="${opts.loginUrl}" style="display:inline-block;padding:12px 24px;background:#06B6D4;color:white;text-decoration:none;border-radius:6px;margin:16px 0">Acessar painel</a></div>`;
}

export function rideReceiptEmailTemplate(opts: { appName: string; passengerName: string; rideId: string; origin: string; destination: string; fare: number; driverName: string; date: string }): string {
  const fareFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opts.fare);
  return `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px"><h1 style="color:#0f172a">Recibo da sua corrida</h1><p>Obrigado por usar o ${opts.appName}!</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Data</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${opts.date}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Origem</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${opts.origin}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Destino</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${opts.destination}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Motorista</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${opts.driverName}</td></tr><tr><td style="padding:8px;color:#64748b;font-weight:600">Total</td><td style="padding:8px;font-weight:700;color:#0f172a">${fareFormatted}</td></tr></table><p style="color:#64748b;font-size:12px">Corrida #${opts.rideId}</p></div>`;
}
