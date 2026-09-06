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

## Health Score — `HealthScoreSnapshot`

Implementa a seção 30 do manual:

- **Append-only, como todo `*StatusHistory` do projeto**: cada `POST .../recalculate` grava uma linha nova, nunca faz `UPDATE` num snapshot existente. "Health Score atual" é sempre a linha mais recente por `clientId` (`ORDER BY createdAt DESC LIMIT 1`) — o histórico completo de evolução do score já existe de graça, sem esforço extra, do mesmo jeito que `ClientStatusHistory` guarda toda mudança de status.
- **`breakdown` é `Json`, não uma tabela `health_factors` normalizada**: o manual descreve fatores por dimensão, mas nada no produto hoje precisa consultar/filtrar por fator individual entre clientes (ex.: "todos os clientes com pontualidade < 50%") — só precisa exibir o breakdown de um cliente por vez. Normalizar isso agora seria estrutura sem uso real; se um caso de uso de consulta cross-cliente por fator aparecer, essa é a migração natural.
- **Só 3 dimensões calculadas** (`financeiro`, `entregas`, `aprovacoes`) das 7 do manual, pesos renormalizados de 20/20/10 (base 100 com as outras 4) para 40/40/20 (base 100 só com essas 3). As 4 restantes (Relacionamento, Satisfação, Resultados, Contrato) aparecem como texto em `breakdown.pendente`, não como campos de score fictícios — não existe hoje uma fonte de dado real para elas (NPS/CSAT não modelado, contrato é só link de Drive).
- **Score neutro (75) em vez de 0 ou exclusão quando falta dado**: um cliente sem nenhuma fatura liquidada/vencida, ou sem nenhuma tarefa concluída/bloqueada no período de lookback (180 dias), recebe 75 ("Saudável") naquela dimensão em vez de 0 ("Alto risco") — a ausência de sinal não deveria empurrar um cliente novo para o alto risco. `hasData: false` no breakdown marca isso explicitamente para a UI mostrar "Sem dado suficiente ainda" em vez de fingir precisão.
- **`modelVersion`** (`"v1-financeiro-entregas-aprovacoes"`) grava, por snapshot, qual fórmula gerou aquele score — necessário porque a fórmula vai mudar (adicionar dimensões, ajustar pesos) e snapshots antigos precisam continuar interpretáveis no contexto da versão que os gerou, não da versão atual.
- **`apps/web/lib/dates.ts`** (novo módulo, nasceu desta fatia): centraliza `endOfDayUTC`/`startOfDayUTC`/`isPastDueDate` — qualquer comparação entre um `dueDate` (sempre meia-noite UTC do dia escolhido num `<input type="date">`) e um timestamp com hora real (`settledDate`, `completedAt`, `now()`) deve passar por aqui, nunca comparar os dois diretamente. Ver `docs/DECISIONS.md` para o bug real que motivou isso.

## Risco de churn e retenção — `ChurnRiskSnapshot`, `RetentionPlan`, `RetentionPlanStatusHistory`

Implementa a seção 31 do manual:

- **`ChurnRiskSnapshot` é append-only, mesmo padrão do `HealthScoreSnapshot`** — cada recálculo grava uma linha nova. A diferença de modelo está em `signals` (JSON) vs. `breakdown`: aqui cada sinal carrega um `weight` fixo somado quando `triggered`, sem normalização por peso relativo — reflete literalmente a tabela "Sinal / Exemplo de peso" da seção 31, que é aditiva, não uma média ponderada como o Health Score.
- **`band` é uma coluna própria** (`ChurnRiskBand`), diferente do Health Score onde a banda é sempre recalculada a partir do score na hora de exibir (`bandForScore`) e nunca persistida. Aqui optei por persistir porque o corte de banda é uma decisão nossa (o manual não define números), não uma fórmula do domínio — gravar a banda junto do score no momento do cálculo evita que uma mudança futura nos cortes reescreva silenciosamente o "risco" histórico de snapshots antigos.
- **`RetentionPlan.responsibleUserId` e `createdByUserId` são `String` simples, sem relation formal ao `User`** — mesmo padrão pragmático já usado em `Task.assigneeUserId`; o nome do responsável é resolvido em memória via `getAgencyMembers()` na hora de exibir, não via `include` do Prisma.
- **`RetentionPlanStatusHistory` é append-only**: concluir ou cancelar um plano nunca apaga a linha `ATIVO` original — a seção 31.1 pede "responsável, prazo, próxima revisão e **resultado**", e o resultado só é aceito na transição pra `CONCLUIDO` (validado na API, não no schema — `result` é opcional no banco porque um plano `ATIVO` legitimamente ainda não tem resultado).

