"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function FormField({ label, error, id, type, ...inputProps }: FormFieldProps) {
  const fieldId = id ?? inputProps.name;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-[#344054]">
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          type={isPassword && revealed ? "text" : type}
          className={`h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE] ${isPassword ? "pr-10" : ""}`}
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
            className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-[#98A2B3] hover:text-[#475467]"
          >
            {revealed ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="text-xs font-medium text-[#D94343]">
          {error}
        </p>
      )}
    </div>
  );
}
