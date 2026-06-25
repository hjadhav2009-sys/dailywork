import { AppShell } from "@/components/AppShell";
import { AwbBarcodeScanner } from "@/components/AwbBarcodeScanner";
import { PageHeader } from "@/components/PageHeader";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { PlaceholderPanel } from "@/components/ui/PlaceholderPanel";
import { requireAccount, requireUser } from "@/lib/auth";
import { getLatestImportedBatch, getPackingDashboard } from "@/lib/data";
import { moveOldPendingToReviewAction, searchAwbAction } from "./actions";

type PackingPageProps = {
  searchParams?: Promise<{
    error?: string;
    notFound?: string;
    multiple?: string;
    q?: string;
    oldPendingReviewed?: string;
    view?: string;
  }>;
};

export default async function PackingAwbPage({ searchParams }: PackingPageProps) {
  const user = await requireUser(["OWNER", "PACKER"]);
  const account = await requireAccount(user);
  const [dashboard, latestBatch, params] = await Promise.all([
    getPackingDashboard(account.id),
    getLatestImportedBatch(account.id),
    searchParams
  ]);

  if (params?.view === "packed") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Packer"
          title="Packed orders history is staged for a later phase"
          description="Phase 1 preserves the live scan flow while reserving a clean navigation slot for future packed-history tools."
        />

        <PlaceholderPanel
          eyebrow="Packed orders placeholder"
          title="Packed history will stay separated from the live AWB scanner."
          description="When this module is built, packers and owners will be able to review recently packed orders without interrupting the fast dispatch workflow on the main scan screen."
          highlights={[
            `Packed today: ${dashboard.packedTodayCount}`,
            `Ready today: ${dashboard.todayReadyCount}`,
            `Current batch: ${latestBatch ? latestBatch.fileName : "none yet"}`
          ]}
          primaryAction={{ href: "/packing", label: "Back to scan AWB" }}
        />

        <AlertBanner tone="info" title="Phase 1 scope">
          Packed-history reporting is intentionally postponed. The stable scan flow, problem orders, reports, and exports remain the source of truth for now.
        </AlertBanner>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Packer"
        title="Scan or search AWB"
        description="Scan the label or type the last 5 to 8 AWB characters. The flow is optimized for fast mobile dispatch work."
      />

      <AwbBarcodeScanner action={searchAwbAction} defaultAwb={params?.q} />

      <Card className="flex gap-2 overflow-x-auto" padding="sm" tone="quiet">
        <span className="dw-chip">{account.name}</span>
        <span className="dw-chip">{user.name}</span>
        <span className="dw-chip">Packed today {dashboard.packedTodayCount}</span>
        <span className="dw-chip">Today ready {dashboard.todayReadyCount}</span>
        <span className="dw-chip">Current batch {latestBatch ? latestBatch.fileName : "none"}</span>
        <span className="dw-chip">All pending {dashboard.pendingCount}</span>
        <span className="dw-chip">Old pending {dashboard.oldPendingCount}</span>
        <span className="dw-chip">Problems {dashboard.problemCount}</span>
      </Card>

      {user.role === "OWNER" && dashboard.oldPendingCount > 0 ? (
        <form action={moveOldPendingToReviewAction}>
          <AlertBanner tone="warning" title="Old pending review suggested">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>
                {dashboard.oldPendingCount} old pending order{dashboard.oldPendingCount === 1 ? "" : "s"} remain in history and reports. Keep today clean by reviewing them separately.
              </p>
              <button className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5">
                Move old pending to review
              </button>
            </div>
          </AlertBanner>
        </form>
      ) : null}

      <div className="space-y-3">
        {params?.oldPendingReviewed ? (
          <AlertBanner tone="success">
            Old pending review noted for {params.oldPendingReviewed} order{params.oldPendingReviewed === "1" ? "" : "s"}. No orders were deleted or reset.
          </AlertBanner>
        ) : null}
        {params?.error ? <AlertBanner tone="error">Enter a valid AWB.</AlertBanner> : null}
        {params?.notFound ? <AlertBanner tone="warning">No order matched AWB {params.notFound}.</AlertBanner> : null}
        {params?.multiple ? (
          <AlertBanner tone="info">Multiple orders matched {params.q}. Choose the correct AWB from the live suggestions.</AlertBanner>
        ) : null}
        {dashboard.todayReadyCount === 0 ? (
          <AlertBanner tone="info">
            No ready packing orders from today&apos;s imports. Manual AWB search still checks all READY orders for this account.
          </AlertBanner>
        ) : null}
      </div>
    </AppShell>
  );
}