## Régua de cobrança — `FinanceEntry.collectionTaskId`

Implementa a seção 28 do manual:

- **Sem tabela própria de "estágio da régua"**: o estágio (D-5/D0/D+1/D+3/D+7/D+15) é sempre derivado na hora, a partir de `FinanceEntry.dueDate` vs. a data atual (`apps/web/lib/collection-ladder.ts`), nunca persistido. Diferente do `ChurnRiskSnapshot.band` (persistido porque representa uma decisão pontual no tempo), o estágio da régua muda todo dia sozinho conforme o atraso cresce — persistir um valor que fica errado no dia seguinte seria pior que recalcular.
- **`collectionTaskId String? @unique` + relação com `Task`**: é a mesma família de padrão de idempotência usado em `RoutineRun.period` (`@@unique`) e `MediaAsset.key` (`@unique`) — aqui a garantia é "no máximo uma tarefa de cobrança por lançamento". `onDelete: SetNull` na FK: apagar a tarefa (ex.: limpeza manual) nunca apaga o lançamento financeiro, só desfaz o vínculo, permitindo gerar uma nova tarefa depois.
- **Projeto "Cobrança" é find-or-create por cliente (ou por agência, quando o lançamento não tem cliente)**: em vez de um projeto novo por tarefa (como as Rotinas fazem, onde cada geração é logicamente distinta) ou um projeto novo por lançamento, aqui um único projeto "Cobrança" por cliente acumula todas as tarefas de cobrança daquele cliente ao longo do tempo — mais parecido com o padrão de "Arquivos"/"Biblioteca" (um bucket estável) do que com Rotinas.

## NPS — `SurveyCampaign`, `SurveyRecipient`, `NpsSnapshot`, `ClientContact.marketingOptOut`

Implementa a seção 32.1 do manual (eNPS, seção 32.1 também, fica fora desta fatia — ver `docs/DECISIONS.md`):

- **Resposta mora na própria `SurveyRecipient`, não numa tabela `survey_responses` separada** (diferente do que a seção 45.2 lista): para NPS de cliente, é sempre 1 destinatário = no máximo 1 resposta — não existe o cenário de "múltiplas respostas por convite" que justificaria uma tabela à parte. Mesmo raciocínio já aplicado a `HealthScoreSnapshot.breakdown` (JSON em vez de tabela normalizada) — simplificação documentada, não uma omissão.
- **`NpsSnapshot` é append-only, sempre relativo a uma campanha** (`campaignId` obrigatório), não um rollup histórico da agência inteira ao longo de várias campanhas — cada campanha tem seu próprio NPS bem definido; combinar várias campanhas num único "NPS da agência ao longo do tempo" é um problema de cohort (seção 32.2), ainda não construído.
- **`ClientContact.marketingOptOut`**: novo campo, único jeito de implementar de verdade "contatos com opt-out não recebem marketing" (seção 32.3) — sem UI de edição de contato ainda (mesma pendência conhecida desde a Release 1B: só dá pra adicionar contato, não editar um existente), então hoje só é possível marcar opt-out diretamente no banco. Documentado como pendência de UI, não do modelo.
- **`SurveyRecipient.email`/`contactName` são cópias no momento do envio, não uma referência viva a `ClientContact`**: se o contato mudar de e-mail depois, a campanha já criada continua mostrando pra quem foi enviada de fato — mesmo princípio de "snapshot no momento do evento" já usado em outras entidades de histórico do projeto (ex.: `MediaAsset.fileName`).

