import {
  Home,
  Users,
  Briefcase,
  Workflow,
  Wallet,
  UserCog,
  Zap,
  Sparkles,
  MessageSquare,
  Globe,
  GraduationCap,
  Plug,
  Settings,
} from "lucide-react";
import type { NavigationGroup } from "./types";

/**
 * Estrutura de navegação da Fase 1 do ZENITE MKT (Manual Mestre v2.0, seção 4.4 e
 * especificação de sidebar). Todos os itens nascem com comingSoon: true e são
 * habilitados individualmente conforme cada fatia funcional é implementada —
 * ver docs/STATUS.md para o que já está ativo.
 *
 * Ordem dos grupos reorganizada por frequência de uso (pedido do usuário,
 * 2026-09-07): processos do dia a dia (Produção, Comercial, Gestão) vêm logo
 * após a Home; Clientes (carteira/cadastro, acessado com bem menos frequência
 * que o resto) desce para depois de Gestão. Ver docs/DECISIONS.md.
 *
 * Sidebar sem accordion (pedido do usuário, 2026-09-08, inspirado no Kiiru):
 * `href` de cada item com `children` aponta direto para a primeira "subdivisão"
 * (children[0].href) — o item é sempre um link único, nunca um botão que abre
 * submenu. `children` deixou de alimentar a sidebar e passou a alimentar as
 * abas horizontais (`SectionTabs`, em `AppShell`) exibidas no topo do conteúdo
 * quando a rota ativa bate com uma das subdivisões daquele item.
 */
export const navigationGroups: NavigationGroup[] = [
  {
    id: "overview",
    label: "Visão geral",
    items: [{ id: "home", label: "Home", icon: Home, href: "/", comingSoon: false }],
  },
  {
    id: "production",
    label: "Produção",
    items: [
      {
        id: "operations",
        label: "Operação",
        icon: Workflow,
        href: "/operacao",
        comingSoon: false,
        children: [
          { id: "operations-board", label: "Quadro", href: "/operacao", comingSoon: false },
          { id: "operations-calendar", label: "Calendário", href: "/operacao/calendario", comingSoon: false },
          { id: "operations-library", label: "Biblioteca", href: "/operacao/biblioteca", comingSoon: false },
          { id: "operations-recurring", label: "Recorrências", href: "/operacao/recorrencias", comingSoon: false },
          { id: "operations-publishing", label: "Publicação", href: "/operacao/publicacao", comingSoon: true },
        ],
      },
      {
        id: "commercial",
        label: "Comercial",
        icon: Briefcase,
        href: "/comercial/pipeline",
        comingSoon: false,
        children: [
          { id: "commercial-pipeline", label: "Pipeline", href: "/comercial/pipeline", comingSoon: false },
          { id: "commercial-leads", label: "Leads", href: "/comercial/leads", comingSoon: false },
          { id: "commercial-proposals", label: "Propostas", href: "/comercial/propostas", comingSoon: false },
          { id: "commercial-campaigns", label: "Campanhas", href: "/comercial/campanhas", comingSoon: false },
          { id: "commercial-products", label: "Produtos", href: "/comercial/produtos", comingSoon: true },
          { id: "commercial-goals", label: "Metas", href: "/comercial/metas", comingSoon: true },
        ],
      },
    ],
  },
  {
    id: "management",
    label: "Gestão",
    items: [
      {
        id: "finance",
        label: "Financeiro",
        icon: Wallet,
        href: "/financeiro/visao-geral",
        comingSoon: false,
        children: [
          { id: "finance-overview", label: "Visão geral", href: "/financeiro/visao-geral", comingSoon: false },
          { id: "finance-receivables", label: "Contas a receber", href: "/financeiro/receber", comingSoon: false },
          { id: "finance-payables", label: "Contas a pagar", href: "/financeiro/pagar", comingSoon: false },
          { id: "finance-billing", label: "Cobranças", href: "/financeiro/cobrancas", comingSoon: false },
          { id: "finance-dre", label: "DRE", href: "/financeiro/dre", comingSoon: false },
          { id: "finance-cashflow", label: "Fluxo de caixa", href: "/financeiro/caixa", comingSoon: false },
          { id: "finance-indicators", label: "Indicadores", href: "/financeiro/indicadores", comingSoon: false },
        ],
      },
      {
        id: "people",
        label: "Pessoas",
        icon: UserCog,
        href: "/pessoas/equipe",
        comingSoon: false,
        children: [
          { id: "people-team", label: "Equipe", href: "/pessoas/equipe", comingSoon: false },
          { id: "people-capacity", label: "Capacidade", href: "/pessoas/capacidade", comingSoon: false },
          { id: "people-hours", label: "Horas", href: "/pessoas/horas", comingSoon: false },
          { id: "people-vacations", label: "Férias", href: "/pessoas/ferias", comingSoon: false },
          { id: "people-jobs", label: "Vagas", href: "/pessoas/vagas", comingSoon: false },
          { id: "people-enps", label: "eNPS", href: "/pessoas/enps", comingSoon: false },
        ],
      },
    ],
  },
  {
    id: "client-management",
    label: "Clientes",
    items: [
      {
        id: "clients",
        label: "Clientes",
        icon: Users,
        href: "/clientes/carteira",
        comingSoon: false,
        children: [
          { id: "clients-portfolio", label: "Carteira", href: "/clientes/carteira", comingSoon: false },
          { id: "clients-risk", label: "Risco de churn", href: "/clientes/risco", comingSoon: false },
          { id: "clients-onboarding", label: "Onboarding", href: "/clientes/onboarding", comingSoon: false },
          { id: "clients-contracts", label: "Contratos", href: "/clientes/contratos", comingSoon: false },
          { id: "clients-files", label: "Arquivos", href: "/clientes/arquivos", comingSoon: false },
          { id: "clients-nps", label: "NPS", href: "/clientes/nps", comingSoon: false },
          { id: "clients-cohort", label: "Cohort", href: "/clientes/cohort", comingSoon: false },
          { id: "clients-reactivation", label: "Reativações", href: "/clientes/reativacoes", comingSoon: false },
        ],
      },
    ],
  },
  {
    id: "intelligence",
    label: "Inteligência e automação",
    items: [
      { id: "automations", label: "Automações", icon: Zap, href: "/automacoes", comingSoon: false },
      { id: "zenite-ai", label: "Zenite AI", icon: Sparkles, href: "/zenite-ai", comingSoon: true },
    ],
  },
  {
    id: "communication",
    label: "Comunicação e recursos",
    items: [
      { id: "chat", label: "Chat", icon: MessageSquare, href: "/chat", comingSoon: true },
      { id: "client-portal", label: "Portal do Cliente", icon: Globe, href: "/portal", comingSoon: true },
      { id: "academy", label: "Academy", icon: GraduationCap, href: "/academy", comingSoon: true },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    items: [
      { id: "integrations", label: "Integrações", icon: Plug, href: "/integracoes", comingSoon: false },
      {
        id: "settings",
        label: "Configurações",
        icon: Settings,
        href: "/configuracoes/equipe",
        comingSoon: false,
        children: [
          {
            id: "settings-team",
            label: "Equipe e permissões",
            href: "/configuracoes/equipe",
            comingSoon: false,
          },
          {
            id: "settings-appearance",
            label: "Aparência",
            href: "/configuracoes/aparencia",
            comingSoon: false,
          },
        ],
      },
    ],
  },
];

export function findNavigationItemByHref(href: string) {
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.href === href) return item;
      const child = item.children?.find((c) => c.href === href);
      if (child) return child;
    }
  }
  return undefined;
}
