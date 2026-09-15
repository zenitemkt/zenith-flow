"use client";

import { useState } from "react";

export function SurveyResponseForm({ token, commentPrompt }: { token: string; commentPrompt: string | null }) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (score === null) return;
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/public/survey/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, comment: comment.trim() || undefined }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível registrar sua resposta.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg bg-[#DCFCE7] p-4 text-center text-sm font-medium text-[#166534]">
        Obrigado pela sua resposta!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className={`flex h-10 items-center justify-center rounded-lg border text-sm font-semibold ${
              score === n
                ? "border-[#FF2B00] bg-[#FF2B00] text-white"
                : "border-[#D0D5DD] text-[#344054] hover:bg-[#F6F7FB]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-[#98A2B3]">
        <span>Pouco provável</span>
        <span>Muito provável</span>
      </div>

      {commentPrompt && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="survey-comment" className="text-sm font-medium text-[#344054]">
            {commentPrompt}
          </label>
          <textarea
            id="survey-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
          />
        </div>
      )}

      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

      <button
        type="button"
        disabled={score === null || loading}
        onClick={() => void handleSubmit()}
        className="flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#FF2B00" }}
      >
        {loading ? "Enviando..." : "Enviar resposta"}
      </button>
    </div>
  );
}
