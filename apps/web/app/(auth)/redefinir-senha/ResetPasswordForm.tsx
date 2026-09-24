"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthField } from "../AuthField";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalidToken = searchParams.get("error") === "INVALID_TOKEN" || !token;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token: token! });
    setLoading(false);

    if (resetError) {
      setError("Este link expirou ou já foi usado — peça um novo em “Esqueci minha senha”.");
      return;
    }

    setDone(true);
  }

  if (invalidToken) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-bold text-white">Link inválido</h1>
        <p className="mb-6 text-sm text-[#9CA0AD]">Este link de redefinição é inválido ou já expirou.</p>
        <Link
          href="/esqueci-senha"
          className="flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "#FF2B00" }}
        >
          Pedir um novo link
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-bold text-white">Senha redefinida</h1>
        <p className="mb-6 text-sm text-[#9CA0AD]">
          Sua senha foi alterada e todas as sessões antigas foram encerradas por segurança.
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/login");
            router.refresh();
          }}
          className="flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "#FF2B00" }}
        >
          Ir para o login
        </button>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold text-white">Redefinir senha</h1>
      <p className="mb-6 text-sm text-[#9CA0AD]">Escolha uma nova senha pra sua conta.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="Nova senha"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthField
          label="Confirmar nova senha"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <p className="text-sm font-medium text-[#FF8A80]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </>
  );
}
