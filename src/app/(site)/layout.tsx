import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { cookies } from "next/headers";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Cheap check: the cookie only decides which header buttons to show.
  const signedIn = !!(await cookies()).get("oryn_session")?.value;
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
