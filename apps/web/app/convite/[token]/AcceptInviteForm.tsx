"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { FormField } from "@/app/_components/FormField";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setExistingAccount(false);
    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    if (signUpError) {
      setLoading(false);
      if (signUpError.status === 422 || /already exists/i.test(signUpError.message ?? "")) {
        setExistingAccount(true);
      } else {
        setError(signUpError.message ?? "Não foi possível criar sua conta.");
      }
      return;
    }

    const response = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível ativar o convite.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (existingAccount) {
    return (
      <p className="text-sm text-[#667085]">
        Já existe uma conta com o e-mail <strong>{email}</strong>.{" "}
        <Link href="/login" className="font-medium text-[#FF2B00]">
          Faça login
        </Link>{" "}
        e peça para quem convidou vincular seu acesso — aceite automático de convite para conta
        existente chega em uma próxima entrega.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="E-mail" value={email} disabled readOnly />
      <FormField
        label="Seu nome"
        name="name"
        autoComplete="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <FormField
        label="Crie uma senha"
        type="password"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#FF2B00" }}
      >
        {loading ? "Ativando..." : "Aceitar convite e entrar"}
      </button>
    </form>
  );
}
