"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@zenite-mkt/ui";

export function ChangePasswordForm() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmação não bate com a nova senha.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("A nova senha precisa ser diferente da atual.");
      return;
    }

    setLoading(true);
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setLoading(false);

    if (changeError) {
      setError(changeError.message ?? "Senha atual incorreta.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Senha alterada. Outros dispositivos logados foram desconectados por segurança.");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-md flex-col gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4 dark:border-[#303343] dark:bg-[#171821]"
    >
      <div>
        <h2 className="text-sm font-semibold text-[#101828] dark:text-white">Trocar senha</h2>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#AEB4C5]">
          Confirme a senha atual pra definir uma nova. Isso desconecta qualquer outro dispositivo logado com sua conta.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-[#475467] dark:text-[#AEB4C5]">
        Senha atual
        <input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] dark:border-[#343747] dark:bg-[#0F1016] dark:text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[#475467] dark:text-[#AEB4C5]">
        Nova senha
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] dark:border-[#343747] dark:bg-[#0F1016] dark:text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[#475467] dark:text-[#AEB4C5]">
        Confirmar nova senha
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] dark:border-[#343747] dark:bg-[#0F1016] dark:text-white"
        />
      </label>

      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 h-10 self-start rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#FF2B00" }}
      >
        {loading ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