## eNPS — `EnpsCampaign`, `EnpsInvite`, `EnpsResponse`, `EnpsSnapshot`

Implementa a seção 32.1 do manual (a parte de eNPS deixada de fora da fatia de NPS de clientes):

- **A diferença estrutural fundamental em relação a `SurveyRecipient` (NPS de clientes)**: lá, resposta e destinatário são a mesma linha (`score`/`comment` na própria `SurveyRecipient`) porque não há requisito de anonimato. Aqui são **três tabelas deliberadamente desconectadas**: `EnpsInvite` (quem foi convidado, token, se já respondeu — nunca a nota), `EnpsResponse` (a nota e o comentário — sem nenhuma FK pra `EnpsInvite` ou `Employee`), e `EnpsCampaign` (o que amarra as duas por `campaignId`, nunca por pessoa). Isso implementa literalmente "resultado de equipe não pode expor respondente quando anonimato for prometido" — não como uma regra de exibição que alguém poderia contornar consultando o banco direto, mas como uma garantia que o próprio schema não permite quebrar (não existe coluna pra fazer esse join).
- **Limite honesto do anonimato, documentado e não escondido**: numa campanha com pouquíssimos respondentes (ex.: 2 de 10 convidados responderam), ainda é tecnicamente possível inferir quem respondeu por correlação de horário entre `EnpsInvite.respondedAt` e `EnpsResponse.createdAt` — a mesma limitação de qualquer pesquisa "anônima" do mundo real com N pequeno. O schema garante que **a identidade nunca é armazenada**, não que a anonimato estatístico é perfeito contra esse tipo de inferência.
- **Acesso restrito via RBAC, não via schema**: diferente do anonimato (que é estrutural), "acesso é restrito" é uma regra de aplicação (`canViewEnps()` em `lib/rbac.ts`, checada em toda rota e página) — `SUPER_ADMIN`/`AGENCY_ADMIN`/`HR` apenas. Um Gestor ou Analista não vê `/pessoas/enps` nem consegue chamar as rotas de API diretamente.
- **Reaproveita a fórmula do NPS de clientes** (`computeNpsBreakdown` de `lib/nps.ts`, reexportada como `computeEnpsBreakdown` em `lib/enps.ts`) — mesma matemática (% promotores − % detratores), sem duplicar código só porque o público é diferente.

## Cohort — sem tabela nova, tudo derivado

Implementa a seção 32.2 do manual:

- **Nenhum modelo novo**: cohort é 100% derivado de `Client`, `ClientStatusHistory` (pra saber o mês de ativação e se/quando foi encerrado) e `FinanceEntry` (receita liquidada por mês) — calculado sob demanda em `apps/web/lib/cohort.ts`, nunca persistido. Diferente de `HealthScoreSnapshot`/`ChurnRiskSnapshot`/`NpsSnapshot` (que fazem sentido persistir porque representam uma decisão/cálculo pontual auditável no tempo), um cohort é só uma reagregação dos mesmos dados brutos — persistir traria o risco de ficar desatualizado sem ninguém perceber.
- **A lógica assume histórico de status estritamente cronológico** (`ClientStatusHistory.createdAt` sempre crescente por cliente, nunca editado) — é uma garantia real do sistema em produção (`createdAt` é `@default(now())`, nunca há rota que o edite), então o cálculo de "qual era o status do cliente num mês de referência" (`statusAsOf` em `lib/cohort.ts`) pode confiar em iterar em ordem e pegar o último evento até aquele ponto. Isso só quebraria se algo backdatasse uma linha de histórico manualmente — o que não existe em nenhuma rota do produto (só aconteceu de propósito no smoke test, pra simular múltiplos meses sem esperar meses de verdade).
- **Só a dimensão "mês de início" está implementada** — "canal" e "produto" (também citados na seção 32.2) não têm campo nenhum no schema hoje; "squad" existe (`ClientAllocation`) mas uma segunda dimensão de agrupamento fica pra quando houver um caso de uso real pedindo, mesma régua pragmática do Health Score.

