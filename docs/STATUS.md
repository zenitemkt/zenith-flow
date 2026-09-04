# Status de implementação — ZENITH FLOW

Última atualização: 2026-09-04.

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
- **Release 1C (parte 5) — Fornecedores** (seção 16 do manual):
  - `packages/db`: `Vendor` (nome, categoria, contato, status `homologado/bloqueado`), `VendorOrder` (ordem ao fornecedor, opcionalmente ligada a uma `Task` interna — "tarefa externa gera ordem ao fornecedor").
  - `/operacao/fornecedores`: lista + criação (só nome obrigatório). `/operacao/fornecedores/[id]`: contato, homologar/bloquear, ordens com status próprio (`solicitada → em andamento → concluída/cancelada`).
  - **Bloquear um fornecedor preserva as ordens existentes** e só impede abrir novas — testado e confirmado (a API rejeita nova ordem com fornecedor bloqueado, 400).
  - **Isso fecha a Release 1C inteira**, exceto Notificações (adiada — depende de um sistema de notificação in-app/e-mail mais amplo, que faz mais sentido junto com outros módulos que também precisam notificar).
  - Testado ponta a ponta via Playwright: criar fornecedor + tarefa vinculada → nova ordem → mover até "Concluída" → bloquear fornecedor → ordem continua visível → nova ordem é rejeitada enquanto bloqueado. Dados de teste limpos do banco depois.
- **Contratos** (`/clientes/contratos`): por decisão do usuário, não é o modelo completo do manual (seção 12) — é um botão simples que abre a pasta de contratos da agência no Google Drive numa aba nova. Sem banco de dados envolvido; o link está fixo no código (`apps/web/app/(app)/clientes/contratos/page.tsx`), documentado em `docs/DECISIONS.md`.
- **Release 1D (parte 1) — Conteúdo e aprovação por link** (seção 17 do manual):
  - `packages/db`: `ContentItem` (título, cliente, canal, formato, campanha, legenda, data), `ContentVersion` (cada envio de material vira uma versão nova), `ContentApproval` (token público de aprovação, uma por versão), `ContentComment`, `ContentStatusHistory` (append-only).
  - Estados: `ideia → pauta → produção → revisão interna → aguardando cliente → ajustes → aprovado → agendado → publicado → arquivado` (cadeia completa da seção 17). `AGUARDANDO_CLIENTE` só sai via decisão do cliente no link, nunca por botão interno.
  - `/conteudo/planejamento`: lista de peças + criação. `/conteudo/[id]`: versões (link externo — Drive/Figma/Canva, sem upload real ainda), "Enviar para aprovação do cliente" (gera link público), comentários internos, histórico completo.
  - **`/aprovar/[token]`: página pública, sem login** — é a resposta ao "cliente aprova por link **ou** portal" do manual (seção 3.2, critério de saída da Fase 1D); implementamos o link, que é a opção mais simples e já satisfaz o critério. Portal do cliente com login próprio (seção 18) é um projeto à parte, maior, ainda não iniciado.
  - Aprovação vale só para a versão específica enviada (`@@unique` em `ContentApproval.contentVersionId`) — uma nova versão sempre precisa de um novo envio/token.
  - Testado ponta a ponta via Playwright, incluindo a parte do cliente: criar peça → mover até revisão interna → adicionar versão (link) → enviar para aprovação → **abrir o link público numa aba anônima, sem sessão nenhuma** → aprovar → conferir que o painel interno mostra "Aprovado" com trilha completa no histórico. Dados de teste limpos do banco depois.
