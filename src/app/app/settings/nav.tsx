"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/app/settings/data", "Data sources"],
  ["/app/settings/rules", "Rules & autonomy"],
  ["/app/settings/brief", "Weekly brief"],
  ["/app/settings/account", "Account & data"],
  ["/app/settings/pause", "Global pause"],
];

export function SettingsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:flex-col lg:self-start">
      {ITEMS.map(([h, l]) => (
        <Link key={h} href={h} aria-current={path === h ? "page" : undefined} className={`shrink-0 rounded-md px-3 py-2 text-[14px] ${path === h ? "bg-brand-soft font-medium text-brand-text" : "text-fg-2 hover:bg-subtle"}`}>
          {l}
        </Link>
      ))}
    </nav>
  );
}