## Reativações — `Client.competitorName`, `Client.reactivationEligible`

Implementa a seção 32.3 do manual:

- **Só dois campos novos, direto em `Client`, sem tabela própria**: `competitorName` (opcional) e `reactivationEligible` (boolean, default `true`) — não precisam de histórico próprio (diferente de status, que já tem `ClientStatusHistory`), então viraram colunas simples, mesmo padrão pragmático de `ClientContact.marketingOptOut`.
- **"Motivo" e "última nota" não precisaram de nada novo**: motivo já é `ClientStatusHistory.reason` (capturado obrigatoriamente na transição pra `EM_ENCERRAMENTO`, não em `ENCERRADO`); última nota é só a `ClientNote` mais recente do cliente. Reaproveitar dado que já existe em vez de duplicá-lo em campos novos.
- **"MRR perdido" foi deliberadamente deixado de fora**: mesmo bloqueio da seção 29 (indicadores financeiros) — sem um modelo de receita recorrente/contrato, não há "MRR" real pra perder, só uma aproximação inventada a partir de lançamentos avulsos.

## Indicadores financeiros — sem tabela nova

Implementa (parcialmente) a seção 29 do manual:

- **Nenhum modelo novo, mesmo raciocínio do Cohort**: DSO e Logo churn são derivados sob demanda de `FinanceEntry` e `ClientStatusHistory` já existentes (`apps/web/lib/finance-indicators.ts`), nunca persistidos — são recálculos, não decisões pontuais que mereçam virar snapshot como Health Score/Churn Risk/NPS.
- **`statusAsOf()` foi promovida de helper privado de `lib/cohort.ts` pra função exportada**, reaproveitada aqui pra "este cliente estava ativo nesta data de referência?" — mesmo problema que o Cohort já resolvia, evitando duplicar a lógica de "última transição de status até uma data".

## Leads — `Lead`, `LeadStatusHistory`, `LeadNote`

Implementa a seção 39 do manual (abre a Fase 3):

- **`@@unique([agencyId, email])` é a garantia real de duplicidade** (seção 39.1: "e-mail normalizado é chave primária operacional") — não é só uma checagem em código, é uma constraint do banco. `email` é sempre normalizado (`lib/leads.ts`, `normalizeEmail()`) antes de gravar. Postgres permite múltiplos `NULL` na coluna de uma unique constraint, então leads sem e-mail nunca colidem entre si.
- **`Lead.convertedClientId` é `@unique`, não uma lista**: um lead só pode gerar um cliente (não faz sentido um lead virar dois clientes). `onDelete: SetNull` — apagar o `Client` convertido não apaga o histórico do lead, só desfaz o link.
- **Mesmo padrão de `ClientStatusHistory`/`ClientNote`**: `LeadStatusHistory` (append-only) e `LeadNote` espelham exatamente os equivalentes de `Client` — é literalmente o mesmo problema (timeline de um registro que muda de estado ao longo do tempo), resolvido com o mesmo desenho, sem inventar nada novo.
- **Sem `tags`, `consentimentos`, `score` ou `oportunidades` nesta fatia** (todos citados na seção 39 como parte do "Lead 360"): tags e consentimento não têm um caso de uso real ainda pedindo; score (seção 39.2) precisaria de uma tabela `score_events` e um job de decaimento periódico — mesmo bloqueio de "sem `apps/worker` ainda" de outras partes do sistema; oportunidades dependem do Pipeline (seção 39, "Opportunity"), que é a próxima fatia natural de CRM, ainda não construída.

## Pipeline comercial — `PipelineStage`, `Opportunity`, `OpportunityStatusHistory`

Implementa a seção 39 do manual (parte "Opportunity"):

