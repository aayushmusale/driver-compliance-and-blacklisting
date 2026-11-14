import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, today, UPLOAD_DIR } from "./db";
import { licenseStatus, daysLeft, LICENSE_LABEL, WARNING_DAYS, licenseNoError } from "./status";
import type { User } from "./auth";

export class Denied extends Error {}
const deny = (m: string): never => { throw new Denied(m); };
const now = () => new Date().toISOString();

export type DriverRow = {
  id: number; driver_code: string; name: string; phone: string; location: string; blacklisted: number; created_by: number;
  site_id: number | null; site_name: string | null; resp_site_id: number | null; resp_cluster_id: number | null;
  last_site_name: string | null; cluster_name: string | null;
  lic_number: string | null; lic_expiry: string | null; lic_verified: number | null; lic_file: string | null;
};

const DRIVER_SQL = `
SELECT d.*, a.site_id AS site_id, s.name AS site_name,
  COALESCE(a.site_id, (SELECT site_id FROM assignments WHERE driver_id=d.id ORDER BY id DESC LIMIT 1)) AS resp_site_id,
  rs.cluster_id AS resp_cluster_id, rc.name AS cluster_name, rs.name AS last_site_name,
  l.number AS lic_number, l.expiry AS lic_expiry, l.verified AS lic_verified, l.file_name AS lic_file
FROM drivers d
LEFT JOIN assignments a ON a.driver_id=d.id AND a.active=1
LEFT JOIN sites s ON s.id=a.site_id
LEFT JOIN sites rs ON rs.id=COALESCE(a.site_id,(SELECT site_id FROM assignments WHERE driver_id=d.id ORDER BY id DESC LIMIT 1))
LEFT JOIN clusters rc ON rc.id=rs.cluster_id
LEFT JOIN licenses l ON l.driver_id=d.id`;

export const audit = (userId: number | null, action: string, driverId: number | null, detail: string) =>
  db().prepare("INSERT INTO audit (at,user_id,action,driver_id,detail) VALUES (?,?,?,?,?)").run(now(), userId, action, driverId, detail);

export function getDriver(id: number): DriverRow | undefined {
  return db().prepare(DRIVER_SQL + " WHERE d.id=?").get(id) as DriverRow | undefined;
}

export function searchDrivers(q = ""): DriverRow[] {
  const like = `%${q.trim()}%`;
  if (!q.trim()) return db().prepare(DRIVER_SQL + " ORDER BY d.driver_code").all() as DriverRow[];
  return db().prepare(DRIVER_SQL + " WHERE d.name LIKE ? OR d.driver_code LIKE ? OR d.phone LIKE ? OR l.number LIKE ? ORDER BY d.driver_code")
    .all(like, like, like, like) as DriverRow[];
}

// ---------- blacklist check (the only cross-site lookup a site supervisor has) ----------
export type CheckStatus = "BLACKLISTED" | "AVAILABLE" | "AT_MY_SITE" | "ACTIVE_ELSEWHERE";
export type CheckRow = { id: number; code: string; name: string; status: CheckStatus; remark?: string; by?: string; at?: string };

/**
 * Lets a supervisor confirm whether a person is blacklisted before adding them, WITHOUT exposing other sites' driver records:
 * only ID, name, blacklist status (+ remark) and whether the driver can be added are returned. Exact match on Driver ID, Name or License Number only.
 */
export function blacklistCheck(u: User, q: string): { error?: string; rows: CheckRow[] } {
  const term = q.trim();
  if (!term) return { rows: [] };
  if (term.length < 3) return { error: "Enter the full Driver ID, Driver Name or License Number.", rows: [] };
  // exact (case-insensitive) match on the three unique identifiers only: Driver ID, Driver Name, License Number
  const ds = db().prepare(DRIVER_SQL + " WHERE lower(d.driver_code)=lower(?) OR lower(d.name)=lower(?) OR lower(l.number)=lower(?) ORDER BY d.driver_code LIMIT 8")
    .all(term, term, term) as DriverRow[];
  audit(u.id, "BLACKLIST_CHECK", null, `Searched "${term}" -> ${ds.length} match(es)`);
  return { rows: ds.map((d) => toCheckRow(u, d)) };
}

