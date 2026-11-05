import { PageHeader } from "@/components/ui";
import { SettingsNav } from "./nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" sub="Your data, rules, brief schedule and account." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsNav />
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </>
  );
}