- **`PipelineStage` é uma tabela, não um enum** — ao contrário de `WorkItemStatus`/`ClientStatus`/`LeadStatus` (cadeias de estado fixas do manual), a seção 39 pede explicitamente "custom pipeline": cada agência define seus próprios estágios. `@@unique([agencyId, order])` garante que não existam dois estágios disputando a mesma posição na mesma agência.
- **`Opportunity.status` (OPEN/WON/LOST) é separado de `stageId`**: o estágio é só "onde no funil", sempre um `PipelineStage` `OPEN`; ganhar ou perder não é "mais um estágio da lista", é uma transição de status própria (mesmo raciocínio de `ClientStatus.ENCERRADO` não ser "mais uma etapa do onboarding"). Isso também explica por que `OpportunityStatusHistory.toStageId` é opcional — uma linha de histórico pode representar só uma mudança de estágio (status continua `OPEN`) ou só uma mudança de status (`toStageId` nulo, `toStatus` vira `WON`/`LOST`).
- **`clientId` e `leadId` são independentes, ambos opcionais**: uma oportunidade nem sempre nasce de um lead (cliente já ativo pedindo mais um serviço) nem sempre tem um cliente (ainda é só um lead sendo trabalhado). Não modelei como "XOR" no schema — a UI decide qual vínculo faz sentido pra cada caso, sem o banco impor uma regra que a seção 39 não pede.
- **Estágios padrão semeados na mesma transação do signup** (`api/agencies/route.ts`), mesmo padrão do `OnboardingTemplate` — uma agência nova nunca começa com um pipeline vazio precisando de configuração antes do primeiro uso.

## Propostas — `Proposal`, `ProposalStatusHistory`

Implementa a seção 39 do manual (parte "Proposal", fecha a seção):

- **Quarta aparição do mesmo padrão de link público** neste projeto (depois de `ContentApproval`, `SurveyRecipient` e `EnpsInvite`): `token` único, `expiresAt` calculado no envio, decisão registrada via rota pública sem sessão. Reaproveitei o TTL de 14 dias de `ContentApproval` em vez de inventar um novo prazo.
- **`status` cobre "visualizada" como transição real, não como um campo `viewedAt` isolado**: a página pública, ao carregar, transiciona `ENVIADA → VISUALIZADA` (gravando `viewedAt` e uma linha em `ProposalStatusHistory`) — dá pra responder "quando exatamente o cliente abriu isso" com uma consulta simples no histórico, não só "ele abriu alguma vez".
- **`EXPIRADA` é alcançável de duas formas**: calculada ao vivo (`isProposalExpired()`, compara `expiresAt` contra a data atual, mesmo padrão de `ContentApproval` em `/aprovar/[token]`) *e* como uma transição manual real gravada no banco (`POST /api/proposals/:id/expire`) — a diferença importa porque só a segunda persiste; a primeira é sempre recalculada, nunca escrita, evitando depender de um job pra "ficar certa" no tempo.
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

## Arquivos e biblioteca — `MediaAsset`

Implementa as seções 9.3 (Arquivos) e 17 (Biblioteca, parte da Conteúdo) do manual:

- **Um único model pras duas necessidades**: "arquivo do cliente" e "item de biblioteca de conteúdo" são, na prática, a mesma coisa — um arquivo com metadado, dono (agência) e opcionalmente um cliente. Em vez de duas tabelas quase idênticas, `MediaAsset.clientId` (opcional) é o que diferencia: com cliente, aparece em `/clientes/[id]` e `/clientes/arquivos`; sem ou com cliente, aparece em `/conteudo/biblioteca` (que lista tudo, filtrável).
- **`key` é o dado permanente; a URL nunca é guardada**: o bucket R2 é privado, então a única forma seria guardar uma URL assinada — mas essas expiram. Guardamos só a `key` (`@@unique`, nunca colide) e geramos uma URL assinada nova a cada download, por trás de um redirect estável (`GET /api/media/:id`). O link que aparece pro usuário nunca muda; o destino por trás, sim.
- **`onDelete: SetNull` em `clientId`, `Cascade` em `agencyId`**: apagar um cliente não apaga os arquivos dele (útil demais pra perder por engano) — só desvincula. Apagar a agência inteira (só acontece em teste, nunca em uso real) apaga tudo, mesmo padrão de todo o resto do schema.