function toCheckRow(u: User, d: DriverRow): CheckRow {
  const r = d.blacklisted ? latestRemark(d.id) : null;
  const status: CheckStatus = d.blacklisted ? "BLACKLISTED" : d.site_id === u.site_id && u.site_id ? "AT_MY_SITE" : d.site_id ? "ACTIVE_ELSEWHERE" : "AVAILABLE";
  return { id: d.id, code: d.driver_code, name: d.name, status, remark: r?.remark, by: r?.by_name, at: r?.at };
}

/** Live duplicate check while typing in the Add driver form. Exact match on Driver ID or License Number; same limited view as the blacklist check. */
export function identifierLookup(u: User, field: "code" | "license", value: string): CheckRow | null {
  const v = value.trim();
  if (u.role !== "SUPERVISOR" || !v) return null;
  const d = db().prepare(DRIVER_SQL + (field === "code" ? " WHERE lower(d.driver_code)=lower(?)" : " WHERE lower(l.number)=lower(?)") + " LIMIT 1").get(v) as DriverRow | undefined;
  return d ? toCheckRow(u, d) : null;
}

/** A supervisor may open a driver's profile only if the driver belongs (or last belonged) to the supervisor's own site. */
export const supervisorOwns = (u: User, d: DriverRow) => u.role !== "SUPERVISOR" || d.resp_site_id === u.site_id;

// ---------- scope helpers ----------
/** Sites a user may see in dashboards. DGM: all. Senior Manager: own cluster. Supervisor: own site. */
export function scopeSiteIds(u: User): number[] {
  const rows = u.role === "DGM"
    ? db().prepare("SELECT id FROM sites").all()
    : u.role === "SENIOR_MANAGER"
      ? db().prepare("SELECT id FROM sites WHERE cluster_id=?").all(u.cluster_id)
      : [{ id: u.site_id }];
  return (rows as { id: number }[]).map((r) => r.id);
}

/** Can this user see the full detail (license number, documents) of the driver? */
export function inScope(u: User, d: DriverRow): boolean {
  if (u.role === "DGM") return true;
  if (u.role === "SENIOR_MANAGER") return d.resp_cluster_id === u.cluster_id;
  return d.site_id === u.site_id;
}

export const canBlacklist = (u: User, d: DriverRow) =>
  u.role === "DGM" || (u.role === "SENIOR_MANAGER" && d.resp_cluster_id === u.cluster_id);

export const isOwnSiteDriver = (u: User, d: DriverRow) => u.role === "SUPERVISOR" && d.site_id === u.site_id;

export const canRelease = (u: User, d: DriverRow) => d.site_id != null && (u.role !== "SUPERVISOR" ? canBlacklist(u, d) : isOwnSiteDriver(u, d));

