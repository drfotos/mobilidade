/**
 * @saas/pwa-helpers — utilitários para PWA robusto em iOS/Android.
 *
 * 1. Screen Wake Lock — mantém tela acesa no driver-pwa (iOS suspende GPS em background)
 * 2. Silent Audio Loop — redundância iOS para evitar congelamento de JS em background
 * 3. isStandalone — detecta se PWA está instalado (standalone mode)
 * 4. requestPersistentStorage — pede armazenamento persistente para offline
 */

// ─── Screen Wake Lock API ─────────────────────────────────────────────────
let wakeLockSentinel: any = null;

export async function requestScreenWakeLock(): Promise<boolean> {
  try {
    if ("wakeLock" in navigator) {
      wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        console.log("[pwa] Screen Wake Lock liberado.");
      });
      console.log("[pwa] Screen Wake Lock ativado.");
      return true;
    }
    console.warn("[pwa] Wake Lock API não suportada neste navegador.");
    return false;
  } catch (err) {
    console.warn(`[pwa] Falha ao obter Wake Lock: ${(err as Error).name} — ${(err as Error).message}`);
    return false;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    await wakeLockSentinel.release();
    wakeLockSentinel = null;
  }
}

/** Reativa o Wake Lock automaticamente quando a página volta a ficar visível. */
export function setupWakeLockAutoRestore(): () => void {
  const handler = async () => {
    if (wakeLockSentinel !== null && document.visibilityState === "visible") {
      await requestScreenWakeLock();
    }
  };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

// ─── Silent Audio Loop (iOS background hack) ───────────────────────────────
let audioElement: HTMLAudioElement | null = null;

/**
 * Cria um loop de áudio silencioso para iOS não congelar o JS em background.
 * Usa um WAV silencioso em base64 (5 segundos, faz loop infinito).
 */
export function startSilentAudioLoop(): void {
  if (audioElement || typeof window === "undefined") return;
  // WAV silencioso de 1 segundo em base64
  const silentWav =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  audioElement = new Audio(silentWav);
  audioElement.loop = true;
  audioElement.volume = 0.01; // quase inaudível mas iOS considera "tocando"
  audioElement.play().catch((err) => {
    console.warn("[pwa] Não foi possível iniciar áudio silencioso:", err);
  });
  console.log("[pwa] Áudio silencioso iniciado (iOS background hack).");
}

export function stopSilentAudioLoop(): void {
  if (audioElement) {
    audioElement.pause();
    audioElement = null;
    console.log("[pwa] Áudio silencioso parado.");
  }
}

// ─── PWA Detection ────────────────────────────────────────────────────────
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

// ─── Persistent Storage ────────────────────────────────────────────────────
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`[pwa] Storage persistente: ${isPersisted ? "ativado" : "negado"}`);
    return isPersisted;
  }
  return false;
}

// ─── Combo: ativa tudo que motorista precisa ──────────────────────────────
/**
 * Ativa Wake Lock + Silent Audio + Storage persistente.
 * Use no driver-pwa quando o motorista fica online.
 * Retorna função de cleanup para chamar quando ficar offline.
 */
export async function enableDriverPwaFeatures(): Promise<() => void> {
  await requestScreenWakeLock();
  const cleanupWakeLock = setupWakeLockAutoRestore();
  startSilentAudioLoop();
  await requestPersistentStorage();

  return async () => {
    await releaseScreenWakeLock();
    cleanupWakeLock();
    stopSilentAudioLoop();
  };
}
