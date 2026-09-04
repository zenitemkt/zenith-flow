# Status de implementação — ZENITH FLOW

Última atualização: 2026-09-04 (madrugada).

## Implementado

- Monorepo (npm workspaces): `apps/web` (Next.js 14 + Tailwind), `packages/ui` (design system) e `packages/db` (Prisma + Postgres).
- **Sidebar de navegação** completa (`packages/ui/src/navigation`):
  - Todas as abas do manual (Visão geral, Produção, Gestão, Inteligência e automação, Comunicação e recursos, Sistema) cadastradas em `nav-config.ts`.
  - Recolhida por padrão (68px), expande por hover, foco de teclado ou clique no botão de fixar; delay de 200ms ao recolher.
  - Submenu abre apenas por clique/teclado (Clientes, Operação, Conteúdo, Financeiro, Pessoas, Configurações).
  - Tooltip acessível no estado recolhido (400ms), `aria-current="page"` no item ativo, `aria-expanded`/`aria-controls` nos submenus.
  - Preferência de fixação (`pinned`) persistida em `localStorage`. Respeita `prefers-reduced-motion`.
  - `MobileDrawer` (<768px) com focus trap, fechamento por Escape/backdrop/botão.
  - Agora exibe dados reais de sessão (nome, papel, agência) e um botão funcional de "Sair".
- **Release 1A — Auth, agência, workspace, membros, RBAC** (banco real, Neon Postgres em `sa-east-1`):
  - `packages/db`: schema Prisma (`User`, `Session`, `Account`, `Verification` do Better Auth + `Agency`, `Workspace`, `Membership`, `AuditLog` do domínio ZENITH FLOW). Migrations aplicadas.
  - Auth por e-mail/senha via **Better Auth** (`apps/web/lib/auth.ts`), cookies HttpOnly, middleware protegendo todas as rotas exceto `/login`, `/signup`, `/convite/*`, `/api/auth/*`.
  - `/signup`: cria usuário + agência + workspace interno (kind `AGENCY`) + membership `AGENCY_ADMIN` numa única transação. `/login`. `/nova-agencia`: fallback para usuário autenticado sem agência.
  - `/configuracoes/equipe`: lista membros do workspace e (para `AGENCY_ADMIN`/`SUPER_ADMIN`) convida novos membros — gera link de convite com token (`/convite/[token]`), já que envio de e-mail real é Fase 2.
  - RBAC inicial em `apps/web/lib/rbac.ts` (8 papéis do manual, seção 7.1); `canManageTeam()` guarda a ação de convidar.
  - Toda mutação relevante grava `AuditLog` (`agency.created`, `membership.invited`, `membership.accepted`).
  - Testado ponta a ponta via Playwright: signup → agência criada → sidebar com dados reais → convite → aceite por outro usuário → ambos "Ativo" na lista → logout. Dados de teste limpos do banco depois.
- **Release 1B (parte 1) — Clientes, contatos, onboarding** (seções 10 e 11 do manual):
  - `packages/db`: `Client`, `ClientContact`, `ClientStatusHistory` (append-only, motivo obrigatório em pausar/encerrar), `ClientNote`, `OnboardingTemplate`/`OnboardingTemplateItem`, `OnboardingRun`/`OnboardingItem`.
  - Template de onboarding padrão (4 itens) semeado automaticamente para cada agência nova, no mesmo transaction do signup.
  - `/clientes/carteira`: lista clientes da agência + criação rápida (nome + documento).
  - `/clientes/[id]`: visão 360 — contatos (com contato principal), ações de mudança de status (`prospect → onboarding → ativo → pausado/em encerramento → encerrado → reativado`, seção 10), checklist de onboarding e timeline (histórico de status + notas, mesclados por data).
  - Checklist de onboarding: dependência **sequencial por ordem** (item N só libera após N-1 concluído) — simplificação deliberada do "grafo de dependências" do manual, documentada em `docs/DECISIONS.md`.
  - Ativar um cliente (`ATIVO`) cria automaticamente seu `Workspace` (kind `CLIENT`) — ainda sem membership/portal (Release 1D).
  - Testado ponta a ponta via Playwright: criar cliente → adicionar contato → iniciar onboarding → concluir item 1 → item 2 desbloqueia → nota na timeline. Dados de teste limpos do banco depois.
  - **Cadastro completo via popup**: `Modal` acessível (focus trap, Escape, backdrop) em `packages/ui`, reaproveitado por `ClientFormModal` (criação e edição). Campos: nome fantasia (único obrigatório), CNPJ, e-mail, telefone, WhatsApp e — só na criação — responsável (nome/e-mail/telefone), que vira automaticamente o contato principal. Botão "Editar dados" no perfil do cliente permite completar/corrigir a qualquer momento (`PATCH /api/clients/:id`) — cadastro parcial (só o nome) é o caso normal, não um erro.
