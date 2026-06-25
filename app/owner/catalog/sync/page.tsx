import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { PlaceholderPanel } from "@/components/ui/PlaceholderPanel";
import { requireUser } from "@/lib/auth";

export default async function OwnerCatalogSyncPage() {
  await requireUser(["OWNER"]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Catalog Sync"
        title="Catalog sync will be staged here later"
        description="Phase 1 reserves the route, UI language, and safety expectations for future catalog updates without enabling any scraper code."
      />

      <PlaceholderPanel
        eyebrow="Sync placeholder"
        title="Future syncs will stay owner-controlled and reviewable."
        description="When scraping arrives in a later phase, this page will be the checkpoint for safe execution, visibility into changes, and a clean distinction between today’s operational images and the broader catalog master."
        highlights={[
          "Catalog sync will update SKU, title, product URL, image URLs, Product Highlights, Additional Details, and the last scraped date in the master Excel-backed workflow.",
          "Daily warehouse screens will still prefer only current and active SKU images needed for picking and packing.",
          "Any future scrape flow will require explicit review steps rather than silent background updates."
        ]}
        primaryAction={{ href: "/owner/catalog", label: "Back to catalog overview" }}
        secondaryAction={{ href: "/owner", label: "Return to dashboard" }}
      />

      <AlertBanner tone="info" title="Planned integration point">
        {/* TODO(catalog-phase-2): connect the reviewed catalog master import/sync pipeline here once scraping rules, rate limits, and validation UX are finalized. */}
        This page exists now so later scraper work has a clear, isolated entry point instead of leaking into the stable warehouse workflows.
      </AlertBanner>

      <Card tone="quiet">
        <h2 className="text-2xl font-semibold text-slate-950">What will not happen in Phase 1</h2>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <li>No automatic image harvesting</li>
          <li>No full-catalog background sync jobs</li>
          <li>No incomplete or disabled scraper code paths hidden behind buttons</li>
        </ul>
      </Card>
    </AppShell>
  );
}
