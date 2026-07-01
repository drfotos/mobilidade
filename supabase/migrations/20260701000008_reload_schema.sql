-- Migration 008: Force PostgREST schema cache reload
COMMENT ON TABLE public.companies IS 'MobilerPremium companies';
NOTIFY pgrst, 'reload schema';
