# Briefing — Portal do Cliente em `portal.hubzenite.com.br`

> Documento escrito pela sessão de Claude Code do site institucional (`zenitehub`), a pedido do Kevin, em 2026-09-23. Antes de programar qualquer coisa a partir daqui: leia `README.md`, `AGENTS.md`, `docs/STATUS.md`, `docs/DECISIONS.md` e `docs/ROADMAP.md` — este briefing **não substitui** o Manual Mestre nem os docs internos, ele só traduz o pedido do Kevin, cruza com o que já existe no sistema (pra não haver retrabalho) e detalha o que falta.

---

## 1. Contexto — por que este documento existe

O Kevin quer publicar este projeto (`zenith-flow` / projeto Vercel `zenite-mkt`) como subdomínio do site institucional: **`portal.hubzenite.com.br`**. A ideia central dele:

> "Quando entrar nessa URL, já pede login e senha. Se for de um cliente, vai pro portal de cliente. Se não, é a equipe interna."

O ponto interessante: **isso já existe quase por completo no sistema atual.** Antes de escrever uma linha de código, o próximo agente precisa saber exatamente o que já está pronto, pra não reconstruir nada. Este documento existe pra separar três coisas:

1. O que o Kevin pediu (visão dele, em linguagem de negócio)
2. O que **já está implementado** hoje (confirmado em `docs/STATUS.md`)
3. O que **falta construir de fato** (o trabalho real desta fatia)

## 2. Estado da infraestrutura (Vercel/DNS) — feito nesta sessão

- Domínio `portal.hubzenite.com.br` **já foi adicionado ao projeto Vercel `zenite-mkt`** (mesmo projeto desta pasta — `prj_1lm8PPRrBBWcamiZeFxVDPsXBQtV`, time `zenitemkt-1513`).
- Falta só o registro DNS no provedor (GoDaddy, fora do acesso desta sessão): `A portal.hubzenite.com.br → 76.76.21.21`. O Kevin vai fazer isso depois.
- **Nenhuma mudança de código foi feita aqui.** Este projeto não tem o código do Next.js — só o site institucional estático (`zenitehub`).
- Implicação de arquitetura: como são dois projetos Vercel **totalmente separados** (não um monorepo único), rodar o sistema administrativo não deixa o site institucional mais pesado ou lento — são deploys, builds e runtimes independentes. Isso já foi validado com o Kevin e não precisa ser revisitado.

## 3. O que já existe hoje no Portal do Cliente (NÃO reconstruir)

Confirmado em `docs/STATUS.md` (Release 1D partes 4/5 e reforço de 2026-09-07). Login e roteamento:

- **Login único, roteamento automático por papel**: mesma tela de login (Better Auth, e-mail/senha), mesma sessão. `(app)/layout.tsx` redireciona sessão com papel de cliente pra `/portal`; `/portal/layout.tsx` faz o inverso (`lib/portal.ts`, `requirePortalContext()`). Ou seja: **o requisito "login único que decide se é cliente ou equipe" já está pronto** — o que falta é só a camada de subdomínio (seção 5).
- Papéis de cliente (`CLIENT_ADMIN`/`CLIENT_VIEWER`) já existem no schema desde a Release 1A, dentro de `Workspace(kind: CLIENT)`.
- Convite de acesso: aba "Portal do cliente" no perfil do cliente, convite por e-mail, aceite via `/convite/[token]` (fluxo já existente, reaproveitado).

Telas do portal já em produção:

