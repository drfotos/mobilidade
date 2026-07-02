import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MobilerPremium — Passageiro",
  description: "Plataforma White Label de Mobilidade",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Leaflet CSS via CDN — no integrity hash (can break if CDN updates) */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
