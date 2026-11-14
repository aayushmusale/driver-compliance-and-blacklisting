import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { blacklistCheck } from "@/lib/service";
import { addDriverAction } from "@/app/actions";
import { Flash } from "@/components/ui";
import { CheckResults } from "@/components/check-results";
import { AddDriverForm } from "@/components/add-driver-form";

export default async function NewDriver({ searchParams }: { searchParams: Promise<{ q?: string; err?: string }> }) {
  const u = await requireUser();
  const { q = "", err } = await searchParams;
  if (u.role !== "SUPERVISOR") return <div className="card">Only site supervisors add drivers.</div>;
  const res = blacklistCheck(u, q);
  const blocked = res.rows.some((r) => r.status === "BLACKLISTED");
  return (
    <>
      <h1>Add a driver to {u.site_name}</h1>
      <Flash err={err} />
      <div className="card">
        <h2>Step 1 — Blacklist check (always first)</h2>
        <p className="mut">Check the exact Driver ID, Driver Name or License Number. Blacklisted drivers cannot be added to any site.</p>
        <form className="row"><input name="q" defaultValue={q} placeholder="Driver ID, Driver Name or License Number" style={{ width: 360 }} /><button>Check</button>{q && <Link href="/drivers/new">Clear</Link>}</form>
        <div style={{ marginTop: ".8rem" }}><CheckResults q={q} rows={res.rows} error={res.error} /></div>
      </div>
      {blocked ? (
        <div className="card"><b>A matching driver is blacklisted.</b> If this is a different person, change the search (for example the driver ID) and check again before adding.</div>
      ) : (
        <div className="card">
          <h2>Step 2 — New driver and license</h2>
          <p className="mut">Only for a driver who is not already in the company vault. Existing drivers are added from the check results above.</p>
          <AddDriverForm action={addDriverAction} defaultCode={/^\w+$/.test(q) ? q : ""} />
          <p className="mut" style={{ marginTop: ".6rem" }}>OCR suggestions (next phase) will also need the supervisor's confirmation.</p>
        </div>
      )}
    </>
  );
}
