import Link from "next/link";

import { CONTACT_EMAIL } from "@/lib/legal";

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="site-footer-contact-icon"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M4 6.5h16v11H4z" />
      <path d="m4.5 7 7.5 5 7.5-5" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-contact-block">
          <p className="site-footer-label">Contact us</p>
          <a className="site-footer-contact" href={`mailto:${CONTACT_EMAIL}`}>
            <MailIcon />
            <span>{CONTACT_EMAIL}</span>
          </a>
        </div>

        <nav aria-label="Policy links" className="site-footer-links">
          <Link href="/terms">Terms of Service</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
