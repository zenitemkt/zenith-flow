"use client";

export default function SimulatorError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-[#FECDCA] bg-[#FEF3F2] p-5 text-sm text-[#B42318]">
      <p className="font-semibold">O simulador encontrou um erro.</p>
      <p className="mt-1 break-words font-mono text-xs">{error.message}</p>
      <button type="button" onClick={reset} className="mt-3 rounded-lg bg-[#B42318] px-3 py-1.5 text-xs font-medium text-white">
        Tentar de novo
      </button>
    </div>
  );
}
