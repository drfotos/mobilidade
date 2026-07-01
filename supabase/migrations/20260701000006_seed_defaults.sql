-- Migration 006: Seed defaults
do $$ begin
  perform set_config('app.super_admin_email', 'portaldrfotos@gmail.com', false);
end$$;

create or replace function create_default_categories() returns trigger as $$
begin
  insert into categories (company_id, name, icon, color, base_fare, per_km, per_min, min_fare, wait_per_min, cancel_fee, radius_m, max_passengers, vehicle_types)
  values
    (new.id, 'Moto', 'bike', '#10B981', 3.00, 1.20, 0.30, 6.00, 0.20, 4.00, 4000, 1, '{moto}'),
    (new.id, 'Carro X', 'car', '#06B6D4', 4.50, 1.80, 0.40, 8.00, 0.30, 5.00, 5000, 4, '{sedan,hatch}'),
    (new.id, 'Carro Black', 'car', '#0F172A', 8.00, 2.80, 0.70, 15.00, 0.50, 8.00, 6000, 4, '{sedan,suv}');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_companies_create_default_categories
  after insert on companies for each row execute function create_default_categories();
