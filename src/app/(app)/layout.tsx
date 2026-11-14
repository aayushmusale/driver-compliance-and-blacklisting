import { ShieldCheck, LogOut } from "lucide-react";
import { requireUser, roleLabel } from "@/lib/auth";
import { runExpiryCheck, unreadCount } from "@/lib/service";
import { Nav, type NavItem } from "@/components/nav";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  runExpiryCheck(); // simulates the scheduled daily check; idempotent
  const unread = unreadCount(u);
  const where = u.site_name ?? u.cluster_name ?? "All sites";
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/drivers", label: u.role === "SUPERVISOR" ? "My site's drivers" : "Driver vault", icon: "drivers" },
    ...(u.role === "SUPERVISOR" ? [{ href: "/check", label: "Blacklist check", icon: "check" } as NavItem, { href: "/drivers/new", label: "Add driver", icon: "add" } as NavItem] : []),
    { href: "/concerns", label: "Concerns", icon: "concerns" },
    { href: "/notifications", label: "Notifications", icon: "notifications", badge: unread },
    ...(u.role !== "SUPERVISOR" ? [{ href: "/audit", label: "Audit trail", icon: "audit" } as NavItem] : []),
    ...(u.role === "DGM" ? [{ href: "/admin", label: "Admin", icon: "admin" } as NavItem] : []),
  ];
  return (
    <div className="min-h-screen lg:flex">
      <aside className="flex flex-col gap-6 border-r bg-white p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        <div className="flex items-center gap-2.5 px-2 pt-1">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-red-500 to-primary text-white shadow-md"><ShieldCheck className="h-5 w-5" /></div>
          <div className="leading-tight"><div className="text-sm font-semibold">Driver Compliance</div><div className="text-[11px] text-muted-foreground">Supreme Facilities</div></div>
        </div>
        <Nav items={items} />
        <div className="mt-auto space-y-3 rounded-xl border bg-muted p-3">
          <div className="text-sm font-medium">{u.name}</div>
          <div className="text-xs text-muted-foreground">{roleLabel(u.role)} · {where}</div>
          <form action={logout}><button className="ghost !w-full"><LogOut className="h-4 w-4" />Switch user</button></form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="bg-amber-100/80 px-4 py-1.5 text-center text-xs font-medium text-amber-800">PROTOTYPE · all data is illustrative · not real Supreme driver data</div>
        <main>{children}</main>
      </div>
    </div>
  );
}
