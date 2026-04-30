"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";

import {
  createSupabaseBrowserClient,
  getSupabaseAuthRedirectUrl,
} from "@/lib/supabase";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [authMode, setAuthMode] = useState<"email" | "phone">("email");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      return;
    }

    client.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fillDemo = (kind: "customer" | "worker") => {
    setAuthMode("email");
    setEmail(kind === "customer" ? "demo.customer@rapidohelp.local" : "demo.worker@rapidohelp.local");
    setPassword("RapidoDemo123!");
    setPhone("");
    setPhoneCode("");
    setPhoneCodeSent(false);
    setError(null);
    setMessage(`${kind === "customer" ? "Customer" : "Worker"} demo credentials filled.`);
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const client = createSupabaseBrowserClient();

    if (!client) {
      setError(
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.",
      );
      setMessage(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: authError } = password
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getSupabaseAuthRedirectUrl(),
          },
        });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setMessage(password ? "Signed in successfully." : "Magic link sent. Open the email and come back to this page.");
  };

  const submitPhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const client = createSupabaseBrowserClient();

    if (!client) {
      setError("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.");
      setMessage(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: authError } = phoneCodeSent
      ? await client.auth.verifyOtp({
          phone,
          token: phoneCode,
          type: "sms",
        })
      : await client.auth.signInWithOtp({ phone });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (phoneCodeSent) {
      setMessage("Signed in successfully.");
      return;
    }

    setPhoneCodeSent(true);
    setMessage("SMS code sent. Enter the code to finish signing in.");
  };

  const signOut = async () => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      return;
    }

    await client.auth.signOut();
    setMessage("Signed out.");
    setError(null);
  };

  return (
    <section className="auth-panel">
      <p className="eyebrow">Web auth starter</p>
      <h1>Sign in with a magic link.</h1>
      <p className="lead">
        This page uses Supabase email OTP so the web app can authenticate
        without a custom backend server.
      </p>

      {session ? (
        <div className="auth-session">
          <p>
            Signed in as <strong>{session.user.email ?? session.user.id}</strong>
          </p>
          <div className="auth-actions">
            <Link className="cta-link" href="/dashboard">
              Open dashboard
            </Link>
            <button onClick={signOut} type="button">
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-actions">
            <button onClick={() => fillDemo("customer")} type="button">
              Demo customer
            </button>
            <button onClick={() => fillDemo("worker")} type="button">
              Demo worker
            </button>
          </div>

          <div className="auth-actions">
            <button disabled={authMode === "email"} onClick={() => setAuthMode("email")} type="button">
              Email
            </button>
            <button disabled={authMode === "phone"} onClick={() => setAuthMode("phone")} type="button">
              Phone
            </button>
          </div>

          {authMode === "email" ? (
            <form className="auth-form" onSubmit={submitEmail}>
              <label>
                Email address
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="founder@rapidohelp.app"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Leave blank for magic link"
                  type="password"
                  value={password}
                />
              </label>
              <button disabled={loading} type="submit">
                {loading ? "Please wait..." : password ? "Sign in" : "Send magic link"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={submitPhone}>
              <label>
                Phone number
                <input
                  autoComplete="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+15551234567"
                  required
                  type="tel"
                  value={phone}
                />
              </label>
              {phoneCodeSent ? (
                <label>
                  SMS code
                  <input
                    inputMode="numeric"
                    onChange={(event) => setPhoneCode(event.target.value)}
                    placeholder="123456"
                    required
                    value={phoneCode}
                  />
                </label>
              ) : null}
              <button disabled={loading} type="submit">
                {loading ? "Please wait..." : phoneCodeSent ? "Verify code" : "Send SMS code"}
              </button>
            </form>
          )}
        </>
      )}

      {message ? <p className="auth-success">{message}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      <p className="auth-note">
        In Supabase Auth settings, add your local web URL and the production web
        URL to the redirect allow list before testing sign-in.
      </p>
    </section>
  );
}
