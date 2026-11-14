import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export type User = {
  id: number; name: string; role: "SUPERVISOR" | "SENIOR_MANAGER" | "DGM";
  site_id: number | null; cluster_id: number | null; dashboard_access: number;
  site_name?: string | null; cluster_name?: string | null;
};

// PROTOTYPE AUTH: a demo user switcher stored in a cookie. In the real build this is replaced by Clerk,
// keeping this same local `users` table for roles, sites and clusters.
export async function currentUser(): Promise<User | null> {
  const id = Number((await cookies()).get("uid")?.value);
  if (!id) return null;
  return (db().prepare(
    `SELECT u.*, s.name site_name, c.name cluster_name FROM users u
     LEFT JOIN sites s ON s.id=u.site_id LEFT JOIN clusters c ON c.id=u.cluster_id WHERE u.id=?`
  ).get(id) as User) ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export const roleLabel = (r: string) =>
  r === "DGM" ? "DGM" : r === "SENIOR_MANAGER" ? "Senior Manager" : "Site Supervisor";
