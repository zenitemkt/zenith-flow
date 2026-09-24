import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/esqueci-senha",
  "/redefinir-senha",
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
  "/api/collect",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * BRIEFING_PORTAL_SUBDOMINIO.md (seção 5): portal.hubzenite.com.br serve o
 * mesmo deploy, mas só pode expor o Portal do Cliente — nenhuma rota interna
 * deve responder nesse host, mesmo que alguém digite a URL direto.
 */
const PORTAL_HOST = process.env.PORTAL_HOST ?? "portal.hubzenite.com.br";

const PORTAL_ALLOWED_PREFIXES = [
  "/portal",
  "/login",
  "/esqueci-senha",
  "/redefinir-senha",
  "/convite",
  "/api/auth",
  "/api/portal",
  "/api/media",
];

function isPortalHost(host: string | null): boolean {
  return host === PORTAL_HOST;
}

function isAllowedOnPortalHost(pathname: string): boolean {
  return PORTAL_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Checagem leve de cookie (sem hit no banco) — a validação completa da sessão
 * acontece nas páginas/route handlers via auth.api.getSession (seção 7.2 do
 * manual: o backend nunca confia apenas no que o cliente afirma).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const onPortalHost = isPortalHost(host);
  const effectivePath = onPortalHost && pathname === "/" ? "/portal" : pathname;

  if (onPortalHost && !isAllowedOnPortalHost(effectivePath)) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  if (!isPublicPath(effectivePath)) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (onPortalHost && pathname === "/") {
    return NextResponse.rewrite(new URL("/portal", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
