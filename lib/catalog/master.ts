import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeSkuForMatching } from "@/lib/sku";
import { extractSkuFromTitle } from "./sku-extraction";

export const catalogStorageDir = join(process.cwd(), "storage", "catalog");
export const catalogMasterPath = join(catalogStorageDir, "meesho_catalog_master.xlsx");
export const catalogIndexPath = join(catalogStorageDir, "catalog-index.json");

export const productSheetName = "Products";
export const imagesSheetName = "Images";
export const attributesSheetName = "Attributes";
export const errorsSheetName = "Errors";

export const productHeaders = [
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
] as const;

export const imageHeaders = ["sku", "image_no", "image_url", "status", "last_checked_at"] as const;
export const attributeHeaders = ["sku", "section", "attribute_name", "attribute_value"] as const;
export const errorHeaders = ["row_no", "sku", "error_type", "message", "raw_value"] as const;

export type CatalogProduct = {
  rowNo: number;
  sku: string;
  rawSku: string;
  skuSource: "sheet" | "title";
  title: string;
  productUrl: string;
  mainImageUrl: string;
  price: string;
  rating: string;
  category: string;
  status: string;
  lastScrapedAt: string;
  lastCheckedAt: string;
  notes: string;
  skuSearch: string;
  titleSearch: string;
};

export type CatalogImage = {
  rowNo: number;
  sku: string;
  imageNo: number;
  imageUrl: string;
  status: string;
  lastCheckedAt: string;
};

export type CatalogAttribute = {
  rowNo: number;
  sku: string;
  section: string;
  attributeName: string;
  attributeValue: string;
};

export type CatalogImportError = {
  rowNo: number;
  sku: string;
  errorType: string;
  message: string;
  rawValue: string;
};

export type CatalogSummary = {
  productCount: number;
  productImageUrlCount: number;
  imageRowCount: number;
  imageUrlCount: number;
  attributeCount: number;
  missingSkuCount: number;
  extractedSkuCount: number;
  invalidRowCount: number;
};

export type CatalogIndex = {
  version: 1;
  generatedAt: string;
  sourceFileName: string;
  products: CatalogProduct[];
  images: CatalogImage[];
  attributes: CatalogAttribute[];
  errors: CatalogImportError[];
  summary: CatalogSummary;
  lastImport: {
    fileName: string;
    importedAt: string;
    status: "IMPORTED" | "IMPORTED_WITH_ERRORS";
  } | null;
};

export type CatalogSearchResult = CatalogProduct & {
  images: CatalogImage[];
  attributes: CatalogAttribute[];
  productHighlights: CatalogAttribute[];
  additionalDetails: CatalogAttribute[];
};

type RawSheetRow<T extends readonly string[]> = {
  rowNo: number;
  values: Record<T[number], string>;
};

type ParsedWorkbookRows = {
  productRows: RawSheetRow<typeof productHeaders>[];
  imageRows: RawSheetRow<typeof imageHeaders>[];
  attributeRows: RawSheetRow<typeof attributeHeaders>[];
  errors: CatalogImportError[];
};

const defaultSearchLimit = 25;
const maxSearchLimit = 50;

function nowIso() {
  return new Date().toISOString();
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellToString(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if ("text" in value && value.text) {
      return String(value.text);
    }

    if ("result" in value && value.result !== undefined) {
      return String(value.result);
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }

    if ("hyperlink" in value && value.hyperlink) {
      return String(value.hyperlink);
    }
  }

  return String(value);
}

