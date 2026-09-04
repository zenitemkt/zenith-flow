# Decisões — ZENITH FLOW

## 2026-09-04 — Conteúdo: aprovação por link público, não portal do cliente com login

**Contexto**: a seção 17 do manual pede um fluxo de aprovação de conteúdo pelo cliente. A seção 3.2 (critério de saída da Fase 1D) diz explicitamente "cliente aprova por link **ou** portal" — ou seja, o próprio manual já prevê o link como alternativa válida, não como atalho informal. Construir o Portal do Cliente completo (seção 18: login próprio, histórico consolidado, múltiplas telas) é um projeto bem maior que esta fatia.

**Decisão**: implementar `ContentApproval` com token público (`/aprovar/[token]`), sem exigir login — página server-side que valida token existe, está `PENDENTE` e não expirou (14 dias), e permite Aprovar ou Solicitar ajuste (com nota obrigatória). Cada versão do conteúdo tem sua própria aprovação (`@@unique(contentVersionId)`), então um link antigo nunca pode ser reaproveitado para aprovar uma versão diferente da que foi enviada.

**Consequência**: o critério de saída da Fase 1D já está satisfeito por este mecanismo sozinho. O Portal do Cliente com login (seção 18) continua no roadmap como iniciativa própria — quando for construído, pode conviver com o link público (nem toda agência vai querer dar login a todo cliente) em vez de substituí-lo. `docs/STATUS.md` documenta isso como parcial, não como pendência bloqueante da Fase 1D.

## 2026-09-04 — Contratos: link fixo pro Google Drive, não o modelo do manual

**Contexto**: a seção 12 do manual descreve um módulo completo de Contratos (catálogo de produtos, versionamento, ativação gerando estrutura operacional). O usuário decidiu explicitamente não construir isso agora — prefere manter contratos organizados no Google Drive por enquanto.

**Decisão**: `/clientes/contratos` é uma página estática com um botão que abre `https://drive.google.com/drive/folders/...` numa aba nova (`target="_blank"`). Sem tabela no banco, sem API, o link fica hardcoded em `apps/web/app/(app)/clientes/contratos/page.tsx`.

**Consequência**: se no futuro o usuário quiser voltar ao modelo completo do manual (ou até só tornar o link configurável por agência, já que hoje é fixo pra todo mundo — o que só é aceitável enquanto existir uma única agência real usando o sistema), a seção 12 do manual continua sendo a referência funcional; nada foi descartado, só adiado.

## 2026-09-04 — "Carga" é contagem de tarefas, não horas

**Contexto**: a seção 16 do manual pede comparar "horas/pontos disponíveis e planejados" para medir capacidade. Isso pressupõe apontamento de horas e estimativas por tarefa — que é a seção 21 (Fase 1E), ainda não implementada.

**Decisão**: em vez de esperar a Fase 1E ou inventar um sistema de estimativa só para preencher esta tela, "carga" nesta fatia é a contagem de tarefas abertas (`Task.status` fora de `CONCLUIDA`/`CANCELADA`) atribuídas a cada pessoa — calculada on-the-fly, sem tabela nova. É uma proxy honesta: não mede esforço real, mas já aponta quem está com muita coisa na mão. Os limiares visuais (4+ = atenção, 8+ = sobrecarga) são arbitrários, ajustáveis depois.

**Consequência**: quando `time_entries`/`estimates` existirem (Fase 1E), essa tela pode evoluir para horas reais sem quebrar nada — é só trocar a query de `groupBy` por tarefa para `sum` por horas estimadas.

## 2026-09-04 — Rotinas: só mensal, geração manual, sem worker ainda

**Contexto**: a seção 15 do manual pede recorrência com timezone, dias úteis e data final, gatilho automático "no dia 1" e resiliência a falha (fila + alerta). Isso pressupõe um worker/scheduler rodando em produção (`apps/worker`, seção 44 do manual), que ainda não existe no monorepo.

**Decisão**: implementar a peça que importa primeiro — a função de geração idempotente (`generateRoutineRun`) e o schema completo (`RoutineTemplate`, `RoutineTemplateTask`, `RoutineRun` com `@@unique([templateId, period])`) — e expor um botão "Gerar agora" manual em vez de um cron real. A idempotência (o requisito mais importante da seção 15) é validada de verdade: gerar duas vezes o mesmo período não duplica nada, garantido pela constraint do banco, não só por lógica de aplicação.

**Consequência**: quando `apps/worker` existir, ele só precisa chamar `generateRoutineRun()` uma vez por dia para cada template ativo cujo `dayOfMonth` bateu com hoje — nenhuma mudança na função em si. Recorrência semanal/dias úteis e o estado `FALHOU` com fila de retry (já modelados no schema) ficam para quando houver um caso real pedindo.

## 2026-09-04 — Quadro de tarefas: clique-para-mover agora, drag-and-drop depois

**Contexto**: o manual (seção 5, "Componentes e padrões de tela") pede Kanban "com drag-and-drop com alternativa acessível". Implementar drag-and-drop de verdade (biblioteca, sensores de teclado, anúncios ARIA durante o arraste) é um investimento de UI maior que o resto desta fatia.

