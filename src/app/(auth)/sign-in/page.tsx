import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { SignInForm } from "../forms";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/app");
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.025em]">Welcome back</h1>
      <p className="mb-8 mt-2 text-[15px] text-fg-2">Sign in to see this week’s actions.</p>
      <SignInForm next={next} />
      <p className="mt-8 text-center text-[14px] text-fg-2">
        New to Oryn?{" "}
        <Link href="/sign-up" className="font-medium text-brand-text hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
