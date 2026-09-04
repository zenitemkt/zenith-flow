import { useId, useRef, useState, type ReactNode } from "react";

const SHOW_DELAY_MS = 400;

interface TooltipProps {
  label: string;
  disabled?: boolean;
  children: (describedById: string | undefined) => ReactNode;
}

/**
 * Tooltip acessível para o estado recolhido da sidebar (seção 4 da spec de navegação).
 * Só aparece quando `disabled` é false (isto é, quando a sidebar está recolhida).
 */
export function Tooltip({ label, disabled, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const showTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const clear = () => {
    if (showTimeout.current) {
      clearTimeout(showTimeout.current);
      showTimeout.current = null;
    }
  };

  const scheduleShow = () => {
    if (disabled) return;
    clear();
    showTimeout.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
  };

  const hide = () => {
    clear();
    setVisible(false);
  };

  return (
    <span
      className="relative flex"
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={scheduleShow}
      onBlur={hide}
    >
      {children(disabled ? undefined : tooltipId)}
      {!disabled && visible && (
        <span
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1F2430] px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {label}
        </span>
      )}
    </span>
  );
}
