import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyActiveSkuState, nextActiveSkuState } from "../lib/catalog/active-skus";
import { parseCatalogWorkbook } from "../lib/catalog/master";
import { buildCatalogDetailsMap, catalogDetailsForSku } from "../lib/catalog/order-enrichment";
import { parseSpreadsheetRows } from "../lib/import/files";
import { parseManifestSpreadsheetRows } from "../lib/import/manifest-excel";
import { planOrderImport, type ParsedOrderImportRow } from "../lib/import/orders";
import { buildPickerSkuGroups } from "../lib/operations/picking";
import {
  buildBrokenImageUrlRows,
  buildDuplicateAwbSkippedRows,
  buildMissingCatalogSkuRows,
  buildTodayPackingRows,
  buildTodayPickingRows
} from "../lib/reports/operational-reports";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "phase5");

function fixtureFile(name: string, type = "application/octet-stream") {
  return new File([readFileSync(join(fixtureDir, name))], name, { type });
}

const catalogBuffer = readFileSync(join(fixtureDir, "small-catalog-master.xlsx"));
const catalogIndex = await parseCatalogWorkbook(catalogBuffer, "small-catalog-master.xlsx");

assert.equal(catalogIndex.summary.productCount, 12, "Phase 5 catalog fixture has 12 products");
assert.equal(catalogIndex.summary.attributeCount, 48, "Phase 5 catalog fixture includes dynamic highlights and details");
assert.equal(catalogDetailsForSku(catalogIndex, "QA-BR-GOLD-01").title, "Balaji Bracelet Gold QA-BR-GOLD-01", "Catalog fixture supports exact SKU lookup");
assert.equal(catalogDetailsForSku(catalogIndex, "QA-BROKEN-11").brokenImage, true, "Catalog fixture includes a broken image SKU");

const manifestRows = parseManifestSpreadsheetRows(await parseSpreadsheetRows(fixtureFile("daily-manifest.xlsx")));
const orderRows: ParsedOrderImportRow[] = manifestRows
  .filter((row) => row.sourceType === "MANIFEST_ORDER")
  .map((row) => ({
    rowNumber: row.rowNumber,
    awb: row.awb,
    courier: row.courier,
    sku: row.sku,
    qty: row.qty,
    color: row.color,
    size: row.size,
    orderNo: row.orderNo,
    productDescription: row.productDescription,
    paymentType: row.paymentType
  }));
const orderSkus = orderRows.map((row) => row.sku ?? "");
const catalogBySku = buildCatalogDetailsMap(catalogIndex, orderSkus);
const catalogSkus = new Set(Array.from(catalogBySku.entries()).filter(([, detail]) => !detail.missingCatalog).map(([sku]) => sku));
const imageSkus = new Set(Array.from(catalogBySku.entries()).filter(([, detail]) => detail.imageUrl && !detail.brokenImage).map(([sku]) => sku));
const brokenImageSkus = new Set(Array.from(catalogBySku.entries()).filter(([, detail]) => detail.brokenImage).map(([sku]) => sku));
const importPlan = planOrderImport([], orderRows, imageSkus, catalogSkus, brokenImageSkus, true);

assert.equal(orderRows.length, 6, "Manifest Excel fixture parses six courier rows");
assert.equal(importPlan.created.length, 5, "Workflow import creates unique AWBs only");
assert.equal(importPlan.duplicates.length, 1, "Workflow import skips duplicate AWB");
assert.equal(importPlan.missingCatalogRows.length, 1, "Workflow import flags missing catalog SKU");
assert.equal(importPlan.brokenImageRows.length, 1, "Workflow import flags broken catalog image SKU");

const picklistRows = parseManifestSpreadsheetRows(await parseSpreadsheetRows(fixtureFile("picklist-summary.csv", "text/csv")));
assert.equal(picklistRows.every((row) => row.sourceType === "PICKLIST_SUMMARY"), true, "Picklist summary CSV stays AWB-less and non-importable");
assert.equal(picklistRows.find((row) => row.sku === "QA-BR-GOLD-01")?.qty, 3, "Picklist summary fixture carries total quantity");

const activeState = nextActiveSkuState(emptyActiveSkuState(5, new Date("2026-06-20T08:00:00.000Z")), importPlan.created, {
  now: new Date("2026-06-20T08:00:00.000Z"),
  catalogIndex
});
assert.equal(activeState.skus["QA-BR-GOLD-01"]?.quantityWindow, 3, "Active SKU state counts only imported unique AWBs");
assert.equal(activeState.skus["QA-NOT-CATALOG"]?.missingCatalog, true, "Active SKU state marks missing catalog SKU");
assert.equal(activeState.skus["QA-BROKEN-11"]?.brokenImage, true, "Active SKU state marks broken image SKU");

