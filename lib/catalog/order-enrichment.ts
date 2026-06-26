import { normalizeSkuForMatching } from "@/lib/sku";
import {
  searchCatalogByExactSku,
  type CatalogAttribute,
  type CatalogIndex,
  type CatalogSearchResult
} from "./master";

export type CatalogOrderDetails = {
  sku: string;
  product: CatalogSearchResult | null;
  title: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  missingCatalog: boolean;
  missingImage: boolean;
  brokenImage: boolean;
  productHighlights: CatalogAttribute[];
  additionalDetails: CatalogAttribute[];
  color: string | null;
  size: string | null;
};

export function isHttpImageUrl(value: string | null | undefined) {
  if (!value) {
    return false;
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

function statusIsBroken(status: string | null | undefined) {
  return Boolean(status && /broken|failed|invalid/i.test(status));
}

function attributeValue(attributes: CatalogAttribute[], names: string[]) {
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
  return attributes.find((attribute) => normalizedNames.has(attribute.attributeName.trim().toLowerCase()))?.attributeValue || null;
}

export function preferredCatalogImage(product: CatalogSearchResult | null | undefined) {
  if (!product) {
    return null;
  }

  if (isHttpImageUrl(product.mainImageUrl)) {
    return product.mainImageUrl;
  }

  const sortedImages = [...product.images].sort((left, right) => left.imageNo - right.imageNo);
  const activeImage = sortedImages.find((image) => isHttpImageUrl(image.imageUrl) && !statusIsBroken(image.status));
  const fallbackImage = sortedImages.find((image) => isHttpImageUrl(image.imageUrl));

  return activeImage?.imageUrl ?? fallbackImage?.imageUrl ?? null;
}

export function catalogImageIssue(product: CatalogSearchResult | null | undefined) {
  if (!product) {
    return {
      missingImage: true,
      brokenImage: false
    };
  }

  const imageUrl = preferredCatalogImage(product);

  if (!imageUrl) {
    return {
      missingImage: true,
      brokenImage: product.images.some((image) => statusIsBroken(image.status))
    };
  }

  const matchingImage = product.images.find((image) => image.imageUrl === imageUrl);

  return {
    missingImage: false,
    brokenImage: statusIsBroken(product.status) || statusIsBroken(matchingImage?.status) || !isHttpImageUrl(imageUrl)
  };
}

export function catalogDetailsForSku(index: CatalogIndex, sku: string | null | undefined): CatalogOrderDetails {
  const normalizedSku = normalizeSkuForMatching(sku);
  const product = normalizedSku ? searchCatalogByExactSku(index, normalizedSku) : null;
  const imageUrl = preferredCatalogImage(product);
  const imageIssue = catalogImageIssue(product);
  const attributes = product?.attributes ?? [];

  return {
    sku: normalizedSku,
    product,
    title: product?.title || null,
    productUrl: product?.productUrl || null,
    imageUrl,
    missingCatalog: Boolean(normalizedSku && !product),
    missingImage: imageIssue.missingImage,
    brokenImage: imageIssue.brokenImage,
    productHighlights: product?.productHighlights ?? [],
    additionalDetails: product?.additionalDetails ?? [],
    color: attributeValue(attributes, ["color", "colour"]) ?? null,
    size: attributeValue(attributes, ["size", "sizing"]) ?? null
  };
}

export function buildCatalogDetailsMap(index: CatalogIndex, skus: Array<string | null | undefined>) {
  const details = new Map<string, CatalogOrderDetails>();

  for (const sku of skus) {
    const normalizedSku = normalizeSkuForMatching(sku);

    if (!normalizedSku || details.has(normalizedSku)) {
      continue;
    }

    details.set(normalizedSku, catalogDetailsForSku(index, normalizedSku));
  }

  return details;
}
