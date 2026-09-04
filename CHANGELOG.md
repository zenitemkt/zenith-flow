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
