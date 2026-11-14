"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { CheckRow } from "@/lib/service";
import { licenseNoError, LICENSE_NO_MSG, LICENSE_NO_HTML_PATTERN, LICENSE_NO_TITLE } from "@/lib/status";

type State = { loading: boolean; match: CheckRow | null; done: boolean };

/** Checks the vault while the supervisor types (debounced). Exact match only; never exposes more than the blacklist check does. */
function useLiveLookup(field: "code" | "license", value: string): State {
  const [s, setS] = useState<State>({ loading: false, match: null, done: false });
  useEffect(() => {
    const v = value.trim();
    if (!v) { setS({ loading: false, match: null, done: false }); return; }
    setS((p) => ({ ...p, loading: true, done: false }));
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/lookup?field=${field}&value=${encodeURIComponent(v)}`, { signal: ctl.signal });
        const j = await r.json();
        setS({ loading: false, match: j.match ?? null, done: true });
      } catch { /* aborted by a newer keystroke */ }
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [field, value]);
  return s;
}

function Status({ s, what, value }: { s: State; what: string; value: string }) {
  if (!value.trim()) return null;
  if (s.loading || !s.done) return <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking the vault…</span>;
  if (!s.match) return <span className="flex items-center gap-1.5 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" />This {what} is not in the vault. OK to use.</span>;
  const m = s.match;
  return (
    <span className="rounded-md border border-red-300 bg-red-50 p-2 text-xs font-normal text-red-900">
      <span className="flex items-center gap-1.5 font-semibold"><XCircle className="h-3.5 w-3.5" />
        {m.status === "BLACKLISTED" ? `BLACKLISTED: ${m.name} (ID ${m.code}) is not eligible and cannot be added to any site.` : `This ${what} already exists in the vault: ${m.name} (ID ${m.code}).`}</span>
      {m.status === "BLACKLISTED" && m.remark && <span className="mt-1 block">Remark: {m.remark}</span>}
      {m.status !== "BLACKLISTED" && <span className="mt-1 block">A duplicate cannot be created. <Link href={`/check?q=${encodeURIComponent(m.code)}`}>Open the blacklist check</Link> to add this driver to your site.</span>}
    </span>
  );
}

const Req = ({ children }: { children: React.ReactNode }) => <span>{children}<span className="text-primary"> *</span></span>;

export function AddDriverForm({ action, defaultCode = "" }: { action: (f: FormData) => void | Promise<void>; defaultCode?: string }) {
  const [code, setCode] = useState(defaultCode);
  const [lic, setLic] = useState("");
  const licErr = licenseNoError(lic);
  const licOk = licErr === null;
  const codeS = useLiveLookup("code", code);
  const licS = useLiveLookup("license", licOk ? lic : ""); // look up only once the number is a valid 15-character value
  const blocked = !!codeS.match || !!licS.match || codeS.loading || licS.loading || !licOk;

  return (
    <form className="f" action={action} style={{ maxWidth: 560 }}>
      <p className="mut">All fields marked <span className="text-primary">*</span> are mandatory.</p>
      <label><Req>Driver ID</Req><input name="code" required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></label>
      <Status s={codeS} what="Driver ID" value={code} />
      <label><Req>Full name</Req><input name="name" required /></label>
      <label><Req>Contact number</Req><input name="phone" required inputMode="tel" /></label>
      <label><Req>Location</Req><input name="location" required defaultValue="Pune" /></label>
      <hr />
      <label><Req>License number (15 letters/digits)</Req><input name="number" required value={lic} maxLength={15} pattern={LICENSE_NO_HTML_PATTERN} title={LICENSE_NO_TITLE}
        onChange={(e) => setLic(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} autoComplete="off" /></label>
      {lic && !licOk && (
        <span className="flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-800" role="alert">
          <XCircle className="h-3.5 w-3.5 shrink-0" />{lic.length < 15 ? `${LICENSE_NO_MSG} (${lic.length}/15)` : licErr}</span>
      )}
      {licOk && <Status s={licS} what="License number" value={lic} />}
      <label><Req>License expiry date</Req><input type="date" name="expiry" required /></label>
      <label><Req>License photo / scan / PDF (stored privately)</Req><input type="file" name="file" accept="image/*,application/pdf" required /></label>
      <label className="row"><input type="checkbox" name="confirm" required /> <Req>I have compared the details with the document and confirm they are correct (verification)</Req></label>
      <div><button disabled={blocked}>Add driver to my site</button></div>
      {blocked && <p className="mut">The button unlocks when the License number is a valid 15-character value, and neither it nor the Driver ID is already in the vault.</p>}
    </form>
  );
}
