import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/server/db";
import { isPaused, requireActiveWorkspace } from "@/server/service";
import { PageHeader } from "@/components/ui";
import { DraftEditor } from "./editor";

export const metadata = { title: "Draft" };

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { ws, db } = await requireActiveWorkspace();
  const [d] = await db.select().from(schema.drafts).where(and(eq(schema.drafts.id, id), eq(schema.drafts.workspaceId, ws.id)));
  if (!d) notFound();
  const [action] = d.actionId ? await db.select({ id: schema.actions.id, title: schema.actions.title }).from(schema.actions).where(eq(schema.actions.id, d.actionId)) : [];
  return (
    <>
      <PageHeader back={{ href: "/app/drafts", label: "Drafts" }} title={d.title} sub={action ? <>For action: <a href={`/app/actions/${action.id}`} className="font-medium text-brand-text hover:underline">{action.title}</a></> : undefined} />
      <DraftEditor
        key={d.updatedAt.toISOString()}
        draft={{ id: d.id, kind: d.kind, title: d.title, recipient: d.recipient ?? "", subject: d.subject ?? "", body: d.body, flags: d.flags, status: d.status }}
        paused={isPaused(ws)}
      />
    </>
  );
}
