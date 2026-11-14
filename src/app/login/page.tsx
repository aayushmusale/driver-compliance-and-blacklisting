import { ShieldCheck, Crown, Briefcase, ClipboardCheck } from "lucide-react";
import { db } from "@/lib/db";
import { loginAs } from "../actions";
import { roleLabel } from "@/lib/auth";
import { Spotlight, Aurora } from "@/components/ui/spotlight";

export const dynamic = "force-dynamic";

const ICON = { DGM: Crown, SENIOR_MANAGER: Briefcase, SUPERVISOR: ClipboardCheck } as const;

export default function Login() {
  const users = db().prepare("SELECT u.*, s.name site_name, c.name cluster_name FROM users u LEFT JOIN sites s ON s.id=u.site_id LEFT JOIN clusters c ON c.id=u.cluster_id ORDER BY u.id").all() as any[];
  const groups = [
    { title: "Leadership", list: users.filter((u) => u.role !== "SUPERVISOR") },
    { title: "Site supervisors", list: users.filter((u) => u.role === "SUPERVISOR") },
  ];
  return (
    <div className="relative min-h-screen overflow-hidden bg-primary text-white">
      <Aurora />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 py-14">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary shadow-2xl"><ShieldCheck className="h-7 w-7" /></div>
        <h1 className="bg-gradient-to-b from-white to-red-100 bg-clip-text text-center text-4xl font-bold tracking-tight text-transparent md:text-5xl">Centralized Driver<br />Compliance Platform</h1>
        <p className="mt-3 max-w-xl text-center text-sm text-white/85">One trusted record of every driver: license validity, blacklist status and eligibility, visible across all authorized sites.</p>
        <p className="mt-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/85">Prototype · pick a demo user · all data illustrative (production sign-in uses Clerk)</p>

        <div className="mt-10 w-full space-y-8">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/75">{g.title}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.list.map((u) => {
                  const Icon = ICON[u.role as keyof typeof ICON];
                  return (
                    <form key={u.id} action={loginAs}>
                      <input type="hidden" name="uid" value={u.id} />
                      <button className="!flex !h-full !w-full !items-start !justify-start !gap-3 !rounded-xl !border !border-white/20 !bg-white/10 !p-4 !text-left !shadow-none !backdrop-blur transition hover:!-translate-y-0.5 hover:!border-white/60 hover:!bg-white/20">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-primary"><Icon className="h-4 w-4" /></span>
                        <span>
                          <span className="block text-sm font-semibold">{u.name.replace(" (demo)", "")}</span>
                          <span className="block text-xs font-normal text-white/75">{roleLabel(u.role)}{u.site_name ? ` · ${u.site_name}` : ""}{u.cluster_name ? ` · ${u.cluster_name}` : ""}</span>
                        </span>
                      </button>
                    </form>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
