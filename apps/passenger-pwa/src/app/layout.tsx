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
        {/* Leaflet CSS must be loaded via link tag, not @import in CSS (Tailwind 4 breaks @import) */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
