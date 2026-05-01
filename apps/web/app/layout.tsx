import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RapidoHelp",
    template: "%s | RapidoHelp",
  },
  description: "Book trusted roadside, home, care, and moving help from nearby verified service partners.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "RapidoHelp",
    description: "Book trusted roadside, home, care, and moving help from nearby verified service partners.",
    url: siteUrl,
    siteName: "RapidoHelp",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
