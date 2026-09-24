"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface AgencySwitcherProps {
  workspace: string;
  textTransitionClass?: string;
  agencies?: { id: string; name: string }[];
  currentAgencyId?: string;
  onSwitchAgency?: (agencyId: string) => void;
}

export function AgencySwitcher({
  workspace,
  textTransitionClass = "",
  agencies,
  currentAgencyId,
  onSwitchAgency,
}: AgencySwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative mt-2">
      <button
        type="button"
        onClick={() => onSwitchAgency && setOpen((value) => !value)}
        aria-haspopup={onSwitchAgency ? "listbox" : undefined}
        aria-expanded={onSwitchAgency ? open : undefined}
        aria-label={`Agência atual: ${workspace}${onSwitchAgency ? " — trocar de agência" : ""}`}
        className={`flex w-full items-center gap-2 rounded-lg border border-[#343747] bg-[#232532] px-2 py-2 text-left hover:bg-[#2A2D3D] ${textTransitionClass}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-xs font-semibold text-[#FF2B00]">
          {workspace.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#F9FAFB]">
          {workspace}
        </span>
        {onSwitchAgency && (
          <ChevronDown size={14} className="shrink-0 text-[#AEB4C5]" aria-hidden />
        )}
      </button>

      {open && onSwitchAgency && agencies && (
        <ul
          role="listbox"
          aria-label="Trocar de agência"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-[#343747] bg-[#232532] py-1 shadow-[0_18px_48px_rgba(16,24,40,0.4)]"
        >
          {agencies.map((agency) => {
            const active = agency.id === currentAgencyId;
            return (
              <li key={agency.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setOpen(false);
                    if (!active) onSwitchAgency(agency.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#F9FAFB] hover:bg-[#2A2D3D]"
                >
                  <span className="min-w-0 flex-1 truncate">{agency.name}</span>
                  {active && <Check size={14} className="shrink-0 text-[#FF2B00]" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
