# Modelo de dados — ZENITH FLOW

Schema completo em `packages/db/prisma/schema.prisma`. Este documento explica o *porquê*, não repete os campos.

## Auth (Better Auth) — `User`, `Session`, `Account`, `Verification`

Tabelas exigidas pelo adapter Prisma do Better Auth (`better-auth/adapters/prisma`). Nomes e formato não são escolha nossa — são o contrato da lib. Detalhe não óbvio: `Account.issuer` foi adicionado manualmente (não vem do gerador oficial, que está descontinuado) — ver `docs/DECISIONS.md` de 2026-09-04.

## Domínio — `Agency`, `Workspace`, `Membership`, `AuditLog`

Implementa a seção 7 do manual (Contas, workspaces e multi-tenancy):

- **Agency**: tenant raiz. Uma agência = uma conta operacional.
- **Workspace**: todo membership aponta para um workspace específico — inclusive o workspace interno da própria agência (`kind: AGENCY`), criado junto com ela no signup. Workspaces de clientes (`kind: CLIENT`) chegam na Release 1B.
- **Membership**: vínculo usuário-workspace-papel. Sempre tem `agencyId` (denormalizado, para filtros rápidos) e `workspaceId` (obrigatório). Um convite pendente é uma `Membership` com `userId: null`, `status: INVITED` e `inviteToken` preenchido; ao aceitar, vira `userId` setado + `status: ACTIVE` + token limpo.
  - `@@unique([workspaceId, email])`: mesma pessoa não pode ter dois vínculos com o mesmo workspace.
- **AuditLog**: append-only (nunca editar/apagar linha existente — seção 48.1 do manual). Guarda `agencyId`, ator, ação, tipo/id do recurso e metadata livre.

## Clientes e onboarding — `Client`, `ClientContact`, `ClientStatusHistory`, `ClientNote`, `OnboardingTemplate`/`Item`, `OnboardingRun`/`Item`

Implementa as seções 10 e 11 do manual:

- **Client**: `workspaceId` é nulo até a ativação — só ganha um `Workspace` (kind `CLIENT`) quando o status vira `ATIVO` (seção 10: "ao ativar: criar... portal"). Isso reaproveita o mesmo modelo de multi-tenancy da seção 7, sem duplicar conceito.
- **ClientStatusHistory**: append-only. Toda mudança de status grava uma linha, mesmo a criação (primeira linha com `fromStatus: null`). Transições permitidas ficam em `apps/web/lib/clients.ts` (`CLIENT_STATUS_TRANSITIONS`), não no schema — regra de negócio, não de dado.
- **OnboardingTemplate/Item**: um template por agência (semeado automaticamente no signup, seção "Decisões" abaixo). `OnboardingRun` clona os itens do template no momento em que o cliente entra em onboarding — mudar o template depois não altera runs já criados (seção 15 do manual: "mudança de template não altera instâncias passadas", mesmo princípio aplicado aqui).
- **OnboardingItem.status**: `PENDENTE` (liberado, ainda não feito) vs `BLOQUEADO` (aguardando o anterior) vs `CONCLUIDO`. Dependência é sequencial pela coluna `order` — ver decisão abaixo.
- **Client.email/phone/whatsapp**: dados da empresa em si (não de uma pessoa) — o contato "Responsável" continua sendo uma `ClientContact` separada (`isPrimary: true`). Cadastro pode nascer só com `name` preenchido; todo o resto é opcional e editável depois via `PATCH /api/clients/:id`.

## Demandas — `Request`, `RequestComment`, `RequestStatusHistory`

Implementa a seção 13 do manual:

- **Request.clientId é opcional**: uma demanda pode ser interna (sem cliente) ou vinculada a um cliente. `requesterName` é texto livre (não um `User`/`ClientContact` formal) porque ainda não existe portal do cliente (Fase 1D) — quando existir, isso pode migrar para uma referência real.
- **Request.priority não é definida na criação**: o campo só é preenchido durante a triagem/aprovação (seção 13: "prioridade é definida por matriz, não apenas pelo solicitante"). Por isso é opcional no create e só aparece como opção nas transições `TRIAGEM`/`APROVADA`.
- **`status: CONVERTIDA` ainda não cria nada**: é só um marcador. A conversão real para Tarefa/Projeto acontece quando esses módulos existirem — ver `docs/DECISIONS.md`.

