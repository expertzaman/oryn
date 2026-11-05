import { AgentMark, ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="text-center">
        <AgentMark size={48} className="mx-auto" />
        <p className="overline mt-6">404</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em]">We couldn’t find that page</h1>
        <p className="mt-2 text-[15px] text-fg-2">It may have been moved or deleted.</p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href="/app">Go to This Week</ButtonLink>
          <ButtonLink href="/" variant="secondary">Home</ButtonLink>
        </div>
      </div>
    </div>
  );
}
