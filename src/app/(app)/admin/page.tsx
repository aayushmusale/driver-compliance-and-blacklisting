import { requireUser, roleLabel } from "@/lib/auth";
import { adminData } from "@/lib/service";
import { accessAction, moveSiteAction, runCheckAction } from "@/app/actions";
import { Flash } from "@/components/ui";

export default async function Admin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const u = await requireUser();
  const { ok, err } = await searchParams;
  if (u.role !== "DGM") return <div className="card">Admin is available to the DGM only.</div>;
  const a = adminData();
  return (
    <>
      <h1>Admin</h1>
      <Flash ok={ok} err={err} />
      <div className="card">
        <h2>Expiry check</h2>
        <p className="mut">Runs automatically (simulating the daily scheduled job). Creates in-app alerts for each site supervisor: licenses expired or expiring within 60 days. Safe to run repeatedly — no duplicates.</p>
        <form action={runCheckAction}><button>Run daily expiry check now</button></form>
      </div>
      <div className="card">
        <h2>Sites and clusters</h2>
        <p className="mut">The real site-to-Senior-Manager mapping is not available yet; the DGM enters/changes it here. Sample mapping shown.</p>
        <table><thead><tr><th>Site</th><th>Supervisor</th><th>Cluster</th><th>Senior Manager</th><th>Move to cluster</th></tr></thead>
          <tbody>{a.sites.map((s) => (
            <tr key={s.id}><td>{s.name}</td><td>{s.supervisor}</td><td>{s.cluster_name}</td><td>{a.clusters.find((c) => c.id === s.cluster_id)?.manager}</td>
              <td><form action={moveSiteAction} className="row"><input type="hidden" name="site" value={s.id} />
                <select name="cluster" defaultValue={s.cluster_id} style={{ width: 130 }}>{a.clusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <button className="ghost">Save</button></form></td></tr>
          ))}</tbody></table>
      </div>
      <div className="card">
        <h2>Users and dashboard access</h2>
        <table><thead><tr><th>User</th><th>Role</th><th>Site / cluster</th><th>Dashboard access</th></tr></thead>
          <tbody>{a.users.filter((x) => x.role !== "SUPERVISOR").map((x) => (
            <tr key={x.id}><td>{x.name}</td><td>{roleLabel(x.role)}</td><td>{x.cluster_name ?? "All"}</td>
              <td><form action={accessAction} className="row"><input type="hidden" name="uid" value={x.id} />
                {x.dashboard_access ? <><span className="badge b-OK">Granted</span><button className="ghost" name="on" value="0" disabled={x.role === "DGM"}>Revoke</button></>
                  : <><span className="badge b-EXPIRED">Revoked</span><button name="on" value="1">Grant</button></>}</form></td></tr>
          ))}</tbody></table>
        <p className="mut">Senior Managers see only their own cluster's sites; the DGM sees every site.</p>
      </div>
    </>
  );
}
