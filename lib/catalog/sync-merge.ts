import { normalizeSkuForMatching } from "@/lib/sku";
import type { CatalogAttribute, CatalogImage, CatalogImportError, CatalogIndex, CatalogProduct } from "./master";
import { emptyCatalogIndex, normalizeCatalogIndex } from "./master";
import type { MeeshoProductDetail } from "./sync-parser";
import { extractSkuFromTitle, type SkuExtractionRule } from "./sku-extraction";

export type CatalogMergeInput = {
  index: CatalogIndex;
  detail?: MeeshoProductDetail;
  productUrl: string;
  error?: {
    errorType: string;
    message: string;
    rawValue?: string;
  };
  skuExtractionRule?: SkuExtractionRule;
  customRegex?: string;
  scrapedAt?: string;
};

export type CatalogMergeResult = {
  index: CatalogIndex;
  sku?: string;
  added: boolean;
  updated: boolean;
  failed: boolean;
  brokenImageUrlCount: number;
  message: string;
};

function isHttpUrl(value: string) {
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

function brokenImageCount(imageUrls: string[]) {
  return imageUrls.filter((url) => !isHttpUrl(url)).length;
}

function imageStatus(url: string) {
  return isHttpUrl(url) ? "active" : "broken";
}

function toCatalogError(input: {
  rowNo?: number;
  sku?: string;
  errorType: string;
  message: string;
  rawValue?: string;
}): CatalogImportError {
  return {
    rowNo: input.rowNo ?? 0,
    sku: input.sku ?? "",
    errorType: input.errorType,
    message: input.message,
    rawValue: input.rawValue ?? ""
  };
}

function productForDetail(input: {
  detail: MeeshoProductDetail;
  sku: string;
  skuSource: CatalogProduct["skuSource"];
  scrapedAt: string;
  existing?: CatalogProduct;
}): CatalogProduct {
  const existing = input.existing;

  return {
    rowNo: existing?.rowNo ?? 0,
    sku: input.sku,
    rawSku: existing?.rawSku ?? (input.skuSource === "sheet" ? input.sku : ""),
    skuSource: existing?.skuSource ?? input.skuSource,
    title: input.detail.title,
    productUrl: input.detail.productUrl || existing?.productUrl || "",
    mainImageUrl: input.detail.mainImageUrl,
    price: input.detail.price,
    rating: input.detail.rating,
    category: input.detail.category || existing?.category || "",
    status: existing?.status || "active",
    lastScrapedAt: input.scrapedAt,
    lastCheckedAt: input.scrapedAt,
    notes: existing?.notes ?? "",
    skuSearch: input.sku.toLowerCase(),
    titleSearch: input.detail.title.toLowerCase()
  };
}

function imagesForDetail(detail: MeeshoProductDetail, sku: string, scrapedAt: string): CatalogImage[] {
  return detail.imageUrls.map((imageUrl, index) => ({
    rowNo: 0,
    sku,
    imageNo: index + 1,
    imageUrl,
    status: imageStatus(imageUrl),
    lastCheckedAt: scrapedAt
  }));
}

function attributesForDetail(detail: MeeshoProductDetail, sku: string): CatalogAttribute[] {
  return [...detail.productHighlights, ...detail.additionalDetails].map((attribute) => ({
    rowNo: 0,
    sku,
    section: attribute.section,
    attributeName: attribute.attributeName,
    attributeValue: attribute.attributeValue
  }));
}

function isSyncManagedSection(attribute: CatalogAttribute) {
  return ["product highlights", "additional details"].includes(attribute.section.toLowerCase());
}

function resolveSku(detail: MeeshoProductDetail, rule: SkuExtractionRule, customRegex: string | undefined) {
  const extracted = extractSkuFromTitle({
    title: detail.title,
    rule,
    customRegex
  }).sku;

  return normalizeSkuForMatching(extracted);
}

export function mergeCatalogProductFromSync(input: CatalogMergeInput): CatalogMergeResult {
  const scrapedAt = input.scrapedAt ?? new Date().toISOString();
  const baseIndex = input.index.version === 1 ? input.index : emptyCatalogIndex();

  if (input.error || !input.detail) {
    const error = toCatalogError({
      sku: "",
      errorType: input.error?.errorType ?? "PRODUCT_URL_FAILED",
      message: input.error?.message ?? "Product URL failed during sync.",
      rawValue: input.error?.rawValue ?? input.productUrl
    });

    return {
      index: normalizeCatalogIndex({
        ...baseIndex,
        errors: [error, ...baseIndex.errors]
      }),
      added: false,
      updated: false,
      failed: true,
      brokenImageUrlCount: 0,
      message: error.message
    };
  }

  const sku = resolveSku(input.detail, input.skuExtractionRule ?? "default", input.customRegex);

  if (!sku) {
    const error = toCatalogError({
      errorType: "MISSING_SKU",
      message: "SKU could not be extracted from the product title.",
      rawValue: JSON.stringify({ title: input.detail.title, productUrl: input.productUrl })
    });

    return {
      index: normalizeCatalogIndex({
        ...baseIndex,
        errors: [error, ...baseIndex.errors]
      }),
      added: false,
      updated: false,
      failed: true,
      brokenImageUrlCount: 0,
      message: error.message
    };
  }

  const existingIndex = baseIndex.products.findIndex((product) => product.sku === sku);
  const existing = existingIndex >= 0 ? baseIndex.products[existingIndex] : undefined;
  const product = productForDetail({
    detail: input.detail,
    sku,
    skuSource: "title",
    scrapedAt,
    existing
  });
  const products = [...baseIndex.products];

  if (existingIndex >= 0) {
    products[existingIndex] = product;
  } else {
    products.push(product);
  }

  const images = [
    ...baseIndex.images.filter((image) => image.sku !== sku),
    ...imagesForDetail(input.detail, sku, scrapedAt)
  ];
  const attributes = [
    ...baseIndex.attributes.filter((attribute) => attribute.sku !== sku || !isSyncManagedSection(attribute)),
    ...attributesForDetail(input.detail, sku)
  ];
  const imageBrokenCount = brokenImageCount(input.detail.imageUrls);
  const errors =
    imageBrokenCount > 0
      ? [
          toCatalogError({
            sku,
            errorType: "BROKEN_IMAGE_URL",
            message: `${imageBrokenCount} image URL value(s) were invalid and marked broken.`,
            rawValue: JSON.stringify(input.detail.imageUrls.filter((url) => !isHttpUrl(url)))
          }),
          ...baseIndex.errors
        ]
      : baseIndex.errors;

  return {
    index: normalizeCatalogIndex({
      ...baseIndex,
      products,
      images,
      attributes,
      errors
    }),
    sku,
    added: existingIndex < 0,
    updated: existingIndex >= 0,
    failed: false,
    brokenImageUrlCount: imageBrokenCount,
    message: existingIndex >= 0 ? `Updated ${sku}.` : `Added ${sku}.`
  };
}
