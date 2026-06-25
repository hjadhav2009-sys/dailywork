import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { loadCatalogIndex } from "@/lib/catalog/master";
import { compactNumber, formatDateTime } from "@/lib/format";

export default async function OwnerCatalogSyncPage() {
  await requireUser(["OWNER"]);
  const index = await loadCatalogIndex();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Catalog Sync"
        title="Phase 3 live sync planning"
        description="Current phase uses Excel import/export only. Live scraping will be Phase 3."
        action={{ href: "/owner/catalog", label: "Open catalog" }}
      >
        <ButtonLink href="/owner/catalog/export" variant="secondary">
          Export Master Excel
        </ButtonLink>
      </PageHeader>

      <AlertBanner tone="warning" title="Live scraping will be Phase 3">
        Current phase uses Excel import/export only. No Meesho scraper button, background job, or image downloader is enabled here.
      </AlertBanner>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card padding="lg">
          <p className="dw-kicker">Excel actions</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Manage the catalog master</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/owner/catalog">Import Master Excel</ButtonLink>
            <ButtonLink href="/owner/catalog/export" variant="secondary">
              Export Master Excel
            </ButtonLink>
          </div>
        </Card>

        <Card padding="lg" tone="quiet">
          <p className="dw-kicker">Current index</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">
            {compactNumber(index.summary.productCount)} products indexed
          </h2>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/78 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Image URLs</dt>
              <dd className="mt-2 text-lg font-black text-slate-950">{compactNumber(index.summary.imageUrlCount)}</dd>
            </div>
            <div className="rounded-2xl bg-white/78 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Attributes</dt>
              <dd className="mt-2 text-lg font-black text-slate-950">{compactNumber(index.summary.attributeCount)}</dd>
            </div>
            <div className="rounded-2xl bg-white/78 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Invalid rows</dt>
              <dd className="mt-2 text-lg font-black text-slate-950">{compactNumber(index.summary.invalidRowCount)}</dd>
            </div>
            <div className="rounded-2xl bg-white/78 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last import</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(index.lastImport?.importedAt)}</dd>
            </div>
          </dl>
        </Card>
      </section>

      <Card padding="lg">
        <p className="dw-kicker">Phase 3 checklist</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            "Owner-reviewed scraping rules",
            "Rate limits and retry policy",
            "Change review before master updates"
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold text-slate-800">
              {item}
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
