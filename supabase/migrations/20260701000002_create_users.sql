-- Migration 002: Users
create table users (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id) on delete set null,
  auth_user_id  uuid unique not null,
  email         text unique,
  phone         text unique,
  name          text,
  avatar_url    text,
  role          user_role not null default 'passenger',
  status        text not null default 'active' check (status in ('active','suspended','deleted')),
  created_at    timestamptz not null default now()
);
create index idx_users_company on users(company_id);
create index idx_users_auth on users(auth_user_id);
create index idx_users_role on users(role);

create or replace function public.handle_new_auth_user() returns trigger as $$
declare
  v_company_id uuid;
  v_role user_role := 'passenger';
  v_super_admin_email text := current_setting('app.super_admin_email', true);
begin
  if v_super_admin_email is not null and lower(new.email) = lower(v_super_admin_email) then
    v_role := 'super_admin';
  elsif new.raw_user_meta_data ->> 'company_id' is not null then
    v_company_id := (new.raw_user_meta_data ->> 'company_id')::uuid;
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'company_admin');
  end if;

  insert into public.users (auth_user_id, email, phone, name, role, company_id)
  values (new.id, new.email, new.raw_user_meta_data ->> 'phone', new.raw_user_meta_data ->> 'name', v_role, v_company_id);

  new.app_metadata = jsonb_set(coalesce(new.app_metadata, '{}'::jsonb), '{company_id}',
    case when v_company_id is not null then to_jsonb(v_company_id) else 'null'::jsonb end);
  new.app_metadata = jsonb_set(new.app_metadata, '{role}', to_jsonb(v_role::text));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

alter table users enable row level security;
create policy users_select_tenant on users for select using (
  role = 'super_admin'::user_role or company_id = public.company_id() or auth_user_id = auth.uid()
);
create policy users_insert_tenant on users for insert with check (
  company_id = public.company_id() or auth.uid() is null
);
create policy users_update_tenant on users for update using (
  role = 'super_admin'::user_role or company_id = public.company_id() or auth_user_id = auth.uid()
);
create policy users_delete_tenant on users for delete using (
  role = 'super_admin'::user_role or company_id = public.company_id()
);
