import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "RapidoHelp",
  description: "Book local roadside and everyday help from nearby verified helpers.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "RapidoHelp",
    description: "Book local roadside and everyday help from nearby verified helpers.",
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
      <body>{children}</body>
    </html>
  );
}
