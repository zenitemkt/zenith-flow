"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthField } from "../AuthField";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message ?? "Não foi possível criar sua conta.");
      return;
    }

    const response = await fetch("/api/agencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Sua conta foi criada, mas não conseguimos criar a agência. Tente novamente em Configurações.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold text-white">Criar sua agência</h1>
      <p className="mb-6 text-sm text-[#9CA0AD]">
        Leva menos de um minuto. Você começa como Admin da Agência.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="Nome da agência"
          name="agencyName"
          required
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          placeholder="Zenite Mkt"
        />
        <AuthField
          label="Seu nome"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <AuthField
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Senha"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm font-medium text-[#FF8A80]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Criando..." : "Criar agência"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#9CA0AD]">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-semibold text-[#FF6A3D] hover:text-[#FF8C5C]">
          Entrar
        </Link>
      </p>
    </>
  );
}
