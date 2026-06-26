import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { compactNumber, formatDateTime } from "@/lib/format";
import { getDashboardStats, getRecentBatches, getRecentOrders } from "@/lib/data";
import { requireAccount, requireUser } from "@/lib/auth";
import { updateActiveSkuLoopSettingAction } from "./actions";

type OwnerDashboardPageProps = {
  searchParams?: Promise<{
    activeLoopUpdated?: string;
  }>;
};

export default async function OwnerDashboardPage({ searchParams }: OwnerDashboardPageProps) {
  const user = await requireUser(["OWNER"]);
  const account = await requireAccount(user);
  const [stats, orders, batches, params] = await Promise.all([
    getDashboardStats(account.id),
    getRecentOrders(account.id),
    getRecentBatches(account.id),
    searchParams
  ]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Owner"
        title="Daily warehouse dashboard"
        description="Upload daily orders, watch catalog health, and monitor the pick-and-pack queue."
        action={{ href: "/owner/uploads/new", label: "Upload labels" }}
      />

      {params?.activeLoopUpdated ? (
        <div className="mb-5 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
          Active SKU loop setting saved.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today SKUs" value={compactNumber(stats.todaySkus)} tone="berry" />
        <StatCard label="Today total qty" value={compactNumber(stats.todayTotalQty)} tone="mint" />
        <StatCard label="Missing catalog SKUs" value={compactNumber(stats.missingCatalogSkus)} tone="clay" />
        <StatCard label="Broken/missing image SKUs" value={compactNumber(stats.brokenOrMissingImageSkus)} tone="clay" />
        <StatCard label={`Active ${stats.activeLoopRetentionDays}-day SKUs`} value={compactNumber(stats.activeLoopSkus)} />
        <StatCard label="Duplicate AWBs skipped" value={compactNumber(stats.duplicateAwbsSkippedToday)} />
        <StatCard label="Orders ready picking" value={compactNumber(stats.readyPickingOrders)} tone="berry" />
        <StatCard label="Orders ready packing" value={compactNumber(stats.readyPackingOrders)} tone="mint" />
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Ready orders" value={compactNumber(stats.readyOrders)} tone="berry" />
        <StatCard label="Packed" value={compactNumber(stats.packedOrders)} tone="mint" />
        <StatCard label="Problems" value={compactNumber(stats.problemOrders)} tone="clay" />
        <StatCard label="SKU images" value={compactNumber(stats.skuMappings)} />
        <StatCard label="Batches" value={compactNumber(stats.batches)} />
      </section>

      <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <form action={updateActiveSkuLoopSettingAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label>
            <span className="text-sm font-semibold text-slate-700">Active SKU loop days</span>
            <input
              name="retentionDays"
              type="number"
              min={1}
              max={30}
              defaultValue={stats.activeLoopRetentionDays}
              className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-berry focus:ring-2 focus:ring-pink-100"
            />
          </label>
          <button className="min-h-11 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Save loop
          </button>
        </form>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-950">Recent orders</h2>
            <Link href="/picker" className="text-sm font-semibold text-berry hover:text-pink-800">
              View pick list
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {orders.map((order) => (
              <div key={order.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-semibold text-slate-950">{order.sku}</p>
                  <p className="text-sm text-slate-600">
                    AWB {order.awb} · Qty {order.qty} · {order.courier ?? "Courier pending"}
                  </p>
                </div>
                <StatusBadge value={order.packStatus} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-950">Upload batches</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/owner/uploads/${batch.id}/review`}
                className="block px-4 py-4 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{batch.fileName}</p>
                    <p className="text-sm text-slate-600">
                      {batch._count.orders} orders · {formatDateTime(batch.createdAt)}
                    </p>
                  </div>
                  <StatusBadge value={batch.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