function isHttpUrl(value: string) {
  if (!value) {
    return true;
  }

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function rawValue(values: Record<string, string>) {
  return JSON.stringify(values);
}

function addError(errors: CatalogImportError[], error: CatalogImportError) {
  errors.push(error);
}

function missingColumns<T extends readonly string[]>(worksheet: ExcelJS.Worksheet | undefined, headers: T) {
  if (!worksheet) {
    return [...headers];
  }

  const headerValues = worksheet.getRow(1).values as ExcelJS.CellValue[];
  const presentHeaders = new Set(headerValues.slice(1).map((header) => normalizeHeader(cellToString(header))));
  return headers.filter((header) => !presentHeaders.has(normalizeHeader(header)));
}

function readSheetRows<T extends readonly string[]>(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: T,
  errors: CatalogImportError[]
): RawSheetRow<T>[] {
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    addError(errors, {
      rowNo: 1,
      sku: "",
      errorType: "MISSING_SHEET",
      message: `Sheet "${sheetName}" is required.`,
      rawValue: sheetName
    });
    return [];
  }

  const missing = missingColumns(worksheet, headers);

  for (const column of missing) {
    addError(errors, {
      rowNo: 1,
      sku: "",
      errorType: "MISSING_COLUMN",
      message: `Sheet "${sheetName}" is missing "${column}".`,
      rawValue: column
    });
  }

  const headerValues = worksheet.getRow(1).values as ExcelJS.CellValue[];
  const headerIndexes = new Map<string, number>();
  headerValues.slice(1).forEach((header, index) => {
    const normalizedHeader = normalizeHeader(cellToString(header));

    if (normalizedHeader) {
      headerIndexes.set(normalizedHeader, index + 1);
    }
  });

  const rows: RawSheetRow<T>[] = [];

  worksheet.eachRow((row, rowNo) => {
    if (rowNo === 1) {
      return;
    }

    const values = {} as Record<T[number], string>;

    for (const header of headers) {
      const typedHeader = header as T[number];
      const columnIndex = headerIndexes.get(normalizeHeader(header));
      const value = columnIndex ? cellToString(row.getCell(columnIndex).value).trim() : "";
      values[typedHeader] = value;
    }

    const hasValue = Object.values(values).some(Boolean);

    if (hasValue) {
      rows.push({ rowNo, values });
    }
  });

  return rows;
}

function parseRawRows(workbook: ExcelJS.Workbook): ParsedWorkbookRows {
  const errors: CatalogImportError[] = [];

  return {
    productRows: readSheetRows(workbook, productSheetName, productHeaders, errors),
    imageRows: readSheetRows(workbook, imagesSheetName, imageHeaders, errors),
    attributeRows: readSheetRows(workbook, attributesSheetName, attributeHeaders, errors),
    errors
  };
}

function emptySummary(): CatalogSummary {
  return {
    productCount: 0,
    productImageUrlCount: 0,
    imageRowCount: 0,
    imageUrlCount: 0,
    attributeCount: 0,
    missingSkuCount: 0,
    extractedSkuCount: 0,
    invalidRowCount: 0
  };
}

function emptyIndex(sourceFileName = "meesho_catalog_master.xlsx"): CatalogIndex {
  return {
    version: 1,
    generatedAt: nowIso(),
    sourceFileName,
    products: [],
    images: [],
    attributes: [],
    errors: [],
    summary: emptySummary(),
    lastImport: null
  };
}