| Rota | O que faz | Observação |
|---|---|---|
| `/portal` | Início: contadores de aprovações pendentes + próximas peças | — |
| `/portal/calendario` | Calendário mensal do cliente | Reaproveita o **mesmo componente `CalendarGrid`** de `/conteudo/calendario` e os helpers de `lib/content-calendar.ts`. Já é "grade mensal", scoped ao próprio cliente. |
| `/portal/aprovacoes` | Fila de pendentes + histórico de aprovação | Decide via sessão autenticada (sem precisar de link público — isso é só pro fluxo sem login) |
| `/portal/solicitacoes` | Cliente abre uma solicitação | Vira uma `Task` sem responsável ("Não atribuída") do lado interno |
| `/portal/arquivos` | Arquivos do cliente | `MediaAsset`/Cloudflare R2, isolado por `clientId` |
| `/portal/financeiro` | Financeiro visível ao cliente | Só `FinanceEntry` tipo `RECEITA` do próprio `clientId` — **nunca** despesa, custo ou margem (regra da seção 18 do manual, aplicada na query, não só na UI). Boleto em PDF anexado pelo time (`AttachBoletoButton`) fica disponível pra download aqui. |
| `/portal/trafego` | Tráfego pago do cliente | Somente leitura — mostra as campanhas daquele cliente (`Campaign.clientId`), sem o painel de atribuição interno (isso é assunto da agência) |

**O que ainda não existe no portal** (confirmado como pendência aberta em `docs/STATUS.md`):

- Comentários/thread no portal (o componente `CommentThreadPanel` existe e é reaproveitável, mas ainda não foi ligado ao portal)
- Relatórios (mencionado como pendência desde a Release 1D, nunca fechado)
- Geração de PIX / cobrança automática — hoje o financeiro é 100% manual, incluindo o boleto (upload manual de PDF). Integração Asaas (que resolveria isso) está **bloqueada** porque depende de uma conta sandbox que só o Kevin pode criar (seção 27 do manual)

## 4. O que o Kevin pediu — cruzando com o que existe

### 4.1. Calendário editorial visual (cards por dia, com status)

**Pedido do Kevin:** formato visual de calendário do mês, cada card de publicação no dia certo, mostrando status "Em desenvolvimento", "Agendado", "Publicado/Concluído". Ver o mês em execução e o mês seguinte planejado (podendo aprovar ou sugerir mudança numa publicação).

**Já existe:** `/portal/calendario` com grade mensal reaproveitada de `/conteudo/calendario`.

**O que precisa confirmar/ajustar nesta fatia:**
- Conferir se o enum atual de `ContentItem.status` já cobre exatamente os três rótulos que o Kevin quer ver no portal (`Em desenvolvimento`, `Agendado`, `Publicado/Concluído`) ou se precisa de um mapeamento de exibição (o enum interno pode ter mais granularidade — ex. rascunho, revisão, aprovação — e o portal deveria simplificar pra esses 3 estados visíveis ao cliente).
- Confirmar que dá pra navegar entre "mês atual" e "próximo mês" dentro de `/portal/calendario` (a grade existe, mas verificar se a navegação entre meses já está exposta ao cliente ou só ao time interno).
- **"Sugerir mudança em uma publicação" é a peça nova de verdade.** Aprovar já existe (`/portal/aprovacoes`). Sugerir mudança é diferente de aprovar/rejeitar — parece mais próximo de um comentário vinculado ao `ContentItem` daquele dia. Como comentários no portal ainda não existem, esta é uma decisão de escopo: expandir "aprovações" para aceitar "aprovar com ressalva/comentário" no mesmo fluxo, OU trazer o `CommentThreadPanel` pro portal (reaproveitável, já é usado em `/conteudo/[id]`) e permitir comentário do cliente vinculado ao item do calendário. A segunda opção é mais simples de implementar e mais consistente com o resto do sistema.

### 4.2. Financeiro do cliente (a pagar, pagos, gerar PIX, acompanhar)

**Pedido do Kevin:** cliente vê o que está a pagar, o que já foi pago, consegue gerar PIX de pagamento, e acompanha tudo.

**Já existe:** `/portal/financeiro` mostra receitas daquele cliente e permite baixar boleto em PDF (quando o time anexa manualmente).

**O que falta / decisão pendente:** "gerar PIX" tem dois caminhos bem diferentes em esforço, e o Kevin precisa decidir qual:

