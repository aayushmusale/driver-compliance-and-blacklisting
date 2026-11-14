"use client";
// Ready-made column sets so every driver / site table in the app is filterable in the same way.
import { DataTable, type Col, type Preset } from "./data-table";

const LICENSE = ["Valid", "Expiring soon", "Expired", "Pending verification"];
const WINDOW = ["Already expired", "Within 30 days", "31-60 days", "61-180 days", "Over 180 days", "No expiry date"];

export const DRIVER_PRESETS: Preset[] = [
  { label: "Action needed", filters: { license_status: "Expired|Expiring soon|Pending verification" } },
  { label: "Expired", filters: { license_status: "Expired" } },
  { label: "Expiring soon", filters: { license_status: "Expiring soon" } },
  { label: "Pending verification", filters: { license_status: "Pending verification" } },
  { label: "Eligible", filters: { eligibility: "Eligible" } },
  { label: "Not eligible", filters: { eligibility: "Not eligible" } },
  { label: "Blacklisted", filters: { blacklist: "Blacklisted" } },
];

export function DriversTable({ rows, showSite = true, showCluster = false, pageSize = 12 }: { rows: any[]; showSite?: boolean; showCluster?: boolean; pageSize?: number }) {
  const cols: Col[] = [
    { key: "code", label: "Driver ID", filter: "text" },
    { key: "name", label: "Name", kind: "driver", filter: "text" },
    { key: "phone", label: "Phone", filter: "text" },
    ...(showCluster ? [{ key: "cluster", label: "Cluster", filter: "select" } as Col] : []),
    ...(showSite ? [{ key: "site", label: "Site", kind: "site", filter: "select" } as Col] : []),
    { key: "active", label: "At site", kind: "active", filter: "select", options: ["Active", "Inactive"] },
    { key: "license_status", label: "License", kind: "license", filter: "select", options: LICENSE },
    { key: "expiry", label: "Expiry date", filter: "text" },
    { key: "expiry_window", label: "Expiry window", filter: "select", options: WINDOW, sortKey: "days" },
    { key: "lic_no", label: "License no.", kind: "mono", filter: "text" },
    { key: "blacklist", label: "Blacklist", kind: "blacklist", filter: "select", options: ["Not blacklisted", "Blacklisted"] },
    { key: "eligibility", label: "Eligibility", kind: "eligibility", filter: "select", options: ["Eligible", "Not eligible"] },
  ];
  return <DataTable columns={cols} rows={rows} presets={DRIVER_PRESETS} pageSize={pageSize} searchPlaceholder="Search any driver detail…" empty="No drivers match the filters." />;
}

export function SitesTable({ rows, showCluster = true }: { rows: any[]; showCluster?: boolean }) {
  const cols: Col[] = [
    { key: "name", label: "Site (click to open)", kind: "site", filter: "text" },
    ...(showCluster ? [{ key: "cluster", label: "Cluster", filter: "select" } as Col] : []),
    { key: "total", label: "Active drivers", kind: "num", filter: "num" },
    { key: "EXPIRED", label: "Expired", kind: "num", filter: "num" },
    { key: "EXPIRING", label: "Expiring", kind: "num", filter: "num" },
    { key: "PENDING", label: "Pending", kind: "num", filter: "num" },
    { key: "blacklisted", label: "Blacklisted", kind: "num", filter: "num" },
    { key: "open_concerns", label: "Open concerns", kind: "num", filter: "num" },
    { key: "mix", label: "Mix", kind: "bar", filter: "none", sortKey: "EXPIRED" },
  ];
  return <DataTable columns={cols} rows={rows} pageSize={20} searchPlaceholder="Search sites…" />;
}

export function AuditTable({ rows }: { rows: any[] }) {
  const cols: Col[] = [
    { key: "when", label: "When", filter: "text", sortKey: "at" },
    { key: "user", label: "Who", filter: "select" },
    { key: "action", label: "Action", filter: "select" },
    { key: "driver", label: "Driver", filter: "text" },
    { key: "detail", label: "Detail", filter: "text" },
  ];
  return <DataTable columns={cols} rows={rows} pageSize={15} searchPlaceholder="Search the audit trail…" />;
}