// ---------- drivers ----------
export function addDriver(u: User, f: { code: string; name: string; phone: string; location: string; number: string; expiry: string; confirm: boolean; file?: { name: string; buf: Buffer } | null }) {
  if (u.role !== "SUPERVISOR") deny("Only site supervisors add drivers.");
  // every field of the form is mandatory
  if (![f.code, f.name, f.phone, f.location, f.number, f.expiry].every((x) => x && x.trim())) deny("All fields are mandatory: Driver ID, name, contact number, location, license number and expiry date.");
  if (!f.file || !f.file.buf.length) deny("The license photo / scan / PDF is mandatory.");
  if (!f.confirm) deny("Please confirm that you have compared the details with the license document.");
  const licErr = licenseNoError(f.number.trim());
  if (licErr) deny(licErr);
  f.number = f.number.trim().toUpperCase();
  if (Number.isNaN(Date.parse(f.expiry))) deny("Enter a valid license expiry date.");
  if (db().prepare("SELECT 1 FROM drivers WHERE lower(driver_code)=lower(?)").get(f.code)) deny("A driver with this ID already exists in the company vault. Use the blacklist check above, and add the existing driver to your site instead.");
  if (db().prepare("SELECT 1 FROM licenses WHERE lower(number)=lower(?)").get(f.number)) deny("This license number is already registered to a driver in the company vault. Use the blacklist check above.");
  const tx = db().transaction(() => {
    const id = Number(db().prepare("INSERT INTO drivers (driver_code,name,phone,location,created_by,created_at) VALUES (?,?,?,?,?,?)")
      .run(f.code, f.name, f.phone, f.location, u.id, now()).lastInsertRowid);
    db().prepare("INSERT INTO assignments (driver_id,site_id,active,from_date,added_by) VALUES (?,?,1,?,?)").run(id, u.site_id, today(), u.id);
    db().prepare("INSERT INTO licenses (driver_id,added_by,updated_at) VALUES (?,?,?)").run(id, u.id, now());
    audit(u.id, "DRIVER_ADDED", id, `Added ${f.name} (${f.code}) to ${u.site_name}`);
    if (f.number || f.expiry || f.file) saveLicense(u, id, f.number, f.expiry, f.confirm, f.file, true);
    return id;
  });
  return tx();
}

export function updateDriverDetails(u: User, id: number, f: { name: string; phone: string; location: string }) {
  const d = getDriver(id) ?? deny("Driver not found.");
  if (!(u.role === "DGM" || (u.role === "SUPERVISOR" && d!.created_by === u.id))) deny("You can only correct entries you added.");
  db().prepare("UPDATE drivers SET name=?,phone=?,location=? WHERE id=?").run(f.name, f.phone, f.location, id);
  audit(u.id, "DRIVER_CORRECTED", id, `Name/phone/location corrected (was ${d!.name}, ${d!.phone}, ${d!.location})`);
}

// ---------- license (add / renew / verify) ----------
export function saveLicense(u: User, id: number, number: string, expiry: string, confirm: boolean, file?: { name: string; buf: Buffer } | null, skipCheck = false) {
  const d = getDriver(id) ?? deny("Driver not found.");
  if (!skipCheck && !(isOwnSiteDriver(u, d!) || u.role === "DGM")) deny("Only the supervisor of the driver's current site can update this license.");
  const old = db().prepare("SELECT * FROM licenses WHERE driver_id=?").get(id) as any;
  let fileName = old?.file_name ?? null, filePath = old?.file_path ?? null;
  if (file && file.buf.length) {
    fileName = file.name;
    filePath = crypto.randomUUID() + path.extname(file.name);
    fs.writeFileSync(path.join(UPLOAD_DIR, filePath), file.buf);
  }
  if (number) {
    const licErr = licenseNoError(number.trim());
    if (licErr) deny(licErr);
    number = number.trim().toUpperCase();
    if (db().prepare("SELECT 1 FROM licenses WHERE lower(number)=lower(?) AND driver_id<>?").get(number, id)) deny("This license number is already registered to another driver.");
  }
  const number2 = number || old?.number || null, expiry2 = expiry || old?.expiry || null;
  const verified = confirm && number2 && expiry2 ? 1 : 0; // never auto-confirmed: supervisor must tick the box (BR-12)
  db().prepare(`UPDATE licenses SET number=?,expiry=?,verified=?,verified_by=?,verified_at=?,file_name=?,file_path=?,updated_at=?,
      added_by=COALESCE(added_by,?) WHERE driver_id=?`)
    .run(number2, expiry2, verified, verified ? u.id : null, verified ? now() : null, fileName, filePath, now(), u.id, id);
  audit(u.id, verified ? "LICENSE_VERIFIED" : "LICENSE_SAVED_PENDING", id,
    `License ${old?.number ?? "—"}/${old?.expiry ?? "—"} -> ${number2}/${expiry2}${verified ? " (verified)" : " (pending verification)"}`);
  // renewing/verifying the license is the action the expiry alerts ask for, so those alerts are done
  if (verified) db().prepare("UPDATE notifications SET read=1 WHERE driver_id=? AND kind IN ('EXPIRED','EXPIRING')").run(id);
}

