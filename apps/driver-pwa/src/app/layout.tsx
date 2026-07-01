import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MobilerPremium — Motorista",
  description: "Plataforma White Label de Mobilidade",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
