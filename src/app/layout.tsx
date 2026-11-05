import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://oryn.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Oryn — Three actions that move your growth goal, every week",
    template: "%s · Oryn",
  },
  description:
    "Oryn reads your website, CRM exports and sales notes, then hands B2B SaaS founders the three actions that matter this week — with the evidence behind each one.",
  openGraph: {
    title: "Oryn — Navigate by signal",
    description:
      "Growth intelligence for B2B SaaS founders. Three ranked actions a week, every claim sourced.",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
