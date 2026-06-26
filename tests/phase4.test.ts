import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { emptyActiveSkuState, nextActiveSkuState } from "../lib/catalog/active-skus";
import { emptyCatalogIndex, type CatalogIndex, type CatalogProduct } from "../lib/catalog/master";
import { catalogDetailsForSku } from "../lib/catalog/order-enrichment";
import { parseSpreadsheetRows } from "../lib/import/files";
import { parseManifestSpreadsheetRows } from "../lib/import/manifest-excel";
import { planOrderImport } from "../lib/import/orders";
import { buildPickerSkuGroups } from "../lib/operations/picking";

function productRow(sku: string, title = `${sku} title`, imageUrl = "https://images.meesho.com/product-main.jpg"): CatalogProduct {
  return {
    rowNo: 2,
    sku,
    rawSku: sku,
    skuSource: "sheet",
    title,
    productUrl: `https://www.meesho.com/${sku.toLowerCase()}/p/abc`,
    mainImageUrl: imageUrl,
    price: "199",
    rating: "4.4",
    category: "Bracelet",
    status: "active",
    lastScrapedAt: "",
    lastCheckedAt: "",
    notes: "",
    skuSearch: sku.toLowerCase(),
    titleSearch: title.toLowerCase()
  };
}

function catalogIndex(): CatalogIndex {
  const index = emptyCatalogIndex("phase4.xlsx");
  index.products = [productRow("SKU1", "Gold Bracelet SKU1"), productRow("BROKEN1", "Broken Image Product", "")];
  index.images = [
    {
      rowNo: 2,
      sku: "SKU1",
      imageNo: 1,
      imageUrl: "https://images.meesho.com/sku1-side.jpg",
      status: "active",
      lastCheckedAt: ""
    },
    {
      rowNo: 3,
      sku: "BROKEN1",
      imageNo: 1,
      imageUrl: "https://images.meesho.com/broken.jpg",
      status: "broken",
      lastCheckedAt: ""
    }
  ];
  index.attributes = [
    { rowNo: 2, sku: "SKU1", section: "Product Highlights", attributeName: "Color", attributeValue: "Gold" },
    { rowNo: 3, sku: "SKU1", section: "Additional Details", attributeName: "Sizing", attributeValue: "Free Size" }
  ];
  return index;
}

const duplicatePlan = planOrderImport(
  [],
  [
    { awb: "AWB1", sku: "SKU1", qty: 1, orderNo: "O1" },
    { awb: "AWB1", sku: "SKU1", qty: 1, orderNo: "O1" },
    { awb: "AWB2", sku: "SKU1", qty: 2, orderNo: "O2" }
  ],
  new Set(["SKU1"])
);
assert.equal(duplicatePlan.created.length, 2, "Same SKU with different AWBs imports as separate orders");
assert.equal(duplicatePlan.duplicates.length, 1, "Duplicate AWB inside a batch is skipped");

const groups = buildPickerSkuGroups(
  [
    {
      id: "o1",
      awb: "AWB1",
      sku: "SKU1",
      qty: 2,
      color: "Gold",
      size: "Free Size",
      courier: "Delhivery",
      orderNo: "O1",
      pickStatus: "READY",
      packStatus: "READY"
    },
    {
      id: "o2",
      awb: "AWB2",
      sku: "SKU1",
      qty: 3,
      color: "Gold",
      size: "Free Size",
      courier: "Delhivery",
      orderNo: "O2",
      pickStatus: "READY",
      packStatus: "READY"
    }
  ],
  [],
  [catalogDetailsForSku(catalogIndex(), "SKU1")]
);
assert.equal(groups[0]?.totalQuantity, 5, "Picker grouping sums quantity by SKU/color/size");
assert.equal(groups[0]?.orderCount, 2, "Picker grouping counts AWBs in the SKU group");
assert.equal(groups[0]?.imageUrl, "https://images.meesho.com/product-main.jpg", "Picker grouping uses catalog image when no cached mapping exists");
assert.equal(groups[0]?.catalog?.productHighlights[0]?.attributeName, "Color", "Picker grouping carries dynamic catalog highlights");

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet("Manifest");
worksheet.addRow(["AWB", "SKU", "Quantity", "Courier", "Sub Order No", "Color", "Size"]);
worksheet.addRow(["AWB100", "SKU1", "2", "Delhivery", "SO1", "Gold", "Free Size"]);
worksheet.addRow(["", "SKU2", "5", "", "", "Silver", "Free Size"]);
const buffer = await workbook.xlsx.writeBuffer();
const file = new File([buffer], "manifest.xlsx");
const rawRows = await parseSpreadsheetRows(file);
const manifestRows = parseManifestSpreadsheetRows(rawRows);
assert.equal(manifestRows[0]?.sourceType, "MANIFEST_ORDER", "Manifest Excel parser reads courier order rows");
assert.equal(manifestRows[0]?.awb, "AWB100", "Manifest Excel parser extracts AWB");
assert.equal(manifestRows[0]?.qty, 2, "Manifest Excel parser extracts quantity");
assert.equal(manifestRows[1]?.sourceType, "PICKLIST_SUMMARY", "Manifest Excel parser supports AWB-less picklist summary rows");

const index = catalogIndex();
const matchedCatalog = catalogDetailsForSku(index, "SKU1");
const missingCatalog = catalogDetailsForSku(index, "UNKNOWN1");
const brokenCatalog = catalogDetailsForSku(index, "BROKEN1");
assert.equal(matchedCatalog.missingCatalog, false, "Catalog match finds existing SKU");
assert.equal(matchedCatalog.color, "Gold", "Catalog match exposes dynamic Color attribute");
assert.equal(missingCatalog.missingCatalog, true, "Catalog match marks missing SKU");
assert.equal(brokenCatalog.brokenImage, true, "Catalog match marks broken image URL state");

const day0 = new Date("2026-06-01T10:00:00.000Z");
const day4 = new Date("2026-06-05T10:00:00.000Z");
const day6 = new Date("2026-06-07T10:00:00.000Z");
const initialState = nextActiveSkuState(emptyActiveSkuState(5, day0), [{ sku: "SKU1", qty: 2 }], {
  now: day0,
  catalogIndex: index
});
assert.equal(initialState.skus.SKU1?.active, true, "Current order SKU becomes active");
assert.equal(initialState.skus.SKU1?.quantityWindow, 2, "Active SKU state stores today quantity metadata");
const stillActive = nextActiveSkuState(initialState, [], { now: day4, catalogIndex: index });
assert.equal(stillActive.skus.SKU1?.active, true, "Active SKU stays in the 5-day loop");
const expired = nextActiveSkuState(stillActive, [], { now: day6, catalogIndex: index });
assert.equal(expired.skus.SKU1?.active, false, "Active SKU expires outside the 5-day loop");
const reactivated = nextActiveSkuState(expired, [{ sku: "SKU1", qty: 1 }], { now: day6, catalogIndex: index });
assert.equal(reactivated.skus.SKU1?.active, true, "Expired SKU reactivates when it appears in today's orders");

console.log("Phase 4 tests passed.");
