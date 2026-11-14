import { requireUser } from "@/lib/auth";
import { myNotifications } from "@/lib/service";
import { openNotificationAction, readAllAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VARIANT = { EXPIRED: "danger", BLACKLIST: "danger", EXPIRING: "warning", CONCERN: "warning" } as const;

function Item({ n }: { n: any }) {
  return (
    <form action={openNotificationAction}>
      <input type="hidden" name="id" value={n.id} />
      {/* the whole card is the button: clicking opens the driver and marks the notification read */}
      <button className={cn("!mb-2 !block !w-full !rounded-lg !border !border-l-4 !p-3 !text-left !font-normal !shadow-sm transition hover:!shadow-md",
        n.read ? "!bg-muted/50 !text-muted-foreground !border-l-border" : "!bg-card !text-foreground !border-l-primary")}>
        <span className="flex flex-wrap items-center gap-2">
          {!n.read && <span className="h-2 w-2 rounded-full bg-primary" aria-label="unread" />}
          <Badge variant={VARIANT[n.kind as keyof typeof VARIANT] ?? "neutral"}>{n.kind.replace("_", " ")}</Badge>
          <span className={n.read ? "" : "font-medium"}>{n.message}</span>
        </span>
        <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{new Date(n.created_at).toLocaleString()}</span>
          {n.driver_id && <span className="font-medium text-primary">Open driver →</span>}
        </span>
      </button>
    </form>
  );
}

export default async function Notifications() {
  const u = await requireUser();
  const rows = myNotifications(u);
  const unread = rows.filter((n) => !n.read);
  const read = rows.filter((n) => n.read);
  return (
    <>
      <div className="row"><h1 style={{ margin: 0 }}>Notifications</h1>
        {unread.length > 0 && <form action={readAllAction}><button className="ghost">Mark all as read</button></form>}</div>
      <p className="mut" style={{ margin: ".4rem 0 1rem" }}>Click a notification to open it. It is then marked as read and moves down. Alerts: licenses expiring within 60 days or expired, concerns raised, and blacklist updates.</p>

      <h2>Unread <span className="mut">({unread.length})</span></h2>
      {unread.length === 0 ? <div className="card mut">You are all caught up.</div> : unread.map((n) => <Item key={n.id} n={n} />)}

      {read.length > 0 && (
        <>
          <h2 style={{ marginTop: "1.5rem" }}>Read <span className="mut">({read.length})</span></h2>
          {read.map((n) => <Item key={n.id} n={n} />)}
        </>
      )}
    </>
  );
}
