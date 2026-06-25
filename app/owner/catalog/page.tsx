import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { PlaceholderPanel } from "@/components/ui/PlaceholderPanel";
import { requireUser } from "@/lib/auth";

export default async function OwnerCatalogPage() {
  await requireUser(["OWNER"]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Owner"
        title="Meesho catalog foundation"
        description="Phase 1 prepares the master catalog space without scraping, bulk image downloads, or unfinished live integrations."
        action={{ href: "/owner/catalog/sync", label: "Open sync plan" }}
      />

      <PlaceholderPanel
        eyebrow="Catalog placeholder"
        title="Catalog master data will live here in a controlled DailyWork workflow."
        description="This module is intentionally limited in Phase 1 so the current picking and packing app stays stable while we prepare the structure for future live catalog work."
        highlights={[
          "Meesho Catalog Master Excel will store SKU, title, product URL, image URLs, Product Highlights, Additional Details, and the last scraped date.",
          "Daily orders will continue loading only current and active SKU images instead of downloading the full catalog image library.",
          "Owners will eventually review sync history, stale items, and SKU coverage here before enabling any production scraping."
        ]}
        primaryAction={{ href: "/owner/catalog/sync", label: "Review sync placeholder" }}
        secondaryAction={{ href: "/owner/sku-mappings", label: "Manage today’s SKU images" }}
      />

      <AlertBanner tone="warning" title="Phase 1 safety">
        No Meesho scraping runs in this branch. No full-catalog image download runs in this branch. Current operations stay on the existing mapped image flow.
      </AlertBanner>

      <Card className="grid gap-4 md:grid-cols-2" tone="quiet">
        <div>
          <p className="dw-kicker">What ships now</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Stable foundations first</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            The owner experience now has a dedicated navigation slot and premium placeholder for catalog operations without mixing half-built automation into daily warehouse work.
          </p>
        </div>
        <div className="rounded-[24px] border border-white/80 bg-white/85 p-5">
          <p className="text-sm font-semibold text-slate-950">Planned next-phase hooks</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <li>Catalog Excel import and validation</li>
            <li>Stale SKU freshness checks</li>
            <li>Controlled sync review before any live updates</li>
          </ul>
        </div>
      </Card>
    </AppShell>
  );
}
