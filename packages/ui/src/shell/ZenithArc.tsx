const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Assinatura visual "zênite": a borda de um planeta escuro iluminada por trás,
 * como o sol cruzando o horizonte visto do alto. `rimClassName` posiciona o
 * círculo (o `top` define em que altura a borda aparece) — cada shell ajusta
 * pra ficar logo abaixo do próprio cabeçalho. Sobe uma vez ao carregar
 * (`.zenite-dawn`, em globals.css).
 */
export function ZenithArc({ className = "", rimClassName }: { className?: string; rimClassName: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)] ${className}`}
    >
      <div
        className={`zenite-dawn absolute left-1/2 h-[2640px] w-[2640px] rounded-full bg-[#07080C] ${rimClassName}`}
        style={{
          boxShadow:
            "0 1px 0 0 rgba(255,168,110,0.95), 0 4px 18px 0 rgba(255,90,30,0.75), 0 30px 90px 10px rgba(255,43,0,0.38), 0 90px 220px 60px rgba(255,43,0,0.16)",
        }}
      />
    </div>
  );
}

/** Textura granulada sutil por cima do fundo escuro — evita que os degradês "listrem". */
export function ZenithGrain({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay ${className}`}
      style={{ backgroundImage: GRAIN }}
    />
  );
}