// ---------- site assignment (active / inactive) ----------
export function releaseDriver(u: User, id: number) {
  const d = getDriver(id) ?? deny("Driver not found.");
  if (!canRelease(u, d!)) deny("You cannot release this driver from the site.");
  db().prepare("UPDATE assignments SET active=0,to_date=?,released_by=? WHERE driver_id=? AND active=1").run(today(), u.id, id);
  audit(u.id, "DRIVER_RELEASED", id, `Marked inactive at ${d!.site_name}`);
}

export function addToMySite(u: User, id: number) {
  if (u.role !== "SUPERVISOR") deny("Only a site supervisor adds a driver to their site.");
  const d = getDriver(id) ?? deny("Driver not found.");
  if (d!.blacklisted) deny("This driver is BLACKLISTED and ineligible. They cannot be added to any site.");
  if (d!.site_id) deny(`Driver is currently active at ${d!.site_name}. The supervisor there must mark them inactive first.`);
  db().prepare("INSERT INTO assignments (driver_id,site_id,active,from_date,added_by) VALUES (?,?,1,?,?)").run(id, u.site_id, today(), u.id);
  audit(u.id, "DRIVER_JOINED_SITE", id, `Added to ${u.site_name}`);
}

export const siteHistory = (id: number) =>
  db().prepare(`SELECT a.*, s.name site_name, u.name added_by_name FROM assignments a JOIN sites s ON s.id=a.site_id
    LEFT JOIN users u ON u.id=a.added_by WHERE a.driver_id=? ORDER BY a.id DESC`).all(id) as any[];

// ---------- blacklist / unblock ----------
export function blacklist(u: User, id: number, remark: string, unblock = false) {
  const d = getDriver(id) ?? deny("Driver not found.");
  if (u.role === "SUPERVISOR") deny("Site supervisors cannot blacklist or unblock drivers.");
  if (!canBlacklist(u, d!)) deny("This driver is outside your cluster. Only the DGM or the responsible Senior Manager can act.");
  if (!remark.trim()) deny("A remark is mandatory.");
  if (unblock && !d!.blacklisted) deny("Driver is not blacklisted.");
  if (!unblock && d!.blacklisted) deny("Driver is already blacklisted.");
  db().transaction(() => {
    db().prepare("INSERT INTO blacklist_events (driver_id,action,remark,by_user,role,at) VALUES (?,?,?,?,?,?)")
      .run(id, unblock ? "UNBLOCK" : "BLACKLIST", remark.trim(), u.id, u.role, now());
    db().prepare("UPDATE drivers SET blacklisted=? WHERE id=?").run(unblock ? 0 : 1, id);
    // Blacklisting makes the driver ineligible AND inactive at their site. Unblocking does not re-activate:
    // a supervisor must add the driver to a site again.
    if (!unblock && d!.site_id) {
      db().prepare("UPDATE assignments SET active=0,to_date=?,released_by=? WHERE driver_id=? AND active=1").run(today(), u.id, id);
      audit(u.id, "DRIVER_DEACTIVATED", id, `Marked inactive at ${d!.site_name} due to blacklisting`);
    }
    audit(u.id, unblock ? "UNBLOCK" : "BLACKLIST", id, remark.trim());
    // acting on the driver (from the notification, the profile, anywhere) settles any open concerns about them
    closeConcernsForDriver(u, id, `Closed automatically: driver ${unblock ? "unblocked" : "blacklisted"} by ${u.name}. Remark: ${remark.trim()}`);
    // let the supervisor of the driver's site know
    if (d!.resp_site_id) {
      const sup = db().prepare("SELECT id FROM users WHERE role='SUPERVISOR' AND site_id=?").get(d!.resp_site_id) as { id: number } | undefined;
      if (sup) notify(sup.id, unblock ? "UNBLOCK" : "BLACKLIST", `${d!.name} was ${unblock ? "unblocked" : "BLACKLISTED"} by ${u.name}. Remark: ${remark.trim()}`, id, `bl:${id}:${Date.now()}`);
    }
  })();
}