function parseProducts(rows: RawSheetRow<typeof productHeaders>[], errors: CatalogImportError[]) {
  const products: CatalogProduct[] = [];
  const seenSkus = new Set<string>();
  let missingSkuCount = 0;
  let extractedSkuCount = 0;

  for (const row of rows) {
    const rawSku = normalizeSkuForMatching(row.values.sku);
    const title = row.values.title;
    const extractedSku = rawSku ? "" : extractSkuFromTitle(title).sku;
    const sku = rawSku || extractedSku;

    if (!sku) {
      missingSkuCount += 1;
      addError(errors, {
        rowNo: row.rowNo,
        sku: "",
        errorType: "MISSING_SKU",
        message: "SKU is required or must be extractable from the product title.",
        rawValue: rawValue(row.values)
      });
      continue;
    }

    if (!rawSku) {
      extractedSkuCount += 1;
    }

    if (seenSkus.has(sku)) {
      addError(errors, {
        rowNo: row.rowNo,
        sku,
        errorType: "DUPLICATE_SKU",
        message: `Duplicate SKU "${sku}" was skipped in the catalog index.`,
        rawValue: rawValue(row.values)
      });
      continue;
    }

    for (const [fieldName, value] of [
      ["product_url", row.values.product_url],
      ["main_image_url", row.values.main_image_url]
    ] as const) {
      if (!isHttpUrl(value)) {
        addError(errors, {
          rowNo: row.rowNo,
          sku,
          errorType: "INVALID_URL",
          message: `${fieldName} must be a valid http:// or https:// URL.`,
          rawValue: value
        });
      }
    }

    seenSkus.add(sku);
    products.push({
      rowNo: row.rowNo,
      sku,
      rawSku,
      skuSource: rawSku ? "sheet" : "title",
      title,
      productUrl: row.values.product_url,
      mainImageUrl: row.values.main_image_url,
      price: row.values.price,
      rating: row.values.rating,
      category: row.values.category,
      status: row.values.status,
      lastScrapedAt: row.values.last_scraped_at,
      lastCheckedAt: row.values.last_checked_at,
      notes: row.values.notes,
      skuSearch: sku.toLowerCase(),
      titleSearch: title.toLowerCase()
    });
  }

  return { products, missingSkuCount, extractedSkuCount };
}

function parseImages(rows: RawSheetRow<typeof imageHeaders>[], productSkus: Set<string>, errors: CatalogImportError[]) {
  const images: CatalogImage[] = [];
  const imageCountBySku = new Map<string, number>();

  for (const row of rows) {
    const sku = normalizeSkuForMatching(row.values.sku);
    const imageUrl = row.values.image_url;

    if (!sku) {
      addError(errors, {
        rowNo: row.rowNo,
        sku: "",
        errorType: "MISSING_IMAGE_SKU",
        message: "Image rows must include SKU.",
        rawValue: rawValue(row.values)
      });
      continue;
    }

    if (!productSkus.has(sku)) {
      addError(errors, {
        rowNo: row.rowNo,
        sku,
        errorType: "UNKNOWN_IMAGE_SKU",
        message: `Image row references SKU "${sku}" that is not present in Products.`,
        rawValue: rawValue(row.values)
      });
    }

    if (!imageUrl) {
      addError(errors, {
        rowNo: row.rowNo,
        sku,
        errorType: "MISSING_IMAGE_URL",
        message: "Image URL is required.",
        rawValue: rawValue(row.values)
      });
      continue;
    }

    if (!isHttpUrl(imageUrl)) {
      addError(errors, {
        rowNo: row.rowNo,
        sku,
        errorType: "INVALID_IMAGE_URL",
        message: "Image URL must be a valid http:// or https:// URL.",
        rawValue: imageUrl
      });
      continue;
    }

    const nextImageNo = (imageCountBySku.get(sku) ?? 0) + 1;
    const parsedImageNo = Number.parseInt(row.values.image_no, 10);
    imageCountBySku.set(sku, nextImageNo);
    images.push({
      rowNo: row.rowNo,
      sku,
      imageNo: Number.isFinite(parsedImageNo) && parsedImageNo > 0 ? parsedImageNo : nextImageNo,
      imageUrl,
      status: row.values.status,
      lastCheckedAt: row.values.last_checked_at
    });
  }

  return images;
}