## Decisões de modelagem que não são óbvias pelo schema

- **Sem `outbox_events` ainda**: a Release 1A não tem nenhum efeito colateral assíncrono que justifique o padrão outbox (nada consome eventos de domínio ainda). Ele entra na Release 1B junto com a primeira automação real (ex.: ativar cliente cria estrutura). Ver `docs/DECISIONS.md`.
- **RBAC é enum, não tabela `role`/`permission`**: a Release 1A implementa os 8 papéis fixos do manual (seção 7.1) como `enum MembershipRole`, não como templates configuráveis em tabela. Overrides de permissão por usuário (mencionados no manual) ficam para quando houver um caso de uso real pedindo granularidade além do papel.
- **`Membership.workspaceId` é obrigatório (não nulo)**: cada convite/vínculo é sempre a um workspace específico, nunca "a agência inteira" de forma abstrata. Acesso amplo a todos os workspaces de uma agência é uma questão de RBAC (papel `AGENCY_ADMIN`/`SUPER_ADMIN`), não de ausência de `workspaceId`.
- **Dependência de checklist é sequencial por `order`, não um grafo**: o manual diz "itens podem depender de outros" (seção 11) sem especificar a forma. Implementamos o caso mais comum (item N depende do N-1) em vez de um grafo arbitrário de dependências — mais simples de construir e de usar, e cobre o fluxo real de onboarding (boas-vindas → acessos → briefing → kickoff). Se surgir um caso real de dependência não-linear, evolui para grafo então.
- **Template de onboarding é semeado automaticamente no signup**: em vez de deixar a agência sem nenhum template (tela vazia) ou construir uma UI de configuração de templates nesta fatia, o `/api/agencies` já cria um `OnboardingTemplate` padrão com 4 itens. Gerenciar/customizar templates fica para quando houver demanda real (múltiplos pacotes de serviço, seção 12).

## DRE gerencial — `FinanceCategory.nature`

Implementa a seção 26.1/26.2 do manual:

- **`nature` é uma segunda dimensão da categoria, independente de `type`**: `type` (RECEITA/DESPESA) já existia e decide o sinal do lançamento no caixa; `nature` (`FinanceCategoryNature`) decide em qual linha do DRE ele entra — as duas coisas respondem perguntas diferentes. Um imposto, por exemplo, é `type: DESPESA` (sai dinheiro do caixa) mas `nature: IMPOSTO_DEDUCAO` (reduz a receita bruta na demonstração, não é "mais uma despesa operacional").
- **Migração com backfill de categorias existentes**: a coluna nasceu com `@default(DESPESA_OPERACIONAL)` (suposição mais razoável sem dado histórico), e a migration incluiu um `UPDATE` explícito pra corrigir categorias `type: RECEITA` já existentes pra `nature: RECEITA` (o default genérico não fazia sentido pra elas).
- **`lib/dre.ts` não persiste nada — é sempre um recálculo sob demanda**, mesmo raciocínio do Cohort e dos Indicadores Financeiros (DSO/Logo churn): a demonstração é uma reagregação de dado que já existe (`FinanceEntry` + `FinanceCategory.nature`), não uma decisão pontual que precise de histórico próprio.
- **Lançamento sem categoria cai no padrão por tipo** (`effectiveNature()` em `lib/dre.ts`): Receita sem categoria vira receita bruta, Despesa sem categoria vira despesa operacional — em vez de desaparecer do relatório, que seria mais confuso e mais fácil de esconder um problema real de categorização.

## Portal do Cliente — Arquivos e Financeiro (sem tabela nova)

Implementa a seção 18 do manual (fecha a "parte 2" da pendência registrada na Release 1D):

