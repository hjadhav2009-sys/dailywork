import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { SubmitButton } from "@/components/SubmitButton";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { catalogMasterExists, loadCatalogIndex, searchCatalog } from "@/lib/catalog/master";
import { compactNumber, formatDateTime } from "@/lib/format";
import { importCatalogMasterAction } from "./actions";

type OwnerCatalogPageProps = {
  searchParams?: Promise<{
    sku?: string;
    title?: string;
    imported?: string;
    errors?: string;
    error?: string;
  }>;
};

function importErrorMessage(error: string | undefined) {
  if (error === "file") {
    return "Upload a .xlsx Master Excel file with Products, Images, Attributes, and Errors sheets.";
  }

  if (error === "too-large") {
    return "The catalog file is too large for this local import. Keep this phase to a practical Excel master under 25 MB.";
  }

  if (error === "parse") {
    return "DailyWork could not parse this workbook. Check sheet names, headers, and Excel file format.";
  }

  return null;
}

export default async function OwnerCatalogPage({ searchParams }: OwnerCatalogPageProps) {
  await requireUser(["OWNER"]);
  const params = await searchParams;
  const index = await loadCatalogIndex();
  const hasMaster = await catalogMasterExists();
  const hasSearch = Boolean(params?.sku || params?.title);
  const results = hasSearch
    ? searchCatalog(index, {
        sku: params?.sku,
        title: params?.title,
        limit: 25
      })
    : [];
  const importError = importErrorMessage(params?.error);
  const recentErrors = index.errors.slice(0, 8);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Owner"
        title="Meesho Catalog Master"
        description="Import, validate, export, and search the Excel-backed catalog master. This phase stores image URLs only."
        action={{ href: "/owner/catalog/sync", label: "Sync plan" }}
      >
        <ButtonLink href="/owner/catalog/export" variant="secondary">
          Export Master Excel
        </ButtonLink>
      </PageHeader>

      {importError ? (
        <AlertBanner tone="error" title="Catalog import failed">
          {importError}
        </AlertBanner>
      ) : null}

      {params?.imported ? (
        <AlertBanner tone={Number(params.errors ?? 0) > 0 ? "warning" : "success"} title="Catalog import complete">
          Imported catalog master. Validation rows: {compactNumber(Number(params.errors ?? 0))}.
        </AlertBanner>
      ) : null}

      {!hasMaster ? (
        <AlertBanner tone="info" title="No catalog imported yet">
          Export creates a clean Master Excel template until the first catalog file is imported.
        </AlertBanner>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Products" value={compactNumber(index.summary.productCount)} tone="mint" />
        <StatCard label="Image URLs" value={compactNumber(index.summary.imageUrlCount)} tone="berry" />
        <StatCard label="Attributes" value={compactNumber(index.summary.attributeCount)} tone="clay" />
        <StatCard label="Missing SKUs" value={compactNumber(index.summary.missingSkuCount)} tone="slate" />
        <StatCard label="Invalid rows" value={compactNumber(index.summary.invalidRowCount)} tone="slate" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card as="form" action={importCatalogMasterAction} padding="lg">
          <p className="dw-kicker">Master Excel</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Import catalog file</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="dw-label">Catalog workbook</span>
              <input name="catalogFile" type="file" accept=".xlsx" required className="dw-file-input mt-2" />
            </label>
            <SubmitButton pendingText="Importing...">Import Master Excel</SubmitButton>
          </div>
        </Card>

        <Card padding="lg" tone="quiet">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="dw-kicker">Recent import</p>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                {index.lastImport ? index.lastImport.status.replaceAll("_", " ") : "No import yet"}
              </h2>
            </div>
            <ButtonLink href="/owner/catalog/export" variant="secondary">
              Download workbook
            </ButtonLink>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/80 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Source file</dt>
              <dd className="mt-2 break-words text-sm font-semibold text-slate-950">{index.lastImport?.fileName ?? "Not imported"}</dd>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Imported at</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(index.lastImport?.importedAt)}</dd>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Rows using title SKU</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-950">{compactNumber(index.summary.extractedSkuCount)}</dd>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Catalog storage</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-950">storage/catalog</dd>
            </div>
          </dl>
        </Card>
      </section>

      <Card padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="dw-kicker">Search</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Find catalog SKUs</h2>
          </div>
          <form className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="sr-only">Search SKU</span>
              <input name="sku" defaultValue={params?.sku ?? ""} placeholder="Search SKU" className="dw-input" />
            </label>
            <label className="block">
              <span className="sr-only">Search title</span>
              <input name="title" defaultValue={params?.title ?? ""} placeholder="Search title" className="dw-input" />
            </label>
            <button className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm">
              Search
            </button>
          </form>
        </div>

        {hasSearch ? (
          <div className="mt-5">
            {results.length > 0 ? (
              <div className="grid gap-3">
                {results.map((product) => (
                  <article key={product.sku} className="rounded-2xl border border-slate-200 bg-white/86 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-xl font-black text-slate-950">{product.sku}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{product.title || "No title"}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 text-xs font-semibold text-slate-600">
                        <span className="dw-chip">{product.images.length + (product.mainImageUrl ? 1 : 0)} image URLs</span>
                        <span className="dw-chip">{product.attributes.length} attributes</span>
                      </div>
                    </div>
                    {product.productHighlights.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.productHighlights.slice(0, 4).map((attribute) => (
                          <span key={`${product.sku}-${attribute.attributeName}`} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900">
                            {attribute.attributeName}: {attribute.attributeValue}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                <h3 className="text-xl font-semibold text-slate-950">No catalog matches</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">No products match the current SKU or title search.</p>
              </div>
            )}
          </div>
        ) : null}
      </Card>

      <Card padding="lg" tone={index.summary.invalidRowCount > 0 ? "default" : "quiet"}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="dw-kicker">Validation</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Import errors</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">The exported Master Excel includes these rows on the Errors sheet.</p>
          </div>
          <span className="dw-chip">{compactNumber(index.summary.invalidRowCount)} invalid rows</span>
        </div>

        {recentErrors.length > 0 ? (
          <div className="dw-table-wrap mt-5 shadow-none">
            <table className="dw-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((error, index) => (
                  <tr key={`${error.rowNo}-${error.errorType}-${index}`}>
                    <td>{error.rowNo}</td>
                    <td className="break-words font-semibold text-slate-950">{error.sku || "-"}</td>
                    <td>{error.errorType}</td>
                    <td>{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center">
            <h3 className="text-xl font-semibold text-slate-950">No validation errors</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">The current catalog index has no invalid rows.</p>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
