import { currentUser } from "@/lib/auth";
import { identifierLookup } from "@/lib/service";

// Live duplicate check for the Add driver form. Supervisors only; returns the same limited view as the blacklist check.
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== "SUPERVISOR") return Response.json({ match: null }, { status: 401 });
  const url = new URL(req.url);
  const field = url.searchParams.get("field") === "license" ? "license" : "code";
  return Response.json({ match: identifierLookup(u, field, url.searchParams.get("value") ?? "") }, { headers: { "Cache-Control": "no-store" } });
}
