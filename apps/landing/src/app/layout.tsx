import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MobilerPremium — Plataforma White Label de Mobilidade",
  description: "Crie sua própria operação de transporte privado tipo Uber em minutos. PWA, multi-tenant, com mapas e pagamentos integrados.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
