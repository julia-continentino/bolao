import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Intelligence Pro",
  description: "Pesquisa de mercado, análise setorial, benchmarking financeiro e relatórios corporativos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
