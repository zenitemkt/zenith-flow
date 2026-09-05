import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/convite",
  "/aprovar",
  "/pesquisa",
  "/pesquisa-interna",
  "/proposta",
  "/api/auth",
  "/api/approvals",
  "/api/public/survey",
  "/api/public/enps",
  "/api/public/proposals",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Checagem leve de cookie (sem hit no banco) — a validação completa da sessão
 * acontece nas páginas/route handlers via auth.api.getSession (seção 7.2 do
 * manual: o backend nunca confia apenas no que o cliente afirma).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
