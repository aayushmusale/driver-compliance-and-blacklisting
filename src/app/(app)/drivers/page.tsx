import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { searchDrivers, driversInSites, driverRows } from "@/lib/service";
import { DriversTable } from "@/components/tables";

export default async function Drivers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireUser();
  const { q = "" } = await searchParams;
  const supervisor = u.role === "SUPERVISOR";
  // A site supervisor only ever receives their own site's drivers; the company vault is for Senior Managers and the DGM.
  const rows = driverRows(u, supervisor ? driversInSites([u.site_id!]) : searchDrivers(q));
  return (
    <>
      <h1>{supervisor ? `Drivers of ${u.site_name}` : "Driver vault"}</h1>
      {supervisor ? (
        <p className="mut" style={{ marginBottom: "1rem" }}>You see only your own site's drivers. To check whether any other person is blacklisted, use <Link href="/check">Blacklist check</Link>.</p>
      ) : (
        <>
          <p className="mut">Search the whole company vault by name, driver ID, contact number or license number. Then filter any column below.</p>
          <form className="row card"><input name="q" defaultValue={q} placeholder="Search name, driver ID, phone, license no…" style={{ width: 380 }} /><button>Search vault</button>
            {q && <Link href="/drivers">Clear</Link>}</form>
        </>
      )}
      <div className="card">
        <DriversTable rows={rows} showSite={!supervisor} showCluster={!supervisor} />
      </div>
    </>
  );
}
