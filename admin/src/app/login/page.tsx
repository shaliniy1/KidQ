"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signIn, usingDevLogin } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">Q</span>KidQ Admin
        </div>
        <label>
          Email
          <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {usingDevLogin ? (
          <p className="muted">Local sign-in: Supabase isn&apos;t configured, so the API must run with AUTH_MODE=dev.</p>
        ) : (
          <label>
            Password
            <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
