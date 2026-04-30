"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { TERMS_EFFECTIVE_DATE, TERMS_VERSION, fullTermsPath, termsSections } from "@/lib/legal";

type TermsAcceptanceGateProps = {
  children: ReactNode;
  platform?: "web";
};

type TermsProfile = {
  terms_accepted_at: string | null;
  terms_version: string | null;
};

export function TermsAcceptanceGate({ children, platform = "web" }: TermsAcceptanceGateProps) {
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      setLoading(false);
      setError("Configure Supabase before accepting the Terms.");
      return;
    }

    let disposed = false;

    const loadAcceptance = async () => {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (disposed) return;

      if (!userId) {
        setAccepted(true);
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await client
        .from("profiles")
        .select("terms_accepted_at, terms_version")
        .eq("id", userId)
        .maybeSingle();

      if (disposed) return;

      if (profileError) {
        setError(profileError.message);
        setAccepted(false);
      } else {
        const profile = data as TermsProfile | null;
        setAccepted(Boolean(profile?.terms_accepted_at && profile.terms_version === TERMS_VERSION));
      }

      setLoading(false);
    };

    void loadAcceptance();

    return () => {
      disposed = true;
    };
  }, []);

  const acceptTerms = async () => {
    if (!checked) {
      setError("Check the agreement box before continuing.");
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) return;

    setSubmitting(true);
    setError(null);

    const { error: acceptError } = await client.rpc("accept_terms", {
      p_terms_version: TERMS_VERSION,
      p_platform: platform,
    });

    setSubmitting(false);

    if (acceptError) {
      setError(acceptError.message);
      return;
    }

    setAccepted(true);
  };

  if (loading) {
    return <div className="dashboard-loading">Checking account terms...</div>;
  }

  if (accepted) {
    return <>{children}</>;
  }

  return (
    <section className="dashboard-grid terms-gate">
      <article className="dashboard-card terms-card">
        <p className="eyebrow">Required Agreement</p>
        <h2>Accept RapidoHelp Terms of Service</h2>
        <p className="dashboard-note">
          Effective {TERMS_EFFECTIVE_DATE}. Version {TERMS_VERSION}. You must accept these terms before using RapidoHelp.
        </p>

        <div className="terms-scroll" tabIndex={0}>
          {termsSections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <label className="terms-checkbox">
          <input
            checked={checked}
            disabled={submitting}
            onChange={(event) => setChecked(event.target.checked)}
            type="checkbox"
          />
          <span>
            I have read and agree to the RapidoHelp Terms of Service, including the safety notice, independent worker terms,
            payment terms, liability limits, and arbitration/class action waiver.
          </span>
        </label>

        <div className="dashboard-actions">
          <button disabled={!checked || submitting} onClick={() => void acceptTerms()} type="button">
            {submitting ? "Saving..." : "I agree"}
          </button>
          <a href={fullTermsPath} target="_blank" rel="noreferrer">
            Open full terms
          </a>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}
      </article>
    </section>
  );
}
