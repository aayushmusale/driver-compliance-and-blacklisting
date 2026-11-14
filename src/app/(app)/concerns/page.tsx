import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listConcerns } from "@/lib/service";
import { resolveConcernAction } from "@/app/actions";
import { Flash } from "@/components/ui";

export default async function Concerns({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; status?: string; site?: string }> }) {
  const u = await requireUser();
  const { ok, err, status = "", site = "" } = await searchParams;
  const all = listConcerns(u);
  const rows = all.filter((c) => (!status || c.status === status) && (!site || c.site_name === site));
  const sites = [...new Set(all.map((c) => c.site_name))];
  const reviewer = u.role !== "SUPERVISOR";
  const chip = (label: string, s: string, st: string) => (
    <Link key={label} className={`btn !rounded-full !px-3 !py-1 !text-xs ${s === status && st === site ? "" : "ghost"}`} style={s === status && st === site ? undefined : { background: "#fff", color: "inherit", border: "1px solid hsl(var(--input))" }}
      href={`/concerns?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(st ? { site: st } : {}) })}`}>{label}</Link>
  );
  return (
    <>
      <h1>{reviewer ? "Concerns inbox" : "Concerns I raised"}</h1>
      <Flash ok={ok} err={err} />
      <div className="row" style={{ marginBottom: "1rem" }}>
        <span className="mut">Status:</span>{chip("All", "", site)}{chip("Open", "OPEN", site)}{chip("Resolved", "RESOLVED", site)}{chip("Dismissed", "DISMISSED", site)}
        {reviewer && sites.length > 1 && <><span className="mut" style={{ marginLeft: "1rem" }}>Site:</span>{chip("All sites", status, "")}{sites.map((s) => chip(s, status, s))}</>}
      </div>
      {rows.length === 0 && <div className="card mut">No concerns yet. {u.role === "SUPERVISOR" && "Open a driver at your site and use “Raise a concern”."}</div>}
      {rows.map((c) => (
        <div className="card" key={c.id}>
          <div className="row"><span className={`badge ${c.status === "OPEN" ? "b-EXPIRING" : "b-NEUTRAL"}`}>{c.status}</span>
            <b><Link href={`/drivers/${c.driver_id}`}>{c.driver_name}</Link></b><span className="mut">{c.site_name} · raised by {c.raised_name} · {new Date(c.created_at).toLocaleString()}</span></div>
          <p>{c.text}</p>
          {c.resolution && <p className="mut">Resolution: {c.resolution}</p>}
          {reviewer && c.status === "OPEN" && (
            <form className="f" action={resolveConcernAction}>
              <input type="hidden" name="cid" value={c.id} />
              <textarea name="note" required placeholder="Resolution note (e.g. blacklisted after review / no action needed)…" />
              <div className="row">
                <button name="status" value="RESOLVED">Mark resolved</button>
                <button name="status" value="DISMISSED" className="ghost">Dismiss (no action)</button>
                <Link className="btn red" href={`/drivers/${c.driver_id}`}>Open driver to blacklist →</Link>
              </div>
            </form>
          )}
        </div>
      ))}
    </>
  );
}
