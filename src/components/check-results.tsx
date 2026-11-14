import Link from "next/link";
import { Ban, CheckCircle2, Info, Users } from "lucide-react";
import type { CheckRow } from "@/lib/service";
import { joinAction } from "@/app/actions";

/** Blacklist-check results for a site supervisor: status only, never another site's driver record. */
export function CheckResults({ q, rows, error }: { q: string; rows: CheckRow[]; error?: string }) {
  if (!q) return null;
  if (error) return <div className="msg err">{error}</div>;
  if (rows.length === 0)
    return (
      <div className="msg ok flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>No driver with the Driver ID, Name or License Number “{q}” exists in the company vault, so this driver is not blacklisted. Check the spelling, then add the driver as a new entry.</span></div>
    );
  return (
    <div className="space-y-3">
      {rows.map((r) =>
        r.status === "BLACKLISTED" ? (
          <div key={r.id} className="banner !mb-0">
            <div className="flex items-center gap-2"><Ban className="h-5 w-5" /><b>BLACKLISTED — {r.name} (ID {r.code})</b></div>
            <p style={{ margin: ".4rem 0 0" }}>This driver is <b>not eligible</b>: do not issue any task or work, and they <b>cannot be added to any site</b>.</p>
            <p style={{ margin: ".4rem 0 0" }}><b>Remark:</b> {r.remark}<br /><span className="mut">By {r.by} · {r.at ? new Date(r.at).toLocaleString() : ""}</span></p>
          </div>
        ) : (
          <div key={r.id} className="card !mb-0 flex flex-wrap items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div className="min-w-[200px] flex-1">
              <div className="font-semibold">{r.name} <span className="mut">· ID {r.code}</span></div>
              <div className="mut">
                {r.status === "AVAILABLE" && "Not blacklisted · not currently assigned to any site. You can add this driver to your site."}
                {r.status === "ACTIVE_ELSEWHERE" && "Not blacklisted · currently active at another site. Their site supervisor must mark them inactive before you can add them."}
                {r.status === "AT_MY_SITE" && "Not blacklisted · already active at your site."}
              </div>
            </div>
            {r.status === "AVAILABLE" && (
              <form action={joinAction}><input type="hidden" name="id" value={r.id} /><button><Users className="h-4 w-4" />Add to my site</button></form>
            )}
            {r.status === "AT_MY_SITE" && <Link href={`/drivers/${r.id}`}>Open driver →</Link>}
          </div>
        )
      )}
      <p className="mut flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" />Only blacklist status is shown for drivers outside your site. Their other details are not visible to you.</p>
    </div>
  );
}
