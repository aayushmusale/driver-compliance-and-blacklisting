import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import * as svc from "@/lib/service";
import { Kpi } from "@/components/ui";
import { DriversTable } from "@/components/tables";
import { Badge } from "@/components/ui/badge";
import { WARNING_DAYS } from "@/lib/status";

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const site = svc.getSite(Number((await params).id));
  if (!site) notFound();
  if (!svc.canViewSite(u, site)) return <div className="card"><h1>No access</h1><p>This site is outside your responsibility.</p></div>;

  const drivers = svc.driversInSites([site.id]);
  const rows = svc.driverRows(u, drivers);
  const counts = { total: 0, EXPIRED: 0, EXPIRING: 0, PENDING: 0 };
  rows.filter((r) => r.active === "Active").forEach((r) => {
    counts.total++;
    if (r.license_status === "Expired") counts.EXPIRED++;
    else if (r.license_status === "Expiring soon") counts.EXPIRING++;
    else if (r.license_status === "Pending verification") counts.PENDING++;
  });
  const blacklisted = rows.filter((r) => r.blacklisted_n).length;
  const concerns = svc.listConcerns(u).filter((c) => c.site_id === site.id);
  const moves = svc.siteMovements(site.id);

  return (
    <>
      {u.role !== "SUPERVISOR" && <p><Link href="/dashboard">← Dashboard</Link></p>}
      <h1>{site.name}</h1>
      <p className="mut" style={{ marginBottom: "1rem" }}>{site.cluster_name} · Supervisor: {site.supervisor ?? "—"} · Senior Manager: {site.manager ?? "—"}</p>
      <div className="grid g4" style={{ marginBottom: "1rem" }}>
        <Kpi v={counts.total} l="Active drivers" />
        <Kpi v={counts.EXPIRED} l="Licenses expired" tone="red" />
        <Kpi v={counts.EXPIRING} l={`Expiring within ${WARNING_DAYS} days`} tone="amber" />
        <Kpi v={counts.PENDING} l="Pending verification" tone="gray" />
        <Kpi v={blacklisted} l="Blacklisted (last at this site)" tone="red" icon="ban" />
        <Kpi v={concerns.filter((c) => c.status === "OPEN").length} l="Open concerns" tone="amber" icon="concern" />
      </div>

      <div className="card">
        <h2>Drivers of {site.name} <span className="mut">({rows.length})</span></h2>
        <DriversTable rows={rows} showSite={false} />
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Concerns from this site</h2>
          {concerns.length === 0 ? <p className="mut">None.</p> : concerns.slice(0, 6).map((c) => (
            <p key={c.id}><Badge variant={c.status === "OPEN" ? "warning" : "neutral"}>{c.status}</Badge> <b>{c.driver_name}</b>: {c.text.slice(0, 100)}</p>
          ))}
          <Link href="/concerns">Open concerns inbox →</Link>
        </div>
        <div className="card">
          <h2>Recent joins and exits</h2>
          {moves.length === 0 ? <p className="mut">No movement yet.</p> : (
            <ul className="timeline">{moves.map((m) => (
              <li key={m.id}><Link href={`/drivers/${m.driver_id}`}>{m.driver_name}</Link> · {m.active ? <Badge variant="success">Joined {m.from_date}</Badge> : <Badge variant="neutral">Left {m.to_date}</Badge>}</li>
            ))}</ul>
          )}
        </div>
      </div>
    </>
  );
}
