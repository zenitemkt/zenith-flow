import type { Metadata, Viewport } from "next";
import { Inter, Schibsted_Grotesk } from "next/font/google";
import { getServerSession, getUserAppearance } from "@/lib/session";
import "./globals.css";
import "./zenite-theme.css";
import "./ui-minimal.css";
import "./ui-originals.css";

/** Auto-hospedada pelo Next (baixada no build, sem request ao Google em runtime). */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
/** Títulos da identidade "zênite" (Portal do Cliente e tema escuro do painel interno). */
const display = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "ZENITE MKT",
  description: "Agency Operating System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const appearance = session ? await getUserAppearance(session.user.id) : null;
  // Minimalista é sempre claro e Zenite Originals sempre escuro: os dois ignoram a preferência claro/escuro.
  const isMinimal = appearance?.uiStyle === "MINIMALISTA";
  const isOriginals = appearance?.uiStyle === "ORIGINALS";
  const isDark = isOriginals || (!isMinimal && appearance?.themePreference === "DARK");

  return (
    <html lang="pt-BR" className={`${inter.variable} ${display.variable}${isDark ? " dark" : ""}${isMinimal ? " ui-minimal" : ""}${isOriginals ? " ui-originals" : ""}`}>
      <body>{children}</body>
    </html>
  );
}
