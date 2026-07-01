-- Migration 001: Companies (raiz do multi-tenancy)
create type user_role as enum ('super_admin','company_admin','operator','dispatcher','support','driver','passenger');
create type driver_status as enum ('pending','active','offline','suspended','deleted');
create type ride_status as enum ('solicitada','buscando','aceita','chegando','embarque','em_andamento','finalizada','pagamento','avaliada','cancelada','expirada');

create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  plan        text not null default 'free' check (plan in ('free','starter','pro','enterprise')),
  status      text not null default 'active' check (status in ('active','suspended','archived','deleted')),
  theme       jsonb not null default '{}'::jsonb,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_companies_slug on companies(slug);
create index idx_companies_status on companies(status);

create or replace function update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

create trigger trg_companies_updated before update on companies for each row execute function update_updated_at();

create or replace function public.company_id() returns uuid as $$
  select (auth.jwt() ->> 'company_id')::uuid;
$$ language sql stable;
