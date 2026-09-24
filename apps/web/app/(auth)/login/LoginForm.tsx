"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthField } from "../AuthField";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await authClient.signIn.email({ email, password });

    setLoading(false);
    if (signInError) {
      setError("E-mail ou senha inválidos.");
      return;
    }

    router.push(searchParams.get("next") ?? "/");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold text-white">Entrar</h1>
      <p className="mb-6 text-sm text-[#9CA0AD]">Para continuar no workspace da Zenite Hub Marketing</p>

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
        <div className="flex flex-col gap-1.5">
          <AuthField
            label="Senha"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link href="/esqueci-senha" className="self-end text-xs font-medium text-[#FF6A3D] hover:text-[#FF8C5C]">
            Esqueci minha senha
          </Link>
        </div>

        {error && <p className="text-sm font-medium text-[#FF8A80]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </>
  );
}
