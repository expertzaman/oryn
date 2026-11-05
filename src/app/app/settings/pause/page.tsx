import { isPaused, requireActiveWorkspace } from "@/server/service";
import { PauseForm } from "./form";

export const metadata = { title: "Global pause" };

export default async function PausePage() {
  const { ws } = await requireActiveWorkspace();
  return <PauseForm paused={isPaused(ws)} until={ws.pausedUntil?.toISOString() ?? null} since={ws.pausedAt?.toISOString() ?? null} />;
}