- **Release 1C (parte 1) — Demandas** (seção 13 do manual):
  - `packages/db`: `Request`, `RequestComment`, `RequestStatusHistory` (append-only).
  - Estados: `nova → triagem ⇄ aguardando informação → aprovada/rejeitada → convertida → concluída` (rejeição exige motivo). Prioridade (baixa/média/alta/urgente) definida na triagem/aprovação, não pelo solicitante — conforme seção 13.
  - `/operacao/demandas`: inbox (lista + popup de nova demanda, com cliente opcional e nome do solicitante).
  - `/operacao/demandas/[id]`: detalhe — ações de status, comentários, histórico.
  - Testado ponta a ponta via Playwright: criar demanda vinculada a um cliente → triagem com prioridade → aprovar → comentar → aparece certo na lista. Dados de teste limpos do banco depois.
- **Release 1C (parte 2) — Projetos e Tarefas** (seção 14 do manual):
  - `packages/db`: `Project` (pertence a cliente ou à agência), `Task`, `TaskStatusHistory` (append-only). Estado único `WorkItemStatus` compartilhado por projeto e tarefa: `backlog → planejada → em andamento → bloqueada → revisão → concluída/cancelada`.
  - `/operacao/projetos`: lista de projetos + popup de criação (nome, cliente opcional).
  - `/operacao/projetos/[id]`: quadro por status (colunas), mover tarefa por botão — **acessível, sem drag-and-drop** nesta fatia (ver `docs/DECISIONS.md`). Popup de nova tarefa com bloqueio opcional por outra tarefa do mesmo projeto.
  - `/operacao/tarefas`: lista de todas as tarefas da agência (com projeto e cliente).
  - **Bloqueio por dependência funciona de verdade**: uma tarefa com `blockedByTaskId` não pode ir para "Em andamento" ou "Concluída" enquanto a bloqueadora não estiver concluída — os botões ficam desabilitados e a API rejeita a tentativa (409). Dependência é bloqueio único (não um grafo), mesma simplificação pragmática do checklist de onboarding.
  - **Fecha o loop "demanda vira tarefa"**: demanda `APROVADA` ganha o botão "Converter em tarefa" (`POST /api/requests/:id/convert`) — escolhe projeto existente ou cria um novo, gera a `Task`, marca a demanda como `CONVERTIDA` e deixa um link direto pro projeto. Tudo numa transação só.
  - Testado ponta a ponta via Playwright: projeto manual com duas tarefas (uma bloqueando a outra) → tarefa bloqueadora percorre o quadro até "Concluída" → aviso de bloqueio some e o botão da outra tarefa libera. E também: demanda → triagem → aprovação → "Converter em tarefa" → projeto novo criado com a tarefa → demanda mostra "Convertida" com link. Dados de teste limpos do banco depois.
- **Release 1C (parte 3) — Rotinas recorrentes** (seção 15 do manual):
  - `packages/db`: `RoutineTemplate` (nome, cliente opcional, dia do mês, status `rascunho/ativo/pausado/arquivado`), `RoutineTemplateTask` (tarefas que se repetem), `RoutineRun` (uma linha por período gerado).
  - **`@@unique([templateId, period])` é a chave de idempotência de verdade** (não só uma checagem em código) — seção 15: "idempotency key impede duplicidade por rotina+período". Testei clicando "Gerar agora" duas vezes seguidas: só uma geração existe, a segunda tentativa volta como "já gerado" sem duplicar nada.
  - Só recorrência **mensal** (dia fixo do mês) nesta fatia — semanal e "dias úteis" ficam para quando houver caso real pedindo (documentado em `docs/DECISIONS.md`).
  - Gatilho é manual (botão "Gerar agora") por enquanto — em produção seria um worker agendado rodando a mesma função todo dia; a idempotência é idêntica nos dois casos, só muda quem aperta o play.
  - Ativar rotina → cria `Project` novo a cada geração (nome com o período, ex.: "Rotina mensal de conteúdo · Setembro de 2026") com as tarefas do template clonadas. **Pausar não apaga gerações passadas** (seção 15) — só bloqueia novas.
  - `/operacao/rotinas`: lista + popup de criação (nome, cliente, dia do mês, lista dinâmica de tarefas). `/operacao/rotinas/[id]`: tarefas do template, histórico de gerações (com link pro projeto criado), ativar/pausar/gerar.
  - Testado ponta a ponta via Playwright: criar rotina em rascunho ("Gerar agora" corretamente escondido) → ativar → gerar (projeto criado) → gerar de novo → mensagem de idempotência, sem duplicar. Dados de teste limpos do banco depois.