- **Release 1D (parte 2) — Calendário editorial** (`/conteudo/calendario`): grade mensal (dom-sáb) das peças de `ContentItem` por `scheduledDate`, com navegação anterior/próximo por query param (`?month=YYYY-MM`), destaque do dia atual, badge de status por peça e link direto para o detalhe. Sem schema novo — é só uma segunda visualização sobre os mesmos dados já existentes de `/conteudo/planejamento` (que ganhou um link "Ver calendário" e vice-versa "Ver lista"). Testado via Playwright: peça agendada aparece no dia certo, navegação entre meses funciona (peça só aparece no mês em que está agendada), clique na peça leva ao detalhe.
- **Release 1D (parte 3) — Filtro por cliente em Conteúdo**: `/conteudo/planejamento` e `/conteudo/calendario` ganharam pills de filtro (`ContentClientFilter`, componente compartilhado) — "Todos os clientes" (visão geral, comportamento padrão) ou um cliente específico via `?clientId=`. O filtro persiste ao trocar entre lista e calendário e ao navegar entre meses. O perfil do cliente (`/clientes/[id]`) ganhou uma linha "Conteúdo: N peças" que já abre a lista pré-filtrada para aquele cliente, fechando o loop de "ver o conteúdo a partir do cliente". Sem schema novo — filtro puro por `clientId` já existente em `ContentItem`. Testado via Playwright: visão geral mostra peças de dois clientes, filtro por pill mostra só as do cliente selecionado, filtro é preservado ao ir para o calendário, e o link do perfil do cliente leva direto à lista filtrada.
- **Release 1D (parte 4) — Fila de aprovação e reabertura pós-aprovação, fecha a seção 17 do manual**: consultei o texto original da seção 17 (extração direta do PDF, já que "Posts"/"Publicação" no `nav-config` eram rótulos inventados numa sessão anterior sem correspondência no manual — as telas reais que faltavam eram "biblioteca" e "fila de aprovação").
  - `/conteudo/aprovacoes`: duas listas — peças aguardando decisão do cliente (`ContentApproval.status = PENDENTE`, ordenadas por prazo, com badge de urgência — vermelho ≤1 dia, amarelo ≤3 dias) e peças que voltaram com "ajustes pedidos" ainda sem novo material (`ContentItem.status = AJUSTES`). Link de acesso rápido em `/conteudo/planejamento`.
  - Corrigida a regra "mudança após aprovação reabre aprovação quando campo material muda" (texto literal do manual, seção 17): subir uma nova versão enquanto o item está `APROVADO`/`AGENDADO`/`PUBLICADO` agora volta o status para `PRODUCAO` automaticamente e grava o motivo no histórico ("Material alterado após aprovação — aprovação anterior reaberta"). Antes disso, o item ficava com o badge "Aprovado" mesmo depois de trocar o material, o que era enganoso.
  - Testado via Playwright: peça enviada aparece na fila com o prazo certo, some da fila assim que o cliente aprova pelo link público, e subir uma v2 depois de aprovado reabre pra "Produção" com o motivo certo no histórico. Suite completa de `packages/db` (20/20) revalidada sem regressão.
  - "Biblioteca" (seção 17) continua não construída — depende da mesma decisão de storage (S3/R2) que trava "Arquivos" (seção 9.3); os itens "Posts" e "Publicação" do `nav-config` continuam com rótulos que não correspondem a nenhuma tela do manual, candidatos a renomear/remover numa limpeza futura.
- **Release 1D (parte 5) — Portal do Cliente (seção 18, parte 1)**: o cliente agora consegue logar com conta própria e acompanhar/aprovar conteúdo sem passar pelo painel interno. Reaproveita a base já desenhada desde a Release 1A — `Workspace(kind: CLIENT)` e os papéis `CLIENT_ADMIN`/`CLIENT_VIEWER` já existiam no schema sem uso; nenhuma tabela nova foi criada.
  - **Convite**: no perfil do cliente (precisa estar Ativo, com workspace criado), nova seção "Portal do cliente" lista quem já tem acesso e permite convidar por e-mail (`POST /api/clients/:id/portal-invite`, cria `Membership` no workspace do cliente com role `CLIENT_VIEWER`/`CLIENT_ADMIN`). O aceite reaproveita 100% o fluxo já existente (`/convite/[token]`, `POST /api/invites/accept`) — não foi preciso nenhum código novo aí.
  - **Roteamento por papel**: `(app)/layout.tsx` redireciona sessões com papel de cliente pra `/portal`; `/portal/layout.tsx` faz o inverso (`lib/portal.ts`, `requirePortalContext()`) — mesma sessão Better Auth, mesma tabela `Membership`, só o layout que muda conforme o papel.
  - **Telas**: `/portal` (início — contadores de aprovações pendentes e próximas peças), `/portal/calendario` (mesma grade mensal da visão interna, sempre scoped ao próprio cliente, sem filtro — reaproveita o componente `CalendarGrid` e os helpers de `lib/content-calendar.ts`, extraídos de `/conteudo/calendario` nesta fatia), `/portal/aprovacoes` (pendentes + histórico recente, decide via sessão autenticada).
  - **Aprovar autenticado**: nova rota `POST /api/portal/content/:itemId/decide` aplica a mesma regra de negócio do link público — extraída para `lib/content-approval.ts` (`applyApprovalDecision`) e reusada pelos dois caminhos. A diferença prática: o portal grava o `actorUserId` de verdade no histórico e no audit log (`actorType: "client_portal"`), enquanto o link público continua anônimo (`actorUserId: null`, `actorType: "client"`) — o link público **continua funcionando** mesmo depois que o cliente tem portal (não é um "ou" exclusivo).
  - Testado via Playwright, fluxo completo: staff ativa cliente → convida pro portal → cliente aceita convite (cria conta) → cai direto em `/portal` → aprova pelo portal → status reflete "Aprovado" no lado interno → guards de papel confirmados nos dois sentidos (cliente tentando abrir rota interna volta pro portal; staff tentando abrir `/portal` volta pra área interna). Suite completa de `packages/db` revalidada (20/20).
  - **Fica pra parte 2** (não construído): Solicitações (cliente abrir uma Demanda pelo portal — o manual já modela `Request.clientId` opcional, encaixe natural), Arquivos (mesma pendência de storage), Relatórios, e visibilidade de Contrato/Financeiro permitido pro cliente. O item de sidebar interno "Portal do Cliente" (`nav-config`, grupo Comunicação) continua `comingSoon: true` de propósito — não existe hoje um caso de uso de staff acessando `/portal` (ex.: "ver como o cliente vê"), então não faz sentido habilitá-lo ainda.
