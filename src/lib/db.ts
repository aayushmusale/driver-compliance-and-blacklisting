import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DRIVER_DATA_DIR || path.join(process.cwd(), "data"); // override lets tests use a throwaway database
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clusters (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cluster_id INTEGER REFERENCES clusters(id));
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('SUPERVISOR','SENIOR_MANAGER','DGM')),
  site_id INTEGER REFERENCES sites(id), cluster_id INTEGER REFERENCES clusters(id), dashboard_access INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY, driver_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT, location TEXT,
  blacklisted INTEGER NOT NULL DEFAULT 0, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL);
-- one row per stay at a site; active=1 means the driver currently works there (only one active row per driver)
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY, driver_id INTEGER NOT NULL REFERENCES drivers(id), site_id INTEGER NOT NULL REFERENCES sites(id),
  active INTEGER NOT NULL DEFAULT 1, from_date TEXT NOT NULL, to_date TEXT, added_by INTEGER, released_by INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_site ON assignments(driver_id) WHERE active = 1;
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY, driver_id INTEGER UNIQUE NOT NULL REFERENCES drivers(id), number TEXT, expiry TEXT,
  verified INTEGER NOT NULL DEFAULT 0, added_by INTEGER, verified_by INTEGER, verified_at TEXT, file_name TEXT, file_path TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS blacklist_events (
  id INTEGER PRIMARY KEY, driver_id INTEGER NOT NULL REFERENCES drivers(id), action TEXT NOT NULL CHECK (action IN ('BLACKLIST','UNBLOCK')),
  remark TEXT NOT NULL, by_user INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS concerns (
  id INTEGER PRIMARY KEY, driver_id INTEGER NOT NULL REFERENCES drivers(id), site_id INTEGER NOT NULL REFERENCES sites(id),
  raised_by INTEGER NOT NULL REFERENCES users(id), routed_to INTEGER REFERENCES users(id), text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN', resolution TEXT, resolved_by INTEGER, created_at TEXT NOT NULL, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), kind TEXT NOT NULL, message TEXT NOT NULL,
  driver_id INTEGER, dedupe_key TEXT UNIQUE, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id INTEGER, action TEXT NOT NULL, driver_id INTEGER, detail TEXT);
`;

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function seed(db: Database.Database) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    // ILLUSTRATIVE data only: real site-to-Senior-Manager mapping is not available yet (admin can change it).
    db.prepare("INSERT INTO clusters (id,name) VALUES (1,'Cluster 1'),(2,'Cluster 2')").run();
    const sites = ["Site A", "Site B", "Site C", "Site D", "Site E", "Site F", "Site G", "Site H"];
    sites.forEach((n, i) => db.prepare("INSERT INTO sites (id,name,cluster_id) VALUES (?,?,?)").run(i + 1, n, i < 4 ? 1 : 2));
    const u = db.prepare("INSERT INTO users (id,name,role,site_id,cluster_id,dashboard_access) VALUES (?,?,?,?,?,?)");
    u.run(1, "DGM (demo)", "DGM", null, null, 1);
    u.run(2, "Senior Manager - Cluster 1 (demo)", "SENIOR_MANAGER", null, 1, 1);
    u.run(3, "Senior Manager - Cluster 2 (demo)", "SENIOR_MANAGER", null, 2, 1);
    sites.forEach((n, i) => u.run(10 + i, `Supervisor - ${n} (demo)`, "SUPERVISOR", i + 1, null, 1));

    // offsets (days from today) for the license expiry of each driver; null = pending verification
    const offsets: (number | null)[] = [-40, 10, 25, 50, 200, 365, null, 120, -12, 45, 300, 700, null, 8, 90, 410, 33, 150, -5, 540, 61, 220, null, 380, 14, 260, 59, 480, -90, 75, 320, null];
    const insD = db.prepare("INSERT INTO drivers (id,driver_code,name,phone,location,blacklisted,created_by,created_at) VALUES (?,?,?,?,?,0,?,?)");
    const insA = db.prepare("INSERT INTO assignments (driver_id,site_id,active,from_date,to_date,added_by) VALUES (?,?,?,?,?,?)");
    const insL = db.prepare("INSERT INTO licenses (driver_id,number,expiry,verified,added_by,verified_by,verified_at,updated_at) VALUES (?,?,?,?,?,?,?,?)");
    offsets.forEach((off, i) => {
      const id = i + 1, code = String(1001 + i), site = Math.floor(i / 4) + 1, sup = 10 + site - 1;
      insD.run(id, code, `Driver ${code}`, `98xxxx${String(1000 + i).slice(-4)}`, "Pune", sup, now);
      insA.run(id, site, 1, addDays(-200), null, sup);
      insL.run(id, `MH12XXXX${String(7000 + i).padStart(7, "0")}`, off === null ? addDays(400) : addDays(off), off === null ? 0 : 1, sup, off === null ? null : sup, off === null ? null : now, now);
    });
    // two drivers who left a site (inactive, awaiting a new site) to demo the transfer step
    [[33, "1033", 2, 180], [34, "1034", 6, 400]].forEach(([id, code, site, off]) => {
      const sup = 10 + (site as number) - 1;
      insD.run(id, code, `Driver ${code}`, `98xxxx${code}`, "Pune", sup, now);
      insA.run(id, site, 0, addDays(-300), addDays(-3), sup);
      insL.run(id, `MH12XXXX${String(7000 + (id as number)).padStart(7, "0")}`, addDays(off as number), 1, sup, sup, now, now);
    });
    // a driver that is already blacklisted (Cluster 2) and an open concern (Cluster 1)
    db.prepare("UPDATE drivers SET blacklisted=1 WHERE id=19").run();
    db.prepare("UPDATE assignments SET active=0,to_date=? WHERE driver_id=19 AND active=1").run(addDays(-1)); // blacklisted => inactive
    db.prepare("INSERT INTO blacklist_events (driver_id,action,remark,by_user,role,at) VALUES (19,'BLACKLIST',?,?,?,?)")
      .run("Sample remark: repeated unsafe driving reported at site. Do not assign work.", 3, "SENIOR_MANAGER", now);
    db.prepare("INSERT INTO concerns (driver_id,site_id,raised_by,routed_to,text,created_at) VALUES (2,1,10,2,?,?)")
      .run("Sample concern: driver reported late and was seen using a phone while driving a site vehicle.", now);
    db.prepare("INSERT INTO notifications (user_id,kind,message,driver_id,dedupe_key,created_at) VALUES (2,'CONCERN',?,2,'seed-concern',?)")
      .run("New concern raised by Supervisor - Site A (demo) about Driver 1002.", now);
    db.prepare("INSERT INTO audit (at,user_id,action,driver_id,detail) VALUES (?,3,'BLACKLIST',19,'Seeded sample blacklist')").run(now);
  });
  tx();
}

const g = globalThis as unknown as { __db?: Database.Database };

export function db(): Database.Database {
  if (!g.__db) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const d = new Database(path.join(DATA_DIR, "app.db"));
    d.pragma("journal_mode = WAL");
    d.pragma("foreign_keys = ON");
    d.exec(SCHEMA);
    if (!(d.prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c) seed(d);
    g.__db = d;
  }
  return g.__db;
}
