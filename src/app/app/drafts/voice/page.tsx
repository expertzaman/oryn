import { DEFAULT_VOICE, requireActiveWorkspace } from "@/server/service";
import { PageHeader } from "@/components/ui";
import { VoiceForm } from "./form";

export const metadata = { title: "Voice profile" };

export default async function VoicePage() {
  const { ws } = await requireActiveWorkspace();
  return (
    <>
      <PageHeader back={{ href: "/app/drafts", label: "Drafts" }} title="Voice profile" sub="How Oryn writes as you. Changes apply to the next drafts." />
      <VoiceForm initial={{ ...DEFAULT_VOICE, ...(ws.voice ?? {}) }} />
    </>
  );
}
