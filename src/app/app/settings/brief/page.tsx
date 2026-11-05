import { requireActiveWorkspace } from "@/server/service";
import { BriefForm } from "./form";

export const metadata = { title: "Weekly brief" };

export default async function BriefPage() {
  const { ws } = await requireActiveWorkspace();
  return <BriefForm initial={{ name: ws.name, briefDay: ws.briefDay, briefHour: ws.briefHour, timezone: ws.timezone }} />;
}
