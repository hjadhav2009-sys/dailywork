import ExcelJS from "exceljs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

const productHeaders = [
  "sku",
  "title",
  "product_url",
  "main_image_url",
  "price",
  "rating",
  "category",
  "status",
  "last_scraped_at",
  "last_checked_at",
  "notes"
];
const imageHeaders = ["sku", "image_no", "image_url", "status", "last_checked_at"];
const attributeHeaders = ["sku", "section", "attribute_name", "attribute_value"];
const errorHeaders = ["row_no", "sku", "error_type", "message", "raw_value"];

function addHeader(worksheet, headers) {
  worksheet.addRow(headers);
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns = headers.map(() => ({ width: 24 }));
}

async function buildCatalog() {
  const workbook = new ExcelJS.Workbook();
  const products = workbook.addWorksheet("Products");
  const images = workbook.addWorksheet("Images");
  const attributes = workbook.addWorksheet("Attributes");
  const errors = workbook.addWorksheet("Errors");

  addHeader(products, productHeaders);
  addHeader(images, imageHeaders);
  addHeader(attributes, attributeHeaders);
  addHeader(errors, errorHeaders);

  const skus = [
    ["QA-BR-GOLD-01", "Balaji Bracelet Gold QA-BR-GOLD-01", "Bracelet", "Gold", "Free Size", "https://images.meesho.com/qa/br-gold-main.jpg"],
    ["QA-BR-BROWN-02", "Men Brown Leather Bracelet QA-BR-BROWN-02", "Bracelet", "Brown", "Adjustable", "https://images.meesho.com/qa/br-brown-main.jpg"],
    ["QA-CH-BLUE-03", "Blue Chain Product QA-CH-BLUE-03", "Chain", "Blue", "18 inch", "https://images.meesho.com/qa/ch-blue-main.jpg"],
    ["QA-RG-SILVER-04", "Silver Ring Combo QA-RG-SILVER-04", "Ring", "Silver", "Free Size", "https://images.meesho.com/qa/rg-silver-main.jpg"],
    ["QA-NK-PEARL-05", "Pearl Necklace QA-NK-PEARL-05", "Necklace", "White", "One Size", "https://images.meesho.com/qa/nk-pearl-main.jpg"],
    ["QA-ER-ROSE-06", "Rose Gold Earrings QA-ER-ROSE-06", "Earrings", "Rose Gold", "One Size", "https://images.meesho.com/qa/er-rose-main.jpg"],
    ["QA-KD-BLACK-07", "Black Kada QA-KD-BLACK-07", "Kada", "Black", "Adjustable", "https://images.meesho.com/qa/kd-black-main.jpg"],
    ["QA-BR-RED-08", "Red Thread Bracelet QA-BR-RED-08", "Bracelet", "Red", "Free Size", "https://images.meesho.com/qa/br-red-main.jpg"],
    ["QA-CH-GREEN-09", "Green Chain QA-CH-GREEN-09", "Chain", "Green", "20 inch", "https://images.meesho.com/qa/ch-green-main.jpg"],
    ["QA-ER-GOLD-10", "Gold Hoop Earrings QA-ER-GOLD-10", "Earrings", "Gold", "One Size", "https://images.meesho.com/qa/er-gold-main.jpg"],
    ["QA-BROKEN-11", "Broken Image Test Product QA-BROKEN-11", "Bracelet", "Copper", "Free Size", ""],
    ["QA-MISSIMG-12", "Missing Main Image Product QA-MISSIMG-12", "Pendant", "Silver", "One Size", ""]
  ];

  skus.forEach(([sku, title, category, color, size, imageUrl], index) => {
    products.addRow([
      sku,
      title,
      `https://www.meesho.com/${sku.toLowerCase()}/p/qa${index + 1}`,
      imageUrl,
      String(149 + index * 10),
      index % 3 === 0 ? "4.2" : "4.5",
      category,
      "active",
      "",
      "",
      "Phase 5 QA fixture"
    ]);
    images.addRow([
      sku,
      1,
      imageUrl || `https://images.meesho.com/qa/${sku.toLowerCase()}-fallback.jpg`,
      sku === "QA-BROKEN-11" ? "broken" : "active",
      ""
    ]);
    attributes.addRow([sku, "Product Highlights", "Color", color]);
    attributes.addRow([sku, "Product Highlights", "Type", category]);
    attributes.addRow([sku, "Additional Details", "Sizing", size]);
    attributes.addRow([sku, "Additional Details", "Country of Origin", "India"]);
  });

  await workbook.xlsx.writeFile(join(fixtureDir, "small-catalog-master.xlsx"));
}

async function buildManifest() {
  const workbook = new ExcelJS.Workbook();
  const manifest = workbook.addWorksheet("Manifest");
  addHeader(manifest, ["AWB", "SKU", "Qty", "Courier", "Sub Order No", "Color", "Size", "Product Description", "Payment Type"]);
  manifest.addRow(["QA-AWB-0001", "QA-BR-GOLD-01", 2, "Delhivery", "QA-SO-0001", "Gold", "Free Size", "Balaji Bracelet Gold", "PREPAID"]);
  manifest.addRow(["QA-AWB-0002", "QA-BR-GOLD-01", 1, "Delhivery", "QA-SO-0002", "Gold", "Free Size", "Balaji Bracelet Gold", "COD"]);
  manifest.addRow(["QA-AWB-0003", "QA-CH-BLUE-03", 1, "Shadowfax", "QA-SO-0003", "Blue", "18 inch", "Blue Chain Product", "PREPAID"]);
  manifest.addRow(["QA-AWB-0004", "QA-BROKEN-11", 1, "Xpress Bees", "QA-SO-0004", "Copper", "Free Size", "Broken Image Test Product", "UNKNOWN"]);
  manifest.addRow(["QA-AWB-0005", "QA-NOT-CATALOG", 1, "Delhivery", "QA-SO-0005", "Black", "Free Size", "Missing Catalog Product", "COD"]);
  manifest.addRow(["QA-AWB-0001", "QA-BR-GOLD-01", 2, "Delhivery", "QA-SO-0001", "Gold", "Free Size", "Duplicate AWB row", "PREPAID"]);

  const picklist = workbook.addWorksheet("Picklist Summary");
  addHeader(picklist, ["SKU", "Color", "Size", "Total Quantity"]);
  picklist.addRow(["QA-BR-GOLD-01", "Gold", "Free Size", 3]);
  picklist.addRow(["QA-CH-BLUE-03", "Blue", "18 inch", 1]);
  picklist.addRow(["QA-BROKEN-11", "Copper", "Free Size", 1]);
  picklist.addRow(["QA-NOT-CATALOG", "Black", "Free Size", 1]);

  await workbook.xlsx.writeFile(join(fixtureDir, "daily-manifest.xlsx"));
}

await mkdir(fixtureDir, { recursive: true });
await buildCatalog();
await buildManifest();
console.log("Phase 5 fixture workbooks generated.");
