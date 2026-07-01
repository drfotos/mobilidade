export type UserRole = 'super_admin' | 'company_admin' | 'operator' | 'dispatcher' | 'support' | 'driver' | 'passenger';
export type DriverStatus = 'pending' | 'active' | 'offline' | 'suspended' | 'deleted';
export type RideStatus = 'solicitada' | 'buscando' | 'aceita' | 'chegando' | 'embarque' | 'em_andamento' | 'finalizada' | 'pagamento' | 'avaliada' | 'cancelada' | 'expirada';

export interface GeolocationPoint { lat: number; lng: number; }
export interface CompanyTheme { primary?: string; secondary?: string; logo_url?: string; app_name?: string; footer_text?: string; }
export interface CompanySettings {
  maps_provider?: 'osm' | 'google' | 'mapbox' | 'here' | 'tomtom';
  payment_provider?: 'mercadopago' | 'stripe' | 'asaas';
  mercadopago_access_token?: string;
  commission_rate?: number;
  payout_cadence?: 'daily' | 'weekly' | 'minimum_balance';
}

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: { id: string; name: string; slug: string; plan: 'free' | 'starter' | 'pro' | 'enterprise'; status: 'active' | 'suspended' | 'archived' | 'deleted'; theme: CompanyTheme; settings: CompanySettings; created_at: string; updated_at: string; };
        Insert: { id?: string; name: string; slug: string; plan?: 'free' | 'starter' | 'pro' | 'enterprise'; status?: 'active' | 'suspended' | 'archived' | 'deleted'; theme?: CompanyTheme; settings?: CompanySettings; created_at?: string; updated_at?: string; };
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
      };
      users: {
        Row: { id: string; company_id: string | null; auth_user_id: string; email: string | null; phone: string | null; name: string | null; avatar_url: string | null; role: UserRole; status: string; created_at: string; };
        Insert: { id?: string; company_id?: string | null; auth_user_id: string; email?: string | null; phone?: string | null; name?: string | null; avatar_url?: string | null; role?: UserRole; status?: string; created_at?: string; };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      drivers: {
        Row: { id: string; company_id: string; user_id: string; cnh_number: string; cnh_category: string; cnh_expires_at: string; cnh_img_url: string; selfie_url: string | null; status: DriverStatus; rating: number; total_rides: number; current_position: GeolocationPoint | null; position_updated_at: string | null; created_at: string; };
        Insert: { id?: string; company_id: string; user_id: string; cnh_number: string; cnh_category: string; cnh_expires_at: string; cnh_img_url: string; selfie_url?: string | null; status?: DriverStatus; rating?: number; total_rides?: number; current_position?: GeolocationPoint | null; position_updated_at?: string | null; created_at?: string; };
        Update: Partial<Database['public']['Tables']['drivers']['Insert']>;
      };
      vehicles: {
        Row: { id: string; company_id: string; driver_id: string; plate: string; model: string; color: string; year: number; insurance_url: string; insurance_expires_at: string; created_at: string; };
        Insert: { id?: string; company_id: string; driver_id: string; plate: string; model: string; color: string; year: number; insurance_url: string; insurance_expires_at: string; created_at?: string; };
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>;
      };
      categories: {
        Row: { id: string; company_id: string; name: string; icon: string; color: string; base_fare: number; per_km: number; per_min: number; min_fare: number; wait_per_min: number; cancel_fee: number; radius_m: number; max_passengers: number; vehicle_types: string[]; active: boolean; created_at: string; };
        Insert: { id?: string; company_id: string; name: string; icon?: string; color?: string; base_fare: number; per_km: number; per_min: number; min_fare: number; wait_per_min?: number; cancel_fee?: number; radius_m?: number; max_passengers?: number; vehicle_types?: string[]; active?: boolean; created_at?: string; };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      rides: {
        Row: { id: string; company_id: string; passenger_id: string; driver_id: string | null; category_id: string; status: RideStatus; origin: GeolocationPoint; destination: GeolocationPoint; origin_address: string; destination_address: string; stops: GeolocationPoint[] | null; estimated_distance_m: number | null; estimated_duration_s: number | null; actual_distance_m: number | null; actual_duration_s: number | null; fare: number | null; original_fare: number | null; surge_mult: number; payment_method: string | null; payment_status: string; is_manual: boolean; wait_minutes: number; created_at: string; accepted_at: string | null; finished_at: string | null; };
        Insert: { id?: string; company_id: string; passenger_id: string; driver_id?: string | null; category_id: string; status?: RideStatus; origin: GeolocationPoint; destination: GeolocationPoint; origin_address: string; destination_address: string; stops?: GeolocationPoint[] | null; estimated_distance_m?: number | null; estimated_duration_s?: number | null; actual_distance_m?: number | null; actual_duration_s?: number | null; fare?: number | null; original_fare?: number | null; surge_mult?: number; payment_method?: string | null; payment_status?: string; is_manual?: boolean; wait_minutes?: number; created_at?: string; accepted_at?: string | null; finished_at?: string | null; };
        Update: Partial<Database['public']['Tables']['rides']['Insert']>;
      };
      ride_events: {
        Row: { id: string; company_id: string; ride_id: string; event_type: string; actor_type: string | null; actor_id: string | null; metadata: Record<string, unknown> | null; created_at: string; };
        Insert: { id?: string; company_id: string; ride_id: string; event_type: string; actor_type?: string | null; actor_id?: string | null; metadata?: Record<string, unknown> | null; created_at?: string; };
        Update: Partial<Database['public']['Tables']['ride_events']['Insert']>;
      };
      payments: {
        Row: { id: string; company_id: string; ride_id: string; provider: string; provider_payment_id: string | null; amount: number; commission_rate: number; commission_amount: number; driver_payout: number; status: string; webhook_id: string | null; created_at: string; paid_at: string | null; };
        Insert: { id?: string; company_id: string; ride_id: string; provider: string; provider_payment_id?: string | null; amount: number; commission_rate: number; commission_amount: number; driver_payout: number; status?: string; webhook_id?: string | null; created_at?: string; paid_at?: string | null; };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      audit_log: {
        Row: { id: string; company_id: string; actor_user_id: string | null; actor_type: string; action: string; entity: string; entity_id: string | null; old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; ip_address: string | null; user_agent: string | null; created_at: string; };
        Insert: { id?: string; company_id: string; actor_user_id?: string | null; actor_type: string; action: string; entity: string; entity_id?: string | null; old_value?: Record<string, unknown> | null; new_value?: Record<string, unknown> | null; ip_address?: string | null; user_agent?: string | null; created_at?: string; };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { user_role: UserRole; driver_status: DriverStatus; ride_status: RideStatus; };
  };
};
