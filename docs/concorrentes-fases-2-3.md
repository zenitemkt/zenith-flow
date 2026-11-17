# Análise de Concorrentes — Fases 2 e 3

Prompt de continuação para o Codex. A Fase 1 já está no ar.

---

## Contexto do projeto

Monorepo `zenith-flow` (CRM "Zenite Flow" da agência Zenite Marketing Hub).

- **Stack:** Next.js 14 App Router, TypeScript, Prisma/Postgres, Tailwind, deploy na Vercel (plano Hobby).
- **App web:** `apps/web`. Schema: `packages/db/prisma/schema.prisma`. Navegação: `packages/ui/src/navigation/nav-config.ts`.
- **Build da Vercel** roda `migrate:deploy`, então toda alteração de schema precisa de migration SQL escrita à mão em `packages/db/prisma/migrations/<timestamp>_<nome>/migration.sql`.
- **Crons:** declarados em `vercel.json` e liberados em `apps/web/middleware.ts`. Plano Hobby: no máximo 2 execuções por dia por rota; cada rota de cron valida `CRON_SECRET` por `Authorization: Bearer`.
- **Antes de commitar:** `npx tsc --noEmit -p apps/web` precisa passar limpo.
- **Push:**
  ```bash
  C="credential.helper=!f() { echo username=x-access-token; echo password=\$(GH_CONFIG_DIR=/c/Users/gabri/.gh-zenite gh auth token); }; f"
  git -c credential.helper= -c "$C" pull --rebase -q
  git -c credential.helper= -c "$C" push -q
  ```
- **Vercel CLI:** sempre com `--global-config "C:\Users\gabri\.vercel-zenite"` (projeto `zenite-mkt`).
- **Idioma:** tudo em português do Brasil, incluindo comentários no código. Texto de interface sem jargão: o usuário final é a equipe da agência.
- **Estilo de escrita:** sem travessão, sem "não é X, é Y", sem adjetivo antes de fato. Frases curtas.
- **Nunca** ler ou commitar `.env`.

---

## O que já existe (Fase 1, no ar)

### Banco (`packages/db/prisma/schema.prisma`)
- `Competitor`: `agencyId`, `clientId`, `igUsername`, `isOwn` (perfil do próprio cliente, base de comparação), `notes`, `displayName`, `biography`, `website`, `pictureUrl`, `followers`, `follows`, `mediaCount`, `lastSyncAt`, `lastError`, `aiReport`, `aiReportAt`, `aiReportDays`. Único por `[clientId, igUsername]`.
- `CompetitorPost`: `igMediaId` (único), `caption`, `mediaType`, `mediaProductType`, `mediaUrl`, `thumbnailUrl`, `permalink`, `likeCount`, `commentsCount`, `timestamp`.
- `CompetitorSnapshot`: foto diária (`day` único por concorrente) com `followers`, `follows`, `mediaCount`. Serve para o histórico de crescimento, já que a API não devolve passado.

### Código
- `apps/web/lib/competitors.ts`
  - `cleanUsername(raw)`: aceita `@perfil`, link ou nome puro.
  - `syncCompetitor(id, deep?)`: lê o perfil pela API oficial do Instagram (campo `business_discovery`), usando um `SocialConnection` INSTAGRAM ativo da agência (prefere o do próprio cliente). `deep` busca 4 páginas de 50 posts; o diário busca 1. Grava posts, snapshot do dia e perfil. Erro fica em `lastError`.
  - `syncAllCompetitors(budgetMs)`: percorre todos, começando pelos mais desatualizados, com orçamento de tempo.
  - `analyzeTopPostsWithAI(id, days)`: manda os 6 melhores posts (imagem + legenda + números) para a Claude e grava o texto em `aiReport`. Tenta com imagens; se o link expirar, refaz só com texto.