export const blacklistHistory = (id: number) =>
  db().prepare("SELECT e.*, u.name by_name FROM blacklist_events e JOIN users u ON u.id=e.by_user WHERE e.driver_id=? ORDER BY e.id DESC").all(id) as any[];

export const latestRemark = (id: number) =>
  db().prepare("SELECT e.*, u.name by_name FROM blacklist_events e JOIN users u ON u.id=e.by_user WHERE e.driver_id=? AND e.action='BLACKLIST' ORDER BY e.id DESC LIMIT 1").get(id) as any;

// ---------- concerns ----------
export function raiseConcern(u: User, id: number, text: string) {
  const d = getDriver(id) ?? deny("Driver not found.");
  if (!isOwnSiteDriver(u, d!)) deny("You can raise a concern only about drivers at your own site.");
  if (!text.trim()) deny("Please describe the concern.");
  const sm = db().prepare("SELECT id FROM users WHERE role='SENIOR_MANAGER' AND cluster_id=(SELECT cluster_id FROM sites WHERE id=?)").get(u.site_id) as { id: number } | undefined;
  const cid = Number(db().prepare("INSERT INTO concerns (driver_id,site_id,raised_by,routed_to,text,created_at) VALUES (?,?,?,?,?,?)")
    .run(id, u.site_id, u.id, sm?.id ?? null, text.trim(), now()).lastInsertRowid);
  if (sm) notify(sm.id, "CONCERN", `New concern from ${u.name} about ${d!.name}: "${text.trim().slice(0, 80)}"`, id, `concern:${cid}`);
  audit(u.id, "CONCERN_RAISED", id, text.trim());
}

export function resolveConcern(u: User, cid: number, status: "RESOLVED" | "DISMISSED", note: string) {
  const c = db().prepare("SELECT c.*, s.cluster_id FROM concerns c JOIN sites s ON s.id=c.site_id WHERE c.id=?").get(cid) as any;
  if (!c) deny("Concern not found.");
  if (!(u.role === "DGM" || (u.role === "SENIOR_MANAGER" && c.cluster_id === u.cluster_id))) deny("This concern is not routed to you.");
  if (!note.trim()) deny("Add a resolution note.");
  db().prepare("UPDATE concerns SET status=?,resolution=?,resolved_by=?,resolved_at=? WHERE id=?").run(status, note.trim(), u.id, now(), cid);
  clearConcernNotifications(c.driver_id, cid);
  notify(c.raised_by, "CONCERN_UPDATE", `Your concern about driver #${c.driver_id} was ${status.toLowerCase()}: ${note.trim()}`, c.driver_id, `concern-res:${cid}`);
  audit(u.id, "CONCERN_" + status, c.driver_id, note.trim());
}

/** Removes the "new concern" notifications of a driver once nothing about them is open any more. */
function clearConcernNotifications(driverId: number, cid?: number) {
  if (cid) db().prepare("DELETE FROM notifications WHERE kind='CONCERN' AND dedupe_key=?").run(`concern:${cid}`);
  const stillOpen = (db().prepare("SELECT COUNT(*) c FROM concerns WHERE driver_id=? AND status='OPEN'").get(driverId) as { c: number }).c;
  if (!stillOpen) db().prepare("DELETE FROM notifications WHERE kind='CONCERN' AND driver_id=?").run(driverId);
}

