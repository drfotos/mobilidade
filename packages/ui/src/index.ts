import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string { return twMerge(clsx(inputs)); }

export const themeTokens = {
  primary: 'var(--tenant-primary, #06B6D4)',
  secondary: 'var(--tenant-secondary, #8B5CF6)',
  background: 'var(--tenant-bg, #FFFFFF)',
  foreground: 'var(--tenant-fg, #0F172A)',
} as const;

export const statusColors = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
  offline: 'bg-slate-100 text-slate-700',
  online: 'bg-emerald-100 text-emerald-700',
} as const;

export const rideStatusColors = {
  solicitada: 'bg-amber-100 text-amber-700', buscando: 'bg-amber-100 text-amber-700',
  aceita: 'bg-cyan-100 text-cyan-700', chegando: 'bg-cyan-100 text-cyan-700',
  embarque: 'bg-cyan-100 text-cyan-700', em_andamento: 'bg-cyan-100 text-cyan-700',
  finalizada: 'bg-emerald-100 text-emerald-700', pagamento: 'bg-violet-100 text-violet-700',
  avaliada: 'bg-emerald-100 text-emerald-700', cancelada: 'bg-red-100 text-red-700',
  expirada: 'bg-slate-100 text-slate-500',
} as const;

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return '—';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const r = min % 60;
  return `${h}h ${r}min`;
}

export function getStatusBadgeClass(status: string): string {
  return statusColors[status as keyof typeof statusColors] || 'bg-slate-100 text-slate-700';
}

export function getRideStatusBadgeClass(status: string): string {
  return rideStatusColors[status as keyof typeof rideStatusColors] || 'bg-slate-100 text-slate-700';
}

export const RIDE_STATUS_LABELS: Record<string, string> = {
  solicitada: 'Solicitada', buscando: 'Buscando motorista', aceita: 'Aceita',
  chegando: 'Motorista a caminho', embarque: 'No embarque', em_andamento: 'Em andamento',
  finalizada: 'Finalizada', pagamento: 'Processando pagamento', avaliada: 'Avaliada',
  cancelada: 'Cancelada', expirada: 'Expirada',
};
