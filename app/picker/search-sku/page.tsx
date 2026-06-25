import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { PlaceholderPanel } from "@/components/ui/PlaceholderPanel";
import { requireUser } from "@/lib/auth";

export default async function PickerSearchSkuPage() {
  await requireUser(["OWNER", "PICKER"]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Picker"
        title="Search SKU is reserved for a later phase"
        description="The route and mobile-first layout are ready now so SKU lookup can be added without disturbing the stable picking queue."
      />

      <PlaceholderPanel
        eyebrow="Picker placeholder"
        title="Future SKU lookup will stay fast, simple, and worker-friendly."
        description="When this module is implemented, workers will be able to search the catalog-aware SKU master while the picking queue keeps prioritizing only active order images for today’s work."
        highlights={[
          "Meesho Catalog Master Excel will store SKU, title, product URL, image URLs, Product Highlights, Additional Details, and the last scraped date.",
          "Today’s picker screens will still load only current and active SKU images instead of the full catalog image set.",
          "The search UX here will be built for quick worker decisions, not for heavy catalog admin tasks."
        ]}
        primaryAction={{ href: "/picker", label: "Back to my picking queue" }}
      />

      <AlertBanner tone="info" title="Why this is a placeholder">
        {/* TODO(catalog-phase-2): wire this page to the approved catalog master search indexes after the owner-side catalog model is introduced. */}
        We are intentionally not faking a search feature with incomplete data. Phase 1 keeps the current picking workflow dependable while reserving a polished home for future lookup.
      </AlertBanner>

      <Card tone="quiet">
        <h2 className="text-2xl font-semibold text-slate-950">Current best path</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          For now, pickers should continue using the grouped pick list, product image cards, and problem handoff flow already present in the main queue.
        </p>
      </Card>
    </AppShell>
  );
}
