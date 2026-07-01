import Link from "next/link";
import { Check, Car, Smartphone, CreditCard, MapPin, Zap, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">MobilerPremium</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="text-slate-600 hover:text-slate-900">Recursos</Link>
            <Link href="#pricing" className="text-slate-600 hover:text-slate-900">Planos</Link>
            <Link href="/signup" className="px-4 py-2 rounded-md bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition-colors">Criar operação</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(6,182,212,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium mb-6">
              <Zap className="w-3 h-3" /> White Label · Multi-Tenant · PWA
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              Sua própria operação de
              <span className="block bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">transporte privado em minutos</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 mb-8 leading-relaxed">
              Plataforma SaaS completa para você criar seu próprio "Uber". Motorista e passageiro via PWA, mapas e rotas gratuitos, pagamentos com split via Mercado Pago. Tudo white-label com sua marca.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/25">
                Começar grátis <span className="text-sm opacity-80">— sem cartão</span>
              </Link>
              <Link href="#features" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-slate-600 text-slate-200 font-semibold hover:bg-slate-800 transition-colors">Ver recursos</Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Plano grátis forever</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Setup em 5 minutos</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Multi-tenant real</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Tudo que sua operação precisa</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Da captação do passageiro ao repasse do motorista — uma plataforma completa.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<Smartphone className="w-6 h-6 text-cyan-500" />} title="PWA — sem App Store" description="Passageiro e motorista instalam direto do navegador. Sem taxas de loja, sem revisão, atualização instantânea." />
            <FeatureCard icon={<MapPin className="w-6 h-6 text-cyan-500" />} title="Mapas gratuitos" description="OpenStreetMap + OSRM + Nominatim 100% grátis. Quando crescer, troque para Google Maps com 1 clique no painel." />
            <FeatureCard icon={<CreditCard className="w-6 h-6 text-cyan-500" />} title="Pagamentos com split" description="Mercado Pago com split automático empresa/motorista. PIX, cartão, dinheiro e maquininha suportados." />
            <FeatureCard icon={<Car className="w-6 h-6 text-cyan-500" />} title="Categorias ilimitadas" description="Uber X, Moto, Black, Van, Executivo — crie quantas categorias quiser com pricing próprio por categoria." />
            <FeatureCard icon={<Shield className="w-6 h-6 text-cyan-500" />} title="Multi-tenant com RLS" description="Isolamento de dados no banco (PostgreSQL RLS). Cada empresa enxerga apenas seus dados. Defesa em profundidade." />
            <FeatureCard icon={<Zap className="w-6 h-6 text-cyan-500" />} title="Tempo real nativo" description="Supabase Realtime para posição do motorista, status de corrida e chat. Latência baixa, sem custo extra." />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Comece grátis. Pague quando crescer.</h2>
            <p className="text-lg text-slate-600">Sem cartão de crédito. Sem taxa de setup. Cancele quando quiser.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <PricingCard name="Free" price="R$ 0" period="/mês" description="Para validar a operação" features={["5 motoristas", "200 corridas/mês", "2 categorias", "Mapas OSM grátis", "Mercado Pago"]} cta="Começar grátis" ctaHref="/signup" highlight />
            <PricingCard name="Starter" price="R$ 149" period="/mês" description="Para operação pequena" features={["25 motoristas", "2.000 corridas/mês", "5 categorias", "Suporte e-mail"]} cta="Assinar Starter" ctaHref="/signup?plan=starter" />
            <PricingCard name="Pro" price="R$ 499" period="/mês" description="Para operação estabelecida" features={["100 motoristas", "20.000 corridas/mês", "Categorias ilimitadas", "Domínio próprio", "API pública", "Suporte chat"]} cta="Assinar Pro" ctaHref="/signup?plan=pro" />
            <PricingCard name="Enterprise" price="Sob consulta" period="" description="Para grandes frotas" features={["Motoristas ilimitados", "Corridas ilimitadas", "SLA dedicado", "Integrações ERP/CRM", "Sem branding SaaS"]} cta="Falar com vendas" ctaHref="mailto:vendas@mobilerpremium.com" />
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-cyan-500 to-violet-500 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-lg text-cyan-50 mb-8">Crie sua conta agora. Em 5 minutos sua operação está no ar.</p>
          <Link href="/signup" className="inline-flex items-center justify-center px-8 py-4 rounded-md bg-white text-cyan-600 font-bold hover:bg-slate-100 transition-colors shadow-xl">Criar minha operação</Link>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
                <Car className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">MobilerPremium</span>
            </div>
            <div className="text-sm">© 2026 Super Aplicativos · Todos os direitos reservados</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 rounded-lg bg-cyan-50 flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function PricingCard({ name, price, period, description, features, cta, ctaHref, highlight }: { name: string; price: string; period: string; description: string; features: string[]; cta: string; ctaHref: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border-2 bg-white p-6 flex flex-col ${highlight ? "border-cyan-500 shadow-lg" : "border-slate-200"}`}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{name}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="mb-6">
        <span className="text-3xl font-extrabold text-slate-900">{price}</span>
        <span className="text-slate-500 text-sm">{period}</span>
      </div>
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaHref} className={`block text-center px-4 py-2.5 rounded-md font-semibold transition-colors ${highlight ? "bg-cyan-500 text-white hover:bg-cyan-600" : "bg-slate-100 text-slate-900 hover:bg-slate-200"}`}>{cta}</Link>
    </div>
  );
}