## Projetos e tarefas — `Project`, `Task`, `TaskStatusHistory`

Implementa a seção 14 do manual:

- **WorkItemStatus é um enum único** compartilhado por `Project.status` e `Task.status` — o manual descreve uma única cadeia de estados na seção 14 sem diferenciar as duas entidades, então modelamos assim em vez de dois enums quase idênticos.
- **`Task.blockedByTaskId` é autorrelacionamento simples** (bloqueio único), não uma tabela `task_dependencies` many-to-many como o manual lista — mesma simplificação pragmática do checklist de onboarding (item N depende do N-1). A regra de bloqueio (`isBlockedByDependency` em `apps/web/lib/tasks.ts`) impede ir para `EM_ANDAMENTO`/`CONCLUIDA` enquanto a bloqueadora não estiver `CONCLUIDA`.
- **`Request.convertedTaskId`**: liga a demanda à tarefa gerada por ela. A conversão (`POST /api/requests/:id/convert`) é sua própria rota — não a rota genérica de status — porque precisa decidir em qual `Project` a `Task` entra (existente ou novo).
- **Sem `deliverables` nem `work_logs` nesta fatia**: o manual lista essas entidades na seção 14, mas para o MVP tratamos "concluir a tarefa" como o próprio entregável (sem uma entidade separada de "deliverable" com seu próprio fluxo de aprovação — isso se sobrepõe ao módulo de Aprovações da Fase 1D). Apontamento de horas (`work_logs`) é Fase 1E (seção 21 do manual).

## Rotinas recorrentes — `RoutineTemplate`, `RoutineTemplateTask`, `RoutineRun`

Implementa a seção 15 do manual:

- **`RoutineRun.period` + `@@unique([templateId, period])`**: essa constraint É o mecanismo de idempotência que o manual pede ("idempotency key impede duplicidade por rotina+período") — não é uma checagem só em código, é uma garantia do banco. Duas chamadas concorrentes de geração para o mesmo período: uma cria a linha, a outra recebe erro de constraint (`P2002`) e é tratada como sucesso idempotente em `apps/web/lib/routines.ts`.
- **Cada geração cria um `Project` novo** (não reaproveita um projeto entre períodos) — mantém cada mês/período claramente separado e satisfaz naturalmente "mudança de template não altera instâncias passadas" (seção 15): o `Project` e as `Task` já criados são cópias independentes, não referências ao template.
- **Só recorrência mensal (`dayOfMonth`) nesta fatia**: o manual pede timezone, dias úteis e data final também — implementamos `timezone` e `endDate` no schema (para não bloquear a evolução), mas a lógica de geração ainda não os usa. Semanal/dias úteis ficam para quando houver caso real.
- **Geração é sempre manual (botão "Gerar agora")**: não existe ainda um worker/cron rodando a geração automaticamente no dia certo — isso é `apps/worker`, que ainda não existe no monorepo. A função `generateRoutineRun()` já é a peça que um cron chamaria; só falta o cron em si.

## Squads e capacidade — `Squad`, `SquadMember`, `ClientAllocation`

Implementa a seção 16 do manual:

