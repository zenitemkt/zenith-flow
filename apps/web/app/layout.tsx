import type { Metadata } from "next";
import { getServerSession } from "@/lib/session";
import { prisma } from "@zenith/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZENITH FLOW",
  description: "Agency Operating System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  let isDark = false;
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { themePreference: true },
    });
    isDark = user?.themePreference === "DARK";
  }

  return (
    <html lang="pt-BR" className={isDark ? "dark" : undefined}>
      <body>{children}</body>
    </html>
  );
}
