import { getCurrentUser } from "@/lib/auth";
import { activeSkuRecords, loadActiveSkuState } from "@/lib/catalog/active-skus";
import { loadCatalogIndex } from "@/lib/catalog/master";
import { buildCatalogDetailsMap } from "@/lib/catalog/order-enrichment";
import { csvResponse, rowsToCsv, type CsvValue } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import type { BatchStatus, PackStatus, ProblemStatus, ScanOutcome } from "@prisma/client";

const exportKinds = new Set([
  "orders",
  "packed-orders",
  "pending-orders",
  "problem-orders",
  "scan-logs",
  "sku-mappings",
  "upload-batches",
  "today-picking-list",
  "today-packing-list",
  "missing-catalog-skus",
  "broken-image-urls",
  "duplicate-awbs-skipped",
  "active-skus"
]);

function parseDate(value: string | null, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function dateRange(searchParams: URLSearchParams) {
  const gte = parseDate(searchParams.get("from"));
  const lte = parseDate(searchParams.get("to"), true);

  if (!gte && !lte) {
    return undefined;
  }

  return { gte, lte };
}

function filename(kind: string) {
  return `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
}

function accountFilter(searchParams: URLSearchParams) {
  return searchParams.get("accountId") || undefined;
}

function paymentOrStatusFilter(searchParams: URLSearchParams) {
  return searchParams.get("status") || undefined;
}

function packStatusFilter(value: string | undefined): PackStatus | undefined {
  return value === "READY" || value === "PACKED" || value === "PROBLEM" ? value : undefined;
}

function problemStatusFilter(value: string | undefined): ProblemStatus | undefined {
  return value === "OPEN" || value === "RESOLVED" ? value : undefined;
}

function scanOutcomeFilter(value: string | undefined): ScanOutcome | undefined {
  return value === "FOUND" || value === "PACKED" || value === "PROBLEM" || value === "NOT_FOUND" ? value : undefined;
}

function batchStatusFilter(value: string | undefined): BatchStatus | undefined {
  return value === "UPLOADED" || value === "PARSED" || value === "REVIEWED" || value === "IMPORTED" || value === "FAILED" ? value : undefined;
}

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();

  if (!user || user.role !== "OWNER") {
    return new Response("Forbidden", { status: 403 });
  }

  const { kind } = await context.params;

  if (!exportKinds.has(kind)) {
    return new Response("Unknown export", { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const csv = await buildExport(kind, url.searchParams);
    return csvResponse(csv, filename(kind));
  } catch {
    return new Response("Export failed. Please check filters and try again.", { status: 500 });
  }
}

async function buildExport(kind: string, searchParams: URLSearchParams) {
  if (kind === "today-picking-list") {
    return todayPickingListCsv(searchParams);
  }

  if (kind === "today-packing-list") {
    return todayPackingListCsv(searchParams);
  }

  if (kind === "missing-catalog-skus") {
    return missingCatalogSkusCsv();
  }

  if (kind === "broken-image-urls") {
    return brokenImageUrlsCsv();
  }

  if (kind === "duplicate-awbs-skipped") {
    return duplicateAwbsSkippedCsv(searchParams);
  }

  if (kind === "active-skus") {
    return activeSkusCsv();
  }

  if (kind === "scan-logs") {
    return scanLogsCsv(searchParams);
  }

  if (kind === "sku-mappings") {
    return skuMappingsCsv(searchParams);
  }

  if (kind === "upload-batches") {
    return uploadBatchesCsv(searchParams);
  }

  if (kind === "problem-orders") {
    return problemOrdersCsv(searchParams);
  }

  return ordersCsv(kind, searchParams);
}

function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function todayPickingListCsv(searchParams: URLSearchParams) {
  const rows = await prisma.order.findMany({
    where: {
      accountId: accountFilter(searchParams),
      importedAt: { gte: todayStart() },
      packStatus: "READY"
    },
    orderBy: [{ sku: "asc" }, { color: "asc" }, { size: "asc" }]
  });
  const catalogIndex = await loadCatalogIndex();
  const catalogBySku = buildCatalogDetailsMap(catalogIndex, rows.map((row) => row.sku));
  const grouped = new Map<string, { sku: string; color: string | null; size: string | null; qty: number; awbs: Set<string> }>();

  for (const row of rows) {
    const key = `${row.sku}::${row.color ?? ""}::${row.size ?? ""}`;
    const existing = grouped.get(key) ?? { sku: row.sku, color: row.color, size: row.size, qty: 0, awbs: new Set<string>() };
    existing.qty += row.qty;
    existing.awbs.add(row.awb);
    grouped.set(key, existing);
  }

  return rowsToCsv(
    ["sku", "title", "color", "size", "total_qty", "awb_count", "image_url", "missing_catalog", "image_status"],
    Array.from(grouped.values()).map((group) => {
      const catalog = catalogBySku.get(group.sku);
      const imageStatus = catalog?.brokenImage ? "broken" : catalog?.missingImage ? "missing" : catalog?.imageUrl ? "available" : "unknown";

      return [
        group.sku,
        catalog?.title,
        group.color ?? catalog?.color,
        group.size ?? catalog?.size,
        group.qty,
        group.awbs.size,
        catalog?.imageUrl,
        catalog?.missingCatalog ?? false,
        imageStatus
      ];
    })
  );
}

async function todayPackingListCsv(searchParams: URLSearchParams) {
  const rows = await prisma.order.findMany({
    where: {
      accountId: accountFilter(searchParams),
      importedAt: { gte: todayStart() }
    },
    include: { account: true },
    orderBy: [{ awb: "asc" }]
  });

  return rowsToCsv(
    ["account", "awb", "orderNo", "sku", "qty", "color", "size", "courier", "packStatus", "productDescription", "imageUrl"],
    rows.map((order) => [
      order.account.name,
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
    ])
  );
}

async function activeSkusCsv() {
  const state = await loadActiveSkuState();

  return rowsToCsv(
    ["sku", "active", "first_seen_at", "last_seen_at", "active_until", "quantity_window", "order_count_window", "title", "product_url", "image_url", "missing_catalog", "missing_image", "broken_image"],
    activeSkuRecords(state).map((record) => [
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
    ])
  );
}

async function missingCatalogSkusCsv() {
  const state = await loadActiveSkuState();

  return rowsToCsv(
    ["sku", "last_seen_at", "active_until", "quantity_window", "order_count_window"],
    activeSkuRecords(state)
      .filter((record) => record.missingCatalog)
      .map((record) => [record.sku, record.lastSeenAt, record.activeUntil, record.quantityWindow, record.orderCountWindow])
  );
}

async function brokenImageUrlsCsv() {
  const state = await loadActiveSkuState();

  return rowsToCsv(
    ["sku", "title", "image_url", "status", "last_seen_at", "product_url"],
    activeSkuRecords(state)
      .filter((record) => record.brokenImage || record.missingImage)
      .map((record) => [
        record.sku,
        record.title,
        record.imageUrl,
        record.brokenImage ? "broken" : "missing",
        record.lastSeenAt,
        record.productUrl
      ])
  );
}

async function duplicateAwbsSkippedCsv(searchParams: URLSearchParams) {
  const rows = await prisma.importRowIssue.findMany({
    where: {
      issueType: "DUPLICATE_SKIPPED",
      createdAt: dateRange(searchParams) ?? { gte: todayStart() },
      batch: {
        accountId: accountFilter(searchParams)
      }
    },
    include: {
      batch: {
        include: { account: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return rowsToCsv(
    ["account", "batch", "rowNumber", "message", "rawData", "createdAt"],
    rows.map((issue) => [issue.batch.account.name, issue.batch.fileName, issue.rowNumber, issue.message, issue.rawData, issue.createdAt])
  );
}

async function ordersCsv(kind: string, searchParams: URLSearchParams) {
  const range = dateRange(searchParams);
  const status = paymentOrStatusFilter(searchParams);
  const packStatus = packStatusFilter(status);
  const rows = await prisma.order.findMany({
    where: {
      accountId: accountFilter(searchParams),
      importedAt: kind === "packed-orders" ? undefined : range,
      packedAt: kind === "packed-orders" ? range : undefined,
      packStatus:
        kind === "packed-orders"
          ? "PACKED"
          : kind === "pending-orders"
            ? "READY"
            : packStatus
    },
    include: { account: true },
    orderBy: { importedAt: "desc" }
  });

  return rowsToCsv(
    [
      "account",
      "awb",
      "orderNo",
      "sku",
      "qty",
      "color",
      "size",
      "courier",
      "pickStatus",
      "packStatus",
      "paymentType",
      "productDescription",
      "imageUrl",
      "importedAt",
      "packedAt"
    ],
    rows.map((order) => [
      order.account.name,
      order.awb,
      order.orderNo,
      order.sku,
      order.qty,
      order.color,
      order.size,
      order.courier,
      order.pickStatus,
      order.packStatus,
      order.paymentType,
      order.productDescription,
      order.imageUrl,
      order.importedAt,
      order.packedAt
    ])
  );
}

async function problemOrdersCsv(searchParams: URLSearchParams) {
  const status = problemStatusFilter(paymentOrStatusFilter(searchParams));
  const rows = await prisma.problemOrder.findMany({
    where: {
      accountId: accountFilter(searchParams),
      createdAt: dateRange(searchParams),
      status
    },
    include: {
      account: true,
      order: true,
      reportedBy: true
    },
    orderBy: { createdAt: "desc" }
  });

  return rowsToCsv(
    ["account", "awb", "orderNo", "sku", "qty", "color", "size", "courier", "reason", "status", "reportedBy", "createdAt", "resolvedAt"],
    rows.map((problem) => [
      problem.account.name,
      problem.order.awb,
      problem.order.orderNo,
      problem.order.sku,
      problem.order.qty,
      problem.order.color,
      problem.order.size,
      problem.order.courier,
      problem.reason,
      problem.status,
      problem.reportedBy?.name,
      problem.createdAt,
      problem.resolvedAt
    ])
  );
}

async function scanLogsCsv(searchParams: URLSearchParams) {
  const outcome = scanOutcomeFilter(paymentOrStatusFilter(searchParams));
  const rows = await prisma.scanLog.findMany({
    where: {
      accountId: accountFilter(searchParams),
      createdAt: dateRange(searchParams),
      outcome
    },
    include: {
      account: true,
      scannedBy: true
    },
    orderBy: { createdAt: "desc" }
  });

  return rowsToCsv(
    ["account", "awb", "outcome", "scannedBy", "createdAt", "note"],
    rows.map((scan) => [scan.account.name, scan.awb, scan.outcome, scan.scannedBy?.name, scan.createdAt, scan.note])
  );
}

async function skuMappingsCsv(searchParams: URLSearchParams) {
  const rows = await prisma.skuImageMapping.findMany({
    where: {
      accountId: accountFilter(searchParams),
      updatedAt: dateRange(searchParams),
      active: paymentOrStatusFilter(searchParams) === "inactive" ? false : paymentOrStatusFilter(searchParams) === "active" ? true : undefined
    },
    include: { account: true },
    orderBy: { updatedAt: "desc" }
  });

  return rowsToCsv(
    ["account", "sku", "image_url", "product_name", "color", "size", "notes", "active", "cache_status", "image_health", "last_used_at", "updated_at"],
    rows.map((mapping) => [
      mapping.account.name,
      mapping.sku,
      mapping.imageUrl,
      mapping.productName,
      mapping.color,
      mapping.size,
      mapping.notes,
      mapping.active,
      mapping.cacheStatus,
      mapping.imageHealth,
      mapping.cacheLastUsedAt,
      mapping.updatedAt
    ])
  );
}

async function uploadBatchesCsv(searchParams: URLSearchParams) {
  const status = batchStatusFilter(paymentOrStatusFilter(searchParams));
  const rows = await prisma.uploadBatch.findMany({
    where: {
      accountId: accountFilter(searchParams),
      createdAt: dateRange(searchParams),
      status
    },
    include: {
      account: true,
      createdBy: true
    },
    orderBy: { createdAt: "desc" }
  });

  const csvRows: CsvValue[][] = rows.map((batch) => [
    batch.account.name,
    batch.fileName,
    batch.importType,
    batch.status,
    batch.totalRows,
    batch.createdRows,
    batch.updatedRows,
    batch.duplicateRows,
    batch.missingImageRows,
    batch.skippedRows,
    batch.errorRows,
    batch.createdBy?.name,
    batch.createdAt
  ]);

  return rowsToCsv(
    [
      "account",
      "fileName",
      "importType",
      "status",
      "totalRows",
      "createdRows",
      "updatedRows",
      "duplicateRows",
      "missingImageRows",
      "skippedRows",
      "errorRows",
      "createdBy",
      "createdAt"
    ],
    csvRows
  );
}
