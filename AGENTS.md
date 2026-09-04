# Instruções para agentes (Codex / Claude Code)

Fonte de verdade funcional, visual e técnica: `ZENITH_FLOW_Manual_Mestre_v2.0 (1).pdf` na raiz do repositório. Leia-o inteiro antes de qualquer fatia nova; releia a seção da fase em execução.

**Exceção registrada**: o comportamento da sidebar implementado em `packages/ui/src/navigation` e `packages/ui/src/shell` segue a especificação de "menu lateral vertical expansível" combinada pelo usuário (hover/foco para expandir, recolhida por padrão, submenu só por clique, tooltip no estado recolhido, drawer mobile), que **substitui** a navegação lateral fixa descrita nas seções 4.3/4.4 do manual. Todas as demais definições do manual continuam válidas.

## Antes de codificar

1. `git status` — nunca sobrescrever trabalho não commitado do usuário.
2. Ler `docs/STATUS.md` e `docs/DECISIONS.md` para saber o que já existe.
3. Comparar a fatia pedida com a Matriz funcional mestra (seção 52 do manual).
4. Escrever um plano curto (arquivos, migration, API, UI, testes) antes de editar.

## Durante

- Implementar em fatia vertical: banco → domínio → API → UI → teste → observabilidade.
- Não criar telas vazias sem estado "Em desenvolvimento" explícito.
- Toda aba nova entra em `packages/ui/src/navigation/nav-config.ts` com `comingSoon: true` até ter lógica real — nunca hardcoded em múltiplos lugares.
- Preservar multi-tenancy, RBAC, auditoria e idempotência desde a primeira migration (quando o banco entrar em cena).
- Não usar credenciais de produção; sandbox/fakes apenas.

## Ao finalizar

- Rodar lint, typecheck, testes e build do workspace afetado.
- Atualizar `docs/STATUS.md`, `docs/DECISIONS.md` e `CHANGELOG.md`.
- Resumir: resultado, arquivos principais, testes, limitações, próxima fatia segura.
