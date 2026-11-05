import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { SignUpForm } from "../forms";

export const metadata = { title: "Create your account" };

export default async function SignUpPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/app");
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.025em]">Create your workspace</h1>
      <p className="mb-8 mt-2 text-[15px] text-fg-2">Free while you set up. No card needed. About 5 minutes to your first brief.</p>
      <SignUpForm />
      <p className="mt-8 text-center text-[14px] text-fg-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-brand-text hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
