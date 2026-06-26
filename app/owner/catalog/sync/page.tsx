import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { SubmitButton } from "@/components/SubmitButton";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { loadCatalogIndex } from "@/lib/catalog/master";
import { extractSkuFromTitle, type SkuExtractionRule } from "@/lib/catalog/sku-extraction";
import { loadSyncErrors, loadSyncQueue, loadSyncState, syncProgressPercent, type CatalogSyncStatus } from "@/lib/catalog/sync-storage";
import { compactNumber, formatDateTime } from "@/lib/format";
import {
  openMeeshoLoginAction,
  pauseCatalogSyncAction,
  refreshFailedCatalogItemsAction,
  refreshSelectedSkuAction,
  resumeCatalogSyncAction,
  startCatalogSyncAction,
  stopCatalogSyncAction
} from "./actions";

type OwnerCatalogSyncPageProps = {
  searchParams?: Promise<{
    status?: string;
    previewTitle?: string;
    previewRule?: string;
    previewRegex?: string;
  }>;
};

const skuRules: Array<{ value: SkuExtractionRule; label: string }> = [
  { value: "default", label: "Default tail" },
  { value: "last-word", label: "Last word" },
  { value: "after-last-hyphen", label: "After last hyphen" },
  { value: "square-brackets", label: "Square brackets" },
  { value: "round-brackets", label: "Round brackets" },
  { value: "custom-regex", label: "Custom regex" }
];

