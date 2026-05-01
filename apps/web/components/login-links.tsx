import Link from "next/link";

const loginLinks = [
  { href: "/auth?account=customer", label: "Customer Sign Up", primary: true },
  { href: "/auth?account=helper", label: "Helper Sign Up" },
  { href: "/auth?mode=signin", label: "Admin Sign In" },
];

export function LoginLinks() {
  return (
    <nav aria-label="Login options" className="login-links">
      {loginLinks.map((link) => (
        <Link className={link.primary ? "primary" : undefined} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
