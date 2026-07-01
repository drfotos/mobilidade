-- Migration 005: Audit log + Geofences
create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  actor_user_id uuid,
  actor_type    text not null,
  action        text not null,
  entity        text not null,
  entity_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index idx_audit_company_created on audit_log(company_id, created_at desc);
create index idx_audit_entity on audit_log(entity, entity_id);
alter table audit_log enable row level security;
create policy audit_select_tenant on audit_log for select using (
  company_id = auth.company_id() or exists (select 1 from users u where u.auth_user_id = auth.uid() and u.role = 'super_admin'::user_role)
);
create policy audit_insert_tenant on audit_log for insert with check (true);

create or replace function audit_capture(p_action text, p_entity text) returns trigger as $$
declare v_company_id uuid; v_actor uuid;
begin
  v_actor := auth.uid();
  begin
    execute format('select $1.company_id') using new into v_company_id;
  exception when others then
    begin execute format('select $1.company_id') using old into v_company_id;
    exception when others then v_company_id := null; end;
  end;
  insert into audit_log (company_id, actor_user_id, actor_type, action, entity, entity_id, old_value, new_value)
  values (v_company_id, v_actor, case when v_actor is null then 'system' else 'user' end, p_action, p_entity,
    coalesce(new.id, old.id), case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end, case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace function audit_table(p_table text) returns void as $$
begin
  execute format($f$
    create trigger trg_audit_%1$s_insert after insert on %1$s for each row execute function audit_capture('INSERT', '%1$s');
    create trigger trg_audit_%1$s_update after update on %1$s for each row execute function audit_capture('UPDATE', '%1$s');
    create trigger trg_audit_%1$s_delete after delete on %1$s for each row execute function audit_capture('DELETE', '%1$s');
  $f$, p_table);
end;
$$ language plpgsql;

select audit_table('companies');
select audit_table('users');
select audit_table('drivers');
select audit_table('rides');
select audit_table('payments');
select audit_table('categories');

create table geofences (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  name              text not null,
  type              text not null check (type in ('operational','pricing')),
  polygon           geography(polygon, 4326) not null,
  price_multiplier  numeric(3,2) not null default 1.0,
  fee_fixed         numeric(8,2) not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index idx_geofences_company on geofences(company_id) where active = true;
create index idx_geofences_polygon on geofences using gist (polygon);
alter table geofences enable row level security;
create policy geofences_tenant on geofences for all using (company_id = auth.company_id()) with check (company_id = auth.company_id());
