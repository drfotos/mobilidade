-- Migration 004: Rides, Ride events, Payments
create table rides (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  passenger_id    uuid not null references users(id) on delete restrict,
  driver_id       uuid references drivers(id) on delete set null,
  category_id     uuid not null references categories(id) on delete restrict,
  status          ride_status not null default 'solicitada',
  origin          geography(point, 4326) not null,
  destination     geography(point, 4326) not null,
  origin_address      text not null,
  destination_address text not null,
  stops           jsonb,
  estimated_distance_m integer,
  estimated_duration_s integer,
  actual_distance_m integer,
  actual_duration_s integer,
  fare            numeric(10,2),
  original_fare   numeric(10,2),
  surge_mult      numeric(3,2) not null default 1.0,
  payment_method  text,
  payment_status  text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','chargedback','cash_pending')),
  is_manual       boolean not null default false,
  wait_minutes    integer not null default 0,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  finished_at     timestamptz
);
create index idx_rides_company_status on rides(company_id, status) where status in ('solicitada','buscando','aceita','chegando','embarque','em_andamento');
create index idx_rides_passenger on rides(passenger_id, created_at desc);
create index idx_rides_driver on rides(driver_id, created_at desc);
create index idx_rides_company_created on rides(company_id, created_at desc);
alter table rides enable row level security;
create policy rides_tenant on rides for all using (
  company_id = auth.company_id()
  or passenger_id in (select id from users where auth_user_id = auth.uid())
  or driver_id in (select d.id from drivers d join users u on u.id = d.user_id where u.auth_user_id = auth.uid())
) with check (company_id = auth.company_id());

create table ride_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  ride_id     uuid not null references rides(id) on delete cascade,
  event_type  text not null,
  actor_type  text,
  actor_id    uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index idx_ride_events_ride on ride_events(ride_id, created_at);
create index idx_ride_events_company on ride_events(company_id, created_at desc);
alter table ride_events enable row level security;
create policy ride_events_tenant on ride_events for all using (company_id = auth.company_id()) with check (company_id = auth.company_id());

create table payments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  ride_id         uuid not null references rides(id) on delete cascade,
  provider        text not null,
  provider_payment_id text unique,
  amount          numeric(10,2) not null,
  commission_rate numeric(4,3) not null,
  commission_amount numeric(10,2) not null,
  driver_payout   numeric(10,2) not null,
  status          text not null default 'pending' check (status in ('pending','paid','failed','refunded','chargedback')),
  webhook_id      text unique,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);
create index idx_payments_company_status on payments(company_id, status);
create index idx_payments_ride on payments(ride_id);
alter table payments enable row level security;
create policy payments_tenant on payments for all using (company_id = auth.company_id()) with check (company_id = auth.company_id());
