import { Suspense } from "react";
import Link from "next/link";

import { AuthPanel } from "@/components/auth-panel";
import { LoginLinks } from "@/components/login-links";

export default function AuthPage() {
  return (
    <main className="auth-shell">
      <header className="public-topbar">
        <Link className="public-brand" href="/">
          RapidoHelp
        </Link>
        <LoginLinks />
      </header>
      <Suspense fallback={<div className="dashboard-loading">Loading sign-up options...</div>}>
        <AuthPanel />
      </Suspense>
    </main>
  );
}