/** Resolves every open concern about a driver (used when a Senior Manager / DGM blacklists or unblocks them). */
function closeConcernsForDriver(u: User, driverId: number, note: string) {
  const open = db().prepare("SELECT id, raised_by FROM concerns WHERE driver_id=? AND status='OPEN'").all(driverId) as { id: number; raised_by: number }[];
  for (const c of open) {
    db().prepare("UPDATE concerns SET status='RESOLVED',resolution=?,resolved_by=?,resolved_at=? WHERE id=?").run(note, u.id, now(), c.id);
    notify(c.raised_by, "CONCERN_UPDATE", `Your concern about driver #${driverId} was resolved. ${note}`, driverId, `concern-res:${c.id}`);
    audit(u.id, "CONCERN_RESOLVED", driverId, note);
  }
  clearConcernNotifications(driverId);
}

export function listConcerns(u: User) {
  const base = `SELECT c.*, d.name driver_name, d.driver_code, s.name site_name, r.name raised_name FROM concerns c
    JOIN drivers d ON d.id=c.driver_id JOIN sites s ON s.id=c.site_id JOIN users r ON r.id=c.raised_by`;
  if (u.role === "DGM") return db().prepare(base + " ORDER BY c.status='OPEN' DESC, c.id DESC").all() as any[];
  if (u.role === "SENIOR_MANAGER") return db().prepare(base + " WHERE s.cluster_id=? ORDER BY c.status='OPEN' DESC, c.id DESC").all(u.cluster_id) as any[];
  return db().prepare(base + " WHERE c.site_id=? ORDER BY c.id DESC").all(u.site_id) as any[];
}

// ---------- notifications & daily expiry check ----------
export function notify(userId: number, kind: string, message: string, driverId: number | null, key: string) {
  db().prepare("INSERT OR IGNORE INTO notifications (user_id,kind,message,driver_id,dedupe_key,created_at) VALUES (?,?,?,?,?,?)")
    .run(userId, kind, message, driverId, key, now());
}

/** Idempotent. Alerts each site's supervisor about its ACTIVE drivers whose license is expired or within the 60-day window. */
export function runExpiryCheck(): number {
  let created = 0;
  const rows = db().prepare(`SELECT d.id, d.name, d.driver_code, a.site_id, l.expiry, l.verified, u.id AS sup_id
    FROM assignments a JOIN drivers d ON d.id=a.driver_id JOIN licenses l ON l.driver_id=d.id
    JOIN users u ON u.role='SUPERVISOR' AND u.site_id=a.site_id WHERE a.active=1`).all() as any[];
  for (const r of rows) {
    const st = licenseStatus({ expiry: r.expiry, verified: r.verified });
    if (st !== "EXPIRED" && st !== "EXPIRING") continue;
    const days = daysLeft(r.expiry)!;
    const msg = st === "EXPIRED"
      ? `License of ${r.name} EXPIRED ${-days} day(s) ago (${r.expiry}). Please renew and update the record.`
      : `License of ${r.name} expires in ${days} day(s) (${r.expiry}). Please arrange renewal and update the record.`;
    const res = db().prepare("INSERT OR IGNORE INTO notifications (user_id,kind,message,driver_id,dedupe_key,created_at) VALUES (?,?,?,?,?,?)")
      .run(r.sup_id, st, msg, r.id, `exp:${r.id}:${r.expiry}:${st}`, now());
    created += res.changes;
  }
  return created;
}

export const myNotifications = (u: User) =>
  db().prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY read ASC, id DESC LIMIT 100").all(u.id) as any[];
export const unreadCount = (u: User) =>
  (db().prepare("SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0").get(u.id) as { c: number }).c;
/** Opening a notification marks it read (own notifications only) and returns the driver it is about, if any. */
export function openNotification(u: User, id: number): number | null {
  const n = db().prepare("SELECT driver_id FROM notifications WHERE id=? AND user_id=?").get(id, u.id) as { driver_id: number | null } | undefined;
  if (!n) return null;
  db().prepare("UPDATE notifications SET read=1 WHERE id=? AND user_id=?").run(id, u.id);
  return n.driver_id;
}
export const markAllRead =(u: User) => db().prepare("UPDATE notifications SET read=1 WHERE user_id=?").run(u.id);

