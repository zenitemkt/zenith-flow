import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { NavigationGroup } from "./types";
import { Home, Users } from "lucide-react";

const groups: NavigationGroup[] = [
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
        comingSoon: true,
        children: [
          { id: "clients-portfolio", label: "Carteira", href: "/clientes/carteira", comingSoon: true },
          { id: "clients-nps", label: "NPS", href: "/clientes/nps", comingSoon: true },
        ],
      },
    ],
  },
];

function renderSidebar(activePath = "/") {
  return render(<Sidebar groups={groups} activePath={activePath} />);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Sidebar", () => {
  it("renders collapsed by default and hides labels", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(nav.getAttribute("data-expanded")).toBe("false");
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("expands on mouse enter and shows labels", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.mouseEnter(nav);
    expect(nav.getAttribute("data-expanded")).toBe("true");
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("collapses ~200ms after mouse leave", () => {
    vi.useFakeTimers();
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.mouseEnter(nav);
    expect(nav.getAttribute("data-expanded")).toBe("true");

    fireEvent.mouseLeave(nav);
    expect(nav.getAttribute("data-expanded")).toBe("true");

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(nav.getAttribute("data-expanded")).toBe("true");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(nav.getAttribute("data-expanded")).toBe("false");
  });

  it("expands on keyboard focus", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.focus(nav);
    expect(nav.getAttribute("data-expanded")).toBe("true");
  });

  it("marks the active item with aria-current=page", () => {
    renderSidebar("/");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.mouseEnter(nav);
    const homeLink = screen.getByRole("link", { name: /Home/ });
    expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  it("renders an item with children as a single link, never as an expand button", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.mouseEnter(nav);
    const clientsLink = screen.getByRole("link", { name: /Clientes/ });
    expect(clientsLink).toHaveAttribute("href", "/clientes");
    expect(screen.queryByRole("button", { name: /Clientes/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Carteira")).not.toBeInTheDocument();
  });

  it("marks the parent link as active when the current route matches a child href", () => {
    renderSidebar("/clientes/carteira");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.mouseEnter(nav);
    const clientsLink = screen.getByRole("link", { name: /Clientes/ });
    expect(clientsLink).toHaveAttribute("aria-current", "page");
  });

  it("blurs the focused item on Escape when the sidebar is not pinned", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.mouseEnter(nav);
    const homeLink = screen.getByRole("link", { name: /Home/ });
    homeLink.focus();
    expect(document.activeElement).toBe(homeLink);

    fireEvent.keyDown(nav, { key: "Escape" });
    expect(document.activeElement).not.toBe(homeLink);
  });

  it("keeps the sidebar expanded after pinning, even without hover", () => {
    vi.useFakeTimers();
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.mouseEnter(nav);

    const pinButton = screen.getByRole("button", { name: "Fixar menu expandido" });
    fireEvent.click(pinButton);

    fireEvent.mouseLeave(nav);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(nav.getAttribute("data-expanded")).toBe("true");
    expect(window.localStorage.getItem("zenith:sidebar:pinned")).toBe("true");
  });

  it("renders a coming-soon badge for unimplemented items", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    fireEvent.mouseEnter(nav);
    const homeItem = screen.getByRole("link", { name: /Home/ });
    expect(within(homeItem).getByText("em desenvolvimento")).toBeInTheDocument();
  });
});
