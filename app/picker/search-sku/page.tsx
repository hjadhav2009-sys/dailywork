import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { CatalogUrlImage } from "@/components/catalog/CatalogUrlImage";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { loadCatalogIndex, searchCatalog, type CatalogAttribute, type CatalogSearchResult } from "@/lib/catalog/master";
import { compactNumber } from "@/lib/format";

type PickerSearchSkuPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function uniqueImageUrls(product: CatalogSearchResult) {
  return Array.from(new Set([product.mainImageUrl, ...product.images.map((image) => image.imageUrl)].filter(Boolean)));
}

function AttributeList({ title, attributes }: { title: string; attributes: CatalogAttribute[] }) {
  return (
    <div>
      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      {attributes.length > 0 ? (
        <dl className="mt-3 grid gap-2">
          {attributes.map((attribute) => (
            <div key={`${attribute.sku}-${attribute.section}-${attribute.attributeName}-${attribute.rowNo}`} className="rounded-2xl bg-slate-50 px-3 py-2">
              <dt className="text-xs font-semibold text-slate-500">{attribute.attributeName}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950">{attribute.attributeValue || "-"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-slate-500">
          No {title.toLowerCase()} saved for this SKU.
        </p>
      )}
    </div>
  );
}

export default async function PickerSearchSkuPage({ searchParams }: PickerSearchSkuPageProps) {
  await requireUser(["OWNER", "PICKER"]);
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const index = await loadCatalogIndex();
  const results = query ? searchCatalog(index, { query, limit: 20 }) : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Picker"
        title="Catalog SKU search"
        description="Read-only lookup from the owner imported Master Excel."
      />

      {index.summary.productCount === 0 ? (
        <AlertBanner tone="info" title="Catalog not imported">
          Ask an owner to import the Meesho Catalog Master Excel before using catalog lookup.
        </AlertBanner>
      ) : null}

      <form className="sticky top-[88px] z-20 grid gap-2 rounded-2xl border border-white/80 bg-white/94 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur md:top-[106px] md:grid-cols-[1fr_auto] md:p-3">
        <label className="block">
          <span className="sr-only">Search SKU or title</span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Search SKU or title"
            className="dw-input"
          />
        </label>
        <button className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          Search
        </button>
      </form>

      {query ? (
        <div className="rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
          Showing {compactNumber(results.length)} results for <span className="text-slate-950">{query}</span>
        </div>
      ) : null}

      {!query ? (
        <EmptyState title="Search the catalog" description="Enter a SKU or product title keyword to view the owner imported catalog details." />
      ) : results.length === 0 ? (
        <EmptyState title="No catalog match" description="No catalog product matched this SKU or title search." />
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {results.map((product) => {
            const imageUrls = uniqueImageUrls(product);
            const heroImageUrl = imageUrls[0] ?? null;

            return (
              <Card key={product.sku} padding="lg">
                <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                  <CatalogUrlImage src={heroImageUrl} alt={product.title || product.sku} size="hero" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="dw-chip">{product.category || "Catalog"}</span>
                      {product.status ? <span className="dw-chip">{product.status}</span> : null}
                    </div>
                    <h2 className="mt-4 break-words text-3xl font-black leading-tight text-slate-950">{product.sku}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{product.title || "No title"}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Price</p>
                        <p className="mt-1 text-sm font-black text-slate-950">{product.price || "-"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Rating</p>
                        <p className="mt-1 text-sm font-black text-slate-950">{product.rating || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <AttributeList title="Product Highlights" attributes={product.productHighlights} />
                  <AttributeList title="Additional Details" attributes={product.additionalDetails} />
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Image URLs</h3>
                    <span className="dw-chip">{compactNumber(imageUrls.length)}</span>
                  </div>
                  {imageUrls.length > 0 ? (
                    <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                      {imageUrls.map((imageUrl, index) => (
                        <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer" className="block shrink-0">
                          <CatalogUrlImage src={imageUrl} alt={`${product.sku} image ${index + 1}`} size="thumb" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-slate-500">
                      No image URLs saved for this SKU.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}
