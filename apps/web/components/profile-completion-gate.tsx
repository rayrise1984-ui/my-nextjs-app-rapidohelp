"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase";

type ProfileRow = {
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_worker: boolean | null;
};

type ProfileCompletionGateProps = {
  children: ReactNode;
};

export function ProfileCompletionGate({ children }: ProfileCompletionGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [workspacePath, setWorkspacePath] = useState("/dashboard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const getWorkspacePath = (role: string | null | undefined, isWorker: boolean) => {
    if (role === "admin") return "/admin";
    if (role === "agent" || isWorker) return "/worker";
    return "/dashboard";
  };

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      setLoading(false);
      setError("Live profile services are not available yet. Please try again shortly.");
      return;
    }

    let disposed = false;

    const loadProfile = async () => {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (disposed) {
        return;
      }

      if (!userId) {
        setError("Sign in again to create your profile.");
        setNeedsAuth(true);
        setCompleted(false);
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await client
        .from("profiles")
        .select("full_name, avatar_url, role, is_worker")
        .eq("id", userId)
        .maybeSingle();

      if (disposed) {
        return;
      }

      if (profileError) {
        setError(profileError.message);
        setCompleted(false);
      } else {
        const profile = data as ProfileRow | null;
        const nextFullName = profile?.full_name?.trim() ?? "";
        setFullName(nextFullName);
        setAvatarUrl(profile?.avatar_url ?? "");
        setWorkspacePath(getWorkspacePath(profile?.role, Boolean(profile?.is_worker)));
        setCompleted(nextFullName.length > 0);
      }

      setLoading(false);
    };

    void loadProfile();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && completed && pathname === "/profile") {
      router.replace(workspacePath);
    }
  }, [completed, loading, pathname, router, workspacePath]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedFullName = fullName.trim();

    if (!trimmedFullName) {
      setError("Enter your full name before continuing.");
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setError("Live profile services are not available yet. Please try again shortly.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setSubmitting(false);
      setError("Sign in again to finish your profile.");
      return;
    }

    const { data: updatedProfile, error: updateError } = await client
      .from("profiles")
      .update({
        full_name: trimmedFullName,
        avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
      })
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    setSubmitting(false);

    if (updateError || !updatedProfile) {
      if (!updateError) {
        setError("Your profile could not be saved. Please try again.");
        return;
      }
      setError(updateError.message);
      return;
    }

    setCompleted(true);
  };

  if (loading) {
    return <div className="dashboard-loading">Checking your profile...</div>;
  }

  if (pathname === "/profile" && completed) {
    return <div className="dashboard-loading">Opening your workspace...</div>;
  }

  if (completed) {
    return <>{children}</>;
  }

  if (needsAuth) {
    return (
      <section className="dashboard-grid terms-gate">
        <article className="dashboard-card terms-card">
          <p className="eyebrow">Session Required</p>
          <h2>Sign in to finish your profile</h2>
          <p className="dashboard-note">
            We could not find an active session for this account.
          </p>
          <div className="dashboard-actions">
            <Link href="/auth">Go to sign in</Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="dashboard-grid terms-gate">
      <article className="dashboard-card terms-card">
        <p className="eyebrow">Required Profile</p>
        <h2>Create your profile</h2>
        <p className="dashboard-note">
          You need a completed profile before you can use RapidoHelp.
        </p>

        <form className="dashboard-form" onSubmit={saveProfile}>
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

          <label>
            Avatar URL
            <input
              autoComplete="url"
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="Optional profile image link"
              type="url"
              value={avatarUrl}
            />
          </label>

          <div className="dashboard-actions">
            <button disabled={submitting} type="submit">
              {submitting ? "Saving..." : "Continue"}
            </button>
          </div>
        </form>

        {error ? <p className="auth-error">{error}</p> : null}
      </article>
    </section>
  );
}
