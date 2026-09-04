"use client";

import {
  Fragment,
  useId,
  useRef,
  type ElementType,
  type KeyboardEvent,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Bell,
  Settings,
  Pin,
  PinOff,
  LogOut,
} from "lucide-react";
import type { NavigationGroup, NavigationItem } from "./types";
import { Tooltip } from "./Tooltip";
import { useReducedMotion, useSidebarState } from "./useSidebarState";

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
}

const DEFAULT_USER = {
  name: "Kevin Belluco",
  role: "Admin da Agência",
  workspace: "Zenith Marketing e Mídia",
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
}: SidebarProps) {
  const Link = linkComponent ?? "a";
  const {
    expanded,
    pinned,
    openSubmenuId,
    togglePinned,
    toggleSubmenu,
    closeSubmenu,
    handlers,
  } = useSidebarState();
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
      if (openSubmenuId) {
        event.stopPropagation();
        closeSubmenu();
        return;
      }
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
        "rounded-[16px] border border-[#E4E7EC] bg-white",
        expanded ? "w-[268px] shadow-lg" : "w-[68px] shadow-sm",
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
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 [scrollbar-width:thin]">
        {groups.map((group, groupIndex) => (
          <Fragment key={group.id}>
            {groupIndex > 0 && (
              <div className="my-2 border-t border-[#EEF0F3]" role="separator" />
            )}
            <SidebarGroup
              group={group}
              expanded={expanded}
              activePath={activePath}
              openSubmenuId={openSubmenuId}
              onToggleSubmenu={toggleSubmenu}
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
}: {
  expanded: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  Link: ElementType;
  textTransitionClass: string;
  currentUser: { name: string; role: string; workspace: string };
}) {
  return (
    <div className="flex flex-col border-b border-[#EEF0F3] px-2 py-3">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="Ir para a página inicial do ZENITH FLOW"
          className="flex h-11 min-w-[44px] items-center gap-2 rounded-lg px-2 hover:bg-[#F6F7FB]"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: "#6847F5" }}
          >
            Z
          </span>
          {expanded && (
            <span
              className={`whitespace-nowrap text-sm font-semibold text-[#101828] ${textTransitionClass}`}
            >
              ZENITH FLOW
            </span>
          )}
        </Link>
        {expanded && (
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label={pinned ? "Desafixar menu expandido" : "Fixar menu expandido"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F6F7FB]"
          >
            {pinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
          </button>
        )}
      </div>

      {expanded && (
        <button
          type="button"
          className={`mt-2 flex items-center gap-2 rounded-lg border border-[#E4E7EC] px-2 py-2 text-left hover:bg-[#F6F7FB] ${textTransitionClass}`}
          aria-label={`Workspace atual: ${currentUser.workspace}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-xs font-semibold text-[#6847F5]">
            {currentUser.workspace.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#101828]">
            {currentUser.workspace}
          </span>
          <ChevronDown size={14} className="shrink-0 text-[#667085]" aria-hidden />
        </button>
      )}
    </div>
  );
}

function SidebarGroup({
  group,
  expanded,
  activePath,
  openSubmenuId,
  onToggleSubmenu,
  Link,
  textTransitionClass,
}: {
  group: NavigationGroup;
  expanded: boolean;
  activePath: string;
  openSubmenuId: string | null;
  onToggleSubmenu: (id: string) => void;
  Link: ElementType;
  textTransitionClass: string;
}) {
  const headingId = useId();

  return (
    <div role="group" aria-labelledby={expanded ? headingId : undefined} className="py-1">
      {expanded && (
        <p
          id={headingId}
          className={`px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3] ${textTransitionClass}`}
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
              isSubmenuOpen={openSubmenuId === item.id}
              onToggleSubmenu={onToggleSubmenu}
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
  isSubmenuOpen,
  onToggleSubmenu,
  Link,
  textTransitionClass,
}: {
  item: NavigationItem;
  expanded: boolean;
  activePath: string;
  isSubmenuOpen: boolean;
  onToggleSubmenu: (id: string) => void;
  Link: ElementType;
  textTransitionClass: string;
}) {
  const active = isItemActive(item, activePath);
  const Icon = item.icon;
  const submenuId = useId();
  const hasChildren = Boolean(item.children?.length);

  const rowClassName = [
    "group flex h-11 w-full min-w-[44px] items-center gap-2 rounded-lg px-2.5 text-sm",
    active
      ? "bg-[#F1EDFE] font-semibold text-[#4A2FD8]"
      : "font-medium text-[#475467] hover:bg-[#F6F7FB]",
  ].join(" ");

  const content = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {Icon && (
          <Icon
            size={19}
            aria-hidden
            className={active ? "text-[#6847F5]" : "text-[#667085]"}
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
        <span className="shrink-0 rounded-full bg-[#F1EDFE] px-1.5 text-xs font-semibold text-[#6847F5]">
          {item.badge}
        </span>
      )}
      {expanded && hasChildren && (
        <ChevronRight
          size={14}
          aria-hidden
          className={`shrink-0 text-[#98A2B3] transition-transform ${isSubmenuOpen ? "rotate-90" : ""}`}
        />
      )}
    </>
  );

  return (
    <div>
      <Tooltip label={item.label} disabled={expanded}>
        {(describedBy) =>
          hasChildren ? (
            <button
              type="button"
              aria-expanded={isSubmenuOpen}
              aria-controls={submenuId}
              aria-describedby={describedBy}
              aria-current={active ? "page" : undefined}
              onClick={() => onToggleSubmenu(item.id)}
              className={rowClassName}
            >
              {content}
            </button>
          ) : (
            <Link
              href={item.href}
              aria-describedby={describedBy}
              aria-current={active ? "page" : undefined}
              className={rowClassName}
            >
              {content}
            </Link>
          )
        }
      </Tooltip>

      {hasChildren && expanded && isSubmenuOpen && (
        <ul id={submenuId} className="ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-[#EEF0F3] pl-3">
          {item.children!.map((child) => {
            const childActive = child.href === activePath;
            return (
              <li key={child.id}>
                <Link
                  href={child.href}
                  aria-current={childActive ? "page" : undefined}
                  className={[
                    "flex h-9 items-center rounded-md px-2 text-sm",
                    childActive
                      ? "font-semibold text-[#4A2FD8]"
                      : "text-[#667085] hover:bg-[#F6F7FB]",
                  ].join(" ")}
                >
                  <span className="truncate">{child.label}</span>
                  {child.comingSoon && (
                    <span className="ml-1.5 shrink-0 rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#92600A]">
                      em desenvolvimento
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
    { id: "settings", label: "Configurações", icon: Settings, onClick: undefined },
    ...(onSignOut ? [{ id: "sign-out", label: "Sair", icon: LogOut, onClick: onSignOut }] : []),
  ];

  return (
    <div className="border-t border-[#EEF0F3] px-2 py-2">
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
                  className="flex h-11 w-full min-w-[44px] items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
                >
                  <Icon size={19} aria-hidden className="shrink-0 text-[#667085]" />
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
        className="mt-1 flex h-12 w-full min-w-[44px] items-center gap-2 rounded-lg px-2 hover:bg-[#F6F7FB]"
        aria-label={`Perfil de ${currentUser.name}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EDFE] text-xs font-semibold text-[#6847F5]">
          {currentUser.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
        {expanded && (
          <span className={`min-w-0 flex-1 text-left ${textTransitionClass}`}>
            <span className="block truncate text-sm font-semibold text-[#101828]">
              {currentUser.name}
            </span>
            <span className="block truncate text-xs text-[#667085]">{currentUser.role}</span>
          </span>
        )}
      </button>
    </div>
  );
}