**Decisão**: entregar primeiro a "alternativa acessível" — botões que movem a tarefa para os status válidos seguintes, desabilitados quando bloqueados por dependência — e tratar o drag-and-drop como um reforço visual futuro sobre a mesma base (mesma API `POST /api/tasks/:id/status`, só troca a interação). Como o botão já é 100% funcional e acessível por teclado, isso não é um recurso "faltando" para uso real, é uma segunda forma de interação a mais.

**Consequência**: `docs/STATUS.md` registra isso como parcial, não como pendência bloqueante.

## 2026-09-04 — `prisma migrate dev` não funciona neste terminal; workaround documentado

**Contexto**: `prisma migrate dev` recusa rodar ("environment is non-interactive") sempre que a migration teria algum aviso (ex.: nova constraint `@unique`), mesmo com `-y`/stdin — ele checa TTY de verdade, não só se stdin tem dado.

**Decisão/procedimento** quando isso acontecer de novo:
```bash
# 1. gerar o SQL da diferença entre o banco atual e o schema (não-interativo)
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > /tmp/migration.sql

# 2. criar a pasta de migration manualmente, no formato do Prisma
mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_nome_da_migration
cp /tmp/migration.sql prisma/migrations/<pasta_criada>/migration.sql

# 3. aplicar (esse comando É não-interativo por design)
npx prisma migrate deploy
npx prisma generate
```

**Consequência**: sempre revisar o SQL gerado no passo 1 antes de copiar — é a mesma revisão que `migrate dev` faria, só que manual.

## 2026-09-04 — Cadastro de cliente via popup, salvamento parcial é o caso normal

**Contexto**: pedido explícito do usuário — cadastro precisa ter todos os campos (telefone, CNPJ, WhatsApp, responsável, e-mail), abrir num popup, e permitir salvar só com o nome fantasia preenchido, completando depois.

**Decisão**: criamos um componente `Modal` genérico e acessível em `packages/ui` (focus trap, Escape, backdrop) e um `ClientFormModal` compartilhado entre criação e edição. Só `name` é obrigatório no schema e na API — todo o resto aceita `null`. Adicionamos `PATCH /api/clients/:id` e um botão "Editar dados" no perfil do cliente especificamente para o fluxo de completar depois.

**Consequência**: qualquer form de cadastro rápido futuro (ex.: novo fornecedor, novo lead) pode reaproveitar o `Modal` de `packages/ui` em vez de reinventar.

## 2026-09-04 — Release 1C fatiada: Demandas primeiro, "convertida" não cria Tarefa ainda

**Contexto**: a Release 1C do manual (seção 3.2) junta Demandas, Projetos, Tarefas, Rotinas, Squads e Notificações — grande demais pra uma fatia.

**Decisão**: mesma estratégia da 1B — entregar Demandas isoladamente primeiro (seção 13), incluindo os estados até `CONVERTIDA`, mas sem criar de fato uma Tarefa/Projeto na conversão, já que essas entidades ainda não existem. A demonstração completa do manual ("demanda vira projeto") só fica 100% real quando a próxima fatia (Projetos + Tarefas, seção 14) entrar.

**Consequência**: `docs/STATUS.md` marca esse gap explicitamente. Prioridade da demanda só é definida na triagem/aprovação, nunca na criação (seção 13 do manual é explícita sobre isso).

## 2026-09-04 — Release 1B fatiada em duas partes; outbox ainda não entrou

**Contexto**: a Release 1B do manual (seção 3.2) inclui Clientes, contatos, onboarding, contratos e arquivos — grande demais para uma fatia vertical só.

**Decisão**: entregar primeiro Clientes + Contatos + Onboarding (o que já cumpre o critério de aceite explícito: "cliente cadastrado com timeline e checklist de onboarding"). Contratos/produtos (seção 12) e Arquivos (seção 9.3, depende de escolher S3 vs R2) ficam para a próxima fatia. Ativação de cliente (`client.status → ATIVO`) já cria o `Workspace` do cliente diretamente na mesma transação da API route — **não** introduzimos o padrão outbox/eventos (seção 8 do manual) ainda, porque não há nenhum consumidor assíncrono real esperando por esse evento. Ele entra quando a primeira automação genuinamente assíncrona aparecer (ex.: rotinas recorrentes, Release 1C).

**Consequência**: `docs/STATUS.md` marca claramente o que falta da 1B. O checklist de onboarding usa dependência sequencial por `order` (não um grafo arbitrário) — decisão pragmática, ver `docs/DATA_MODEL.md`.

## 2026-09-03 — Sidebar substitui a navegação lateral fixa do manual

**Contexto**: o Manual Mestre v2.0 (seção 4.3/4.4) especifica uma sidebar fixa de 240-264px, recolhível para 72px, sem detalhar o mecanismo de expansão.

**Decisão**: seguir a especificação alternativa fornecida pelo usuário — sidebar flutuante, recolhida por padrão (68px), expansão por hover/foco/clique, submenu só por clique, tooltip no estado recolhido, drawer mobile dedicado. Identidade visual (cores, ícones, tipografia) permanece 100% ZENITH FLOW; nenhum elemento visual de referências externas foi copiado.

