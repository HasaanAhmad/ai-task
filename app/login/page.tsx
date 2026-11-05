import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <Suspense
        fallback={
          <div className="font-mono text-sm text-[var(--muted)]">Loading…</div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
