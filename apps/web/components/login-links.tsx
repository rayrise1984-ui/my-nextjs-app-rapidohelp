import Link from "next/link";

const loginLinks = [
  { href: "/auth?account=customer", label: "Customer Sign Up", primary: true },
  { href: "/auth?account=helper", label: "Service Partner Sign Up" },
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
