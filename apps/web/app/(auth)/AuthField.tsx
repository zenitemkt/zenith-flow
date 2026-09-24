"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * Variante escura de `app/_components/FormField.tsx`, só para as telas de
 * autenticação (login/criar agência) — a versão clara continua sendo usada
 * em todo o resto do produto (ver docs/DECISIONS.md, "Login/criar agência
 * ganham identidade visual escura própria").
 */
export function AuthField({ label, error, id, type, ...inputProps }: AuthFieldProps) {
  const fieldId = id ?? inputProps.name;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold text-white">
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          type={isPassword && revealed ? "text" : type}
          className={`h-11 w-full rounded-lg border border-[#343747] bg-[#232532] px-3 text-sm text-white placeholder:text-[#6B6E7B] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#FF2B00]/25 ${isPassword ? "pr-10" : ""}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            tabIndex={-1}
            aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={revealed}
            className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-[#8B8D98] hover:text-white"
          >
            {revealed ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="text-xs font-medium text-[#FF8A80]">
          {error}
        </p>
      )}
    </div>
  );
}