- **`ClientAllocation` é histórico, não estado atual**: cada realocação de squad cria uma linha nova (`ATIVA`) e encerra a anterior (`ENCERRADA` + `endDate`), em vez de fazer `UPDATE` no squad responsável do cliente. Isso é literalmente "troca de responsável registra handoff" (seção 16) — a query "squad atual" é só `WHERE status = 'ATIVA'`, mas o histórico completo sempre existe.
- **Sem tabela de "capacidade" (`capacity_calendars`)**: o manual descreve capacidade como horas disponíveis vs. planejadas. Sem um sistema de estimativa/apontamento de horas (isso é `time_entries`/`estimates`, Fase 1E, seção 21), "carga" aqui é uma contagem de `Task` abertas (`status` fora de `CONCLUIDA`/`CANCELADA`) por `assigneeUserId` — calculada on-the-fly via `groupBy`, sem tabela própria. Simples, honesto sobre sua limitação, e útil o suficiente pra apontar sobrecarga óbvia.
- **`Task.assigneeUserId` já existia no schema desde a Release 1C parte 2** (Projetos/Tarefas), só não tinha UI. Reatribuição não tem tabela de histórico própria — usa o `AuditLog` genérico (`task.reassigned`), consistente com como outras mutações menores já são auditadas no projeto.
- **Só squad principal por cliente**: o manual permite "squad principal e especialistas" (pessoas avulsas além do squad). Modelamos só o principal (`ClientAllocation.squadId`); especialistas individuais ficam para quando houver caso real.

## Fornecedores — `Vendor`, `VendorOrder`

Implementa a seção 16 do manual (a parte de `vendors`/`vendor_orders`):

- **`VendorOrder.taskId` é opcional**: o manual descreve "tarefa externa gera ordem ao fornecedor", mas nem toda ordem nasce de uma tarefa já criada no sistema (às vezes é um pedido avulso). Quando vinculada, a ordem aparece também na tela do projeto/tarefa via relação reversa.
- **Bloquear fornecedor não apaga nem cancela ordens existentes** — só impede abrir novas (`POST /api/vendors/:id/orders` retorna 400 se `status = BLOQUEADO`). Mesmo princípio de preservar histórico usado em `ClientAllocation` e `OnboardingTemplate`.
- **`VendorOrderStatus` é um fluxo simples e próprio** (`solicitada → em andamento → concluída/cancelada`), separado de `WorkItemStatus` (Task/Project) — são conceitos diferentes: a ordem é o pedido *para fora*, a tarefa é o trabalho *interno*. Ligar os dois é opcional (`taskId`), não uma fusão de modelos.

## Conteúdo e aprovação — `ContentItem`, `ContentVersion`, `ContentApproval`, `ContentComment`, `ContentStatusHistory`

Implementa a seção 17 do manual (parcialmente — ver `docs/STATUS.md` para o que falta):

- **`ContentVersion` é o histórico de envios, `ContentApproval` é a decisão sobre um deles**: cada vez que a equipe sobe um novo material para revisão, isso é uma `ContentVersion` nova (não um `UPDATE` na anterior) — preserva o que exatamente foi aprovado ou rejeitado, mesmo depois de novas versões existirem.
- **`@@unique([contentVersionId])` em `ContentApproval`**: uma aprovação pertence a exatamente uma versão. Pedir ajustes numa versão não "reabre" a aprovação antiga para nova decisão — a próxima versão gera uma `ContentApproval` nova, com token novo. Isso torna impossível, por construção, um cliente aprovar a versão errada por engano num link antigo reaproveitado.
- **`ContentVersion.assetUrl` é link externo (Drive/Figma/Canva), não upload real**: mesma decisão pragmática já tomada para Contratos — upload de arquivo depende de escolher provedor de storage (S3/R2), ainda não decidido. Nada no schema impede trocar por um campo de arquivo interno depois; a coluna já é só uma URL.
- **Aprovação por link público (token), não portal do cliente com login**: o manual (seção 3.2) define o critério de saída da Fase 1D como "aprova por link **ou** portal" — o link satisfaz o critério sozinho. `ContentApproval.token` é um UUID único, com `expiresAt` (14 dias) e semântica de uso único garantida pelo próprio `status` (`PENDENTE` → `APROVADO`/`AJUSTES_SOLICITADOS`, nunca volta a `PENDENTE`). O ator da decisão é o cliente sem sessão — por isso `ContentStatusHistory.actorUserId` aceita `null` (já era opcional desde a Release 1C, reaproveitado aqui pela primeira vez com um autor real "externo").
- **`ContentStatus` tem 10 estados** cobrindo a cadeia inteira da seção 17 (`ideia → pauta → produção → revisão interna → aguardando cliente → ajustes → aprovado → agendado → publicado → arquivado`). `AGUARDANDO_CLIENTE` só é alcançado via `POST /api/content/:id/submit` (que também cria a `ContentApproval`) e só sai dali via a decisão registrada pelo próprio cliente no link — nenhuma rota interna pode pular esse passo.
- **Comentários são por `ContentItem`, não por versão**: uma discussão interna sobre a peça como um todo não precisa se reatar a cada nova versão. Mesmo padrão simples já usado em `RequestComment`.