- **Release 1C (parte 4) — Squads e capacidade** (seção 16 do manual):
  - `packages/db`: `Squad`, `SquadMember`, `ClientAllocation` (histórico de squad responsável por cliente — reatribuir encerra a linha anterior, nunca apaga).
  - `/operacao/squads`: lista + criação. `/operacao/squads/[id]`: membros com **carga** (contagem de tarefas abertas por pessoa, com destaque visual quando ≥4/≥8), adicionar membro, clientes atendidos (alocação ativa) + realocar.
  - **"Carga" é uma proxy leve** (contagem de tarefas abertas do `Task.assigneeUserId`, não horas) — apontamento de horas de verdade é Fase 1E (seção 21 do manual), documentado em `docs/DECISIONS.md`.
  - `Task` ganhou responsável de verdade: seletor ao criar (`NewTaskModal`) e reatribuição direta no quadro (`TaskBoard`, um `<select>` por card) — toda reatribuição grava `AuditLog` (`task.reassigned`), preservando histórico sem precisar de uma tabela nova.
  - Cliente 360 agora mostra "Squad responsável" (link pro squad) no cabeçalho.
  - Só squad principal por cliente nesta fatia — "especialistas" individuais (regra do manual) ficam para quando houver caso real pedindo.
  - Testado ponta a ponta via Playwright: criar squad → adicionar membro → alocar cliente (aparece nos dois lados: squad e perfil do cliente) → criar tarefa atribuída à pessoa → contagem de carga do squad atualiza de 0 para 1. Dados de teste limpos do banco depois.
- Testes automatizados: 9 (Sidebar) + 15 (isolamento entre agências: memberships, clientes, demandas, tarefas + bloqueio por dependência, rotinas + idempotência, squads + handoff de cliente — Vitest contra o Neon real) = 24/24 passando. `npm run build` e `tsc --noEmit` limpos em `apps/web`.

## Parcial

- Convite de membro: só cobre "pessoa nova" (cria conta na hora). Alguém que já tem conta em outra agência precisa primeiro logar e depois pedir vínculo manual — aceite automático para conta existente é um gap conhecido.
- Release 1B: falta **Contratos** (produtos, itens, vigência — em espera, o usuário vai decidir o formato) e **Arquivos** (upload, seção 9.3 — depende de adapter S3/R2, ainda não escolhido). `/clientes/onboarding` (visão cross-cliente), `/clientes/contratos`, `/clientes/nps`, `/clientes/reativacoes` continuam Empty State.
- Edição de contato (além do responsável criado no cadastro) ainda não existe — só é possível adicionar novos contatos, não editar/remover um existente.
- Release 1C: falta **Fornecedores** e **Notificações**. `/operacao/fornecedores` continua Empty State. Quadro de tarefas é clique-para-mover, não drag-and-drop. Tarefa não tem página de detalhe própria nem apontamento de horas (Fase 1E). Rotinas: só recorrência mensal, geração é manual (sem worker/cron real ainda). Squads: só squad principal (sem especialistas individuais); remover membro de squad ainda não tem UI (só adicionar).
- Demais módulos (Financeiro, Conteúdo etc.) continuam Empty States sem lógica de negócio.

## Pendente (por fase, ver manual)

- Fase 1: contratos/produtos, arquivos, fornecedores, notificações, conteúdo, portal, RH, financeiro manual.
- Fase 2: financeiro avançado, Asaas, Health Score, churn, NPS/eNPS, cohort, envio real de e-mail (convites).
- Fase 3: tracking, GTM/GA4, Meta Ads/CAPI, CRM/leads, automações, e-mail/WhatsApp, Zenith AI.
- Pacotes do manual ainda não criados: `packages/core`, `packages/integrations`, `packages/automation`, `packages/tracking`, `packages/ai`, `apps/worker` (é onde um cron real para rotinas moraria).

## Bloqueios

Nenhum no momento.

## Próximo slice sugerido

Fornecedores (seção 16 do manual) fecha o resto da Release 1C de vez — cadastro de parceiros externos homologados/bloqueados. Depois disso, o natural é avançar pra Release 1D (Conteúdo, calendário, aprovações, portal do cliente) ou retomar Contratos, que segue em espera aguardando decisão do usuário.

## Ambiente local

Variáveis necessárias (ver `.env.example`): `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Depois de `npm install`: `npm run migrate:dev --workspace=packages/db` para aplicar migrations. **Nunca** rodar `npm run build` com `npm run dev` ativo (ver `docs/DECISIONS.md`).
