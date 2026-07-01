import type { Route } from '@saas/maps';

export interface CategoryPricing {
  base_fare: number; per_km: number; per_min: number; min_fare: number;
  wait_per_min?: number; cancel_fee?: number;
}
export interface FareInputs {
  route: Route; category: CategoryPricing; surgeMultiplier?: number;
  waitMinutes?: number; stopsCount?: number; isAirport?: boolean; isNight?: boolean;
}
export interface FareResult {
  base: number; kmCost: number; minCost: number; waitCost: number;
  stopsFee: number; airportFee: number; nightFee: number; subtotal: number;
  surgeAmount: number; total: number; appliedMinimum: boolean;
}

const STOP_FEE = 2.5, AIRPORT_FEE = 5, NIGHT_MULTIPLIER = 1.1;
const RECALC_DISTANCE_THRESHOLD = 1.15, RECALC_TIME_THRESHOLD = 300;

export function calculateFare(inputs: FareInputs): FareResult {
  const { route, category, surgeMultiplier = 1, waitMinutes = 0, stopsCount = 0, isAirport = false, isNight = false } = inputs;
  const distanceKm = route.distance_m / 1000;
  const durationMin = route.duration_s / 60;
  const base = category.base_fare;
  const kmCost = category.per_km * distanceKm;
  const minCost = category.per_min * durationMin;
  const waitCost = (category.wait_per_min || 0) * Math.max(0, waitMinutes - 5);
  const stopsFee = STOP_FEE * Math.max(0, stopsCount);
  const airportFee = isAirport ? AIRPORT_FEE : 0;
  let subtotal = base + kmCost + minCost + waitCost + stopsFee + airportFee;
  const surgeAmount = subtotal * (surgeMultiplier - 1);
  subtotal += surgeAmount;
  const nightFee = isNight ? subtotal * (NIGHT_MULTIPLIER - 1) : 0;
  subtotal += nightFee;
  const appliedMinimum = subtotal < category.min_fare;
  const total = appliedMinimum ? category.min_fare : subtotal;
  return { base, kmCost, minCost, waitCost, stopsFee, airportFee, nightFee, subtotal, surgeAmount, total, appliedMinimum };
}

export function shouldRecalculate(estimatedDistance: number, estimatedDuration: number, actualDistance: number, actualDuration: number): { shouldRecalc: boolean; reason?: 'distance_exceeded' | 'time_exceeded' } {
  if (actualDistance > estimatedDistance * RECALC_DISTANCE_THRESHOLD) return { shouldRecalc: true, reason: 'distance_exceeded' };
  if (actualDuration > estimatedDuration + RECALC_TIME_THRESHOLD) return { shouldRecalc: true, reason: 'time_exceeded' };
  return { shouldRecalc: false };
}

export function calculateSurge(requestingPassengers: number, onlineDrivers: number): number {
  if (onlineDrivers === 0) return 2.0;
  const ratio = requestingPassengers / onlineDrivers;
  if (ratio > 4) return 2.0;
  if (ratio > 2.5) return 1.5;
  if (ratio > 1.5) return 1.2;
  return 1.0;
}

export function isNightTime(date: Date = new Date()): boolean {
  const h = date.getHours();
  return h >= 22 || h < 5;
}

export function formatFare(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