function parseAttributes(rows: RawSheetRow<typeof attributeHeaders>[], productSkus: Set<string>, errors: CatalogImportError[]) {
  const attributes: CatalogAttribute[] = [];

  for (const row of rows) {
    const sku = normalizeSkuForMatching(row.values.sku);
    const section = row.values.section.trim();
    const attributeName = row.values.attribute_name.trim();

    if (!sku) {
      addError(errors, {
        rowNo: row.rowNo,
        sku: "",
        errorType: "MISSING_ATTRIBUTE_SKU",
        message: "Attribute rows must include SKU.",
        rawValue: rawValue(row.values)
      });
      continue;
    }

    if (!productSkus.has(sku)) {
      addError(errors, {
        rowNo: row.rowNo,
        sku,
        errorType: "UNKNOWN_ATTRIBUTE_SKU",
        message: `Attribute row references SKU "${sku}" that is not present in Products.`,
        rawValue: rawValue(row.values)
      });
    }

    if (!section || !attributeName) {
      addError(errors, {
        rowNo: row.rowNo,
        sku,
        errorType: "INVALID_ATTRIBUTE",
        message: "Attribute section and attribute_name are required.",
        rawValue: rawValue(row.values)
      });
      continue;
    }

    attributes.push({
      rowNo: row.rowNo,
      sku,
      section,
      attributeName,
      attributeValue: row.values.attribute_value
    });
  }

  return attributes;
}

function buildIndexFromRows(rows: ParsedWorkbookRows, sourceFileName: string, importedAt: string): CatalogIndex {
  const errors = [...rows.errors];
  const { products, missingSkuCount, extractedSkuCount } = parseProducts(rows.productRows, errors);
  const productSkus = new Set(products.map((product) => product.sku));
  const images = parseImages(rows.imageRows, productSkus, errors);
  const attributes = parseAttributes(rows.attributeRows, productSkus, errors);
  const productImageUrlCount = products.filter((product) => product.mainImageUrl).length;
  const summary: CatalogSummary = {
    productCount: products.length,
    productImageUrlCount,
    imageRowCount: images.length,
    imageUrlCount: productImageUrlCount + images.length,
    attributeCount: attributes.length,
    missingSkuCount,
    extractedSkuCount,
    invalidRowCount: errors.length
  };

  return {
    version: 1,
    generatedAt: importedAt,
    sourceFileName,
    products,
    images,
    attributes,
    errors,
    summary,
    lastImport: {
      fileName: sourceFileName,
      importedAt,
      status: errors.length > 0 ? "IMPORTED_WITH_ERRORS" : "IMPORTED"
    }
  };
}

export async function parseCatalogWorkbook(buffer: Buffer, sourceFileName = "meesho_catalog_master.xlsx") {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return buildIndexFromRows(parseRawRows(workbook), sourceFileName, nowIso());
}

function addHeaderRow<T extends readonly string[]>(worksheet: ExcelJS.Worksheet, headers: T) {
  worksheet.addRow(headers);
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach((column) => {
    column.width = 22;
  });
}

export async function buildCatalogWorkbookBuffer(index: CatalogIndex = emptyIndex()) {
  const workbook = new ExcelJS.Workbook();
  const products = workbook.addWorksheet(productSheetName);
  const images = workbook.addWorksheet(imagesSheetName);
  const attributes = workbook.addWorksheet(attributesSheetName);
  const errors = workbook.addWorksheet(errorsSheetName);

  addHeaderRow(products, productHeaders);
  addHeaderRow(images, imageHeaders);
  addHeaderRow(attributes, attributeHeaders);
  addHeaderRow(errors, errorHeaders);

  for (const product of index.products) {
    products.addRow([
      product.sku,
      product.title,
      product.productUrl,
      product.mainImageUrl,
      product.price,
      product.rating,
      product.category,
      product.status,
      product.lastScrapedAt,
      product.lastCheckedAt,
      product.notes
    ]);
  }

  for (const image of index.images) {
    images.addRow([image.sku, image.imageNo, image.imageUrl, image.status, image.lastCheckedAt]);
  }

  for (const attribute of index.attributes) {
    attributes.addRow([attribute.sku, attribute.section, attribute.attributeName, attribute.attributeValue]);
  }

  for (const error of index.errors) {
    errors.addRow([error.rowNo, error.sku, error.errorType, error.message, error.rawValue]);
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output as ArrayBuffer);
}

