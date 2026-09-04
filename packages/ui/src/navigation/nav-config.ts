import {
  Home,
  Users,
  Briefcase,
  Workflow,
  FileText,
  CheckCircle2,
  Calendar,
  Wallet,
  UserCog,
  BarChart3,
  Zap,
  Sparkles,
  MessageSquare,
  Globe,
  Wrench,
  GraduationCap,
  Plug,
  Settings,
} from "lucide-react";
import type { NavigationGroup } from "./types";

/**
 * Estrutura de navegação da Fase 1 do ZENITH FLOW (Manual Mestre v2.0, seção 4.4 e
 * especificação de sidebar). Todos os itens nascem com comingSoon: true e são
 * habilitados individualmente conforme cada fatia funcional é implementada —
 * ver docs/STATUS.md para o que já está ativo.
 */
export const navigationGroups: NavigationGroup[] = [
  {
    id: "overview",
    label: "Visão geral",
    items: [
      { id: "home", label: "Home", icon: Home, href: "/", comingSoon: true },
      {
        id: "clients",
        label: "Clientes",
        icon: Users,
        href: "/clientes",
        comingSoon: false,
        children: [
          { id: "clients-portfolio", label: "Carteira", href: "/clientes/carteira", comingSoon: false },
          { id: "clients-onboarding", label: "Onboarding", href: "/clientes/onboarding", comingSoon: true },
          { id: "clients-contracts", label: "Contratos", href: "/clientes/contratos", comingSoon: false },
          { id: "clients-nps", label: "NPS", href: "/clientes/nps", comingSoon: true },
          { id: "clients-reactivation", label: "Reativações", href: "/clientes/reativacoes", comingSoon: true },
        ],
      },
      {
        id: "commercial",
        label: "Comercial",
        icon: Briefcase,
        href: "/comercial",
        comingSoon: true,
        children: [
          { id: "commercial-leads", label: "Leads", href: "/comercial/leads", comingSoon: true },
          { id: "commercial-pipeline", label: "Pipeline", href: "/comercial/pipeline", comingSoon: true },
          { id: "commercial-proposals", label: "Propostas", href: "/comercial/propostas", comingSoon: true },
          { id: "commercial-products", label: "Produtos", href: "/comercial/produtos", comingSoon: true },
          { id: "commercial-goals", label: "Metas", href: "/comercial/metas", comingSoon: true },
        ],
      },
    ],
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
          { id: "operations-projects", label: "Projetos", href: "/operacao/projetos", comingSoon: false },
          { id: "operations-requests", label: "Demandas", href: "/operacao/demandas", comingSoon: false },
          { id: "operations-tasks", label: "Tarefas", href: "/operacao/tarefas", comingSoon: false },
          { id: "operations-routines", label: "Rotinas", href: "/operacao/rotinas", comingSoon: false },
          { id: "operations-squads", label: "Squads", href: "/operacao/squads", comingSoon: false },
          { id: "operations-vendors", label: "Fornecedores", href: "/operacao/fornecedores", comingSoon: false },
        ],
      },
      {
        id: "content",
        label: "Conteúdo",
        icon: FileText,
        href: "/conteudo",
        comingSoon: false,
        children: [
          { id: "content-planning", label: "Planejamento", href: "/conteudo/planejamento", comingSoon: false },
          { id: "content-calendar", label: "Calendário", href: "/conteudo/calendario", comingSoon: true },
          { id: "content-posts", label: "Posts", href: "/conteudo/posts", comingSoon: true },
          { id: "content-approvals", label: "Aprovações", href: "/conteudo/aprovacoes", comingSoon: true },
          { id: "content-publishing", label: "Publicação", href: "/conteudo/publicacao", comingSoon: true },
        ],
      },
      { id: "approvals", label: "Aprovações", icon: CheckCircle2, href: "/aprovacoes", comingSoon: true },
      { id: "calendar", label: "Calendário", icon: Calendar, href: "/calendario", comingSoon: true },
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
        href: "/financeiro",
        comingSoon: true,
        children: [
          { id: "finance-overview", label: "Visão geral", href: "/financeiro/visao-geral", comingSoon: true },
          { id: "finance-receivables", label: "Contas a receber", href: "/financeiro/receber", comingSoon: true },
          { id: "finance-payables", label: "Contas a pagar", href: "/financeiro/pagar", comingSoon: true },
          { id: "finance-billing", label: "Cobranças", href: "/financeiro/cobrancas", comingSoon: true },
          { id: "finance-dre", label: "DRE", href: "/financeiro/dre", comingSoon: true },
          { id: "finance-cashflow", label: "Fluxo de caixa", href: "/financeiro/caixa", comingSoon: true },
          { id: "finance-indicators", label: "Indicadores", href: "/financeiro/indicadores", comingSoon: true },
        ],
      },
      {
        id: "people",
        label: "Pessoas",
        icon: UserCog,
        href: "/pessoas",
        comingSoon: true,
        children: [
          { id: "people-team", label: "Equipe", href: "/pessoas/equipe", comingSoon: true },
          { id: "people-capacity", label: "Capacidade", href: "/pessoas/capacidade", comingSoon: true },
          { id: "people-hours", label: "Horas", href: "/pessoas/horas", comingSoon: true },
          { id: "people-vacations", label: "Férias", href: "/pessoas/ferias", comingSoon: true },
          { id: "people-jobs", label: "Vagas", href: "/pessoas/vagas", comingSoon: true },
          { id: "people-enps", label: "eNPS", href: "/pessoas/enps", comingSoon: true },
        ],
      },
      { id: "reports", label: "Relatórios", icon: BarChart3, href: "/relatorios", comingSoon: true },
    ],
  },
  {
    id: "intelligence",
    label: "Inteligência e automação",
    items: [
      { id: "automations", label: "Automações", icon: Zap, href: "/automacoes", comingSoon: true },
      { id: "zenith-ai", label: "Zenith AI", icon: Sparkles, href: "/zenith-ai", comingSoon: true },
    ],
  },
  {
    id: "communication",
    label: "Comunicação e recursos",
    items: [
      { id: "chat", label: "Chat", icon: MessageSquare, href: "/chat", comingSoon: true },
      { id: "client-portal", label: "Portal do Cliente", icon: Globe, href: "/portal", comingSoon: true },
      { id: "toolkit", label: "Toolkit", icon: Wrench, href: "/toolkit", comingSoon: true },
      { id: "academy", label: "Academy", icon: GraduationCap, href: "/academy", comingSoon: true },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    items: [
      { id: "integrations", label: "Integrações", icon: Plug, href: "/integracoes", comingSoon: true },
      {
        id: "settings",
        label: "Configurações",
        icon: Settings,
        href: "/configuracoes",
        comingSoon: true,
        children: [
          {
            id: "settings-team",
            label: "Equipe e permissões",
            href: "/configuracoes/equipe",
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