- Testes automatizados: 9 (Sidebar) + 20 (isolamento entre agências: memberships, clientes, demandas, tarefas + bloqueio por dependência, rotinas + idempotência, squads + handoff, fornecedores + preservação de ordens, conteúdo + aprovação por versão — Vitest contra o Neon real) = 29/29 passando. `npm run build` e `tsc --noEmit` limpos em `apps/web`.

## Parcial

- Convite de membro: só cobre "pessoa nova" (cria conta na hora). Alguém que já tem conta em outra agência precisa primeiro logar e depois pedir vínculo manual — aceite automático para conta existente é um gap conhecido.
- Release 1B: **Contratos** resolvido por decisão do usuário — não é o modelo completo da seção 12 do manual (produtos, versionamento, ativação gerando estrutura operacional), é só um botão em `/clientes/contratos` que abre a pasta do Google Drive da agência numa aba nova (link fixo no código por enquanto). Falta **Arquivos** (upload, seção 9.3 — depende de adapter S3/R2, ainda não escolhido). `/clientes/onboarding` (visão cross-cliente), `/clientes/nps`, `/clientes/reativacoes` continuam Empty State.
- Edição de contato (além do responsável criado no cadastro) ainda não existe — só é possível adicionar novos contatos, não editar/remover um existente.
- Release 1C: falta só **Notificações** (adiada, ver acima). Quadro de tarefas é clique-para-mover, não drag-and-drop. Tarefa não tem página de detalhe própria nem apontamento de horas (Fase 1E). Rotinas: só recorrência mensal, geração é manual (sem worker/cron real ainda). Squads: só squad principal (sem especialistas individuais); remover membro de squad ainda não tem UI (só adicionar).
- Release 1D: a seção 17 (Conteúdo) está fechada, exceto **Biblioteca** (depende da mesma decisão de storage que trava Arquivos). **Portal do cliente** (seção 18) tem login, início, calendário e aprovações — faltam Solicitações, Arquivos e Relatórios do portal (parte 2). Falta **Comunicação/menções genéricas** (seção 19 — hoje cada módulo tem seu próprio comentário simples, sem menções nem thread resolvível). `/aprovacoes` (o item de nível superior, inbox cross-módulo interno — diferente de `/conteudo/aprovacoes` e de `/portal/aprovacoes`, que já existem) continua Empty State. `/conteudo/posts` e `/conteudo/publicacao` no `nav-config` são rótulos sem tela correspondente no manual, candidatos a limpeza futura. Upload real de arquivo (sempre link externo por enquanto) segue dependendo da escolha de storage (S3/R2).
- Demais módulos (Financeiro etc.) continuam Empty States sem lógica de negócio.

## Pendente (por fase, ver manual)

- Fase 1: contratos/produtos, arquivos, notificações, portal do cliente, comunicação genérica, RH, financeiro manual.
- Fase 2: financeiro avançado, Asaas, Health Score, churn, NPS/eNPS, cohort, envio real de e-mail (convites).
- Fase 3: tracking, GTM/GA4, Meta Ads/CAPI, CRM/leads, automações, e-mail/WhatsApp, Zenith AI.
- Pacotes do manual ainda não criados: `packages/core`, `packages/integrations`, `packages/automation`, `packages/tracking`, `packages/ai`, `apps/worker` (é onde um cron real para rotinas moraria).

## Ideias futuras (ainda não implementadas)

- **Funções/papéis por pessoa** (sugestão do usuário, 2026-09-04): cada colaborador poderia ter uma ou mais "funções" (ex.: Gestor de Tráfego, Designer, Editor de Vídeo, Contato com Cliente) — um catálogo definido pela própria agência, não um enum fixo. Demandas indicariam a função necessária, permitindo uma visão "minhas demandas" por pessoa/função, além do squad. Não está na Release 1C atual; avaliar quando chegarmos em RH (seção 20) ou numa revisão de Demandas/Squads.

## Bloqueios

Nenhum no momento.

## Próximo slice sugerido

Release 1C está praticamente fechada (só falta Notificações, adiada de propósito). Os próximos caminhos naturais: Release 1D (Conteúdo, calendário, aprovações, portal do cliente) ou retomar Contratos, que segue em espera aguardando decisão do usuário.

## Ambiente local

Variáveis necessárias (ver `.env.example`): `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Depois de `npm install`: `npm run migrate:dev --workspace=packages/db` para aplicar migrations. **Nunca** rodar `npm run build` com `npm run dev` ativo (ver `docs/DECISIONS.md`).
