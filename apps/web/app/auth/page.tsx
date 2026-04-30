import Link from "next/link";

import { AuthPanel } from "@/components/auth-panel";

export default function AuthPage() {
  return (
    <main className="auth-shell">
      <p>
        <Link href="/">Back to home</Link>
      </p>
      <AuthPanel />
    </main>
  );
}