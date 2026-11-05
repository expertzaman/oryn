import { AUTONOMY_AREAS, DEFAULT_RULES, requireActiveWorkspace } from "@/server/service";
import { RulesForm } from "./form";

export const metadata = { title: "Rules & autonomy" };

export default async function RulesPage() {
  const { ws } = await requireActiveWorkspace();
  const autonomy = Object.fromEntries(AUTONOMY_AREAS.map((a) => [a, ws.autonomy?.[a] ?? 1]));
  return <RulesForm rules={{ ...DEFAULT_RULES, ...(ws.rules ?? {}) }} autonomy={autonomy} areas={[...AUTONOMY_AREAS]} />;
}
