/**
 * Identidade visual escura para login/criar agência (pedido do Kevin,
 * 2026-09-23), inspirada na tela de login da Proton Mail — halo de luz atrás
 * do card + logo fixo no canto superior esquerdo. Única mudança de fundo: o
 * roxo/azul da Proton vira o laranja da marca (#FF2B00). Sem seletor de
 * idioma, "mantenha-me conectado" ou links de termos/privacidade — nenhum
 * desses tem lógica real por trás hoje. Escopo deliberadamente restrito a
 * este layout (registrado em docs/DECISIONS.md); o resto do produto continua
 * na base clara do visualcodex.txt.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0B10] px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-220px] h-[640px] w-[640px] -translate-x-1/2 rounded-full opacity-60 blur-[130px]"
        style={{ background: "radial-gradient(circle, #FF2B00 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[calc(50%+220px)] top-[160px] h-[420px] w-[420px] rounded-full opacity-40 blur-[110px]"
        style={{ background: "radial-gradient(circle, #FF7A1A 0%, transparent 70%)" }}
      />

      <div className="absolute left-6 top-6 flex items-center gap-2 sm:left-10 sm:top-10">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: "#FF2B00" }}
        >
          Z
        </span>
        <span className="text-sm font-semibold tracking-wide text-white">ZENITE MKT</span>
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-[#2F3140] bg-[#171821] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-[#6B6E7B]">Zenite Hub Marketing</p>
      </div>
    </div>
  );
}
