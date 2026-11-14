import { requireUser } from "@/lib/auth";
import { auditLog } from "@/lib/service";
import { AuditTable } from "@/components/tables";

export default async function Audit() {
  const u = await requireUser();
  if (u.role === "SUPERVISOR") return <div className="card">Audit history is available to Senior Managers and the DGM.</div>;
  const rows = auditLog(u).map((r) => ({ id: r.id, at: r.at, when: new Date(r.at).toLocaleString(), user: r.user_name ?? "System", action: r.action, driver: r.driver_name ?? "—", detail: r.detail ?? "" }));
  return (
    <>
      <h1>Audit trail</h1>
      <p className="mut">Append-only record of who did what and when{u.role === "SENIOR_MANAGER" ? " (your cluster)" : ""}. Filter any column.</p>
      <div className="card"><AuditTable rows={rows} /></div>
    </>
  );
}
