"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Campo com lista de sugestões no visual do sistema (no lugar do <datalist> do navegador,
 * que aparece como um balão). Aceita digitar um valor novo.
 */
export function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const exact = options.some((o) => o.toLowerCase() === q);
  const list = q && !exact ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(option: string) {
    onChange(option);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        id={inputId}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${inputId}-list`}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, list.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && active >= 0 && list[active]) {
            e.preventDefault();
            pick(list[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`${className} pr-9`}
      />
      <button type="button" tabIndex={-1} aria-label="Abrir lista" onClick={() => setOpen((o) => !o)} className="absolute right-0 top-0 flex h-full w-9 items-center justify-center text-[#98A2B3]">
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && list.length > 0 && (
        <ul id={`${inputId}-list`} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#E4E7EC] bg-white py-1 shadow-lg">
          {list.map((option, i) => (
            <li key={option} role="option" aria-selected={option === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-2 text-left text-sm text-[#101828] ${i === active ? "bg-[#F2F4F7]" : ""} ${option === value ? "font-semibold" : ""}`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