## Portal do Cliente — sem tabela nova

Implementa (parte 1) a seção 18 do manual:

- **Nenhum model novo**: o portal reaproveita `Workspace(kind: CLIENT)` e os papéis `CLIENT_ADMIN`/`CLIENT_VIEWER` de `MembershipRole` — ambos existiam desde a Release 1A sem uso real. Um "usuário do portal" é só um `Membership` como qualquer outro, só que apontando pro workspace do cliente em vez do workspace interno da agência.
- **Convite e aceite 100% reaproveitados**: `/convite/[token]` e `POST /api/invites/accept` já eram genéricos o bastante (operam sobre `Membership` por `inviteToken`, sem assumir workspace/papel específico) — o único código novo foi a rota que *cria* o convite com `workspaceId` do cliente em vez do workspace do convidante (`POST /api/clients/:id/portal-invite`).
- **Roteamento por papel, não por subdomínio/app separado**: mesma sessão Better Auth para todo mundo. `(app)/layout.tsx` e `/portal/layout.tsx` decidem pra onde mandar o usuário olhando `membership.role` via `isClientRole()` (`lib/rbac.ts`). Mais simples que ter dois apps ou dois logins, e já é o suficiente pro "acessa somente seu workspace" do critério de aceite da seção 18.
- **Aprovação por sessão reaproveita a mesma regra do link público**: `applyApprovalDecision()` (`lib/content-approval.ts`) é chamada tanto por `/api/approvals/:token` (anônimo) quanto por `/api/portal/content/:id/decide` (autenticado) — a única diferença é o `actorUserId` (null vs. o usuário real) e o `actorType` no `AuditLog` (`"client"` vs. `"client_portal"`). O link público continua funcionando mesmo depois que o cliente ganha portal — não são mutuamente exclusivos, e o manual não pede que sejam.

## Solicitações via Portal — reaproveita `Request` sem mudança de schema

- **`Request.clientId`/`requesterName`/`requestedByUserId` já existiam desde a Release 1C** e já eram exatamente o que uma solicitação de portal precisa — o comentário antigo no schema ("ainda não há portal do cliente") ficou desatualizado com esta fatia, mas o modelo não precisou mudar nada. `POST /api/portal/requests` só força `clientId` a ser sempre o do próprio cliente (nunca vindo do corpo da requisição) e preenche `requesterName`/`requestedByUserId` com os dados reais da sessão.
- **Mesmo pipeline de triagem**: uma solicitação aberta pelo portal cai no mesmo inbox (`/operacao/demandas`), com o mesmo `RequestStatus` e as mesmas transições — não existe um "status especial de portal". A única diferença observável é o `AuditLog.actorType` (`"client_portal"` em vez de `"user"`).

## Comunicação e comentários — `CommentThread`, `Comment`, `CommentEdit`, `CommentMention`

Implementa a seção 19 do manual, substituindo `ContentComment` e `RequestComment` (removidos nesta fatia):