**Consequência**: `packages/ui/src/navigation` e `packages/ui/src/shell` implementam essa variante. Todas as demais regras do manual (RBAC nos itens, feature flags, badges, i18n futuro) continuam válidas e já estão modeladas em `NavigationItem`.

## 2026-09-03 — Ordem de entrega: sidebar completa antes das fatias funcionais

**Contexto**: o manual recomenda entregar fatias verticais completas (banco → domínio → API → UI → teste) por release, evitando telas vazias.

**Decisão**: por pedido explícito do usuário, a primeira entrega é a sidebar com **todas** as abas do produto-alvo, cada uma apontando para um Empty State "Em desenvolvimento" (`ComingSoon`), em vez de revelar módulos aos poucos. Cada aba será promovida a fatia funcional real conforme as próximas entregas.

**Consequência**: nenhuma aba tem lógica de negócio, banco de dados ou API ainda. Isso é esperado e documentado em `docs/STATUS.md` — não é uma pendência esquecida.

## 2026-09-03 — Nunca rodar `npm run build` com `npm run dev` ativo no mesmo app

**Contexto**: rodamos `npm run build` (produção) em `apps/web` enquanto `npm run dev` já estava de pé, para validar o Definition of Done. Os dois processos escrevem em `apps/web/.next` simultaneamente, corrompendo o manifest de assets do dev server — resultado: CSS e chunks JS passaram a responder 404 no navegador do usuário, embora `curl` na raiz retornasse 200.

**Decisão**: build de produção só roda com o dev server desligado (ou vice-versa). Se acontecer de novo: matar o processo na porta 3000 (`netstat -ano | findstr :3000` no Windows), apagar `apps/web/.next` e reiniciar `npm run dev` limpo.

## 2026-09-04 — Neon Postgres via CLI oficial (não Docker)

**Contexto**: Docker não está disponível nesta máquina. O manual recomenda Neon Postgres.

**Decisão**: usuário criou um projeto Neon (`billowing-sunset-21073526`, região `sa-east-1`) e autenticou o Neon CLI (`neon login`) manualmente via OAuth no navegador (fluxo interativo que só o usuário podia completar). A connection string foi obtida com `neon connection-string --project-id ...` e salva em `packages/db/.env` (Prisma CLI) e `apps/web/.env.local` (runtime do Next.js) — ambos gitignorados, nunca no repositório. `neon skills`/`neon mcp` também foram configurados para uso futuro.

**Consequência**: banco real (não SQLite) desde o primeiro dia, na mesma região do usuário. Plano gratuito (0,5 GB) é suficiente para toda a Fase 1; upgrade de plano (sem troca de banco) será necessário perto da Fase 3 (tracking de alto volume) ou de auditoria/eventos sem expurgo.

## 2026-09-04 — Campo `Account.issuer` do Better Auth não documentado pelo gerador oficial

**Contexto**: `better-auth` 1.7.2 (core) grava um campo `issuer` (ex.: `"local:credential"`) ao criar uma `Account`, usado para linkagem segura entre provedores de identidade. O pacote `@better-auth/cli` (gerador de schema Prisma) está descontinuado e desatualizado — seu schema gerado NÃO inclui esse campo, causando `PrismaClientValidationError: Unknown argument issuer` no primeiro cadastro.

**Decisão**: adicionar `issuer String?` manualmente ao model `Account` em `packages/db/prisma/schema.prisma` (migration `add_account_issuer`), em vez de confiar no gerador oficial. Ao atualizar a versão do `better-auth` no futuro, reconferir o schema manualmente (rodar um signup de teste) em vez de assumir que o gerador está correto.

## 2026-09-04 — Convite de equipe mora em Configurações, não em Pessoas

**Contexto**: o manual tem "Pessoas > Equipe" (seção 20, módulo de RH — cargos, admissão, dados trabalhistas) e não define explicitamente onde fica o convite de acesso ao sistema (RBAC).

**Decisão**: "Equipe e permissões" (convidar membro, definir papel RBAC) fica em Configurações (`/configuracoes/equipe`), separado do futuro módulo de RH. São conceitos diferentes: acesso/login (`Membership`) vs. dado de contratação (`employees`, Fase 1E). Padrão comum em SaaS (Linear, Stripe, Attio).

**Consequência**: envio de e-mail de convite real (Resend/Brevo) é FUTURO (Fase 2, seção 41.1 do manual) — por ora o link de convite é exibido na tela para envio manual. Aceite de convite por um usuário que já tem conta em outra agência não está implementado ainda (fluxo assume conta nova); documentado em `docs/STATUS.md`.

## 2026-09-03 — Monorepo com npm workspaces (não pnpm)

**Contexto**: manual sugere monorepo modular; pnpm não está disponível neste ambiente.

**Decisão**: usar npm workspaces (nativo, sem instalação extra). Estrutura de pastas (`apps/*`, `packages/*`) segue a sugestão do manual (seção 44.1).
