import { and, eq, sql } from "drizzle-orm";
import { schema } from "@/server/db";
import { currentWeek, isPaused, requireActiveWorkspace } from "@/server/service";
import { AppShell } from "@/components/app/shell";
import { ToastProvider } from "@/components/app/toast";
import { signOut } from "../(auth)/actions";

export const maxDuration = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ws, db } = await requireActiveWorkspace();
  const [{ actions }, [{ n: proposals }], [{ n: drafts }]] = await Promise.all([
    currentWeek(db, ws),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.proposals).where(and(eq(schema.proposals.workspaceId, ws.id), eq(schema.proposals.status, "pending"))),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.drafts).where(and(eq(schema.drafts.workspaceId, ws.id), eq(schema.drafts.status, "draft"))),
  ]);
  return (
    <ToastProvider>
      <AppShell user={{ name: user.name, email: user.email }} company={ws.name} paused={isPaused(ws)} counts={{ week: actions.filter((a) => a.status === "open").length, proposals: Number(proposals), drafts: Number(drafts) }} signOut={signOut}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
