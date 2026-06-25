"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavigationItem = {
  href: string;
  label: string;
  icon: "dashboard" | "orders" | "upload" | "catalog" | "images" | "workers" | "problems" | "reports" | "system" | "pick" | "search" | "pack" | "history" | "password" | "accounts" | "cleanup";
  description?: string;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

const iconPaths: Record<NavigationItem["icon"], string> = {
  dashboard: "M4 13.5 12 4l8 9.5M6.5 12.5V20h11v-7.5",
  orders: "M5 6.5h14M5 12h14M5 17.5h9",
  upload: "M12 4v10m0-10 4 4m-4-4-4 4M5 18.5h14",
  catalog: "M6 5.5h12A1.5 1.5 0 0 1 19.5 7v10A1.5 1.5 0 0 1 18 18.5H6A1.5 1.5 0 0 1 4.5 17V7A1.5 1.5 0 0 1 6 5.5Zm3 3h6m-6 4h6m-6 4h4",
  images: "M6 6.5h12A1.5 1.5 0 0 1 19.5 8v8A1.5 1.5 0 0 1 18 17.5H6A1.5 1.5 0 0 1 4.5 16V8A1.5 1.5 0 0 1 6 6.5Zm2 7 2.5-2.5 2 2L15 10.5l3 3",
  workers: "M9.25 10.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Zm5.5 1.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM4.75 18a4.5 4.5 0 0 1 9 0M13.5 18a3.5 3.5 0 0 1 6.5-1.75",
  problems: "M12 6v5.5m0 4h.01M5.1 18h13.8c1.12 0 1.82-1.2 1.27-2.17L13.27 4.17a1.45 1.45 0 0 0-2.54 0L3.83 15.83C3.28 16.8 3.98 18 5.1 18Z",
  reports: "M6 17.5V12m6 5.5V7m6 10.5V10",
  system: "M12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm7.25 3.75-.92.53a6.85 6.85 0 0 1-.19 1.44l.73.79a.8.8 0 0 1 .06 1.03l-1 1.38a.8.8 0 0 1-.99.27l-.97-.39a6.9 6.9 0 0 1-1.27.73l-.16 1.03a.8.8 0 0 1-.79.67h-1.7a.8.8 0 0 1-.79-.67l-.16-1.03a6.9 6.9 0 0 1-1.27-.73l-.97.39a.8.8 0 0 1-.99-.27l-1-1.38a.8.8 0 0 1 .06-1.03l.73-.79a6.85 6.85 0 0 1-.19-1.44l-.92-.53a.8.8 0 0 1-.39-.69V10a.8.8 0 0 1 .39-.69l.92-.53c.03-.49.09-.97.19-1.44l-.73-.79a.8.8 0 0 1-.06-1.03l1-1.38a.8.8 0 0 1 .99-.27l.97.39c.4-.29.83-.53 1.27-.73l.16-1.03a.8.8 0 0 1 .79-.67h1.7a.8.8 0 0 1 .79.67l.16 1.03c.44.2.87.44 1.27.73l.97-.39a.8.8 0 0 1 .99.27l1 1.38a.8.8 0 0 1-.06 1.03l-.73.79c.1.47.16.95.19 1.44l.92.53a.8.8 0 0 1 .39.69v2.62a.8.8 0 0 1-.39.69Z",
  pick: "M6 9.5h12m-9.5 4h7m-7 4h5M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z",
  search: "m17.5 17.5-3.6-3.6M10.5 16a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z",
  pack: "M6 7.5h12M8 12h8m-8 4.5h5M5.5 5.5h13A1.5 1.5 0 0 1 20 7v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V7a1.5 1.5 0 0 1 1.5-1.5Z",
  history: "M12 6.5v5l3 1.75M12 19a7 7 0 1 0-7-7m0 0H2.75m2.25 0V9.75",
  password: "M8.5 11V8.75a3.5 3.5 0 1 1 7 0V11m-8 0h9a1.5 1.5 0 0 1 1.5 1.5V17A1.5 1.5 0 0 1 16.5 18.5h-9A1.5 1.5 0 0 1 6 17v-4.5A1.5 1.5 0 0 1 7.5 11Z",
  accounts: "M4.5 8.5h15m-15 7h15M6 5.5h12A1.5 1.5 0 0 1 19.5 7v10A1.5 1.5 0 0 1 18 18.5H6A1.5 1.5 0 0 1 4.5 17V7A1.5 1.5 0 0 1 6 5.5Z",
  cleanup: "M7 8.5h10m-8.5 0 .7 8.5m6.6-8.5-.7 8.5M9.5 8.5V6.75A1.25 1.25 0 0 1 10.75 5.5h2.5A1.25 1.25 0 0 1 14.5 6.75V8.5M6 8.5h12"
};

