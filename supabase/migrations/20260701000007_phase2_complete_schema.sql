-- Migration 007: Schema completo Fase 2
-- Zones, Coupons, Chat, Tickets, Ratings, Tips, Scheduled Rides, Plans, Maps Config, Client Data

-- ─── 1. Companies: dados completos do cliente ───────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_cpf text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_rg text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_city text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_state text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_phone text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#06B6D4';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#8B5CF6';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'active';
ALTER TABLE companies ADD CONSTRAINT companies_payment_status_check CHECK (payment_status IN ('active', 'suspended', 'canceled'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS maps_config jsonb DEFAULT '{"provider":"osm"}'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mercadopago_config jsonb DEFAULT '{}'::jsonb;

-- Migra theme.primary → primary_color (se já existir dados)
UPDATE companies SET primary_color = COALESCE(theme->>'primary', primary_color) WHERE theme->>'primary' IS NOT NULL;
UPDATE companies SET secondary_color = COALESCE(theme->>'secondary', secondary_color) WHERE theme->>'secondary' IS NOT NULL;
UPDATE companies SET logo_url = COALESCE(theme->>'logo_url', logo_url) WHERE theme->>'logo_url' IS NOT NULL;

-- ─── 2. Zones (substitui "1 cidade" — cliente desenha no mapa) ──────────
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  polygon geography(Polygon, 4326) NOT NULL,
  city text,
  state text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zones_company ON zones(company_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_zones_polygon ON zones USING gist (polygon);
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zones_tenant ON zones;
CREATE POLICY zones_tenant ON zones FOR ALL USING (company_id = public.company_id()) WITH CHECK (company_id = public.company_id());

-- ─── 3. Coupons ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(10,2) NOT NULL,
  max_uses integer,
  used_count integer DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, code)
);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coupons_tenant ON coupons;
CREATE POLICY coupons_tenant ON coupons FOR ALL USING (company_id = public.company_id()) WITH CHECK (company_id = public.company_id());

-- ─── 4. Chat messages (texto apenas, encerra ao finalizar corrida) ──────
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('passenger', 'driver')),
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_ride ON chat_messages(ride_id, created_at);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_tenant ON chat_messages;
CREATE POLICY chat_tenant ON chat_messages FOR ALL USING (company_id = public.company_id()) WITH CHECK (company_id = public.company_id());

-- ─── 5. Tickets (chamados em 3 níveis) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE, -- NULL para client_to_superadmin
  ticket_type text NOT NULL CHECK (ticket_type IN ('client_to_superadmin', 'driver_to_client', 'passenger_to_client')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  opened_by uuid NOT NULL,
  opened_by_role text NOT NULL,
  assigned_to uuid,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(ticket_type, status);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tickets_select ON tickets;
CREATE POLICY tickets_select ON tickets FOR SELECT USING (
  company_id = public.company_id()
  OR (ticket_type = 'client_to_superadmin' AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'super_admin'::user_role))
  OR opened_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS tickets_insert ON tickets;
CREATE POLICY tickets_insert ON tickets FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS tickets_update ON tickets;
CREATE POLICY tickets_update ON tickets FOR UPDATE USING (
  company_id = public.company_id()
  OR (ticket_type = 'client_to_superadmin' AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'super_admin'::user_role))
);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_messages_select ON ticket_messages;
CREATE POLICY ticket_messages_select ON ticket_messages FOR SELECT USING (
  ticket_id IN (SELECT id FROM tickets WHERE company_id = public.company_id())
  OR ticket_id IN (SELECT id FROM tickets WHERE ticket_type = 'client_to_superadmin' AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'super_admin'::user_role))
);
DROP POLICY IF EXISTS ticket_messages_insert ON ticket_messages;
CREATE POLICY ticket_messages_insert ON ticket_messages FOR INSERT WITH CHECK (true);

-- Trigger update updated_at
CREATE OR REPLACE FUNCTION update_ticket_updated() RETURNS trigger AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_tickets_updated ON tickets;
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_ticket_updated();

-- ─── 6. Ratings (1-5 estrelas, sem comentários) ─────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rater_type text NOT NULL CHECK (rater_type IN ('passenger', 'driver')),
  rater_id uuid NOT NULL,
  rated_type text NOT NULL CHECK (rated_type IN ('passenger', 'driver')),
  rated_id uuid NOT NULL,
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE(ride_id, rater_type)
);
CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_type, rated_id);
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ratings_tenant ON ratings;
CREATE POLICY ratings_tenant ON ratings FOR ALL USING (company_id = public.company_id()) WITH CHECK (company_id = public.company_id());

-- ─── 7. Rides: tip + final_fare + scheduled + coupon ────────────────────
ALTER TABLE rides ADD COLUMN IF NOT EXISTS tip_amount numeric(10,2) DEFAULT 0;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS final_fare numeric(10,2);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES coupons(id);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS assigned_by uuid;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_provider_config jsonb;

-- ─── 8. Categories: novos campos de pricing ─────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS base_fee numeric(8,2) DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS per_stop_fee numeric(8,2) DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tip_enabled boolean DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS km_enabled boolean DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS min_enabled boolean DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS minute_enabled boolean DEFAULT true;

-- Migra base_fare → base_fee (renomeando conceito: agora base_fee é bandeirada)
UPDATE categories SET base_fee = base_fare WHERE base_fee = 0 AND base_fare > 0;

-- ─── 9. Subscription plans ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  price_monthly numeric(10,2) NOT NULL,
  max_drivers integer,
  max_zones integer, -- NULL = unlimited
  max_rides_month integer,
  features jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

INSERT INTO subscription_plans (name, slug, price_monthly, max_drivers, max_zones, max_rides_month, features, sort_order) VALUES
('Free', 'free', 0, 5, 1, 200, '{"osm_maps": true, "mercadopago": true}'::jsonb, 1),
('Starter', 'starter', 149, 25, 3, 2000, '{"osm_maps": true, "google_maps": true, "mercadopago": true, "email_support": true}'::jsonb, 2),
('Pro', 'pro', 499, 100, NULL, 20000, '{"osm_maps": true, "google_maps": true, "mapbox": true, "mercadopago": true, "custom_domain": true, "api_access": true, "chat_support": true}'::jsonb, 3),
('Enterprise', 'enterprise', 0, NULL, NULL, NULL, '{"all_features": true, "sla": true, "dedicated_support": true}'::jsonb, 4)
ON CONFLICT (slug) DO NOTHING;

-- ─── 10. Payments: SEM split (direto pro cliente) ───────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tip_amount numeric(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS final_amount numeric(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;

-- ─── 11. Auditoria nas novas tabelas ────────────────────────────────────
SELECT public.audit_table('zones');
SELECT public.audit_table('coupons');
SELECT public.audit_table('tickets');
SELECT public.audit_table('ratings');
