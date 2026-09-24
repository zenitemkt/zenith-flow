"use client";

import { Fragment, useId, useRef, type ElementType, type KeyboardEvent } from "react";
import {
  HelpCircle,
  Bell,
  Pin,
  PinOff,
  LogOut,
} from "lucide-react";
import type { NavigationGroup, NavigationItem } from "./types";
import { Tooltip } from "./Tooltip";
import { useReducedMotion, useSidebarState } from "./useSidebarState";
import { AgencySwitcher } from "./AgencySwitcher";

export interface SidebarProps {
  groups: NavigationGroup[];
  activePath: string;
  /** Componente de link do roteador do host (ex.: next/link). Default: <a>. */
  linkComponent?: ElementType;
  currentUser?: {
    name: string;
    role: string;
    workspace: string;
  };
  onSignOut?: () => void;
  /** Agências do usuário — 2+ habilita o seletor no cabeçalho; 0/1 mantém o rótulo estático. */
  agencies?: { id: string; name: string }[];
  currentAgencyId?: string;
  onSwitchAgency?: (agencyId: string) => void;
}

const DEFAULT_USER = {
  name: "Kevin Belluco",
  role: "Admin da Agência",
  workspace: "Zenite Mkt",
};

function isItemActive(item: NavigationItem, activePath: string): boolean {
  if (item.href === activePath) return true;
  return item.children?.some((child) => child.href === activePath) ?? false;
}

export function Sidebar({
  groups,
  activePath,
  linkComponent,
  currentUser = DEFAULT_USER,
  onSignOut,
  agencies,
  currentAgencyId,
  onSwitchAgency,
}: SidebarProps) {
  const Link = linkComponent ?? "a";
  const { expanded, pinned, togglePinned, handlers } = useSidebarState();
  const reducedMotion = useReducedMotion();
  const navRef = useRef<HTMLElement | null>(null);

  const transitionClass = reducedMotion
    ? "transition-none"
    : "transition-[width,box-shadow] duration-200 ease-out";
  const textTransitionClass = reducedMotion
    ? "transition-none"
    : "transition-opacity duration-150 ease-out";

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      if (!pinned && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }

  return (
    <nav
      ref={navRef}
      aria-label="Navegação principal"
      onMouseEnter={handlers.onMouseEnter}
      onMouseLeave={handlers.onMouseLeave}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      onKeyDown={handleKeyDown}
      data-expanded={expanded}
      className={[
        "fixed left-3 top-3 bottom-3 z-40 hidden md:flex md:flex-col",
        "rounded-[16px] border border-[#2F3140] bg-[#171821] text-white",
        expanded ? "w-[280px] shadow-[0_18px_48px_rgba(16,24,40,0.22)]" : "w-[68px] shadow-sm",
        transitionClass,
      ].join(" ")}
    >
      <SidebarHeader
        expanded={expanded}
        pinned={pinned}
        onTogglePin={togglePinned}
        Link={Link}
        textTransitionClass={textTransitionClass}
        currentUser={currentUser}
        agencies={agencies}
        currentAgencyId={currentAgencyId}
        onSwitchAgency={onSwitchAgency}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 [scrollbar-width:thin]">
        {groups.map((group, groupIndex) => (
          <Fragment key={group.id}>
            {groupIndex > 0 && (
              <div className="my-2 border-t border-[#303343]" role="separator" />
            )}
            <SidebarGroup
              group={group}
              expanded={expanded}
              activePath={activePath}
              Link={Link}
              textTransitionClass={textTransitionClass}
            />
          </Fragment>
        ))}
      </div>

      <SidebarFooter
        expanded={expanded}
        currentUser={currentUser}
        textTransitionClass={textTransitionClass}
        onSignOut={onSignOut}
      />
    </nav>
  );
}

