"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AnonymizeCandidateButton({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const response = await fetch(`/api/candidates/${candidateId}/anonymize`, { method: "POST" });
    setLoading(false);
    if (response.ok) router.refresh();
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleClick()}
      className="text-xs font-medium text-[#D94343] hover:underline disabled:opacity-60"
    >
      Anonimizar dados
    </button>
  );
}
