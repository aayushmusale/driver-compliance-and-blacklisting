import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, Clock, Ban, ShieldCheck, ShieldX, Info, Users, MessageSquareWarning } from "lucide-react";
import { licenseStatus, LICENSE_LABEL, daysLeft, type LicenseStatus } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LIC_VARIANT = { VALID: "success", EXPIRING: "warning", EXPIRED: "danger", PENDING: "neutral" } as const;
const LIC_ICON = { VALID: CheckCircle2, EXPIRING: AlertTriangle, EXPIRED: XCircle, PENDING: Clock } as const;

export function LicenseBadge({ expiry, verified }: { expiry?: string | null; verified?: number | null }) {
  const st: LicenseStatus = licenseStatus({ expiry, verified });
  const d = daysLeft(expiry);
  const extra = st === "EXPIRING" ? ` · ${d}d left` : st === "EXPIRED" ? ` · ${-d!}d ago` : "";
  const Icon = LIC_ICON[st];
  return <Badge variant={LIC_VARIANT[st]}><Icon className="h-3 w-3" />{LICENSE_LABEL[st]}{extra}</Badge>;
}

export const BlacklistBadge = ({ on }: { on: number }) =>
  on ? <Badge variant="solidDanger"><Ban className="h-3 w-3" />BLACKLISTED</Badge> : <Badge variant="neutral">Not blacklisted</Badge>;

export const EligibilityBadge = ({ blacklisted }: { blacklisted: number }) =>
  blacklisted ? <Badge variant="danger"><ShieldX className="h-3 w-3" />Not eligible</Badge> : <Badge variant="success"><ShieldCheck className="h-3 w-3" />Eligible</Badge>;

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  const Icon = err ? XCircle : CheckCircle2;
  return <div className={`msg ${err ? "err" : "ok"} flex items-center gap-2`}><Icon className="h-4 w-4 shrink-0" />{err ?? ok}</div>;
}

const TONES = {
  default: "bg-red-50 text-primary", green: "bg-success-soft text-success", amber: "bg-warning-soft text-warning",
  red: "bg-red-100 text-red-700", gray: "bg-secondary text-slate-600",
} as const;
const TONE_ICON = { default: Users, green: CheckCircle2, amber: AlertTriangle, red: XCircle, gray: Clock } as const;

export function Kpi({ v, l, tone = "default", icon }: { v: number | string; l: string; tone?: keyof typeof TONES; icon?: "concern" | "ban" }) {
  const Icon = icon === "concern" ? MessageSquareWarning : icon === "ban" ? Ban : TONE_ICON[tone];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="text-3xl font-semibold tracking-tight">{v}</div>
        <div className={cn("grid h-9 w-9 place-items-center rounded-lg", TONES[tone])}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{l}</div>
    </div>
  );
}

export function StatusBar({ c }: { c: { VALID: number; EXPIRING: number; EXPIRED: number; PENDING: number; total: number } }) {
  const t = Math.max(c.total, 1);
  const seg = (n: number, color: string) => <i style={{ width: `${(n / t) * 100}%`, background: color }} title={String(n)} />;
  return <div className="bar">{seg(c.EXPIRED, "#dc2626")}{seg(c.EXPIRING, "#f59e0b")}{seg(c.PENDING, "#94a3b8")}{seg(c.VALID, "#16a34a")}</div>;
}

export const DriverLink = ({ id, children }: { id: number; children: React.ReactNode }) => <Link href={`/drivers/${id}`} className="font-medium">{children}</Link>;

export const Note = ({ children }: { children: React.ReactNode }) =>
  <div className="mb-3 flex items-start gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
