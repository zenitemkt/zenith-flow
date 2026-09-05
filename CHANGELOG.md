# Changelog

## [Unreleased]

### Adicionado

- Estrutura de monorepo (npm workspaces): `apps/web` (Next.js 14 + Tailwind) e `packages/ui` (design system).
- Sidebar de navegação vertical expansível com todas as abas do produto-alvo (Visão geral, Produção, Gestão, Inteligência e automação, Comunicação e recursos, Sistema), cada uma como Empty State "Em desenvolvimento".
- `AppShell`, `MobileDrawer`, `Tooltip`, `ComingSoon` e configuração de navegação orientada a dados (`nav-config.ts`).
- Testes automatizados (Vitest + Testing Library) para o comportamento da sidebar.
- Documentação obrigatória do manual: `README.md`, `AGENTS.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `.env.example`.
- **Release 1A**: `packages/db` (Prisma + Postgres/Neon), autenticação por e-mail/senha (Better Auth), criação de agência + workspace + membership no signup, convite de membros com RBAC (`/configuracoes/equipe`), aceite de convite (`/convite/[token]`), middleware de proteção de rotas, sidebar com sessão real e logout.
- Teste automatizado de isolamento entre agências/workspaces (`packages/db`) rodando contra o banco Neon real.
- `docs/DATA_MODEL.md`.
- **Release 1B (parte 1)**: entidades de Cliente (`Client`, `ClientContact`, `ClientStatusHistory`, `ClientNote`) e Onboarding (`OnboardingTemplate`, `OnboardingRun`, `OnboardingItem`); template padrão semeado por agência; páginas `/clientes/carteira` (lista + criação) e `/clientes/[id]` (perfil 360 com contatos, mudança de status, checklist de onboarding sequencial e timeline); ativação de cliente cria seu `Workspace`.
- Testes de isolamento de clientes entre agências (`packages/db`).
- Cadastro de cliente completo via popup (`Modal` reutilizável em `packages/ui`): nome fantasia, CNPJ, e-mail, telefone, WhatsApp e responsável — só o nome é obrigatório, o resto pode ser preenchido depois via "Editar dados" no perfil do cliente (`PATCH /api/clients/:id`).
- **Release 1C (parte 1)**: Demandas (`Request`, `RequestComment`, `RequestStatusHistory`) — inbox (`/operacao/demandas`) com popup de criação (título, descrição, cliente, solicitante), detalhe com triagem/prioridade, aprovação/rejeição (com motivo) e comentários.
- Testes de isolamento de demandas entre agências (`packages/db`).
- **Release 1C (parte 2)**: Projetos e Tarefas (`Project`, `Task`, `TaskStatusHistory`) — quadro por status em `/operacao/projetos/[id]` (mover por botão), lista de tarefas em `/operacao/tarefas`, bloqueio real por dependência entre tarefas. Demanda aprovada agora tem "Converter em tarefa" (`POST /api/requests/:id/convert`), fechando o ciclo completo demanda → projeto → tarefa.
- Testes de isolamento e bloqueio por dependência de tarefas (`packages/db`).
- **Release 1C (parte 3)**: Rotinas recorrentes mensais (`RoutineTemplate`, `RoutineTemplateTask`, `RoutineRun`) — `/operacao/rotinas` (lista + criação) e `/operacao/rotinas/[id]` (ativar/pausar/gerar, histórico de gerações). Geração de período é idempotente de verdade via constraint única `[templateId, period]`; cada geração cria um `Project` com as tarefas do template clonadas.
- Testes de isolamento e idempotência de rotinas (`packages/db`).
- **Release 1C (parte 4)**: Squads e capacidade (`Squad`, `SquadMember`, `ClientAllocation`) — `/operacao/squads` (lista + criação) e `/operacao/squads/[id]` (membros com carga, clientes atendidos, realocação com histórico preservado). `Task` ganhou responsável real (atribuir na criação e reatribuir direto no quadro). Cliente 360 mostra o squad responsável.
- Testes de isolamento de squads e handoff de cliente (`packages/db`).
- **Release 1C (parte 5)**: Fornecedores (`Vendor`, `VendorOrder`) — `/operacao/fornecedores` (lista + criação) e `/operacao/fornecedores/[id]` (homologar/bloquear, ordens vinculáveis a tarefas internas, status próprio). Bloquear fornecedor preserva ordens existentes, só impede novas. Fecha a Release 1C (exceto Notificações, adiada).
- Testes de isolamento de fornecedores (`packages/db`).
- Contratos (`/clientes/contratos`): por decisão do usuário, botão simples abrindo a pasta de contratos no Google Drive numa aba nova, em vez do módulo completo da seção 12 do manual.
- **Release 1D (parte 1)**: Conteúdo e aprovação (`ContentItem`, `ContentVersion`, `ContentApproval`, `ContentComment`, `ContentStatusHistory`) — `/conteudo/planejamento` (lista + criação) e `/conteudo/[id]` (versões, comentários, histórico, envio para aprovação do cliente). Aprovação por link público sem login (`/aprovar/[token]`, expira em 14 dias, uma aprovação por versão) — satisfaz o critério de saída da Fase 1D sem exigir o Portal do Cliente completo.
- Testes de isolamento de conteúdo e de aprovação por versão específica (`packages/db`).
- **Release 1D (parte 2)**: Calendário editorial (`/conteudo/calendario`) — grade mensal das peças por data agendada, navegação entre meses, sem schema novo (segunda visualização sobre `ContentItem`).
- **Release 1D (parte 3)**: Filtro por cliente em Conteúdo — pills "Todos os clientes" / cliente específico em `/conteudo/planejamento` e `/conteudo/calendario` (`ContentClientFilter`), preservado ao trocar de visão ou mês. Perfil do cliente ganhou link "Conteúdo: N peças" que abre a lista já filtrada.
- **Release 1D (parte 4)**: Fila de aprovação (`/conteudo/aprovacoes`) — peças aguardando decisão do cliente (com prazo) e peças com ajustes pedidos ainda sem resposta do time. Corrigida a regra da seção 17 do manual: subir uma versão nova depois de já aprovado/agendado/publicado reabre a aprovação, voltando o item para "Produção" automaticamente. Fecha a seção 17 (exceto Biblioteca, que depende da escolha de storage).
- **Release 1D (parte 5)**: Portal do Cliente (seção 18, parte 1) — convite de contato de cliente pro portal a partir do perfil do cliente, login reaproveitando a mesma sessão/convite da Fase 1A, `/portal` (início), `/portal/calendario` e `/portal/aprovacoes` (aprovar/pedir ajuste autenticado, sem token). Sem tabela nova — reaproveita `Workspace(kind: CLIENT)` e os papéis `CLIENT_ADMIN`/`CLIENT_VIEWER` já existentes. Lógica de decisão de aprovação extraída para `lib/content-approval.ts`, compartilhada com o link público. Helpers de calendário (`lib/content-calendar.ts`, `CalendarGrid`) extraídos e reusados entre `/conteudo/calendario` e `/portal/calendario`.
- **Release 1D (parte 6)**: Solicitações no Portal do Cliente (`/portal/solicitacoes`) — cliente abre uma Demanda pra si mesmo, cai no mesmo inbox interno de triagem. Lógica de criação extraída para `lib/requests-create.ts`, compartilhada com a rota interna.
- **Segurança**: 32 rotas internas da API passaram a rejeitar sessões com papel de cliente (`isClientRole`) — gap que só se tornou explorável depois que o Portal do Cliente passou a criar sessões autenticadas reais para clientes.
- **Release 1D (parte 7)**: Comunicação e comentários (seção 19) — `CommentThread`/`Comment`/`CommentEdit`/`CommentMention` substituem `ContentComment`/`RequestComment` (removidos). Thread por entidade com estado aberta/resolvida, edição com histórico, remoção vira tombstone, menções por seletor de pessoas. Componente único (`CommentThreadPanel`) reusado em `/conteudo/[id]` e `/operacao/demandas/[id]`.
- Novo teste de isolamento e integridade de comentários (`packages/db`).
- **Release 1E (parte 1)**: RH básico (seção 20) — `Employee`/`EmployeeStatusHistory`/`LeaveRequest`/`LeaveRequestStatusHistory`, separados de `Membership` de propósito. `/pessoas/equipe` (lista + cadastro, com ou sem login vinculado) e `/pessoas/equipe/[id]` (status, férias/ausências, histórico); `/pessoas/ferias` (inbox de triagem cross-pessoa). Desligar alguém revoga sessões ativas e suspende o Membership, sem apagar autoria histórica. Squad (`/operacao/squads/[id]`) mostra "Afastado até" pra quem está em licença aprovada vigente.
- Novo teste de isolamento, desligamento e disponibilidade de RH (`packages/db`).
- **Release 1E (parte 2)**: Apontamento e produtividade (seção 21) — `Timesheet`/`TimesheetStatusHistory`/`TimeEntry`/`TimeEntryEdit` + `Task.estimatedMinutes`. `/pessoas/horas` (cronômetro real + apontamento manual, folha semanal com envio), `/pessoas/capacidade` (gestor: horas por pessoa, aprovar/corrigir folha, estimado × realizado por projeto). Estimativa inline no quadro de tarefas; squad mostra horas reais da semana além da contagem de tarefas.
- Corrigido bug de arredondamento que zerava apontamentos curtos de cronômetro (`roundMinutes` agora tem piso de 15min).
- Novo teste de isolamento, unicidade de folha por semana e correção com histórico (`packages/db`).