export async function saveCatalogMaster(buffer: Buffer, sourceFileName: string) {
  const index = await parseCatalogWorkbook(buffer, sourceFileName);
  const normalizedWorkbook = await buildCatalogWorkbookBuffer(index);

  await mkdir(catalogStorageDir, { recursive: true });
  await Promise.all([
    writeFile(catalogMasterPath, normalizedWorkbook),
    writeFile(catalogIndexPath, JSON.stringify(index, null, 2), "utf8")
  ]);

  return index;
}

export async function loadCatalogIndex() {
  if (!existsSync(catalogIndexPath)) {
    return emptyIndex();
  }

  try {
    const index = JSON.parse(await readFile(catalogIndexPath, "utf8")) as CatalogIndex;
    return index.version === 1 ? index : emptyIndex();
  } catch {
    return emptyIndex();
  }
}

export async function catalogMasterExists() {
  return existsSync(catalogMasterPath);
}

function safeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) {
    return defaultSearchLimit;
  }

  return Math.min(Math.max(1, Math.trunc(limit)), maxSearchLimit);
}

function sectionIs(attribute: CatalogAttribute, section: string) {
  return attribute.section.toLowerCase() === section.toLowerCase();
}

function resultForProduct(index: CatalogIndex, product: CatalogProduct): CatalogSearchResult {
  const images = index.images.filter((image) => image.sku === product.sku);
  const attributes = index.attributes.filter((attribute) => attribute.sku === product.sku);

  return {
    ...product,
    images,
    attributes,
    productHighlights: attributes.filter((attribute) => sectionIs(attribute, "Product Highlights")),
    additionalDetails: attributes.filter((attribute) => sectionIs(attribute, "Additional Details"))
  };
}

function dedupeProducts(products: CatalogProduct[]) {
  const seen = new Set<string>();
  const deduped: CatalogProduct[] = [];

  for (const product of products) {
    if (seen.has(product.sku)) {
      continue;
    }

    seen.add(product.sku);
    deduped.push(product);
  }

  return deduped;
}

export function searchCatalogByExactSku(index: CatalogIndex, sku: string) {
  const normalizedSku = normalizeSkuForMatching(sku);

  if (!normalizedSku) {
    return null;
  }

  const product = index.products.find((item) => item.sku === normalizedSku);
  return product ? resultForProduct(index, product) : null;
}

export function searchCatalogByPartialSku(index: CatalogIndex, query: string, limit?: number) {
  const normalizedQuery = normalizeSkuForMatching(query).toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return index.products
    .filter((product) => product.skuSearch.includes(normalizedQuery))
    .slice(0, safeLimit(limit))
    .map((product) => resultForProduct(index, product));
}

export function searchCatalogByTitleKeyword(index: CatalogIndex, query: string, limit?: number) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  return index.products
    .filter((product) => terms.every((term) => product.titleSearch.includes(term)))
    .slice(0, safeLimit(limit))
    .map((product) => resultForProduct(index, product));
}

export function searchCatalog(
  index: CatalogIndex,
  input: { query?: string; sku?: string; title?: string; limit?: number }
) {
  const limit = safeLimit(input.limit);
  const candidates: CatalogProduct[] = [];
  const exactSku = input.sku ? searchCatalogByExactSku(index, input.sku) : input.query ? searchCatalogByExactSku(index, input.query) : null;

  if (exactSku) {
    candidates.push(exactSku);
  }

  if (input.sku) {
    candidates.push(...searchCatalogByPartialSku(index, input.sku, limit).map((result) => result));
  }

  if (input.title) {
    candidates.push(...searchCatalogByTitleKeyword(index, input.title, limit).map((result) => result));
  }

  if (input.query && !input.sku && !input.title) {
    candidates.push(...searchCatalogByPartialSku(index, input.query, limit).map((result) => result));
    candidates.push(...searchCatalogByTitleKeyword(index, input.query, limit).map((result) => result));
  }

  return dedupeProducts(candidates).slice(0, limit).map((product) => resultForProduct(index, product));
}

export function catalogExportFilename() {
  return `meesho-catalog-master-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