- **`entityType`/`entityId` são texto livre, não uma FK polimórfica**: Prisma não suporta relations polimórficas nativamente (não tem um equivalente limpo ao `polymorphic` do Rails). Guardar `entityType` como string fechada em código (`CommentEntityType` em `lib/comments.ts`) e validar posse manualmente (`resolveCommentableEntity`) é mais simples que modelar uma tabela de junção ou uma FK por tipo de entidade — e escala bem: adicionar uma entidade comentável nova é só uma linha a mais no union type e no `resolveCommentableEntity`, zero migration.
- **`@@unique([entityType, entityId])` em `CommentThread`**: força "uma thread por entidade" nesta fatia (mais simples que múltiplas threads paralelas por entidade, que o manual também não detalha como distinguir). A thread nasce sob demanda no primeiro comentário via `upsert`, não precisa ser criada antecipadamente.
- **Autor e menção guardam só `userId`, sem relation direta pro `User`**: resolver nome pra exibição é um join leve feito em `lib/comments.ts` (`loadCommentThreadView`), não no schema — evita uma FK que teria que sobreviver a `onDelete: SetNull` como em `Membership.userId`, e mantém `Comment`/`CommentMention` agnósticos de Better Auth.
- **`CommentEdit` é append-only, mesmo padrão de `*StatusHistory`**: cada edição E cada remoção gravam o texto anterior aqui antes de mudar o `Comment.body` — "edição mantém histórico" da seção 19 não é uma frase solta, é uma garantia de dado.
- **Remoção é tombstone, não `DELETE`**: `Comment.status = REMOVIDO` + `body` esvaziado, a linha continua existindo (preserva `threadId`/`authorUserId`/timestamps, e o texto original fica recuperável via `CommentEdit`). Consistente com o resto do projeto nunca apagar histórico de fato.
- **Menção por seletor de pessoas, não parsing de `@nome` no texto**: nomes compostos e coincidências tornam parsing de texto livre ambíguo sem uma gramática de menção real (ex.: `@[Nome](id)`, como Slack/Linear fazem por trás dos panos). Pra esta fatia, a UI oferece chips clicáveis dos membros da equipe — o resultado (`mentionedUserIds`) já chega estruturado na API, sem precisar interpretar texto.

## RH básico — `Employee`, `EmployeeStatusHistory`, `LeaveRequest`, `LeaveRequestStatusHistory`

Implementa a seção 20 do manual (parcialmente — ver `docs/STATUS.md` para o que falta):

- **`Employee` é deliberadamente separado de `Membership`**: `Membership` é acesso/login (RBAC), `Employee` é dado de contratação (cargo, data de admissão, status de vínculo). A mesma pessoa pode ter os dois (via `Employee.userId`, opcional e único) ou só o `Employee` (freelancer sem login) — nunca o contrário seria estranho (um `Membership` sem `Employee` correspondente é o caso comum hoje: qualquer membro de equipe convidado antes desta fatia).
- **`Employee.role` é texto livre, não uma tabela `positions`**: o manual lista "cargos" como entidade própria, mas sem um caso real pedindo listagem/gestão de cargos (filtros, relatórios por cargo), um campo de texto já cobre "saber o cargo de alguém" — mesma lógica pragmática usada em `ClientContact.role`.
- **Sem campo de salário**: a seção 20 exige "dados pessoais e salário usam permissões separadas" — em vez de modelar isso sem um caso de uso real (que permissão? quem vê o quê?), o dado simplesmente não existe ainda. Adicionar depois é uma migration aditiva, não uma mudança estrutural.
- **Desligamento é código, não trigger de banco**: a rota `POST /api/employees/:id/status` faz três coisas na mesma transação ao desligar — muda `Employee.status`, deleta as `Session` do `userId` vinculado, e suspende o(s) `Membership`(s) ativo(s) dessa pessoa (`status: SUSPENDED`, nunca deletado). Isso satisfaz "revoga sessões e preserva autoria histórica" literalmente: `Task.assigneeUserId`, `Comment.authorUserId`, `ContentVersion.createdByUserId` etc. continuam apontando pro mesmo `userId`, que nunca é removido.
- **Indisponibilidade é uma consulta, não um campo desnormalizado**: "afastado agora" não é uma coluna em `Employee` — é calculado a cada leitura via `LeaveRequest` com `status: APROVADA` e `startDate <= hoje <= endDate`. Evita o problema clássico de campo desnormalizado que fica dessincronizado (ex.: esquecer de zerar `afastado: true` quando a licença termina) — a fonte de verdade é sempre a `LeaveRequest`, nunca duplicada.

