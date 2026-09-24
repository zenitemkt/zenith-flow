import type { Metadata } from "next";
import { Inter, Schibsted_Grotesk } from "next/font/google";
import { getServerSession, getUserThemePreference } from "@/lib/session";
import "./globals.css";
import "./zenite-theme.css";

/** Auto-hospedada pelo Next (baixada no build, sem request ao Google em runtime). */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
/** Títulos da identidade "zênite" (Portal do Cliente e tema escuro do painel interno). */
const display = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "ZENITE MKT",
  description: "Agency Operating System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const isDark = session ? (await getUserThemePreference(session.user.id)) === "DARK" : false;

  return (
    <html lang="pt-BR" className={`${inter.variable} ${display.variable}${isDark ? " dark" : ""}`}>
      <body>{children}</body>
    </html>
  );
}
