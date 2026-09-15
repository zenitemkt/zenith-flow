"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function refresh() {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <button
      type="button"
      onClick={refresh}
      aria-label="Atualizar"
      title="Atualizar"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
    >
      <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
}
