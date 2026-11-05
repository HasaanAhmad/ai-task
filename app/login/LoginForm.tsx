"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error || "Login failed");
        return;
      }
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-sm border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[0_18px_40px_rgba(15,28,46,0.08)]"
    >
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
        Sledge
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink)]">
        Enter passphrase
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Shared access phrase required to use the extractor.
      </p>

      <label className="mt-6 block text-sm font-medium text-[var(--ink)]">
        Passphrase
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-sm border border-[var(--line)] bg-white px-3 py-2.5 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
      </label>

      {error ? (
        <p className="mt-3 text-sm text-[var(--err)]">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !password}
        className="mt-5 w-full rounded-sm bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
