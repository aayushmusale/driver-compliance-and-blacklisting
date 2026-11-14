"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import * as svc from "@/lib/service";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => Number(f.get(k));
async function fileOf(f: FormData) {
  const x = f.get("file");
  return x instanceof File && x.size > 0 ? { name: x.name, buf: Buffer.from(await x.arrayBuffer()) } : null;
}

/** Runs a mutation; on a rule violation, sends the user back with a readable message instead of crashing. */
async function run(back: string, fn: () => unknown | Promise<unknown>, okMsg?: string, to?: (r: any) => string) {
  let dest = back, res: any;
  try {
    res = await fn();
    dest = to ? to(res) : back;
    const q = okMsg ? `ok=${encodeURIComponent(okMsg)}` : "";
    dest += (dest.includes("?") ? "&" : "?") + q;
  } catch (e: any) {
    if (!(e instanceof svc.Denied) && !String(e?.message).includes("UNIQUE")) throw e;
    dest = back + (back.includes("?") ? "&" : "?") + "err=" + encodeURIComponent(e.message.includes("UNIQUE") ? "Driver is already active at a site." : e.message);
  }
  revalidatePath("/", "layout");
  redirect(dest);
}

export async function loginAs(f: FormData) {
  (await cookies()).set("uid", s(f, "uid"), { httpOnly: true, path: "/" });
  redirect("/dashboard");
}
export async function logout() { (await cookies()).delete("uid"); redirect("/login"); }

export async function addDriverAction(f: FormData) {
  const u = await requireUser();
  const file = await fileOf(f);
  await run("/drivers/new", () => svc.addDriver(u, { code: s(f, "code"), name: s(f, "name"), phone: s(f, "phone"), location: s(f, "location"),
    number: s(f, "number"), expiry: s(f, "expiry"), confirm: f.get("confirm") === "on", file }), "Driver added to your site.", (id) => `/drivers/${id}`);
}
export async function editDriverAction(f: FormData) {
  const u = await requireUser(); const id = n(f, "id");
  await run(`/drivers/${id}`, () => svc.updateDriverDetails(u, id, { name: s(f, "name"), phone: s(f, "phone"), location: s(f, "location") }), "Driver details corrected.");
}
export async function licenseAction(f: FormData) {
  const u = await requireUser(); const id = n(f, "id");
  const file = await fileOf(f);
  await run(`/drivers/${id}`, () => svc.saveLicense(u, id, s(f, "number"), s(f, "expiry"), f.get("confirm") === "on", file),
    f.get("confirm") === "on" ? "License verified and database updated." : "Saved as pending verification.");
}
export async function releaseAction(f: FormData) {
  const u = await requireUser(); const id = n(f, "id");
  await run(`/drivers/${id}`, () => svc.releaseDriver(u, id), "Driver marked inactive at this site.");
}
export async function joinAction(f: FormData) {
  const u = await requireUser(); const id = n(f, "id");
  await run("/check", () => svc.addToMySite(u, id), "Driver added to your site (active).", () => `/drivers/${id}`);
}
export async function blacklistAction(f: FormData) {
  const u = await requireUser(); const id = n(f, "id");
  await run(`/drivers/${id}`, () => svc.blacklist(u, id, s(f, "remark"), s(f, "mode") === "unblock"), s(f, "mode") === "unblock" ? "Driver unblocked." : "Driver blacklisted: now ineligible and inactive at their site.");
}
export async function concernAction(f: FormData) {
  const u = await requireUser(); const id = n(f, "id");
  await run(`/drivers/${id}`, () => svc.raiseConcern(u, id, s(f, "text")), "Concern raised. Your Senior Manager has been notified.");
}
export async function resolveConcernAction(f: FormData) {
  const u = await requireUser();
  await run("/concerns", () => svc.resolveConcern(u, n(f, "cid"), s(f, "status") as any, s(f, "note")), "Concern updated.");
}
export async function runCheckAction() {
  await requireUser();
  const c = svc.runExpiryCheck();
  await run("/admin", () => c, `Daily expiry check done: ${c} new alert(s).`);
}
export async function openNotificationAction(f: FormData) {
  const u = await requireUser();
  const driverId = svc.openNotification(u, n(f, "id"));
  revalidatePath("/", "layout"); // refreshes the unread counter in the sidebar
  redirect(driverId ? `/drivers/${driverId}` : "/notifications");
}
export async function readAllAction() {
  const u = await requireUser(); svc.markAllRead(u);
  revalidatePath("/", "layout"); redirect("/notifications");
}
export async function moveSiteAction(f: FormData) {
  const u = await requireUser();
  await run("/admin", () => svc.moveSite(u, n(f, "site"), n(f, "cluster")), "Cluster mapping updated.");
}
export async function accessAction(f: FormData) {
  const u = await requireUser();
  await run("/admin", () => svc.setDashboardAccess(u, n(f, "uid"), f.get("on") === "1"), "Dashboard access updated.");
}