- **Nenhum modelo novo** — `/portal/arquivos` e `/portal/financeiro` são leituras filtradas de `MediaAsset` e `FinanceEntry` que já existiam, sempre `WHERE clientId = <cliente do portal>`.
- **A garantia de isolamento entre clientes mora na rota de download (`GET /api/media/:id`), não só na query da página que lista os arquivos**: antes desta fatia, essa rota rejeitava qualquer sessão de papel de cliente (`isClientRole`) por completo — mesmo pra baixar o próprio arquivo. Agora ela resolve o `Client` da sessão (via `Membership.workspaceId`) e só libera o presign quando `asset.clientId` bate com esse cliente. Qualquer outro caso (arquivo de outro cliente, ou item de biblioteca com `clientId: null`) devolve **404, não 403** — um cliente nunca deve saber que um recurso existe se não é dele.
- **`/portal/financeiro` só consulta `type: RECEITA`**, nunca `DESPESA` — implementa ao pé da letra a regra obrigatória "custo/margem internos nunca aparecem" (seção 18). Não existe uma versão "financeiro completo" pro portal, de propósito.

## Edição/remoção de contato de cliente e remoção de membro de squad (sem tabela nova)

- **Nenhum modelo novo** — `PATCH`/`DELETE` sobre `ClientContact` e `DELETE` sobre `SquadMember`, ambos já existentes desde a Release 1B/1C.
- **Exclusividade de "contato principal" é garantida na rota, não numa constraint de banco**: marcar `isPrimary: true` roda, na mesma transação, um `updateMany` que desmarca qualquer outro contato principal do mesmo cliente antes de aplicar a mudança pedida — não existe uma constraint parcial única no schema para isso (o ganho não justificava a complexidade).
- **Remover `SquadMember` é a exclusão da linha do vínculo, e só dela** — `Task.assigneeUserId`, o histórico de carga e `ClientAllocation` não têm nenhuma referência a `SquadMember`, então não há nada em cascata pra decidir aqui.

## Reordenar `PipelineStage` (sem tabela nova)

- **`@@unique([agencyId, order])` já existia** — trocar a posição de dois estágios exige passar por um valor temporário (`order: -1`) dentro de uma transação, já que duas linhas não podem compartilhar `order` nem por um instante. Ver `docs/DECISIONS.md`.
- **Só troca com o vizinho imediato** — a rota não aceita "mover para a posição N", só "esquerda"/"direita" a partir da posição atual.

## Onboarding cross-cliente — `/clientes/onboarding` (sem tabela nova)

- **Nenhum modelo novo** — a página agrega `OnboardingRun`/`OnboardingItem` (existentes desde a Release 1B) por cliente, pegando só a última `OnboardingRun` de cada um (`orderBy: startedAt desc, take: 1`), mesmo critério já usado no perfil individual do cliente.
- **"Progresso" é sempre um recálculo sob demanda** (itens concluídos ÷ total), nunca persistido — mesmo raciocínio de Cohort/DSO/DRE: é uma reagregação de dado que já existe, não uma decisão pontual.

## Converter comentário em tarefa/demanda — `Comment.convertedTaskId`/`convertedRequestId`

Implementa a regra obrigatória da seção 19: "mensagem pode virar demanda/tarefa apenas por usuário autorizado". Ver `docs/DECISIONS.md`.

- **Duas colunas únicas com FK real, não um par polimórfico genérico** — mesma escolha já feita em `Request.convertedTaskId`/`Lead.convertedClientId`/`FinanceEntry.collectionTaskId`: `convertedTaskId` aponta pra `Task`, `convertedRequestId` aponta pra `Request`, cada um `@unique` (uma Task/Request só pode ser o destino de uma conversão).
- **Reverse fields `Task.sourceComment`/`Request.sourceComment`** — mesmo padrão de `Task.sourceRequest` (a Task que veio da conversão de uma Request).
- **Migração aplicada via `prisma migrate diff` + `migrate deploy` manual**, não `migrate dev`: a nova constraint única numa tabela existente dispara um aviso de confirmação que trava em ambiente não-interativo. Ver `docs/DECISIONS.md`.