## Apontamento e produtividade — `Timesheet`, `TimesheetStatusHistory`, `TimeEntry`, `TimeEntryEdit`

Implementa a seção 21 do manual (parcialmente — ver `docs/STATUS.md`):

- **`Timesheet` é criado sob demanda, mesmo padrão de `CommentThread`**: não existe uma rotina que pré-cria folhas vazias toda semana — a primeira vez que alguém aponta horas numa semana, um `upsert` por `[userId, weekStart]` garante a folha certa (existente ou nova). `weekStart` é sempre a segunda-feira (UTC) da semana, calculada em código (`startOfWeekUTC`), não guardada de outra forma.
- **`TimeEntry.taskId` é opcional**: nem todo apontamento é sobre uma tarefa específica (reunião interna, suporte avulso). Quando existe, é o elo que permite comparar `Task.estimatedMinutes` com a soma dos `TimeEntry.minutes` daquela tarefa — a base do "estimado x realizado" pedido pela seção 21.
- **`TimeEntryEdit` é append-only, mesmo padrão de `CommentEdit`**: toda edição grava o valor anterior antes de mudar `TimeEntry.minutes`. A diferença em relação a comentários: aqui o `reason` é condicionalmente obrigatório — livre enquanto a folha é `RASCUNHO` (nada foi revisado ainda), obrigatório se a folha já foi `ENVIADA`/`APROVADA` (aí é uma correção de verdade, seção 21: "correção posterior guarda autor e motivo").
- **Editar um apontamento pós-envio muda `Timesheet.status` pra `CORRIGIDA` automaticamente**: em vez de deixar a folha aprovada com um número que não bate mais, qualquer edição depois do envio reabre o ciclo — a pessoa precisa reenviar (`CORRIGIDA → ENVIADA`) pra folha ser aprovada de novo com o valor certo.
- **Sem tabela `capacity_snapshots` nem `productivity_metrics`**: o manual lista essas entidades pra guardar fotos de capacidade e métricas de qualidade/prazo/produtividade. "Capacidade" (`/pessoas/capacidade`) é uma consulta ao vivo (`groupBy` de `TimeEntry.minutes` por `userId` na semana) — mesmo princípio já usado pra disponibilidade de RH (nunca desnormalizar o que pode ser calculado). Métricas de produtividade "saudável" (qualidade, prazo, volume ponderado) ficaram de fora — o manual avisa explicitamente "sem ranking simplista de pessoas", e modelar isso sem um caso real de uso corre o risco de virar exatamente o ranking simplista que a seção quer evitar.
- **`Task.estimatedMinutes` é opcional e vive no próprio `Task`, não numa tabela `estimates` separada**: o manual lista `estimates` como entidade própria, mas nesta fatia uma tarefa tem no máximo uma estimativa ativa (não um histórico de reestimativas) — um campo simples já cobre o critério de aceite. Se surgir a necessidade de rastrear mudanças de estimativa ao longo do tempo, isso vira uma tabela então.

## Financeiro básico manual — `FinanceCategory`, `FinanceEntry`, `FinanceEntryStatusHistory`

Implementa a seção 22 do manual (parcialmente — ver `docs/STATUS.md`):