- `apps/web/lib/competitor-analytics.ts`: funções puras, sem banco. `analyzeCompetitor(posts, followers, periodDays)` devolve: médias, engajamento sobre seguidores, mix de formatos, top hashtags com *lift*, menções, palavras, CTAs reconhecidas por regex, uso de emoji e pergunta, faixas de tamanho de legenda, dias da semana, mapa de calor 7x24 (horário de Brasília), horários mais usados e com mais interação, cadência e top 12 posts.
- Rotas: `apps/web/app/api/competitors/route.ts` (POST cadastra e já sincroniza; se falhar, apaga o registro), `apps/web/app/api/competitors/[id]/route.ts` (POST com `action: "sync" | "analyze"`, DELETE), `apps/web/app/api/cron/competitors-sync/route.ts` (diário, 09:30 UTC).
- Tela: `apps/web/app/(app)/concorrentes/page.tsx` + `CompetitorControls.tsx`. Item próprio na barra lateral ("Análise de Concorrentes", ícone `Binoculars`, href `/concorrentes`). `/clientes/concorrentes` redireciona para lá.
- Permissão: `META_SOCIAL_EXTRA_SCOPES=instagram_manage_insights` na Vercel, lida em `apps/web/lib/meta-social.ts`.

### Limites conhecidos
- A API não entrega alcance nem visualizações de contas de terceiros. Engajamento = curtidas + comentários.
- Só conta comercial ou de criador pode ser lida.
- Posts com curtidas ocultas vêm com `likeCount: null`.
- `business_discovery` não traz Stories nem comentários individuais.

---

## FASE 2

### 2A. Alertas de concorrente
Reaproveitar o sistema de alertas existente: `apps/web/lib/system-alerts.ts` (`raiseSystemAlert`, `resolveSystemAlertsByPrefix`, tipos por prefixo de chave). Criar o tipo `competitor` com prefixo `competitor:`.

Gerar os alertas dentro do cron diário, depois do sync, numa função nova `generateCompetitorAlerts(agencyId)` em `apps/web/lib/competitor-alerts.ts`:

1. **Post acima da média** — post dos últimos 2 dias com engajamento ≥ 3x a média dos últimos 90 dias daquele perfil (mínimo de 10 posts na base). Chave: `competitor:viral:<postId>`.
2. **Salto de seguidores** — crescimento diário ≥ 3x a média diária dos últimos 30 dias e ≥ 50 seguidores. Chave: `competitor:growth:<competitorId>:<dia>`.
3. **Mudou de ritmo** — passou a postar o dobro (ou metade) da média semanal dos últimos 30 dias. Chave: `competitor:cadence:<competitorId>`.
4. **Formato novo** — começou a usar um formato que não usava nos 90 dias anteriores (ex.: estreou em Reels). Chave: `competitor:format:<competitorId>:<formato>`.

Cada alerta leva `href` para `/concorrentes?c=<id>`. Severidade `INFO`, categoria `AUTOMATION`.

### 2B. Comparativo cliente x concorrentes
Nova aba na tela `/concorrentes`, ou seção no topo quando existir um perfil com `isOwn: true`:
- Posição do cliente no ranking de cada métrica (engajamento, posts por semana, média de interações).
- Gráfico de linhas com os snapshots de seguidores de todos os perfis no período (SVG puro, sem biblioteca nova).
- Lista "o que os concorrentes fazem e o cliente não": hashtags que aparecem em 3+ concorrentes e em nenhum post do cliente; formatos com participação muito maior nos concorrentes; faixas de horário usadas por eles e não pelo cliente.
- **Importante:** o perfil do cliente também entra por `business_discovery`, então as métricas são comparáveis (mesma fonte, mesmas limitações).

### 2C. Temas e ganchos
Em `competitor-analytics.ts`, acrescentar:
- Agrupamento de posts por tema, usando a primeira linha da legenda e as palavras mais frequentes. Cada grupo com número de posts e média de interações.
- Classificação do gancho da primeira linha: pergunta, número ("5 motivos"), promessa, erro ("pare de"), prova social, oferta. Por regex, igual ao que já é feito com CTAs.
- Nova seção na tela mostrando quais ganchos rendem mais.

