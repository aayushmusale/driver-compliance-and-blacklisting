import fs from "fs";
import path from "path";
import { currentUser } from "@/lib/auth";
import { db, UPLOAD_DIR } from "@/lib/db";
import { getDriver, inScope, audit } from "@/lib/service";

// Private document access: authorised on the server for every download, and logged.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const d = getDriver(Number((await params).id));
  if (!d || !inScope(u, d)) return new Response("Forbidden", { status: 403 });
  const l = db().prepare("SELECT file_path,file_name FROM licenses WHERE driver_id=?").get(d.id) as any;
  if (!l?.file_path) return new Response("No document", { status: 404 });
  audit(u.id, "DOCUMENT_VIEWED", d.id, l.file_name);
  const ext = path.extname(l.file_path).toLowerCase();
  const type = ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg";
  return new Response(fs.readFileSync(path.join(UPLOAD_DIR, l.file_path)), { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
}