1. **PIX real via gateway (Asaas)** — geraria QR Code/copia-e-cola de verdade, com baixa automática quando o cliente paga. Está bloqueado hoje porque precisa de uma conta sandbox Asaas que só o Kevin pode criar (mesmo bloqueio já registrado em `docs/STATUS.md` pra seção 27 do manual). Se o Kevin criar a conta, essa integração desbloqueia tanto o financeiro interno quanto essa função no portal.
2. **PIX manual (mais rápido de entregar)** — o time cadastra a chave/copia-e-cola (ou um QR Code estático gerado à parte) junto ao lançamento, do mesmo jeito que hoje anexa o boleto em PDF (`FinanceEntry.boletoAssetId`). O cliente vê e copia, mas não há confirmação automática de pagamento — o time dá baixa manual, como já faz hoje.

Recomendação: começar pela opção 2 (reaproveita exatamente o padrão já existente do boleto, zero infraestrutura nova) e migrar pra opção 1 quando o Kevin tiver a conta Asaas. **Não implementar sem essa decisão do Kevin primeiro.**

### 4.3. Relatórios (Raio-X do Tráfego Pago + Estratégia do Mês)

**Pedido do Kevin:** relatório de "Raio-X do Tráfego Pago" pro cliente, e um espaço pro Gabriel (gestor de tráfego) escrever a "Estratégia do Mês".

**Já existe (mas é interno, não do cliente):** a Home do painel interno já virou um "X-RAY" da agência (`/` — pizza/barra via `recharts`, 6 blocos temáticos: Financeiro, Clientes&saúde, Comercial, Operação, Pessoas, Conteúdo). Isso é o dashboard da **agência inteira**, não o relatório de tráfego de **um cliente específico** — não dá pra simplesmente expor essa tela ao cliente (mistura dado de outros clientes e dado interno que a seção 18 do manual proíbe mostrar).

**O que precisa ser construído (novo, real):**
- Uma tela `/portal/relatorios` (ou dentro de `/portal/trafego`, a decidir) com um "raio-x" **filtrado só pelas campanhas daquele cliente** (`Campaign.clientId`) — reaproveitando os componentes de gráfico (`recharts`) e o dado de `CampaignDailyMetric` que já existe, só que reagregado por cliente em vez de por agência.
- Um campo de texto (rich text simples) para "Estratégia do Mês", escrito pela equipe (Gabriel ou quem tiver o papel de Gestor de Tráfego) e exibido ao cliente naquele mês. Sugestão de modelagem: nova entidade simples tipo `ClientMonthlyStrategyNote` (clientId, competência/mês, autor, texto, `updatedAt`) — segue o mesmo padrão de histórico append-only ou "última versão vale", a decidir com o time (ver `docs/DECISIONS.md` pra convenção de auditoria já usada em outras entidades, ex. `HealthScoreSnapshot`).
- Confirmar com o manual mestre se a seção de Relatórios (mencionada como pendência em `docs/STATUS.md`, linha "Fica pra parte 2: [...] Relatórios") já tem um desenho definido — se sim, seguir o desenho do manual em vez do sugerido aqui.

### 4.4. Equipe interna (demandas, clientes, financeiro, campanhas próprias da agência)

**Pedido do Kevin:** sistema funcional também pro lado interno.

**Já existe e está maduro** (não é trabalho novo desta fatia, só contexto):
- Demandas/operação: Kanban unificado em `/operacao`
- Clientes: cadastro, onboarding, contratos (link Drive), arquivos, portal
- Financeiro: a pagar/a receber, DRE gerencial, indicadores (DSO, Logo churn), régua de cobrança
- Campanhas próprias da agência: `Campaign` com `clientId` nulo = funil comercial da própria agência (mesma tabela usada pro tráfego de cliente)
- Comercial: Leads/CRM, Pipeline, Propostas
- RH: cargos, vagas, candidatos, apontamento

Ou seja, o lado interno já cobre o que o Kevin descreveu. O trabalho real desta fatia é **só o portal do cliente + a camada de subdomínio**, itens 4.1 a 4.3 e seção 5 abaixo.

