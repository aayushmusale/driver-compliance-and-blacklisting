import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { overview, listConcerns, driversInSites, driverRows, scopeSiteIds } from "@/lib/service";
import { Kpi } from "@/components/ui";
import { DriversTable, SitesTable } from "@/components/tables";
import { WARNING_DAYS } from "@/lib/status";

export default async function Dashboard() {
  const u = await requireUser();
  if (u.role !== "SUPERVISOR" && !u.dashboard_access)
    return <div className="card"><h1>No dashboard access</h1><p>The DGM has not enabled dashboard access for your login. Please contact the DGM.</p></div>;

  const o = overview(u);
  const openConcerns = listConcerns(u).filter((c) => c.status === "OPEN");
  const rows = driverRows(u, driversInSites(scopeSiteIds(u)));
  const title = u.role === "DGM" ? "All sites" : u.role === "SENIOR_MANAGER" ? `${u.cluster_name} · my sites` : u.site_name;

  return (
    <>
      <h1>Dashboard — {title}</h1>
      <p className="mut" style={{ marginBottom: "1rem" }}>License alert window: {WARNING_DAYS} days before expiry. License status, blacklist status and eligibility are shown separately. Every table can be searched, filtered and sorted.</p>
      <div className="grid g4" style={{ marginBottom: "1rem" }}>
        <Kpi v={o.tot.total} l="Active drivers" />
        <Kpi v={o.tot.EXPIRED} l="Licenses expired" tone="red" />
        <Kpi v={o.tot.EXPIRING} l={`Expiring within ${WARNING_DAYS} days`} tone="amber" />
        <Kpi v={o.tot.PENDING} l="Pending verification" tone="gray" />
        <Kpi v={o.blacklisted.length} l="Blacklisted drivers" tone="red" icon="ban" />
        {u.role !== "SUPERVISOR" && <Kpi v={openConcerns.length} l="Open concerns" tone="amber" icon="concern" />}
      </div>

      {u.role !== "SUPERVISOR" && (
        <div className="card">
          <h2>Site-wise license status</h2>
          <p className="leg mut"><span><i style={{ background: "#dc2626" }} />Expired</span><span><i style={{ background: "#f59e0b" }} />Expiring soon</span><span><i style={{ background: "#94a3b8" }} />Pending</span><span><i style={{ background: "#16a34a" }} />Valid</span>
            <span>· Click a site to open all its drivers and details</span></p>
          <SitesTable rows={o.siteRows} showCluster={u.role === "DGM"} />
        </div>
      )}

      <div className="card">
        <h2>{u.role === "SUPERVISOR" ? `Drivers at ${u.site_name}` : u.role === "DGM" ? "All drivers" : `Drivers in ${u.cluster_name}`} <span className="mut">({rows.length})</span></h2>
        <DriversTable rows={rows} showSite={u.role !== "SUPERVISOR"} showCluster={u.role === "DGM"} />
      </div>

      {u.role !== "SUPERVISOR" && openConcerns.length > 0 && (
        <div className="card">
          <h2>Open concerns <span className="mut">({openConcerns.length})</span></h2>
          {openConcerns.slice(0, 5).map((c) => <p key={c.id}><b>{c.driver_name}</b> ({c.site_name}): {c.text.slice(0, 110)} <Link href="/concerns">Review</Link></p>)}
        </div>
      )}
    </>
  );
}
