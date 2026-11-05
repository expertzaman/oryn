import { asc, eq } from "drizzle-orm";
import { schema } from "@/server/db";
import { isPaused, requireActiveWorkspace } from "@/server/service";
import { AskChat } from "./chat";

export const metadata = { title: "Ask Oryn" };

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { ws, db } = await requireActiveWorkspace();
  const msgs = await db.select().from(schema.messages).where(eq(schema.messages.workspaceId, ws.id)).orderBy(asc(schema.messages.createdAt)).limit(200);
  return (
    <AskChat
      paused={isPaused(ws)}
      initialQuestion={q?.slice(0, 1500) ?? ""}
      messages={msgs.map((m) => {
        const fu = m.content.match(/<!--followups:(.*?)-->/);
        let followUps: string[] = [];
        try {
          followUps = fu ? (JSON.parse(fu[1]) as string[]).filter((x) => typeof x === "string").slice(0, 3) : [];
        } catch {}
        return { id: m.id, role: m.role as "user" | "assistant", content: m.content, refs: m.refs, followUps };
      })}
    />
  );
}