// ---------- dashboards ----------
export function overview(u: User) {
  const sites = scopeSiteIds(u);
  const all = (db().prepare(DRIVER_SQL + " WHERE a.active=1").all() as DriverRow[]).filter((d) => sites.includes(d.site_id!));
  const siteRows = (db().prepare("SELECT s.id,s.name,c.name cluster FROM sites s JOIN clusters c ON c.id=s.cluster_id").all() as any[])
    .filter((s) => sites.includes(s.id))
    .map((s) => {
      const ds = all.filter((d) => d.site_id === s.id);
      const c = { VALID: 0, EXPIRING: 0, EXPIRED: 0, PENDING: 0 };
      ds.forEach((d) => c[licenseStatus({ expiry: d.lic_expiry, verified: d.lic_verified })]++);
      // blacklisted drivers are inactive, so count them against the site they were last at
      const blCount = (db().prepare(DRIVER_SQL + " WHERE d.blacklisted=1").all() as DriverRow[]).filter((d) => d.resp_site_id === s.id).length;
      const open = (db().prepare("SELECT COUNT(*) c FROM concerns WHERE site_id=? AND status='OPEN'").get(s.id) as { c: number }).c;
      return { ...s, site_id: s.id, total: ds.length, ...c, blacklisted: blCount, open_concerns: open, mix: { ...c, total: ds.length } };
    });
  const tot = siteRows.reduce((a, s) => ({ total: a.total + s.total, VALID: a.VALID + s.VALID, EXPIRING: a.EXPIRING + s.EXPIRING, EXPIRED: a.EXPIRED + s.EXPIRED, PENDING: a.PENDING + s.PENDING }),
    { total: 0, VALID: 0, EXPIRING: 0, EXPIRED: 0, PENDING: 0 });
  const blacklistedAll = (db().prepare(DRIVER_SQL + " WHERE d.blacklisted=1").all() as DriverRow[]).filter((d) => d.resp_site_id != null && sites.includes(d.resp_site_id));
  const actionNeeded = all
    .map((d) => ({ d, st: licenseStatus({ expiry: d.lic_expiry, verified: d.lic_verified }) }))
    .filter((x) => x.st !== "VALID")
    .sort((a, b) => (daysLeft(a.d.lic_expiry) ?? 9999) - (daysLeft(b.d.lic_expiry) ?? 9999));
  return { siteRows, tot, blacklisted: blacklistedAll, actionNeeded };
}

// ---------- admin ----------
export function adminData() {
  return {
    clusters: db().prepare("SELECT c.*, (SELECT name FROM users WHERE role='SENIOR_MANAGER' AND cluster_id=c.id) manager FROM clusters c").all() as any[],
    sites: db().prepare("SELECT s.*, c.name cluster_name, (SELECT name FROM users WHERE role='SUPERVISOR' AND site_id=s.id) supervisor FROM sites s JOIN clusters c ON c.id=s.cluster_id").all() as any[],
    users: db().prepare("SELECT u.*, s.name site_name, c.name cluster_name FROM users u LEFT JOIN sites s ON s.id=u.site_id LEFT JOIN clusters c ON c.id=u.cluster_id ORDER BY u.id").all() as any[],
  };
}
export function moveSite(u: User, siteId: number, clusterId: number) {
  if (u.role !== "DGM") deny("Only the DGM can change cluster mapping.");
  db().prepare("UPDATE sites SET cluster_id=? WHERE id=?").run(clusterId, siteId);
  audit(u.id, "SITE_CLUSTER_CHANGED", null, `Site ${siteId} -> cluster ${clusterId}`);
}
export function setDashboardAccess(u: User, userId: number, on: boolean) {
  if (u.role !== "DGM") deny("Only the DGM can change dashboard access.");
  db().prepare("UPDATE users SET dashboard_access=? WHERE id=?").run(on ? 1 : 0, userId);
  audit(u.id, "DASHBOARD_ACCESS", null, `User ${userId} -> ${on ? "granted" : "revoked"}`);
}

