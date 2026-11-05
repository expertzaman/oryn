"use client";

import { useEffect } from "react";
import { AgentMark, Button, ButtonLink } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const db = /DATABASE_URL|database/i.test(error.message);
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="max-w-md text-center">
        <AgentMark size={48} className="mx-auto" />
        <h1 className="mt-6 text-[26px] font-semibold tracking-[-0.025em]">Something went wrong</h1>
        <p className="mt-2 text-[15px] text-fg-2">{db ? "The database isn’t reachable. If you run this deployment, check the DATABASE_URL setting." : "An unexpected error happened. Your data is safe — try again."}</p>
        {error.digest ? <p className="mt-2 text-[12px] text-fg-3">Reference: {error.digest}</p> : null}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">Home</ButtonLink>
        </div>
      </div>
    </div>
  );
}
