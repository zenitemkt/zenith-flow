"use client";

import { useState } from "react";

export function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}/pesquisa-interna/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="flex h-7 items-center justify-center rounded-md border border-[#D0D5DD] px-2 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB]"
    >
      {copied ? "Copiado!" : "Copiar link"}
    </button>
  );
}