### 2D. Anúncios da Meta (via extensão)
**Status: implementada em 2026-11-16.**

O usuário tem a extensão `meta-ad-library-downloader` (pasta `G:\Projetos\meta-ad-library-downloader`), que já lê a Biblioteca de Anúncios no navegador. A API oficial da Biblioteca não entrega anúncios comerciais no Brasil, só políticos, por isso o caminho é a extensão.

- Criar `CompetitorAd` no schema: `competitorId`, `adArchiveId` (único), `startedAt`, `lastSeenAt`, `active`, `platforms` (string[]), `bodyText`, `headline`, `linkUrl`, `ctaLabel`, `creativeUrls` (string[]), `format`.
- Rota `POST /api/competitors/[id]/ads` autenticada por um token de agência (campo novo em `Agency`, gerado na tela) que recebe os anúncios em lote, faz upsert por `adArchiveId` e marca `active: false` em quem não veio na carga.
- Ajustar a extensão para enviar os anúncios para essa rota.
- Na tela: lista de anúncios, com **dias no ar** em destaque (`lastSeenAt - startedAt`). Anúncio no ar há muito tempo é o melhor sinal de criativo que funciona.
- Alerta novo: concorrente subiu anúncio (chave `competitor:newad:<adArchiveId>`).

---

## FASE 3

### 3A. Relatório mensal
**Status: implementada em 2026-11-17.**

- Nova tabela `CompetitorReport`: `clientId`, `month`, `content` (texto gerado pela Claude), `generatedAt`.
- Cron mensal (dia 1) ou botão na tela: junta os dados dos concorrentes e do cliente no mês e pede à Claude um relatório com: o que mudou no mercado, o que funcionou para os concorrentes, onde o cliente está à frente ou atrás e um plano de 5 ações para o mês.
- Mostrar no portal do cliente (`apps/web/app/portal/`), em aba nova, só para quem tem papel `CLIENT_ADMIN` ("Cliente - Aprovador").

### 3B. Avaliações no Google
**Status: implementada em 2026-11-17.**

- API do Google Places (Place Details), com cota gratuita mensal. Precisa de `GOOGLE_PLACES_API_KEY`.
- Campos novos em `Competitor`: `googlePlaceId`, `googleRating`, `googleReviewCount`.
- Busca o lugar pelo nome e cidade, guarda nota e número de avaliações, e inclui no comparativo.
- Snapshot diário da nota, para ver a evolução.

### 3C. Site do concorrente
- PageSpeed Insights API (gratuita, sem chave para uso leve): nota de performance do site do concorrente.
- Guardar `websiteScore` e a data da medição. Útil como argumento comercial.

### 3D. Sugestões de pauta
- Botão "Gerar ideias de conteúdo" que cruza os temas e ganchos vencedores dos concorrentes com o que o cliente ainda não publicou, e devolve 10 ideias prontas (formato, gancho e legenda inicial).
- Enviar as ideias direto para o calendário de conteúdo como rascunho (`ContentItem` com status inicial), já ligadas ao cliente.

---

## Ordem sugerida

1. 2A (alertas) — usa só o que já existe no banco, entrega valor imediato.
2. 2B (comparativo) — depende de ter o perfil do cliente cadastrado com `isOwn`.
3. 2C (temas e ganchos) — só análise, sem dependência externa.
4. 2D (anúncios) — precisa mexer na extensão, é o maior pedaço.
5. Fase 3 — confirmar com o usuário antes, porque 3B tem custo possível.

## Regras ao implementar

- Toda mudança de schema precisa de migration SQL à mão.
- Nada de biblioteca nova sem necessidade real: gráficos em SVG puro, como já é feito em `apps/web/app/(app)/trafego-raio-x/DailyChart.tsx`.
- Rodar `npx tsc --noEmit -p apps/web` antes de cada commit.
- Mensagem de commit em português, descrevendo o que muda para quem usa.
- Ao terminar cada parte, dizer ao usuário o que foi testado e o que não foi.
