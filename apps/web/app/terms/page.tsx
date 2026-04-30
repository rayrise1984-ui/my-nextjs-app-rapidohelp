import { TERMS_EFFECTIVE_DATE, TERMS_VERSION, termsSections } from "@/lib/legal";

export default function TermsPage() {
  return (
    <main className="dashboard-shell">
      <article className="dashboard-card terms-card">
        <p className="eyebrow">Legal</p>
        <h1>RapidoHelp Terms of Service</h1>
        <p className="dashboard-note">
          Effective {TERMS_EFFECTIVE_DATE}. Version {TERMS_VERSION}.
        </p>
        <p>
          These Terms of Service are a binding agreement between you and RapidoHelp. By creating an account, signing in,
          posting a job, accepting a job, using the website, using the mobile app, or clicking "I agree," you agree to
          these Terms and to our marketplace rules.
        </p>
        {termsSections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <section>
          <h2>Contact</h2>
          <p>Questions about these Terms should be sent to support through the RapidoHelp app or website.</p>
        </section>
      </article>
    </main>
  );
}
