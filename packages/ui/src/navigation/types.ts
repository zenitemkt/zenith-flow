import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export type IconComponent = ComponentType<LucideProps>;

export interface NavigationItem {
  /** Identificador estável do item (usado em rotas, testes e persistência). */
  id: string;
  /** Rótulo visível quando a sidebar está expandida ou em tooltip quando recolhida. */
  label: string;
  /** Ícone linear (Lucide) exibido em ambos os estados. Opcional em subitens. */
  icon?: IconComponent;
  /** Rota de destino. Itens apenas organizacionais (grupos) não possuem href. */
  href?: string;
  /** Nome do grupo ao qual o item pertence (Visão geral, Produção, Gestão...). */
  group?: string;
  /** Permissão RBAC necessária para o item aparecer. Ausente = visível a todos os papéis internos. */
  permission?: string;
  /** Feature flag que precisa estar ativa para o item aparecer. */
  featureFlag?: string;
  /** Badge de notificação/contagem exibido à direita quando expandido. */
  badge?: number | string;
  /**
   * "Subdivisões" do item — não aparecem na sidebar (que é sempre um link
   * único, sem accordion). Alimentam as abas horizontais (`SectionTabs`) no
   * topo do conteúdo quando a rota ativa corresponde a uma delas.
   */
  children?: NavigationItem[];
  /**
   * Indica que a funcionalidade ainda não foi implementada nesta fase do projeto.
   * Itens marcados navegam para uma tela "Em desenvolvimento" em vez de 404.
   */
  comingSoon?: boolean;
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavigationItem[];
}
