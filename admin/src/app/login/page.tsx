"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendPasswordReset, signIn, usingDevLogin } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

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

  async function requestReset() {
    if (!email.trim()) {
      setError("Enter your email above first, then select Forgot password.");
      return;
    }
    setResetBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setResetSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not send the reset email.");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">Q</span>KidQ
        </div>
        <label>
          Email
          <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {usingDevLogin ? (
          <p className="muted">Use your admin email to continue.</p>
        ) : (
          <label>
            Password
            <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        )}
        {!usingDevLogin && !resetSent && (
          <button type="button" className="link-button login-forgot" onClick={requestReset} disabled={resetBusy}>
            {resetBusy ? "Sending reset email…" : "Forgot password?"}
          </button>
        )}
        {resetSent && <p className="muted">If that email has an admin account, a reset link is on its way.</p>}
        {error && <p className="error">{error}</p>}
        <button className="btn primary login-button" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
