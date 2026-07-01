# MobilerPremium — Plataforma White Label de Mobilidade

SaaS Multi-Tenant de Aplicativos tipo Uber — PWA primeiro, 100% gratuito no MVP.

**Repositório**: https://github.com/drfotos/mobilidade

## Status MVP (Fase 1)

✅ Monorepo pnpm + Turborepo com 5 apps + 7 packages
✅ 6 migrations SQL com RLS multi-tenant em todas as tabelas
✅ 7 Edge Functions Deno (create-company, create-ride, accept-ride, update-driver-position, finish-ride, calculate-fare, webhook-mercadopago)
✅ Landing page (porta 3000) — marketing + signup self-service
✅ Admin Global (porta 3001) — login + dashboard super admin
✅ Admin Company (porta 3002) — dashboard + motoristas + categorias + corridas + settings white-label
✅ Driver PWA (porta 3003) — login + online/offline + GPS + receber/aceitar corridas
✅ Passenger PWA (porta 3004) — login + mapa OSM + pin arrastável + pedir corrida
✅ Multi-tenancy real via PostgreSQL RLS
✅ Auditoria automática via trigger

## Setup

### Pré-requisitos
- Node 20+, pnpm 9+, Supabase CLI, Vercel CLI

### Variáveis de ambiente
Veja `.env.example`. Configure em cada app Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_OSRM_URL`, `NEXT_PUBLIC_NOMINATIM_URL`
- `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_ADMIN_GLOBAL_URL`, etc.

### Desenvolvimento local
```bash
pnpm install
pnpm dev
```

### Deploy
1. Push para GitHub
2. `supabase link --project-ref vlkrlpcniippudhgggwt && supabase db push`
3. Criar super admin no Supabase Auth (email portaldrfotos@gmail.com, marcar Auto Confirm)
4. Importar cada app no Vercel com Root Directory = `apps/<nome>`
5. Configurar variáveis no Vercel

## Stack
- Next.js 16 + React 19 + Tailwind 4
- Supabase (PostgreSQL + RLS + Realtime + Storage + Auth + Edge Functions)
- OpenStreetMap + OSRM + Nominatim (mapas gratuitos)
- Mercado Pago (split)
- OneSignal (push) + Resend (email)
- Vercel (*.vercel.app gratuito)

## Estrutura
```
apps/        # 5 apps Next.js
packages/    # 7 bibliotecas TypeScript (@saas/*)
supabase/    # migrations + edge functions
```
