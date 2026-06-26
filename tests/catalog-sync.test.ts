import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyCatalogIndex } from "../lib/catalog/master";
import { mergeCatalogProductFromSync } from "../lib/catalog/sync-merge";
import { parseMeeshoProductDetailHtml } from "../lib/catalog/sync-parser";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "catalog");
const html = readFileSync(join(fixtureDir, "meesho-product-detail.html"), "utf8");
const detail = parseMeeshoProductDetailHtml(html, "https://www.meesho.com/balaji-bracelet/p/abc123");

assert.equal(detail.title, "Balaji Bracelet Gold SJ-BR-ME-G-Balaji 02", "Product detail parser extracts title");
assert.equal(detail.productUrl, "https://www.meesho.com/balaji-bracelet/p/abc123", "Product detail parser extracts URL");
assert.equal(detail.mainImageUrl, "https://images.meesho.com/products/balaji-main.webp", "Product detail parser extracts main image URL");
assert.equal(detail.imageUrls.includes("https://images.meesho.com/products/balaji-side.jpg"), true, "Product detail parser extracts JSON-LD image URLs");
assert.equal(detail.imageUrls.includes("https://images.meesho.com/products/balaji-extra.avif"), true, "Product detail parser extracts lazy image URLs");
assert.equal(detail.price, "249", "Product detail parser extracts price");
assert.equal(detail.rating, "4.4", "Product detail parser extracts rating");
assert.equal(detail.category, "Bracelets", "Product detail parser extracts category");
assert.equal(detail.productHighlights.find((attribute) => attribute.attributeName === "Plating")?.attributeValue, "Gold Plated", "Product Highlights are dynamic attributes");
assert.equal(detail.additionalDetails.find((attribute) => attribute.attributeName === "Country of Origin")?.attributeValue, "India", "Additional Details are dynamic attributes");

const emptyIndex = emptyCatalogIndex("sync-test.xlsx");
const addResult = mergeCatalogProductFromSync({
  index: emptyIndex,
  detail,
  productUrl: detail.productUrl,
  skuExtractionRule: "default",
  scrapedAt: "2026-06-26T00:00:00.000Z"
});

assert.equal(addResult.added, true, "Catalog merge adds a new SKU");
assert.equal(addResult.sku, "SJ-BR-ME-G-Balaji 02", "Catalog merge uses Phase 2 SKU extraction");
assert.equal(addResult.index.products.length, 1, "Catalog merge writes product row");
assert.equal(addResult.index.images.length, 3, "Catalog merge writes image URL rows");
assert.equal(addResult.index.attributes.length, 6, "Catalog merge writes Product Highlights and Additional Details");

const updatedDetail = {
  ...detail,
  title: "Balaji Bracelet Gold SJ-BR-ME-G-Balaji 02",
  price: "279",
  productHighlights: [
    {
      section: "Product Highlights" as const,
      attributeName: "Color",
      attributeValue: "Antique Gold"
    }
  ]
};
const updateResult = mergeCatalogProductFromSync({
  index: addResult.index,
  detail: updatedDetail,
  productUrl: detail.productUrl,
  skuExtractionRule: "default",
  scrapedAt: "2026-06-27T00:00:00.000Z"
});

assert.equal(updateResult.updated, true, "Catalog merge updates an existing SKU");
assert.equal(updateResult.index.products[0]?.price, "279", "Catalog merge updates product fields");
assert.equal(
  updateResult.index.attributes.find((attribute) => attribute.attributeName === "Color")?.attributeValue,
  "Antique Gold",
  "Catalog merge replaces synced dynamic attributes"
);

const failedResult = mergeCatalogProductFromSync({
  index: updateResult.index,
  productUrl: "https://www.meesho.com/missing/p/bad",
  error: {
    errorType: "PRODUCT_URL_FAILED",
    message: "Product page did not load.",
    rawValue: "HTTP 500"
  }
});

assert.equal(failedResult.failed, true, "Catalog merge marks failed product URL");
assert.equal(failedResult.index.errors[0]?.errorType, "PRODUCT_URL_FAILED", "Failed product URL becomes an error row");

const brokenImageResult = mergeCatalogProductFromSync({
  index: updateResult.index,
  detail: {
    ...detail,
    imageUrls: ["https://images.meesho.com/products/good.webp", "not-a-url"],
    mainImageUrl: "https://images.meesho.com/products/good.webp"
  },
  productUrl: detail.productUrl,
  skuExtractionRule: "default"
});

assert.equal(brokenImageResult.brokenImageUrlCount, 1, "Catalog merge counts broken image URL values");
assert.equal(
  brokenImageResult.index.images.some((image) => image.status === "broken"),
  true,
  "Catalog merge marks invalid image URLs as broken without downloading images"
);

console.log("Catalog sync tests passed.");
