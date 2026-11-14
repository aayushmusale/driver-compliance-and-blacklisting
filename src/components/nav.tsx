"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, UserPlus, MessageSquareWarning, Bell, ScrollText, Settings, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { check: ShieldQuestion, dashboard: LayoutDashboard, drivers: Users, add: UserPlus, concerns: MessageSquareWarning, notifications: Bell, audit: ScrollText, admin: Settings };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const active = i.href === "/drivers" ? path.startsWith("/drivers") && path !== "/drivers/new" : path === i.href || path.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium no-underline transition hover:no-underline",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-accent hover:text-accent-foreground")}>
            <Icon className="h-4 w-4" />
            <span className="flex-1">{i.label}</span>
            {!!i.badge && <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-primary ring-1 ring-primary/30">{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