## 5. A peça de arquitetura nova: roteamento por subdomínio

Isso é o que genuinamente não existe ainda e precisa ser desenhado. Hoje o sistema roda todo num domínio só (área interna e `/portal/*` convivem no mesmo host). O pedido é: `portal.hubzenite.com.br` deve:

1. Servir a mesma aplicação Next.js (mesmo deploy — **não** é um projeto separado, é o mesmo projeto Vercel, domínio adicional).
2. Ao entrar em `portal.hubzenite.com.br`, cair direto na tela de login (não expor nenhuma rota interna nesse host).
3. Depois do login, cliente cai em `/portal/*` (já existe); usuário de equipe interna que tentar logar por esse subdomínio — decidir se deve ser bloqueado (o portal é só pra clientes) ou redirecionado pro domínio principal.
4. O domínio principal do sistema (o que hoje é `zenith-flow-one.vercel.app`, e futuramente talvez algo como `app.hubzenite.com.br` ou domínio próprio — a decidir) continua servindo a área interna normalmente.

**Caminho técnico sugerido** (a validar com o time): Next.js Middleware (`middleware.ts`) lendo `request.headers.get('host')`. Se o host for `portal.hubzenite.com.br`:
- Rewrite de `/` para `/portal` (ou pra tela de login se não autenticado);
- Bloquear (404 ou redirect) qualquer rota que não comece com `/portal`, `/login`, `/convite`, `/api` necessário ao portal — evita que alguém acesse rota interna digitando a URL direto nesse host.

Isso é decisão de implementação do próximo agente — só documentando aqui que é **trabalho novo**, não existe hoje nenhum tratamento por `host` no projeto (confirmar lendo `apps/web/middleware.ts` se existir, e `docs/DECISIONS.md` por precedente).

## 6. Decisões que só o Kevin pode tomar (não avançar sem elas)

1. **PIX**: opção manual (rápida, reaproveita padrão do boleto) ou esperar a conta Asaas (automática, mas bloqueada até ele criar a conta sandbox)?
2. **Domínio da área interna**: vai continuar em `zenith-flow-one.vercel.app`, ou também ganha domínio próprio (ex. `app.hubzenite.com.br`)? Afeta o desenho do middleware de host.
3. **Usuário interno tentando logar pelo subdomínio do portal**: bloquear ou redirecionar pro domínio principal?
4. **"Estratégia do Mês"**: é só um texto livre por cliente/mês, ou precisa de histórico de versões (ex. o cliente pode ver estratégias de meses anteriores)?
5. **DNS**: falta o Kevin apontar `A portal.hubzenite.com.br → 76.76.21.21` no GoDaddy (fora do alcance desta sessão) — sem isso o subdomínio não resolve, mesmo com o código pronto.

## 7. Ordem sugerida de implementação

1. Resolver o DNS (Kevin, fora do código) e confirmar `portal.hubzenite.com.br` respondendo.
2. Middleware de roteamento por host (seção 5) — sem isso, nada do resto importa em produção.
3. Calendário: ajustar rótulos de status pro cliente + navegação de mês (4.1, primeira parte — baixo risco, é ajuste de tela existente).
4. Comentário/"sugerir mudança" vinculado ao item do calendário no portal (4.1, segunda parte — depende de decisão de escopo).
5. PIX manual no financeiro do portal (4.2, opção 2 — reaproveita padrão do boleto).
6. Relatórios de tráfego por cliente + Estratégia do Mês (4.3 — é a fatia mais nova, com modelagem de dado nova).

---

*Este documento foi gerado a partir de uma conversa com o Kevin na sessão do site institucional. Ele expande a visão de produto que ele descreveu, cruzando com `docs/STATUS.md` deste projeto para não duplicar trabalho já feito. Trate como ponto de partida de conversa, não como spec fechada — valide as seções 4 e 5 com o Kevin antes de codificar, especialmente os itens da seção 6.*
