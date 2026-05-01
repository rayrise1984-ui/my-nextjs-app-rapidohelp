import Link from "next/link";

import { CONTACT_EMAIL, TERMS_EFFECTIVE_DATE, TERMS_VERSION, privacySections } from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <main className="dashboard-shell">
      <article className="dashboard-card terms-card">
        <p className="eyebrow">Legal</p>
        <h1>RapidoHelp Privacy Policy</h1>
        <p className="dashboard-note">
          Effective {TERMS_EFFECTIVE_DATE}. Version {TERMS_VERSION}.
        </p>
        <p>
          This Privacy Policy explains how RapidoHelp collects, uses, shares, and protects information across customer,
          service partner, and admin workflows.
        </p>
        {privacySections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <section>
          <h2>Contact</h2>
          <p>
            Questions about this Policy can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You can also read the{" "}
            <Link href="/terms">Terms of Service</Link>.
          </p>
        </section>
      </article>
    </main>
  );
}
