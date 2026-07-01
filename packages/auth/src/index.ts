import { Session } from '@supabase/supabase-js';

export type UserRole = 'super_admin' | 'company_admin' | 'operator' | 'dispatcher' | 'support' | 'driver' | 'passenger';

export function extractTenantFromSession(session: Session | null): { companyId: string | null; role: UserRole | null } {
  if (!session) return { companyId: null, role: null };
  const meta = session.user?.app_metadata || {};
  return { companyId: meta.company_id || null, role: (meta.role as UserRole) || null };
}

export function hasRole(session: Session | null, allowedRoles: UserRole[]): boolean {
  const { role } = extractTenantFromSession(session);
  if (!role) return false;
  return allowedRoles.includes(role);
}

export const ADMIN_ROLES: UserRole[] = ['super_admin', 'company_admin', 'operator', 'dispatcher', 'support'];
export const DRIVER_ROLES: UserRole[] = ['driver'];

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isStrongPassword(password: string): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/.test(password);
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/.test(slug);
}