function statusTone(status: CatalogSyncStatus) {
  if (["RUNNING", "DISCOVERING"].includes(status)) {
    return "bg-teal-50 text-teal-900 ring-teal-200";
  }

  if (status === "FAILED") {
    return "bg-rose-50 text-rose-900 ring-rose-200";
  }

  if (status === "PAUSED" || status === "STOPPING") {
    return "bg-amber-50 text-amber-950 ring-amber-200";
  }

  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "login-opened": "Meesho login browser opened on the owner PC. Complete login manually there.",
    started: "Catalog sync started.",
    paused: "Pause requested.",
    resumed: "Catalog sync resumed.",
    stopping: "Stop requested.",
    "failed-refreshed": "Failed items were moved back to the pending queue.",
    "sku-queued": "Selected SKU was queued for refresh.",
    "sku-not-found": "Selected SKU was not found or has no product URL.",
    "invalid-url": "Shop URL must be a valid http:// or https:// URL."
  };

  return status ? messages[status] : undefined;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-[linear-gradient(135deg,#0f766e_0%,#c56a2d_100%)] transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export default async function OwnerCatalogSyncPage({ searchParams }: OwnerCatalogSyncPageProps) {
  await requireUser(["OWNER"]);
  const params = await searchParams;
  const [index, state, queue, errors] = await Promise.all([loadCatalogIndex(), loadSyncState(), loadSyncQueue(), loadSyncErrors()]);
  const status = statusMessage(params?.status);
  const progress = syncProgressPercent(state);
  const pendingCount = queue.filter((item) => item.status === "pending").length;
  const failedCount = queue.filter((item) => item.status === "failed").length;
  const processingCount = queue.filter((item) => item.status === "processing").length;
  const previewTitle = params?.previewTitle ?? "";
  const previewRule = (params?.previewRule as SkuExtractionRule | undefined) ?? state.settings.skuExtractionRule;
  const previewRegex = params?.previewRegex ?? state.settings.customRegex ?? "";
  const previewSku = previewTitle
    ? extractSkuFromTitle({
        title: previewTitle,
        rule: previewRule,
        customRegex: previewRegex
      }).sku
    : "";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Catalog Sync"
        title="Owner-controlled Meesho sync"
        description="Manual-login, rate-limited catalog updates for the Excel-backed master. Images stay as URLs only."
        action={{ href: "/owner/catalog", label: "Open catalog" }}
      >
        <ButtonLink href="/owner/catalog/export" variant="secondary">
          Export Master Excel
        </ButtonLink>
      </PageHeader>

      {status ? (
        <AlertBanner tone={params?.status === "invalid-url" || params?.status === "sku-not-found" ? "error" : "info"} title="Sync update">
          {status}
        </AlertBanner>
      ) : null}

      <AlertBanner tone="warning" title="Safety rules active">
        Manual login only. No password storage, no CAPTCHA bypass, no anti-bot bypass, no full image downloads. Sync stores product and image URLs only.
      </AlertBanner>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Discovered" value={compactNumber(state.stats.totalProductsDiscovered)} tone="mint" />
        <StatCard label="Processed" value={compactNumber(state.stats.productsProcessed)} tone="berry" />
        <StatCard label="Added" value={compactNumber(state.stats.productsAdded)} tone="clay" />
        <StatCard label="Updated" value={compactNumber(state.stats.productsUpdated)} tone="slate" />
        <StatCard label="Failed" value={compactNumber(state.stats.productsFailed)} tone="slate" />
      </section>

      <Card padding="lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="dw-kicker">Current sync</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-950">Status</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ring-1 ${statusTone(state.status)}`}>
                {state.status}
              </span>
            </div>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">{state.lastMessage ?? "No sync has run yet."}</p>
            {state.activeProductUrl ? <p className="mt-2 break-all text-xs font-semibold text-slate-500">{state.activeProductUrl}</p> : null}
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-md">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last sync</p>
              <p className="mt-2 text-sm font-black text-slate-950">{formatDateTime(state.lastSyncDate)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Broken image URLs</p>
              <p className="mt-2 text-sm font-black text-slate-950">{compactNumber(state.stats.brokenImageUrlCount)}</p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card padding="lg">
          <p className="dw-kicker">Start sync</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Safe product source</h2>
          <form action={startCatalogSyncAction}>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="dw-label">Shop URL or product URL</span>
                <input name="shopUrl" defaultValue={state.settings.shopUrl} placeholder="https://www.meesho.com/..." className="dw-input mt-2" />
              </label>
              <label>
                <span className="dw-label">Max products per run</span>
                <input name="maxProductsPerRun" type="number" min={1} max={250} defaultValue={state.settings.maxProductsPerRun} className="dw-input mt-2" />
              </label>
              <label>
                <span className="dw-label">Delay between products (ms)</span>
                <input name="delayMs" type="number" min={500} max={60000} step={250} defaultValue={state.settings.delayMs} className="dw-input mt-2" />
              </label>
              <label>
                <span className="dw-label">SKU extraction rule</span>
                <select name="skuExtractionRule" defaultValue={state.settings.skuExtractionRule} className="dw-select mt-2">
                  {skuRules.map((rule) => (
                    <option key={rule.value} value={rule.value}>
                      {rule.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="dw-label">Custom regex</span>
                <input name="customRegex" defaultValue={state.settings.customRegex ?? ""} placeholder="Optional capture group" className="dw-input mt-2" />
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 md:col-span-2">
                <input name="resumeFromLastProduct" type="checkbox" defaultChecked={state.settings.resumeFromLastProduct} className="h-5 w-5 accent-teal-700" />
                Resume from last queued product
              </label>
            </div>
            <div className="mt-5">
              <SubmitButton pendingText="Starting...">Start Catalog Sync</SubmitButton>
            </div>
          </form>
          <div className="mt-3">
            <form action={openMeeshoLoginAction}>
              <input type="hidden" name="loginUrl" value={state.settings.shopUrl} />
              <SubmitButton pendingText="Opening..." variant="secondary">Open Meesho Login</SubmitButton>
            </form>
          </div>
        </Card>

        <Card padding="lg" tone="quiet">
          <p className="dw-kicker">Controls</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Pause, resume, retry</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form action={pauseCatalogSyncAction}>
              <SubmitButton pendingText="Pausing..." variant="secondary">Pause Sync</SubmitButton>
            </form>
            <form action={resumeCatalogSyncAction}>
              <SubmitButton pendingText="Resuming..." variant="secondary">Resume Sync</SubmitButton>
            </form>
            <form action={stopCatalogSyncAction}>
              <SubmitButton pendingText="Stopping..." variant="danger">Stop Sync</SubmitButton>
            </form>
            <form action={refreshFailedCatalogItemsAction}>
              <SubmitButton pendingText="Refreshing..." variant="secondary">Refresh Failed Items</SubmitButton>
            </form>
          </div>
          <form action={refreshSelectedSkuAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label>
              <span className="dw-label">Refresh selected SKU</span>
              <input name="selectedSku" placeholder="SKU from catalog" className="dw-input mt-2" />
            </label>
            <SubmitButton pendingText="Queueing..." variant="secondary">Refresh Selected SKU</SubmitButton>
          </form>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card padding="lg">
          <p className="dw-kicker">SKU preview</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Test extraction rule</h2>
          <form className="mt-5 grid gap-3">
            <label>
              <span className="dw-label">Product title</span>
              <input name="previewTitle" defaultValue={previewTitle} placeholder="Balaji Bracelet Gold SJ-BR-ME-G-Balaji 02" className="dw-input mt-2" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="dw-label">Rule</span>
                <select name="previewRule" defaultValue={previewRule} className="dw-select mt-2">
                  {skuRules.map((rule) => (
                    <option key={rule.value} value={rule.value}>
                      {rule.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="dw-label">Custom regex</span>
                <input name="previewRegex" defaultValue={previewRegex} className="dw-input mt-2" />
              </label>
            </div>
            <button className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm">
              Preview SKU
            </button>
          </form>
          <div className="mt-5 rounded-2xl bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Extracted SKU</p>
            <p className="mt-2 break-words text-xl font-black text-slate-950">{previewSku || "Not tested"}</p>
          </div>
        </Card>

        <Card padding="lg">
          <p className="dw-kicker">Queue</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">{compactNumber(queue.length)} queued products</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pending</p>
              <p className="mt-2 text-lg font-black text-slate-950">{compactNumber(pendingCount)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Processing</p>
              <p className="mt-2 text-lg font-black text-slate-950">{compactNumber(processingCount)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Failed</p>
              <p className="mt-2 text-lg font-black text-slate-950">{compactNumber(failedCount)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Catalog products indexed: {compactNumber(index.summary.productCount)}. JSON index is used only for fast search; Excel remains the source of truth.
          </p>
        </Card>
      </section>

      <Card padding="lg">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="dw-kicker">Error log</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Recent sync errors</h2>
          </div>
          <span className="dw-chip">{compactNumber(errors.length)} stored errors</span>
        </div>

        {errors.length > 0 ? (
          <div className="dw-table-wrap mt-5 shadow-none">
            <table className="dw-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Retry</th>
                </tr>
              </thead>
              <tbody>
                {errors.slice(0, 20).map((error, index) => (
                  <tr key={`${error.createdAt}-${error.errorType}-${index}`}>
                    <td>{formatDateTime(error.createdAt)}</td>
                    <td className="break-words font-semibold text-slate-950">{error.sku || "-"}</td>
                    <td>{error.errorType}</td>
                    <td>{error.message}</td>
                    <td>
                      {error.sku ? (
                        <form action={refreshSelectedSkuAction}>
                          <input type="hidden" name="selectedSku" value={error.sku} />
                          <button className="text-xs font-bold text-[var(--dw-brand)] underline">Retry SKU</button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-500">Use failed refresh</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center">
            <h3 className="text-xl font-semibold text-slate-950">No sync errors</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Errors from product discovery, page extraction, and catalog merge will appear here.</p>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
