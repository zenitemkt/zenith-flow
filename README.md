# ZENITH FLOW

Agency Operating System — implementação incremental a partir do `ZENITH_FLOW_Manual_Mestre_v2.0.pdf` (fonte de verdade funcional, visual e técnica; ver raiz do repositório).

## Stack

- **Web**: Next.js 14 (App Router) + React + TypeScript, em `apps/web`.
- **UI/Design system**: `packages/ui` — tokens visuais, `Sidebar`, `MobileDrawer`, `AppShell`, padrões de tela (`ComingSoon` etc.).
- **Banco**: `packages/db` — Prisma + Postgres (Neon).
- **Auth**: Better Auth (e-mail/senha), cookies HttpOnly, sessão validada no servidor.
- **Estilo**: Tailwind CSS, com tokens do manual (seção 4.2) em `apps/web/tailwind.config.ts`.
- Estrutura de monorepo (npm workspaces) preparada para os pacotes futuros do manual (`packages/core`, `packages/integrations`, `packages/automation`, `packages/tracking`, `packages/ai`) — ver `docs/STATUS.md`.

## Setup local

1. `npm install`
2. Copie `.env.example` para `packages/db/.env` e `apps/web/.env.local`, preenchendo `DATABASE_URL` (Neon — `neon connection-string --project-id <id>`), `BETTER_AUTH_SECRET` (gerar com o comando no próprio `.env.example`) e `BETTER_AUTH_URL`.
3. `npm run migrate:dev --workspace=packages/db` — aplica as migrations no banco.
4. `npm run dev` — sobe `apps/web` em http://localhost:3000. Crie sua conta em `/signup`.

## Comandos

```bash
npm install                                  # instala tudo (root + workspaces)
npm run dev                                   # sobe apps/web em http://localhost:3000
npm run test                                   # testes de packages/ui e packages/db (Vitest)
npm run lint                                    # lint de apps/web
npm run build                                    # build de produção de apps/web
npm run migrate:dev --workspace=packages/db       # nova migration Prisma
npm run studio --workspace=packages/db             # Prisma Studio (explorar o banco)
```

**Importante**: nunca rode `npm run build` enquanto `npm run dev` está ativo — os dois escrevem em `apps/web/.next` e se corrompem mutuamente (ver `docs/DECISIONS.md`).

## Estado atual

Ver `docs/STATUS.md` para o que já está implementado, parcial ou pendente.
A navegação lateral (sidebar) existe com **todas** as abas do manual; a
Release 1A (auth, agência, workspace, membros, RBAC) já funciona de ponta a
ponta. Os demais módulos apontam para um Empty State "Em desenvolvimento" até
sua fatia funcional ser entregue.
