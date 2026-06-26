import type { ActiveSkuRecord } from "@/lib/catalog/active-skus";
import type { CatalogIndex } from "@/lib/catalog/master";
import { buildCatalogDetailsMap } from "@/lib/catalog/order-enrichment";
import type { CsvValue } from "@/lib/csv";

export type PickingReportOrder = {
  sku: string;
  awb: string;
  qty: number;
  color: string | null;
  size: string | null;
};

export type PackingReportOrder = PickingReportOrder & {
  accountName: string;
  orderNo: string;
  courier: string | null;
  packStatus: string;
  productDescription: string | null;
  imageUrl: string | null;
};

export type DuplicateAwbIssueReportRow = {
  accountName: string;
  batchFileName: string;
  rowNumber: number | null;
  message: string;
  rawData: string | null;
  createdAt: Date | string;
};

export const todayPickingHeaders = [
  "sku",
  "title",
  "color",
  "size",
  "total_qty",
  "awb_count",
  "image_url",
  "missing_catalog",
  "image_status"
];

export const todayPackingHeaders = [
  "account",
  "awb",
  "orderNo",
  "sku",
  "qty",
  "color",
  "size",
  "courier",
  "packStatus",
  "productDescription",
  "imageUrl"
];

export const activeSkuHeaders = [
  "sku",
  "active",
  "first_seen_at",
  "last_seen_at",
  "active_until",
  "quantity_window",
  "order_count_window",
  "title",
  "product_url",
  "image_url",
  "missing_catalog",
  "missing_image",
  "broken_image"
];

export const missingCatalogSkuHeaders = ["sku", "last_seen_at", "active_until", "quantity_window", "order_count_window"];
export const brokenImageUrlHeaders = ["sku", "title", "image_url", "status", "last_seen_at", "product_url"];
export const duplicateAwbSkippedHeaders = ["account", "batch", "rowNumber", "message", "rawData", "createdAt"];

function imageStatusFor(input: { imageUrl?: string | null; missingImage?: boolean; brokenImage?: boolean } | undefined) {
  if (input?.brokenImage) {
    return "broken";
  }

  if (input?.missingImage) {
    return "missing";
  }

  return input?.imageUrl ? "available" : "unknown";
}

export function buildTodayPickingRows(orders: PickingReportOrder[], catalogIndex: CatalogIndex): CsvValue[][] {
  const catalogBySku = buildCatalogDetailsMap(catalogIndex, orders.map((row) => row.sku));
  const grouped = new Map<string, { sku: string; color: string | null; size: string | null; qty: number; awbs: Set<string> }>();

  for (const row of orders) {
    const key = `${row.sku}::${row.color ?? ""}::${row.size ?? ""}`;
    const existing = grouped.get(key) ?? { sku: row.sku, color: row.color, size: row.size, qty: 0, awbs: new Set<string>() };
    existing.qty += row.qty;
    existing.awbs.add(row.awb);
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).map((group) => {
    const catalog = catalogBySku.get(group.sku);

    return [
      group.sku,
      catalog?.title,
      group.color ?? catalog?.color,
      group.size ?? catalog?.size,
      group.qty,
      group.awbs.size,
      catalog?.imageUrl,
      catalog?.missingCatalog ?? false,
      imageStatusFor(catalog)
    ];
  });
}

export function buildTodayPackingRows(orders: PackingReportOrder[]): CsvValue[][] {
  return orders.map((order) => [
    order.accountName,
    order.awb,
    order.orderNo,
    order.sku,
    order.qty,
    order.color,
    order.size,
    order.courier,
    order.packStatus,
    order.productDescription,
    order.imageUrl
  ]);
}

export function buildActiveSkuRows(records: ActiveSkuRecord[]): CsvValue[][] {
  return records.map((record) => [
    record.sku,
    record.active,
    record.firstSeenAt,
    record.lastSeenAt,
    record.activeUntil,
    record.quantityWindow,
    record.orderCountWindow,
    record.title,
    record.productUrl,
    record.imageUrl,
    record.missingCatalog,
    record.missingImage,
    record.brokenImage
  ]);
}

export function buildMissingCatalogSkuRows(records: ActiveSkuRecord[]): CsvValue[][] {
  return records
    .filter((record) => record.missingCatalog)
    .map((record) => [record.sku, record.lastSeenAt, record.activeUntil, record.quantityWindow, record.orderCountWindow]);
}

export function buildBrokenImageUrlRows(records: ActiveSkuRecord[]): CsvValue[][] {
  return records
    .filter((record) => record.brokenImage || record.missingImage)
    .map((record) => [
      record.sku,
      record.title,
      record.imageUrl,
      record.brokenImage ? "broken" : "missing",
      record.lastSeenAt,
      record.productUrl
    ]);
}

export function buildDuplicateAwbSkippedRows(issues: DuplicateAwbIssueReportRow[]): CsvValue[][] {
  return issues.map((issue) => [issue.accountName, issue.batchFileName, issue.rowNumber, issue.message, issue.rawData, issue.createdAt]);
}