- **`FinanceEntry.type` compartilhado entre receita e despesa, mesmo truque de `WorkItemStatus`**: em vez de duas tabelas quase idênticas (`payables`/`receivables`, como o manual sugere), um único model com `type: RECEITA | DESPESA` e rótulos de status que mudam conforme o tipo (`LIQUIDADO` vira "Recebido" ou "Pago" só na camada de apresentação, `lib/finance.ts`). Menos duplicação, mesma tabela de índices/relations pra manter.
- **`amountCents` é `Int`, nunca `Float`**: dinheiro em centavos evita todo o problema de arredondamento de ponto flutuante — convenção que qualquer módulo financeiro futuro (Fase 2, Asaas) deve seguir.
- **Três datas com significados diferentes, nunca uma reaproveitada** (regra obrigatória da seção 22 — "separar competência, vencimento e liquidação"): `competencyDate` (a que mês/período o lançamento pertence), `dueDate` (quando vence), `settledDate` (quando foi liquidado de verdade, só preenchido ao chegar em `LIQUIDADO`). O fluxo de caixa (`/financeiro/caixa`) usa `competencyDate` pra "previsto" e `settledDate` pra "realizado" — é exatamente por essa separação existir que a página consegue mostrar as duas visões lado a lado.
- **Estorno é auto-relacionamento com valor negativo, não edição nem "desfazer"**: `reversalOfId` (único — um lançamento só pode ser estornado uma vez) aponta pro lançamento original; o estorno em si já nasce `LIQUIDADO` com `amountCents` negativo. Somar o original + o estorno em qualquer agregação (`visão geral`, `fluxo de caixa`) já cancela o efeito automaticamente, sem precisar de lógica condicional de "ignorar lançamentos estornados" espalhada pelo código — a regra obrigatória "valores são imutáveis após conciliação" vira uma trava de aplicação (nenhuma rota edita um `FinanceEntry` já `LIQUIDADO`) mais essa modelagem que resolve a matemática sozinha.
- **"Vencido" nem sempre é um status gravado**: a UI calcula "está vencido" ao vivo (`PENDENTE` com `dueDate` no passado) pra colorir o badge, mesmo padrão já usado pra disponibilidade de RH e capacidade de squad — nunca desnormalizar o que dá pra calcular na leitura. `VENCIDO` como status gravado no enum continua existindo pra quem quiser marcar formalmente (ex.: pra relatório), mas não é obrigatório passar por ele visualmente.
- **Sem `financial_accounts` nem `cost_centers`**: o manual lista essas entidades, mas pra uma agência pequena nesta fase, cliente e projeto já segmentam o suficiente — não modelamos "contas bancárias" (nenhuma reconciliação bancária real ainda, isso é Fase 2/Asaas) nem centro de custo separado.

## Decisões de modelagem que não são óbvias pelo schema

- **Sem `outbox_events` ainda**: a Release 1A não tem nenhum efeito colateral assíncrono que justifique o padrão outbox (nada consome eventos de domínio ainda). Ele entra na Release 1B junto com a primeira automação real (ex.: ativar cliente cria estrutura). Ver `docs/DECISIONS.md`.
- **RBAC é enum, não tabela `role`/`permission`**: a Release 1A implementa os 8 papéis fixos do manual (seção 7.1) como `enum MembershipRole`, não como templates configuráveis em tabela. Overrides de permissão por usuário (mencionados no manual) ficam para quando houver um caso de uso real pedindo granularidade além do papel.
- **`Membership.workspaceId` é obrigatório (não nulo)**: cada convite/vínculo é sempre a um workspace específico, nunca "a agência inteira" de forma abstrata. Acesso amplo a todos os workspaces de uma agência é uma questão de RBAC (papel `AGENCY_ADMIN`/`SUPER_ADMIN`), não de ausência de `workspaceId`.
- **Dependência de checklist é sequencial por `order`, não um grafo**: o manual diz "itens podem depender de outros" (seção 11) sem especificar a forma. Implementamos o caso mais comum (item N depende do N-1) em vez de um grafo arbitrário de dependências — mais simples de construir e de usar, e cobre o fluxo real de onboarding (boas-vindas → acessos → briefing → kickoff). Se surgir um caso real de dependência não-linear, evolui para grafo então.
- **Template de onboarding é semeado automaticamente no signup**: em vez de deixar a agência sem nenhum template (tela vazia) ou construir uma UI de configuração de templates nesta fatia, o `/api/agencies` já cria um `OnboardingTemplate` padrão com 4 itens. Gerenciar/customizar templates fica para quando houver demanda real (múltiplos pacotes de serviço, seção 12).