function isItemActive(item: NavigationItem, pathname: string, searchParams: URLSearchParams, allItems: NavigationItem[]) {
  const url = new URL(item.href, "https://dailywork.local");

  if (pathname !== url.pathname && !pathname.startsWith(`${url.pathname}/`)) {
    return false;
  }

  for (const [key, value] of url.searchParams.entries()) {
    if (searchParams.get(key) !== value) {
      return false;
    }
  }

  if (url.searchParams.size === 0) {
    const matchedSpecificSibling = allItems.some((candidate) => {
      if (candidate.href === item.href) {
        return false;
      }

      const candidateUrl = new URL(candidate.href, "https://dailywork.local");
      if (candidateUrl.pathname !== url.pathname || candidateUrl.searchParams.size === 0) {
        return false;
      }

      for (const [key, value] of candidateUrl.searchParams.entries()) {
        if (searchParams.get(key) !== value) {
          return false;
        }
      }

      return true;
    });

    if (matchedSpecificSibling) {
      return false;
    }
  }

  return true;
}

export function ShellNavigation({ groups, mobile = false }: { groups: NavigationGroup[]; mobile?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = groups.flatMap((group) => group.items);

  if (mobile) {
    return (
      <nav className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => {
          const active = isItemActive(item, pathname, searchParams, items);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[94px] shrink-0 flex-col items-center gap-1 rounded-3xl px-4 py-3 text-center transition",
                active
                  ? "bg-[linear-gradient(140deg,#0f766e_0%,#115e59_100%)] text-white shadow-[0_18px_30px_rgba(15,118,110,0.25)]"
                  : "bg-white/82 text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.08)] ring-1 ring-white/80 hover:bg-white"
              )}
            >
              <span className={cn("rounded-2xl p-2", active ? "bg-white/12" : "bg-slate-100/90")}>
                <svg viewBox="0 0 24 24" className={cn("h-5 w-5 fill-none stroke-[1.8]", active ? "stroke-white" : "stroke-slate-700")}>
                  <path d={iconPaths[item.icon]} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-[11px] font-semibold leading-4">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{group.title}</p>
          <div className="mt-3 space-y-2">
            {group.items.map((item) => {
              const active = isItemActive(item, pathname, searchParams, items);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-start gap-3 rounded-3xl px-3 py-3 transition",
                    active
                      ? "bg-[linear-gradient(145deg,rgba(15,118,110,0.96)_0%,rgba(17,94,89,0.94)_100%)] text-white shadow-[0_18px_34px_rgba(15,118,110,0.22)]"
                      : "text-slate-700 hover:bg-white/88 hover:shadow-[0_12px_26px_rgba(15,23,42,0.06)]"
                  )}
                >
                  <span className={cn("mt-0.5 rounded-2xl p-2", active ? "bg-white/12" : "bg-slate-100/90 group-hover:bg-slate-100")}>
                    <svg viewBox="0 0 24 24" className={cn("h-5 w-5 fill-none stroke-[1.8]", active ? "stroke-white" : "stroke-slate-700")}>
                      <path d={iconPaths[item.icon]} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    {item.description ? (
                      <span className={cn("mt-1 block text-xs leading-5", active ? "text-white/72" : "text-slate-500")}>
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
