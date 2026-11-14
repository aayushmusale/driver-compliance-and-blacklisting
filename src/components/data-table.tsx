"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FilterX, Search } from "lucide-react";
import { LicenseBadge, BlacklistBadge, EligibilityBadge, StatusBar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";

export type Kind = "text" | "driver" | "site" | "license" | "blacklist" | "eligibility" | "active" | "bar" | "num" | "mono";
export type Col = {
  key: string; label: string; kind?: Kind;
  filter?: "text" | "select" | "num" | "none";
  options?: string[];            // fixed order for select filters (otherwise derived from the data)
  sortKey?: string;              // row field used for sorting (defaults to key)
};
export type Preset = { label: string; filters: Record<string, string> }; // select values may be "A|B" (any of)
type Row = Record<string, any>;

const ALL = "";

function matchNum(v: number, expr: string) {
  const m = expr.trim().match(/^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return true;
  const n = Number(m[2]);
  switch (m[1]) { case ">": return v > n; case "<": return v < n; case ">=": return v >= n; case "<=": return v <= n; default: return v === n; }
}

function Cell({ col, row }: { col: Col; row: Row }) {
  const v = row[col.key];
  switch (col.kind) {
    case "driver": return <Link href={`/drivers/${row.id}`} className="font-medium">{v}</Link>;
    case "site": return row.site_id ? <Link href={`/sites/${row.site_id}`} className="font-medium">{v}</Link> : <>{v}</>;
    case "license": return <LicenseBadge expiry={row.expiry_raw} verified={row.verified} />;
    case "blacklist": return <BlacklistBadge on={row.blacklisted_n} />;
    case "eligibility": return <EligibilityBadge blacklisted={row.blacklisted_n} />;
    case "active": return <Badge variant={v === "Active" ? "success" : "neutral"}>{v}</Badge>;
    case "bar": return <StatusBar c={row.mix} />;
    case "mono": return <span className="font-mono text-xs">{v}</span>;
    default: return <>{v}</>;
  }
}

export function DataTable({ columns, rows, presets = [], pageSize = 12, searchPlaceholder = "Search this table…", empty = "No rows match the filters." }:
  { columns: Col[]; rows: Row[]; presets?: Preset[]; pageSize?: number; searchPlaceholder?: string; empty?: string }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const options = useMemo(() => {
    const o: Record<string, string[]> = {};
    for (const c of columns) if (c.filter === "select") o[c.key] = c.options ?? [...new Set(rows.map((r) => String(r[c.key])))].sort();
    return o;
  }, [columns, rows]);

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      for (const c of columns) {
        const val = f[c.key];
        if (!val) continue;
        if (c.filter === "select") { if (!val.split("|").includes(String(r[c.key]))) return false; }
        else if (c.filter === "num") { if (!matchNum(Number(r[c.key]), val)) return false; }
        else if (!String(r[c.key]).toLowerCase().includes(val.toLowerCase())) return false;
      }
      if (q) {
        const hay = columns.map((c) => String(r[c.key])).join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)!;
      const k = col.sortKey ?? col.key;
      out.sort((a, b) => {
        const x = a[k], y = b[k];
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
      });
    }
    return out;
  }, [rows, columns, f, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const view = filtered.slice(cur * pageSize, cur * pageSize + pageSize);
  const active = Object.values(f).some(Boolean) || !!q;
  const setFilter = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setPage(0); };
  const clear = () => { setF({}); setQ(""); setPage(0); };
  const presetOn = (p: Preset) => Object.keys(p.filters).length === Object.values(f).filter(Boolean).length && Object.entries(p.filters).every(([k, v]) => f[k] === v);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={searchPlaceholder} className="!w-64 !py-1.5 !pl-8 !text-sm" />
        </div>
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => { setF(presetOn(p) ? {} : p.filters); setPage(0); }}
            className={presetOn(p) ? "!rounded-full !px-3 !py-1 !text-xs" : "ghost !rounded-full !px-3 !py-1 !text-xs"}>{p.label}</button>
        ))}
        {active && <button type="button" onClick={clear} className="ghost !px-3 !py-1 !text-xs"><FilterX className="h-3.5 w-3.5" />Clear filters</button>}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>{columns.map((c) => {
              const on = sort?.key === c.key;
              const Icon = !on ? ArrowUpDown : sort!.dir === 1 ? ArrowUp : ArrowDown;
              return (
                <th key={c.key}>
                  <button type="button" onClick={() => setSort(on && sort!.dir === -1 ? null : { key: c.key, dir: on ? -1 : 1 })}
                    className="!inline-flex !items-center !gap-1 !bg-transparent !p-0 !text-xs !font-medium !uppercase !tracking-wide !text-muted-foreground !shadow-none hover:!bg-transparent hover:!text-foreground">
                    {c.label}<Icon className={`h-3 w-3 ${on ? "text-primary" : "opacity-40"}`} />
                  </button>
                </th>
              );
            })}</tr>
            <tr className="bg-muted/50">{columns.map((c) => (
              <th key={c.key} className="!h-auto !py-1.5 !normal-case">
                {c.filter === "select" ? (
                  <select value={f[c.key] ?? ALL} onChange={(e) => setFilter(c.key, e.target.value)} className="!h-8 !min-w-[110px] !py-0 !text-xs">
                    <option value={ALL}>All</option>
                    {options[c.key].map((o) => <option key={o} value={o}>{o}</option>)}
                    {f[c.key]?.includes("|") && <option value={f[c.key]}>{f[c.key].split("|").length} selected</option>}
                  </select>
                ) : c.filter === "none" ? null : (
                  <input value={f[c.key] ?? ""} onChange={(e) => setFilter(c.key, e.target.value)} placeholder={c.filter === "num" ? ">2, =0…" : "Filter…"} className="!h-8 !min-w-[80px] !py-0 !text-xs" />
                )}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={r.id ?? i} className={r.blacklisted_n ? "bl" : ""}>
                {columns.map((c) => <td key={c.key}><Cell col={c} row={r} /></td>)}
              </tr>
            ))}
            {view.length === 0 && <tr><td colSpan={columns.length} className="py-8 text-center text-muted-foreground">{empty}</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <button type="button" className="ghost !px-2 !py-1" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft className="h-4 w-4" /></button>
          Page {cur + 1} of {pages}
          <button type="button" className="ghost !px-2 !py-1" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
