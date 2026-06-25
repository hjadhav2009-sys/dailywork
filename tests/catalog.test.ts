import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  attributeHeaders,
  attributesSheetName,
  errorHeaders,
  errorsSheetName,
  imageHeaders,
  imagesSheetName,
  parseCatalogWorkbook,
  productHeaders,
  productSheetName,
  searchCatalog,
  searchCatalogByExactSku,
  searchCatalogByPartialSku,
  searchCatalogByTitleKeyword
} from "../lib/catalog/master";
import { extractSkuFromTitle } from "../lib/catalog/sku-extraction";

assert.equal(
  extractSkuFromTitle("Men Brown Leather Bracelet ShivBr2025346").sku,
  "ShivBr2025346",
  "Default SKU extraction uses the final SKU-like title part"
);
assert.equal(
  extractSkuFromTitle("Balaji Bracelet Gold SJ-BR-ME-G-Balaji 02").sku,
  "SJ-BR-ME-G-Balaji 02",
  "Default SKU extraction keeps compact hyphen SKU plus trailing number"
);
assert.equal(
  extractSkuFromTitle("Blue Chain Product SJ-CH-PL-B-EE06").sku,
  "SJ-CH-PL-B-EE06",
  "Default SKU extraction keeps final hyphenated SKU"
);
assert.equal(extractSkuFromTitle({ title: "Product [SQ-BR-01]", rule: "square-brackets" }).sku, "SQ-BR-01", "Square bracket SKU rule works");
assert.equal(extractSkuFromTitle({ title: "Product (RD-BR-02)", rule: "round-brackets" }).sku, "RD-BR-02", "Round bracket SKU rule works");
assert.equal(extractSkuFromTitle({ title: "Product ABC-123", rule: "last-word" }).sku, "ABC-123", "Last word SKU rule works");
assert.equal(extractSkuFromTitle({ title: "Product ABC-123", rule: "after-last-hyphen" }).sku, "123", "After last hyphen SKU rule works");
assert.equal(
  extractSkuFromTitle({ title: "Product code: ZX-900", rule: "custom-regex", customRegex: "code:\\s*(.+)$" }).sku,
  "ZX-900",
  "Custom regex SKU placeholder works"
);

async function catalogWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  const products = workbook.addWorksheet(productSheetName);
  const images = workbook.addWorksheet(imagesSheetName);
  const attributes = workbook.addWorksheet(attributesSheetName);
  const errors = workbook.addWorksheet(errorsSheetName);

  products.addRow(productHeaders);
  products.addRow([
    "",
    "Men Brown Leather Bracelet ShivBr2025346",
    "https://www.meesho.com/product/shiv",
    "https://images.meesho.com/shiv-main.jpg",
    "199",
    "4.4",
    "Bracelet",
    "active",
    "",
    "",
    "Extract SKU from title"
  ]);
  products.addRow([
    "SJ-BR-ME-G-Balaji 02",
    "Balaji Bracelet Gold SJ-BR-ME-G-Balaji 02",
    "https://www.meesho.com/product/balaji",
    "",
    "249",
    "4.7",
    "Bracelet",
    "active",
    "",
    "",
    ""
  ]);
  products.addRow([
    "SJ-CH-PL-B-EE06",
    "Blue Chain Product SJ-CH-PL-B-EE06",
    "https://www.meesho.com/product/blue-chain",
    "not-a-url",
    "149",
    "4.1",
    "Chain",
    "active",
    "",
    "",
    ""
  ]);
  products.addRow(["", "", "", "", "", "", "", "", "", "", "Missing SKU test row"]);

  images.addRow(imageHeaders);
  images.addRow(["ShivBr2025346", "1", "https://images.meesho.com/shiv-1.jpg", "active", ""]);
  images.addRow(["SJ-BR-ME-G-Balaji 02", "1", "https://images.meesho.com/balaji-1.jpg", "active", ""]);
  images.addRow(["SJ-CH-PL-B-EE06", "1", "ftp://bad.example/image.jpg", "broken", ""]);

  attributes.addRow(attributeHeaders);
  attributes.addRow(["ShivBr2025346", "Product Highlights", "Color", "Brown"]);
  attributes.addRow(["ShivBr2025346", "Additional Details", "Base Metal", "Leather"]);
  attributes.addRow(["SJ-BR-ME-G-Balaji 02", "Product Highlights", "Plating", "Gold"]);
  attributes.addRow(["SJ-BR-ME-G-Balaji 02", "Additional Details", "Country of Origin", "India"]);
  attributes.addRow(["SJ-CH-PL-B-EE06", "", "Type", "Chain"]);

  errors.addRow(errorHeaders);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output as ArrayBuffer);
}

const index = await parseCatalogWorkbook(await catalogWorkbookBuffer(), "catalog-test.xlsx");

assert.equal(index.summary.productCount, 3, "Catalog parser indexes valid product rows");
assert.equal(index.summary.extractedSkuCount, 1, "Catalog parser extracts SKU from title when Products.sku is empty");
assert.equal(index.summary.missingSkuCount, 1, "Catalog parser counts rows without SKU or extractable title SKU");
assert.equal(index.summary.imageRowCount, 2, "Catalog parser keeps valid image URL rows only");
assert.equal(index.summary.attributeCount, 4, "Catalog parser keeps dynamic attributes with valid sections");
assert.equal(
  index.errors.some((error) => error.errorType === "INVALID_URL" && error.sku === "SJ-CH-PL-B-EE06"),
  true,
  "Catalog parser flags invalid product URLs"
);
assert.equal(
  index.errors.some((error) => error.errorType === "INVALID_IMAGE_URL" && error.sku === "SJ-CH-PL-B-EE06"),
  true,
  "Catalog parser flags invalid image URL rows"
);
assert.equal(
  index.errors.some((error) => error.errorType === "INVALID_ATTRIBUTE" && error.sku === "SJ-CH-PL-B-EE06"),
  true,
  "Catalog parser flags invalid dynamic attribute rows"
);

const shiv = searchCatalogByExactSku(index, "ShivBr2025346");
assert.equal(shiv?.productHighlights[0]?.attributeName, "Color", "Search result exposes Product Highlights dynamically");
assert.equal(shiv?.additionalDetails[0]?.attributeName, "Base Metal", "Search result exposes Additional Details dynamically");
assert.equal(searchCatalogByPartialSku(index, "Balaji").at(0)?.sku, "SJ-BR-ME-G-Balaji 02", "Partial SKU search finds hyphen SKU");
assert.equal(searchCatalogByTitleKeyword(index, "Blue Chain").at(0)?.sku, "SJ-CH-PL-B-EE06", "Title keyword search finds catalog product");
assert.equal(searchCatalog(index, { query: "bracelet", limit: 20 }).length, 2, "Combined search dedupes title matches");

console.log("Catalog tests passed.");
