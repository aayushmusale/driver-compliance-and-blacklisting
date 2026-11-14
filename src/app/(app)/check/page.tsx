import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { blacklistCheck } from "@/lib/service";
import { CheckResults } from "@/components/check-results";

export default async function Check({ searchParams }: { searchParams: Promise<{ q?: string; err?: string }> }) {
  const u = await requireUser();
  const { q = "", err } = await searchParams;
  const res = blacklistCheck(u, q);
  return (
    <>
      <h1>Blacklist check</h1>
      {err && <div className="msg err">{err}</div>}
      <p className="mut" style={{ marginBottom: "1rem" }}>Before adding a new driver, check here whether they are blacklisted. Search by exact Driver ID, Driver Name or License Number. You see only the blacklist status and remark; other sites' driver records are not visible to you.</p>
      <form className="row card">
        <input name="q" defaultValue={q} placeholder="Driver ID, Driver Name or License Number" style={{ width: 380 }} autoFocus />
        <button>Check</button>{q && <Link href="/check">Clear</Link>}
      </form>
      <CheckResults q={q} rows={res.rows} error={res.error} />
      {u.role === "SUPERVISOR" && q && res.rows.every((r) => r.status !== "BLACKLISTED") && !res.error && (
        <p style={{ marginTop: "1rem" }}><Link href="/drivers/new" className="btn">Continue to add a new driver →</Link></p>
      )}
    </>
  );
}
