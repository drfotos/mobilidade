-- Migration 003: Drivers, Vehicles, Categories
create table drivers (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  cnh_number      text not null,
  cnh_category    text not null,
  cnh_expires_at  date not null,
  cnh_img_url     text not null,
  selfie_url      text,
  status          driver_status not null default 'pending',
  rating          numeric(2,1) not null default 5.0,
  total_rides     integer not null default 0,
  current_position geography(point, 4326),
  position_updated_at timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_drivers_company_status on drivers(company_id, status) where status in ('active', 'offline');
create index idx_drivers_position on drivers using gist (current_position) where current_position is not null and status = 'active';
create index idx_drivers_user on drivers(user_id);
alter table drivers enable row level security;
create policy drivers_tenant on drivers for all using (
  company_id = public.company_id() or exists (select 1 from users u where u.auth_user_id = auth.uid() and u.role = 'super_admin'::user_role)
) with check (
  company_id = public.company_id() or exists (select 1 from users u where u.auth_user_id = auth.uid() and u.role = 'super_admin'::user_role)
);

create table vehicles (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  driver_id       uuid not null references drivers(id) on delete cascade,
  plate           text not null,
  model           text not null,
  color           text not null,
  year            integer not null,
  insurance_url   text not null,
  insurance_expires_at date not null,
  created_at      timestamptz not null default now()
);
create index idx_vehicles_company on vehicles(company_id);
create index idx_vehicles_driver on vehicles(driver_id);
alter table vehicles enable row level security;
create policy vehicles_tenant on vehicles for all using (company_id = public.company_id()) with check (company_id = public.company_id());

create table categories (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  icon            text not null default 'car',
  color           text not null default '#06B6D4',
  base_fare       numeric(8,2) not null,
  per_km          numeric(8,2) not null,
  per_min         numeric(8,2) not null,
  min_fare        numeric(8,2) not null,
  wait_per_min    numeric(8,2) not null default 0,
  cancel_fee      numeric(8,2) not null default 0,
  radius_m        integer not null default 5000,
  max_passengers  integer not null default 4,
  vehicle_types   text[] not null default '{sedan,hatch,suv}',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index idx_categories_company on categories(company_id) where active = true;
alter table categories enable row level security;
create policy categories_tenant on categories for all using (company_id = public.company_id()) with check (company_id = public.company_id());
