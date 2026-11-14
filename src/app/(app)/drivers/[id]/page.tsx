import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import * as svc from "@/lib/service";
import { maskLicense, WARNING_DAYS, LICENSE_NO_HTML_PATTERN, LICENSE_NO_TITLE } from "@/lib/status";
import { LicenseBadge, BlacklistBadge, EligibilityBadge, Flash } from "@/components/ui";
import { blacklistAction, concernAction, editDriverAction, joinAction, licenseAction, releaseAction } from "@/app/actions";

export default async function DriverPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const u = await requireUser();
  const { id } = await params; const { ok, err } = await searchParams;
  const d = svc.getDriver(Number(id));
  if (!d) notFound();
  if (!svc.supervisorOwns(u, d))
    return <div className="card"><h1>No access</h1><p>This driver is not part of your site. To check whether someone is blacklisted, use <Link href="/check">Blacklist check</Link>.</p></div>;
  const full = svc.inScope(u, d);
  const own = svc.isOwnSiteDriver(u, d);
  const remark = d.blacklisted ? svc.latestRemark(d.id) : null;
  const bl = svc.blacklistHistory(d.id);
  const sites = svc.siteHistory(d.id);
  const lic = (await import("@/lib/db")).db().prepare("SELECT l.*, a.name added_name, v.name verified_name FROM licenses l LEFT JOIN users a ON a.id=l.added_by LEFT JOIN users v ON v.id=l.verified_by WHERE l.driver_id=?").get(d.id) as any;
  const canViewDoc = full && lic?.file_path;

  return (
    <>
      <p><Link href="/drivers">← Driver vault</Link></p>
      <Flash ok={ok} err={err} />
      {d.blacklisted ? (
        <div className="banner">
          <b>BLACKLISTED — driver is INELIGIBLE and INACTIVE.</b> Do not issue any task or work. This driver cannot be added to any site.
          {remark && <p style={{ margin: ".5rem 0 0" }}><b>Remark:</b> {remark.remark}<br /><span className="mut">By {remark.by_name} · {new Date(remark.at).toLocaleString()}</span></p>}
        </div>
      ) : null}

      <div className="card">
        <div className="row"><h1 style={{ margin: 0 }}>{d.name}</h1><span className="mut">ID {d.driver_code}</span></div>
        <div className="row" style={{ margin: ".6rem 0" }}>
          <span>License: <LicenseBadge expiry={d.lic_expiry} verified={d.lic_verified} /></span>
          <span>Blacklist: <BlacklistBadge on={d.blacklisted} /></span>
          <span>Eligibility: <EligibilityBadge blacklisted={d.blacklisted} /></span>
          <span>Site: {d.site_name ? <span className="badge b-OK">Active at {d.site_name}</span> : <span className="badge b-NEUTRAL">Inactive (last: {d.last_site_name})</span>}</span>
        </div>
        <p className="mut">Phone {d.phone || "—"} · Location {d.location || "—"} · Cluster {d.cluster_name ?? "—"}</p>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>License</h2>
          <p>Number: <b>{full ? d.lic_number ?? "—" : maskLicense(d.lic_number)}</b><br />
            Expiry: <b>{d.lic_expiry ?? "—"}</b> {d.lic_expiry && <span className="mut">(alerts start {WARNING_DAYS} days before)</span>}<br />
            Added by: {lic?.added_name ?? "—"} · Verified by: {lic?.verified_name ?? "—"} {lic?.verified_at ? `(${new Date(lic.verified_at).toLocaleDateString()})` : ""}</p>
          {canViewDoc && <p><a href={`/api/files/${d.id}`} target="_blank">📄 View license document ({lic.file_name})</a></p>}
          {!full && <p className="mut">Full license details and documents are visible to the driver's site and its Senior Manager.</p>}
          {(own || u.role === "DGM") && (
            <>
              <hr /><h3>Renew / update / verify license</h3>
              <form className="f" action={licenseAction}>
                <input type="hidden" name="id" value={d.id} />
                <label>License number (15 letters/digits)<input name="number" defaultValue={d.lic_number ?? ""} maxLength={15} minLength={15} pattern={LICENSE_NO_HTML_PATTERN} title={LICENSE_NO_TITLE} /></label>
                <label>Expiry date<input type="date" name="expiry" defaultValue={d.lic_expiry ?? ""} /></label>
                <label>New / updated document<input type="file" name="file" accept="image/*,application/pdf" /></label>
                <label className="row"><input type="checkbox" name="confirm" defaultChecked={!!d.lic_verified} /> I have compared with the document and confirm (verified)</label>
                <div><button>Save license</button></div>
              </form>
            </>
          )}
        </div>

        <div className="card">
          <h2>Site assignment</h2>
          <table><thead><tr><th>Site</th><th>Status</th><th>From</th><th>To</th></tr></thead>
            <tbody>{sites.map((a) => (
              <tr key={a.id}><td>{a.site_name}</td><td>{a.active ? <span className="badge b-OK">Active</span> : <span className="badge b-NEUTRAL">Inactive</span>}</td><td>{a.from_date}</td><td>{a.to_date ?? "—"}</td></tr>
            ))}</tbody></table>
          <div className="row" style={{ marginTop: ".7rem" }}>
            {svc.canRelease(u, d) && <form action={releaseAction}><input type="hidden" name="id" value={d.id} /><button className="ghost">Driver left {d.site_name} → mark inactive</button></form>}
            {u.role === "SUPERVISOR" && !d.site_id && !d.blacklisted && <form action={joinAction}><input type="hidden" name="id" value={d.id} /><button>Driver joined my site ({u.site_name}) → add as active</button></form>}
            {u.role === "SUPERVISOR" && d.blacklisted && <span className="badge b-EXPIRED">Cannot be added to a site — blacklisted</span>}
            {u.role === "SUPERVISOR" && d.site_id && d.site_id !== u.site_id && <span className="mut">Active at {d.site_name}. Their supervisor must mark them inactive before you can add them.</span>}
          </div>
          {(u.role === "DGM" || (u.role === "SUPERVISOR" && d.created_by === u.id)) && (
            <>
              <hr /><h3>Correct driver details</h3>
              <form className="f" action={editDriverAction}>
                <input type="hidden" name="id" value={d.id} />
                <label>Name<input name="name" defaultValue={d.name} /></label>
                <label>Phone<input name="phone" defaultValue={d.phone} /></label>
                <label>Location<input name="location" defaultValue={d.location} /></label>
                <div><button className="ghost">Save correction</button></div>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="grid g2">
        {own && (
          <div className="card">
            <h2>Raise a concern</h2>
            <p className="mut">Goes to your Senior Manager with a saved record. Be factual and professional.</p>
            <form className="f" action={concernAction}><input type="hidden" name="id" value={d.id} />
              <textarea name="text" required placeholder="Describe the concern…" /><div><button className="navy">Raise concern</button></div></form>
          </div>
        )}
        {svc.canBlacklist(u, d) && (
          <div className="card">
            <h2>{d.blacklisted ? "Unblock driver" : "Blacklist driver"}</h2>
            <p className="mut">{u.role === "DGM" ? "As DGM you can act on any driver." : "You can act on drivers in your own cluster."} A remark is mandatory and is visible to supervisors at all sites.</p>
            <form className="f" action={blacklistAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="mode" value={d.blacklisted ? "unblock" : "blacklist"} />
              <textarea name="remark" required placeholder="Remark (factual, professional)…" />
              <div><button className={d.blacklisted ? "" : "red"}>{d.blacklisted ? "Unblock" : "Blacklist — make ineligible"}</button></div></form>
          </div>
        )}
        {u.role === "SUPERVISOR" && !own && <div className="card mut">You can check this driver, but only the driver's own site supervisor can verify, update or raise concerns. Blacklisting is done by Senior Managers and the DGM.</div>}
      </div>

      <div className="card">
        <h2>Blacklist history</h2>
        {bl.length === 0 ? <p className="mut">No blacklist events.</p> : (
          <ul className="timeline">{bl.map((e) => (
            <li key={e.id}><span className={`badge ${e.action === "BLACKLIST" ? "b-BL" : "b-OK"}`}>{e.action}</span> {new Date(e.at).toLocaleString()} · {e.by_name} ({e.role.replace("_", " ").toLowerCase()}) — “{e.remark}”</li>
          ))}</ul>
        )}
      </div>
    </>
  );
}