export function auditLog(u: User) {
  const base = `SELECT a.*, u.name user_name, d.name driver_name FROM audit a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN drivers d ON d.id=a.driver_id`;
  if (u.role === "DGM") return db().prepare(base + " ORDER BY a.id DESC LIMIT 200").all() as any[];
  return (db().prepare(base + " ORDER BY a.id DESC LIMIT 400").all() as any[]).filter((r) => {
    if (!r.driver_id) return false;
    const d = getDriver(r.driver_id);
    return d && d.resp_cluster_id === u.cluster_id;
  }).slice(0, 200);
}

// ---------- filterable table rows (plain, serialisable objects for the client DataTable) ----------
const bucket = (days: number | null) =>
  days == null ? "No expiry date" : days < 0 ? "Already expired" : days <= 30 ? "Within 30 days" : days <= 60 ? "31-60 days" : days <= 180 ? "61-180 days" : "Over 180 days";
export const EXPIRY_BUCKETS = ["Already expired", "Within 30 days", "31-60 days", "61-180 days", "Over 180 days", "No expiry date"];

export function driverRows(u: User, ds: DriverRow[]) {
  return ds.map((d) => {
    const st = licenseStatus({ expiry: d.lic_expiry, verified: d.lic_verified });
    const days = daysLeft(d.lic_expiry);
    const full = inScope(u, d);
    return {
      id: d.id, code: d.driver_code, name: d.name, phone: d.phone ?? "",
      site: d.last_site_name ?? "—", site_id: d.resp_site_id, active: d.site_id ? "Active" : "Inactive", cluster: d.cluster_name ?? "—",
      license_status: LICENSE_LABEL[st], expiry: d.lic_expiry ?? "—", expiry_raw: d.lic_expiry, verified: d.lic_verified ?? 0,
      days: days ?? 99999, expiry_window: d.lic_verified ? bucket(days) : "No expiry date",
      lic_no: full ? d.lic_number ?? "—" : d.lic_number ? "•••• " + d.lic_number.slice(-4) : "—",
      blacklist: d.blacklisted ? "Blacklisted" : "Not blacklisted", blacklisted_n: d.blacklisted,
      eligibility: d.blacklisted ? "Not eligible" : "Eligible",
    };
  });
}
export type DriverTableRow = ReturnType<typeof driverRows>[number];

/** Every driver whose current (or, if inactive, last) site is one of the given sites. */
export const driversInSites = (siteIds: number[]) =>
  (db().prepare(DRIVER_SQL + " ORDER BY d.driver_code").all() as DriverRow[]).filter((d) => d.resp_site_id != null && siteIds.includes(d.resp_site_id));

// ---------- site drill-down ----------
export function getSite(id: number) {
  return db().prepare(`SELECT s.*, c.name cluster_name,
    (SELECT name FROM users WHERE role='SUPERVISOR' AND site_id=s.id) supervisor,
    (SELECT name FROM users WHERE role='SENIOR_MANAGER' AND cluster_id=s.cluster_id) manager
    FROM sites s JOIN clusters c ON c.id=s.cluster_id WHERE s.id=?`).get(id) as any;
}
export const canViewSite = (u: User, site: { id: number; cluster_id: number }) =>
  u.role === "DGM" || (u.role === "SENIOR_MANAGER" && site.cluster_id === u.cluster_id) || (u.role === "SUPERVISOR" && site.id === u.site_id);

export const siteMovements = (siteId: number) =>
  db().prepare(`SELECT a.*, d.name driver_name FROM assignments a JOIN drivers d ON d.id=a.driver_id WHERE a.site_id=? ORDER BY a.id DESC LIMIT 12`).all(siteId) as any[];

export { licenseStatus, LICENSE_LABEL, WARNING_DAYS };