function SidebarHeader({
  expanded,
  pinned,
  onTogglePin,
  Link,
  textTransitionClass,
  currentUser,
  agencies,
  currentAgencyId,
  onSwitchAgency,
}: {
  expanded: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  Link: ElementType;
  textTransitionClass: string;
  currentUser: { name: string; role: string; workspace: string };
  agencies?: { id: string; name: string }[];
  currentAgencyId?: string;
  onSwitchAgency?: (agencyId: string) => void;
}) {
  const canSwitch = (agencies?.length ?? 0) > 1 && Boolean(onSwitchAgency);

  return (
    <div className="flex flex-col border-b border-[#303343] px-2 py-3">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="Ir para a página inicial do ZENITE MKT"
          className="flex h-11 min-w-[44px] items-center gap-2 rounded-lg px-2 text-white hover:bg-[#232532]"
        >
          <img
            src="/logo-z.png"
            alt=""
            aria-hidden
            className="h-8 w-8 shrink-0 rounded-lg object-cover"
          />
          {expanded && (
            <span
              className={`whitespace-nowrap text-sm font-semibold text-white ${textTransitionClass}`}
            >
              ZENITE MKT
            </span>
          )}
        </Link>
        {expanded && (
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label={pinned ? "Desafixar menu expandido" : "Fixar menu expandido"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#AEB4C5] hover:bg-[#232532] hover:text-white"
          >
            {pinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
          </button>
        )}
      </div>

      {expanded && (
        <AgencySwitcher
          workspace={currentUser.workspace}
          textTransitionClass={textTransitionClass}
          agencies={agencies}
          currentAgencyId={currentAgencyId}
          onSwitchAgency={canSwitch ? onSwitchAgency : undefined}
        />
      )}
    </div>
  );
}


function SidebarGroup({
  group,
  expanded,
  activePath,
  Link,
  textTransitionClass,
}: {
  group: NavigationGroup;
  expanded: boolean;
  activePath: string;
  Link: ElementType;
  textTransitionClass: string;
}) {
  const headingId = useId();

  return (
    <div role="group" aria-labelledby={expanded ? headingId : undefined} className="py-1">
      {expanded && (
        <p
          id={headingId}
          className={`px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#8E93A6] ${textTransitionClass}`}
        >
          {group.label}
        </p>
      )}
      <ul className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <li key={item.id}>
            <SidebarItem
              item={item}
              expanded={expanded}
              activePath={activePath}
              Link={Link}
              textTransitionClass={textTransitionClass}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarItem({
  item,
  expanded,
  activePath,
  Link,
  textTransitionClass,
}: {
  item: NavigationItem;
  expanded: boolean;
  activePath: string;
  Link: ElementType;
  textTransitionClass: string;
}) {
  const active = isItemActive(item, activePath);
  const Icon = item.icon;

  const rowClassName = [
    "group flex h-11 w-full min-w-[44px] items-center gap-2 rounded-lg px-2.5 text-sm transition-colors",
    active
      ? "bg-[#2A2D3D] font-semibold text-white shadow-[inset_3px_0_0_#FF2B00]"
      : "font-medium text-[#CFD3DF] hover:bg-[#232532] hover:text-white",
  ].join(" ");

  const content = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {Icon && (
          <Icon
            size={19}
            aria-hidden
            className={active ? "text-white" : "text-[#AEB4C5] group-hover:text-white"}
          />
        )}
      </span>
      {expanded && (
        <span className={`min-w-0 flex-1 truncate text-left ${textTransitionClass}`}>
          {item.label}
          {item.comingSoon && (
            <span className="ml-1.5 rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#92600A]">
              em desenvolvimento
            </span>
          )}
        </span>
      )}
      {expanded && item.badge != null && (
        <span className="shrink-0 rounded-full bg-[#FFF1EC] px-1.5 text-xs font-semibold text-[#FF2B00]">
          {item.badge}
        </span>
      )}
    </>
  );

  return (
    <Tooltip label={item.label} disabled={expanded}>
      {(describedBy) => (
        <Link
          href={item.href}
          aria-describedby={describedBy}
          aria-current={active ? "page" : undefined}
          className={rowClassName}
        >
          {content}
        </Link>
      )}
    </Tooltip>
  );
}

function SidebarFooter({
  expanded,
  currentUser,
  textTransitionClass,
  onSignOut,
}: {
  expanded: boolean;
  currentUser: { name: string; role: string; workspace: string };
  textTransitionClass: string;
  onSignOut?: () => void;
}) {
  const footerButtons = [
    { id: "help", label: "Ajuda", icon: HelpCircle, onClick: undefined },
    { id: "notifications", label: "Notificações", icon: Bell, onClick: undefined },
    ...(onSignOut ? [{ id: "sign-out", label: "Sair", icon: LogOut, onClick: onSignOut }] : []),
  ];

  return (
    <div className="border-t border-[#303343] px-2 py-2">
      <ul className="flex flex-col gap-0.5">
        {footerButtons.map(({ id, label, icon: Icon, onClick }) => (
          <li key={id}>
            <Tooltip label={label} disabled={expanded}>
              {(describedBy) => (
                <button
                  type="button"
                  onClick={onClick}
                  aria-describedby={describedBy}
                  aria-label={expanded ? undefined : label}
                  className="flex h-11 w-full min-w-[44px] items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-[#CFD3DF] hover:bg-[#232532] hover:text-white"
                >
                  <Icon size={19} aria-hidden className="shrink-0 text-[#AEB4C5]" />
                  {expanded && (
                    <span className={`truncate ${textTransitionClass}`}>{label}</span>
                  )}
                </button>
              )}
            </Tooltip>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="mt-1 flex h-12 w-full min-w-[44px] items-center gap-2 rounded-lg px-2 hover:bg-[#232532]"
        aria-label={`Perfil de ${currentUser.name}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF1EC] text-xs font-semibold text-[#FF2B00]">
          {currentUser.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
        {expanded && (
          <span className={`min-w-0 flex-1 text-left ${textTransitionClass}`}>
            <span className="block truncate text-sm font-semibold text-white">
              {currentUser.name}
            </span>
            <span className="block truncate text-xs text-[#AEB4C5]">{currentUser.role}</span>
          </span>
        )}
      </button>
    </div>
  );
}
