"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

import {
  createSupabaseBrowserClient,
  getSupabaseAuthRedirectUrl,
} from "@/lib/supabase";
import { ADMIN_LOGIN_EMAIL, isAdminEmail } from "@/lib/admin";

const HELPER_BACKGROUND_CHECK_CONSENT_VERSION = "helper_background_check_v1";

export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminSignin = searchParams.get("account") === "admin";
  const [entryMode, setEntryMode] = useState<"create" | "signin">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<"customer" | "helper">("customer");
  const [helperBackgroundCheckConsent, setHelperBackgroundCheckConsent] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
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

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    const requestedAccount = searchParams.get("account");

    if (requestedAccount === "admin") {
      setEntryMode("signin");
      setAuthMode("email");
      setEmail(ADMIN_LOGIN_EMAIL);
      setPassword("");
      setEmailCode("");
      setEmailCodeSent(false);
      setPhoneCode("");
      setPhoneCodeSent(false);
      return;
    }

    if (requestedMode === "signin") {
      setEntryMode("signin");
      setEmailCode("");
      setEmailCodeSent(false);
      setPhoneCode("");
      setPhoneCodeSent(false);
      return;
    }

    if (requestedMode === "create" || requestedAccount) {
      setEntryMode("create");
      setEmailCode("");
      setEmailCodeSent(false);
      setPhoneCode("");
      setPhoneCodeSent(false);
      if (requestedAccount === "helper") {
        setAccountType("helper");
      } else if (requestedAccount === "customer") {
        setAccountType("customer");
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const client = createSupabaseBrowserClient();

    if (!client) {
      return;
    }

    let disposed = false;

    const routeSignedInUser = async () => {
      if (isAdminEmail(session.user.email)) {
        router.replace("/admin");
        return;
      }

      const { data } = await client
        .from("profiles")
        .select(
          "full_name, role, is_worker, worker_verified, worker_disabled, worker_background_check_consent_at, worker_background_check_consent_platform, worker_background_check_consent_version",
        )
        .eq("id", session.user.id)
        .maybeSingle();

      if (disposed) {
        return;
      }

      const role = data?.role as string | null | undefined;
      const isWorker = Boolean(data?.is_worker);
      const workerApproved = !isWorker || (Boolean(data?.worker_verified) && !Boolean(data?.worker_disabled));
      const hasProfile = Boolean((data?.full_name ?? "").trim());
      const helperConsentSatisfied =
        !isWorker ||
        Boolean(
          data?.worker_background_check_consent_at &&
            data?.worker_background_check_consent_platform &&
            data?.worker_background_check_consent_version === HELPER_BACKGROUND_CHECK_CONSENT_VERSION,
        );
      const destination = !hasProfile
        ? "/profile"
        : !helperConsentSatisfied || !workerApproved
          ? "/profile"
        : role === "admin"
          ? "/admin"
          : role === "agent" || isWorker
            ? "/worker"
            : "/dashboard";

      router.replace(destination);
    };

    void routeSignedInUser();

    return () => {
      disposed = true;
    };
  }, [router, session]);

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const switchEntryMode = (mode: "create" | "signin") => {
    setEntryMode(mode);
    setEmailCode("");
    setEmailCodeSent(false);
    setPhoneCode("");
    setPhoneCodeSent(false);
    if (mode === "create") {
      setAuthMode("email");
    }
    resetFeedback();
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

    if (isAdminSignin && email.trim().toLowerCase() !== ADMIN_LOGIN_EMAIL) {
      setLoading(false);
      setError(`Admin access uses ${ADMIN_LOGIN_EMAIL}.`);
      return;
    }

    if (isAdminSignin && !password.trim()) {
      setLoading(false);
      setError("Enter the admin password.");
      return;
    }

    const normalizedEmail = email.trim();
    const emailCodeValue = emailCode.trim();
    const shouldVerifyEmailCode = emailCodeSent && emailCodeValue.length > 0;

    let authError: { message: string } | null = null;

    if (isAdminSignin) {
      ({ error: authError } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      }));
    } else if (shouldVerifyEmailCode) {
      ({ error: authError } = await client.auth.verifyOtp({
        email: normalizedEmail,
        token: emailCodeValue,
        type: "email",
      }));
    } else {
      ({ error: authError } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getSupabaseAuthRedirectUrl(),
        },
      }));
    }

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (isAdminSignin) {
      setMessage("Signed in successfully.");
      return;
    }

    if (shouldVerifyEmailCode) {
      setMessage("Signed in successfully.");
      return;
    }

    setEmailCodeSent(true);
    setEmailCode("");
    setMessage("Email code sent. Check your inbox to finish signing in.");
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedFullName = fullName.trim();

    if (!trimmedFullName) {
      setError("Enter your full name first.");
      setMessage(null);
      return;
    }

    if (accountType === "helper" && !helperBackgroundCheckConsent) {
      setError("Service partners must consent to a background check before creating a profile.");
      setMessage(null);
      return;
    }

    const client = createSupabaseBrowserClient();

    if (!client) {
      setError(
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.",
      );
      setMessage(null);
      return;
    }

    setLoading(true);
    resetFeedback();

    const { error: authError } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getSupabaseAuthRedirectUrl(),
        data: {
          full_name: trimmedFullName,
          role: accountType === "helper" ? "agent" : "customer",
          is_worker: accountType === "helper",
          worker_background_check_consent: accountType === "helper" && helperBackgroundCheckConsent,
          worker_background_check_consent_platform: accountType === "helper" ? "web" : null,
          worker_background_check_consent_version:
            accountType === "helper" ? HELPER_BACKGROUND_CHECK_CONSENT_VERSION : null,
        },
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setMessage(
      accountType === "helper"
        ? "Service partner profile created. Check your email or sign in to finish setup."
        : "Profile created. Check your email or sign in to continue.",
    );
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

    const phoneCodeValue = phoneCode.trim();
    const shouldVerifyPhoneCode = phoneCodeSent && phoneCodeValue.length > 0;

    const { error: authError } = shouldVerifyPhoneCode
      ? await client.auth.verifyOtp({
          phone,
          token: phoneCodeValue,
          type: "sms",
        })
      : await client.auth.signInWithOtp({ phone });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (shouldVerifyPhoneCode) {
      setMessage("Signed in successfully.");
      return;
    }

    setPhoneCodeSent(true);
    setPhoneCode("");
    setMessage("SMS code sent. Enter the code to finish signing in.");
  };

  return (
    <section className="auth-panel">
      <p className="eyebrow">Live account access</p>
      <h1>
        {entryMode === "create"
          ? "Create your profile."
          : isAdminSignin
            ? "Admin sign in."
            : "Sign in to RapidoHelp."}
      </h1>
      <p className="lead">
        {entryMode === "create"
          ? "Customer and service partner accounts start by creating a profile, then moving into the app."
          : isAdminSignin
            ? "Use the private admin ID and password. Admin access does not need profile setup."
            : "Use email OTP or SMS OTP to book help, accept jobs, or manage operations."}
      </p>

      {session ? (
        <p className="auth-note">Opening your workspace now.</p>
      ) : (
        <>
          {isAdminSignin ? (
            <form className="auth-form" onSubmit={submitEmail}>
              <p className="auth-note">
                Admin access uses <strong>{ADMIN_LOGIN_EMAIL}</strong> and a password. No profile setup is needed.
              </p>
              <label>
                Admin ID / email
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={ADMIN_LOGIN_EMAIL}
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
                  placeholder="Enter admin password"
                  required
                  type="password"
                  value={password}
                />
              </label>
              <button disabled={loading} type="submit">
                {loading ? "Please wait..." : "Sign in to admin"}
              </button>
            </form>
          ) : entryMode === "create" ? (
            <form className="auth-form" onSubmit={submitProfile}>
              <label>
                Full name
                <input
                  autoComplete="name"
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                  required
                  type="text"
                  value={fullName}
                />
              </label>
              <fieldset className="auth-fieldset">
                <legend>Account type</legend>
                <div className="auth-actions">
                  <button
                    disabled={accountType === "customer"}
                    onClick={() => {
                      setAccountType("customer");
                      setHelperBackgroundCheckConsent(false);
                    }}
                    type="button"
                  >
                    Customer
                  </button>
                  <button
                    disabled={accountType === "helper"}
                    onClick={() => {
                      setAccountType("helper");
                    }}
                    type="button"
                  >
                    Service Partner
                  </button>
                </div>
              </fieldset>
              {accountType === "helper" ? (
                <label className="terms-checkbox">
                  <input
                    checked={helperBackgroundCheckConsent}
                    onChange={(event) => setHelperBackgroundCheckConsent(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    I consent to a background check so RapidoHelp can review my service partner profile for approval.
                  </span>
                </label>
              ) : null}
              <label>
                Email address
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@rapidohelp.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password"
                  required
                  type="password"
                  value={password}
                />
              </label>
              <button disabled={loading} type="submit">
                {loading ? "Please wait..." : "Create profile"}
              </button>
            </form>
          ) : (
            <>
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
                  {searchParams.get("account") === "admin" ? (
                    <p className="auth-note">
                      Admin access uses <strong>{ADMIN_LOGIN_EMAIL}</strong>.
                    </p>
                  ) : null}
                  <label>
                    Email address
                    <input
                      autoComplete="email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@rapidohelp.com"
                      required
                      type="email"
                      value={email}
                    />
                  </label>
                  {emailCodeSent ? (
                    <label>
                      Email code
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        onChange={(event) => setEmailCode(event.target.value)}
                        placeholder="123456"
                        value={emailCode}
                      />
                    </label>
                  ) : null}
                  <button disabled={loading} type="submit">
                    {loading
                      ? "Please wait..."
                      : emailCodeSent
                        ? emailCode.trim()
                          ? "Verify code"
                          : "Resend code"
                        : "Send email code"}
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
                        value={phoneCode}
                      />
                    </label>
                  ) : null}
                  <button disabled={loading} type="submit">
                    {loading
                      ? "Please wait..."
                      : phoneCodeSent
                        ? phoneCode.trim()
                          ? "Verify code"
                          : "Resend code"
                        : "Send SMS code"}
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}

      {message ? <p className="auth-success">{message}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      <p className="auth-note">
        Customer and service partner accounts start by creating a profile. Admin access uses a private ID and password.
      </p>
    </section>
  );
}
