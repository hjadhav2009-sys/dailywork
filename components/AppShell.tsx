import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ShellNavigation, type NavigationGroup } from "@/components/ShellNavigation";
import { clearSession, requireAccount, requireUser, roleHomePath } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-context";

type AppShellProps = {
  children: ReactNode;
  title?: string;
};

const ownerGroups: NavigationGroup[] = [
  {
    title: "Owner workspace",
    items: [
      { href: "/owner", label: "Dashboard", icon: "dashboard", description: "Health, throughput, and queue status" },
      { href: "/picker?work=today&view=cards", label: "Today Orders", icon: "orders", description: "View today’s pick-ready groups" },
      { href: "/owner/uploads/new", label: "Upload Manifest", icon: "upload", description: "Import label and manifest PDFs" },
      { href: "/owner/catalog", label: "Meesho Catalog", icon: "catalog", description: "Future-ready catalog master placeholders" },
      { href: "/owner/sku-mappings", label: "SKU Images", icon: "images", description: "Maintain product image mappings" },
      { href: "/owner/users", label: "Workers", icon: "workers", description: "Manage picker and packer access" },
      { href: "/problems", label: "Problems", icon: "problems", description: "Resolve issue orders quickly" },
      { href: "/reports", label: "Reports", icon: "reports", description: "Review exports and daily summaries" },
      { href: "/owner/system", label: "System", icon: "system", description: "Production readiness and health checks" }
    ]
  },
  {
    title: "Account tools",
    items: [
      { href: "/owner/accounts", label: "Accounts", icon: "accounts", description: "Switch and maintain seller accounts" },
      { href: "/owner/cleanup", label: "Cleanup", icon: "cleanup", description: "Safely trim temporary operational data" },
      { href: "/change-password", label: "Password", icon: "password", description: "Update your login password" }
    ]
  }
];

const pickerGroups: NavigationGroup[] = [
  {
    title: "Picker workspace",
    items: [
      { href: "/picker", label: "My Picking", icon: "pick", description: "Priority SKU groups for today’s work" },
      { href: "/picker/search-sku", label: "Search SKU", icon: "search", description: "Future SKU lookup workspace" },
      { href: "/problems", label: "Issues", icon: "problems", description: "Track exception orders and handoffs" }
    ]
  },
  {
    title: "Account tools",
    items: [{ href: "/change-password", label: "Password", icon: "password", description: "Update your login password" }]
  }
];

const packerGroups: NavigationGroup[] = [
  {
    title: "Packer workspace",
    items: [
      { href: "/packing", label: "Scan AWB", icon: "pack", description: "Open camera or manual AWB search" },
      { href: "/packing?view=packed", label: "Packed Orders", icon: "history", description: "History placeholder for a later phase" },
      { href: "/problems", label: "Problems", icon: "problems", description: "Review issues blocking dispatch" }
    ]
  },
  {
    title: "Account tools",
    items: [{ href: "/change-password", label: "Password", icon: "password", description: "Update your login password" }]
  }
];

async function logoutAction() {
  "use server";

  const user = await requireUser();
  const account = await requireAccount(user);
  const request = await getRequestMeta();
  await recordAuditLog({
    userId: user.id,
    accountId: account.id,
    action: "LOGOUT",
    entityType: "User",
    entityId: user.id,
    request
  });
  await clearSession();
  redirect("/login");
}

function groupsForRole(role: string) {
  if (role === "OWNER") {
    return ownerGroups;
  }

  if (role === "PICKER") {
    return pickerGroups;
  }

  return packerGroups;
}

export async function AppShell({ children, title }: AppShellProps) {
  const user = await requireUser();
  const account = await requireAccount(user);
  const groups = groupsForRole(user.role);
  const homePath = roleHomePath(user.role);

  return (
    <div className="min-h-screen text-slate-950">
      <div className="mx-auto max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
        <div className="lg:grid lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-6">
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <div className="dw-card overflow-hidden p-5">
                <div className="rounded-[24px] bg-[linear-gradient(150deg,rgba(15,118,110,0.14)_0%,rgba(197,106,45,0.12)_100%)] p-5">
                  <Link href={homePath} className="block">
                    <span className="dw-kicker">DailyWork Pick &amp; Pack</span>
                    <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{account.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Premium warehouse control for picking, packing, exceptions, and future Meesho catalog workflows.
                    </p>
                  </Link>
                </div>
              </div>

              <div className="dw-card p-3">
                <ShellNavigation groups={groups} />
              </div>

              <div className="dw-card space-y-3 p-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Signed in</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{user.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{user.role}</p>
                </div>
                <ButtonLink href="/accounts" variant="secondary" className="w-full">
                  Switch account
                </ButtonLink>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <header className="dw-card sticky top-3 z-20 mb-4 overflow-hidden p-4 sm:p-5 lg:top-6">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#0f766e_0%,#c56a2d_100%)]" />
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="dw-kicker lg:hidden">DailyWork Pick &amp; Pack</span>
                    <span className="dw-chip">{user.role}</span>
                  </div>
                  <Link href={homePath} className="mt-3 block min-w-0">
                    <p className="truncate text-2xl font-semibold text-slate-950 sm:text-3xl">{account.name}</p>
                    <p className="mt-1 truncate text-sm text-slate-600">
                      Signed in as {user.name}. Keep today’s pick-and-pack flow clean, fast, and mobile-ready.
                    </p>
                  </Link>
                  {title ? <p className="mt-3 text-sm font-semibold text-slate-500">{title}</p> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ButtonLink href="/accounts" variant="secondary" className="lg:hidden">
                    Switch account
                  </ButtonLink>
                  <ButtonLink href="/change-password" variant="ghost">
                    Password
                  </ButtonLink>
                  <form action={logoutAction}>
                    <button className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-900">
                      Logout
                    </button>
                  </form>
                </div>
              </div>
            </header>

            <main className="space-y-6 pb-28 lg:pb-8">{children}</main>
          </div>
        </div>
      </div>

      <div className="fixed bottom-3 left-0 right-0 z-30 px-3 lg:hidden">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-white/80 bg-[rgba(246,240,231,0.9)] p-2 shadow-[0_22px_48px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <ShellNavigation groups={groups} mobile />
        </div>
      </div>
    </div>
  );
}
