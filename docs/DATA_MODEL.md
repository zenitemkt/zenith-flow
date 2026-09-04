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

## Decisões de modelagem que não são óbvias pelo schema

- **Sem `outbox_events` ainda**: a Release 1A não tem nenhum efeito colateral assíncrono que justifique o padrão outbox (nada consome eventos de domínio ainda). Ele entra na Release 1B junto com a primeira automação real (ex.: ativar cliente cria estrutura). Ver `docs/DECISIONS.md`.
- **RBAC é enum, não tabela `role`/`permission`**: a Release 1A implementa os 8 papéis fixos do manual (seção 7.1) como `enum MembershipRole`, não como templates configuráveis em tabela. Overrides de permissão por usuário (mencionados no manual) ficam para quando houver um caso de uso real pedindo granularidade além do papel.
- **`Membership.workspaceId` é obrigatório (não nulo)**: cada convite/vínculo é sempre a um workspace específico, nunca "a agência inteira" de forma abstrata. Acesso amplo a todos os workspaces de uma agência é uma questão de RBAC (papel `AGENCY_ADMIN`/`SUPER_ADMIN`), não de ausência de `workspaceId`.
- **Dependência de checklist é sequencial por `order`, não um grafo**: o manual diz "itens podem depender de outros" (seção 11) sem especificar a forma. Implementamos o caso mais comum (item N depende do N-1) em vez de um grafo arbitrário de dependências — mais simples de construir e de usar, e cobre o fluxo real de onboarding (boas-vindas → acessos → briefing → kickoff). Se surgir um caso real de dependência não-linear, evolui para grafo então.
- **Template de onboarding é semeado automaticamente no signup**: em vez de deixar a agência sem nenhum template (tela vazia) ou construir uma UI de configuração de templates nesta fatia, o `/api/agencies` já cria um `OnboardingTemplate` padrão com 4 itens. Gerenciar/customizar templates fica para quando houver demanda real (múltiplos pacotes de serviço, seção 12).
