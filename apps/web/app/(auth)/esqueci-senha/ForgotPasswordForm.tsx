"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthField } from "../AuthField";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: requestError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/redefinir-senha",
    });

    setLoading(false);
    if (requestError) {
      setError(requestError.message ?? "Não foi possível enviar o e-mail agora. Tente de novo em instantes.");
      return;
    }

    // O servidor sempre responde sucesso, exista ou não a conta com esse
    // e-mail (evita que alguém descubra quais e-mails têm conta no sistema).
    setSent(true);
  }

  if (sent) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-bold text-white">Verifique seu e-mail</h1>
        <p className="mb-6 text-sm text-[#9CA0AD]">
          Se <strong className="text-white">{email}</strong> tiver uma conta no sistema, você vai receber um link
          pra redefinir a senha em instantes. O link vale por 1 hora.
        </p>
        <Link
          href="/login"
          className="flex h-11 items-center justify-center rounded-lg border border-[#343747] text-sm font-semibold text-white hover:bg-[#232532]"
        >
          Voltar pro login
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold text-white">Esqueci minha senha</h1>
      <p className="mb-6 text-sm text-[#9CA0AD]">
        Digite o e-mail da sua conta — vale pra equipe interna e pro Portal do Cliente.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && <p className="text-sm font-medium text-[#FF8A80]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Enviando..." : "Enviar link de redefinição"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#9CA0AD]">
        <Link href="/login" className="font-semibold text-[#FF6A3D] hover:text-[#FF8C5C]">
          Voltar pro login
        </Link>
      </p>
    </>
  );
}