const pickerGroups = buildPickerSkuGroups(
  importPlan.created.map((row, index) => ({
    id: `order-${index}`,
    awb: row.awb ?? "",
    sku: row.sku ?? "",
    qty: row.qty ?? 1,
    color: row.color ?? null,
    size: row.size ?? null,
    courier: row.courier ?? null,
    orderNo: row.orderNo ?? row.awb ?? "",
    productDescription: row.productDescription,
    pickStatus: "READY" as const,
    packStatus: "READY" as const
  })),
  [],
  Array.from(catalogBySku.values())
);
const goldGroup = pickerGroups.find((group) => group.sku === "QA-BR-GOLD-01");
assert.equal(goldGroup?.totalQuantity, 3, "Picker fallback groups same SKU across different AWBs");
assert.equal(goldGroup?.orderCount, 2, "Picker fallback exposes AWB count");
assert.equal(goldGroup?.imageUrl, "https://images.meesho.com/qa/br-gold-main.jpg", "Picker fallback uses catalog image URL");
assert.equal(goldGroup?.catalog?.productHighlights.some((attribute) => attribute.attributeName === "Color"), true, "Picker fallback carries catalog highlights");

const packerFallback = catalogDetailsForSku(catalogIndex, "QA-CH-BLUE-03");
assert.equal(packerFallback.imageUrl, "https://images.meesho.com/qa/ch-blue-main.jpg", "Packer fallback can use catalog image URL");
assert.equal(packerFallback.additionalDetails.find((attribute) => attribute.attributeName === "Sizing")?.attributeValue, "18 inch", "Packer fallback carries catalog detail attributes");

const pickingRows = buildTodayPickingRows(
  importPlan.created.map((row) => ({
    sku: row.sku ?? "",
    awb: row.awb ?? "",
    qty: row.qty ?? 1,
    color: row.color ?? null,
    size: row.size ?? null
  })),
  catalogIndex
);
assert.equal(pickingRows.find((row) => row[0] === "QA-BR-GOLD-01")?.[4], 3, "Today picking report groups quantity by SKU");
assert.equal(pickingRows.find((row) => row[0] === "QA-NOT-CATALOG")?.[7], true, "Today picking report marks missing catalog SKU");

const packingRows = buildTodayPackingRows(
  importPlan.created.map((row) => ({
    accountName: "QA Account",
    awb: row.awb ?? "",
    orderNo: row.orderNo ?? "",
    sku: row.sku ?? "",
    qty: row.qty ?? 1,
    color: row.color ?? null,
    size: row.size ?? null,
    courier: row.courier ?? null,
    packStatus: "READY",
    productDescription: row.productDescription ?? null,
    imageUrl: catalogBySku.get(row.sku ?? "")?.imageUrl ?? null
  }))
);
assert.equal(packingRows[0]?.[0], "QA Account", "Today packing report includes account name");
assert.equal(packingRows.some((row) => row[1] === "QA-AWB-0004" && row[10] === "https://images.meesho.com/qa/qa-broken-11-fallback.jpg"), true, "Today packing report includes catalog fallback URL");

const activeRecords = Object.values(activeState.skus);
assert.equal(buildMissingCatalogSkuRows(activeRecords).some((row) => row[0] === "QA-NOT-CATALOG"), true, "Missing catalog report includes missing SKU");
assert.equal(buildBrokenImageUrlRows(activeRecords).some((row) => row[0] === "QA-BROKEN-11" && row[3] === "broken"), true, "Broken image report includes broken SKU");
assert.deepEqual(
  buildDuplicateAwbSkippedRows([
    {
      accountName: "QA Account",
      batchFileName: "daily-manifest.xlsx",
      rowNumber: 7,
      message: "AWB QA-AWB-0001 already exists with no safe changes.",
      rawData: "{\"awb\":\"QA-AWB-0001\"}",
      createdAt: "2026-06-20T08:00:00.000Z"
    }
  ])[0],
  [
    "QA Account",
    "daily-manifest.xlsx",
    7,
    "AWB QA-AWB-0001 already exists with no safe changes.",
    "{\"awb\":\"QA-AWB-0001\"}",
    "2026-06-20T08:00:00.000Z"
  ],
  "Duplicate AWB skipped report formats issue rows"
);

const pdfLike = JSON.parse(readFileSync(join(fixtureDir, "manifest-pdf-like-parsed.json"), "utf8")) as {
  manifestOrders: Array<{ awb: string; sku: string }>;
  picklistSummaryRows: Array<{ sku: string; totalQuantity: number }>;
};
assert.equal(pdfLike.manifestOrders[0]?.awb, "QA-AWB-0001", "PDF-like parsed fixture includes courier AWB rows");
assert.equal(pdfLike.picklistSummaryRows[0]?.totalQuantity, 3, "PDF-like parsed fixture includes picklist summary rows");

console.log("Phase 5 workflow tests passed.");
