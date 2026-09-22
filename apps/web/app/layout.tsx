import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerSession, getUserThemePreference } from "@/lib/session";
import "./globals.css";

/** Auto-hospedada pelo Next (baixada no build, sem request ao Google em runtime). */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "ZENITE MKT",
  description: "Agency Operating System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const isDark = session ? (await getUserThemePreference(session.user.id)) === "DARK" : false;

  return (
    <html lang="pt-BR" className={`${inter.variable}${isDark ? " dark" : ""}`}>
      <body>{children}</body>
    </html>
  );
}
