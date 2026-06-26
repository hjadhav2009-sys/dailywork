import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeSkuForMatching } from "@/lib/sku";
import { catalogStorageDir, loadCatalogIndex, type CatalogIndex } from "./master";
import { catalogDetailsForSku } from "./order-enrichment";

export const activeSkusPath = join(catalogStorageDir, "active-skus.json");
export const activeImageCachePath = join(catalogStorageDir, "active-image-cache.json");

export type ActiveSkuOrderInput = {
  sku?: string | null;
  qty?: number | null;
};

export type ActiveSkuRecord = {
  sku: string;
  active: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  activeUntil: string;
  quantityWindow: number;
  orderCountWindow: number;
  title?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  missingCatalog?: boolean;
  missingImage?: boolean;
  brokenImage?: boolean;
};

export type ActiveSkuState = {
  version: 1;
  generatedAt: string;
  retentionDays: number;
  skus: Record<string, ActiveSkuRecord>;
};

export type ActiveImageCacheRecord = {
  sku: string;
  imageUrl: string | null;
  status: "available" | "missing" | "broken";
  source: "catalog";
  lastSeenAt: string;
};

export type ActiveImageCacheState = {
  version: 1;
  generatedAt: string;
  images: Record<string, ActiveImageCacheRecord>;
};

const dayMs = 24 * 60 * 60 * 1000;
const defaultRetentionDays = 5;

function nowIso(now = new Date()) {
  return now.toISOString();
}

export function normalizeActiveSkuRetentionDays(value: unknown) {
  const parsed = Math.trunc(Number(value));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultRetentionDays;
  }

  return Math.min(Math.max(parsed, 1), 30);
}

export function emptyActiveSkuState(retentionDays = defaultRetentionDays, now = new Date()): ActiveSkuState {
  return {
    version: 1,
    generatedAt: nowIso(now),
    retentionDays: normalizeActiveSkuRetentionDays(retentionDays),
    skus: {}
  };
}

function emptyActiveImageCacheState(now = new Date()): ActiveImageCacheState {
  return {
    version: 1,
    generatedAt: nowIso(now),
    images: {}
  };
}

async function ensureStorage() {
  await mkdir(catalogStorageDir, { recursive: true });
}

async function readJsonFile<T>(path: string, fallback: T) {
  if (!existsSync(path)) {
    return fallback;
  }

  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(path: string, value: unknown) {
  await ensureStorage();
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

export async function loadActiveSkuState() {
  const state = await readJsonFile<ActiveSkuState>(activeSkusPath, emptyActiveSkuState());

  return {
    ...emptyActiveSkuState(state.retentionDays),
    ...state,
    retentionDays: normalizeActiveSkuRetentionDays(state.retentionDays)
  };
}

export async function saveActiveSkuState(state: ActiveSkuState) {
  await writeJsonFile(activeSkusPath, state);
}

export async function loadActiveImageCacheState() {
  return readJsonFile<ActiveImageCacheState>(activeImageCachePath, emptyActiveImageCacheState());
}

export async function saveActiveImageCacheState(state: ActiveImageCacheState) {
  await writeJsonFile(activeImageCachePath, state);
}

function activeUntilFor(lastSeenAt: Date, retentionDays: number) {
  return new Date(lastSeenAt.getTime() + retentionDays * dayMs);
}

function isStillActive(record: ActiveSkuRecord, now: Date) {
  const activeUntil = new Date(record.activeUntil);
  return Number.isFinite(activeUntil.getTime()) && activeUntil >= now;
}

function groupedOrderWindow(rows: ActiveSkuOrderInput[]) {
  const groups = new Map<string, { quantityWindow: number; orderCountWindow: number }>();

  for (const row of rows) {
    const sku = normalizeSkuForMatching(row.sku);

    if (!sku) {
      continue;
    }

    const existing = groups.get(sku) ?? { quantityWindow: 0, orderCountWindow: 0 };
    existing.quantityWindow += row.qty ?? 1;
    existing.orderCountWindow += 1;
    groups.set(sku, existing);
  }

  return groups;
}

function enrichRecord(record: ActiveSkuRecord, catalogIndex?: CatalogIndex): ActiveSkuRecord {
  if (!catalogIndex) {
    return record;
  }

  const details = catalogDetailsForSku(catalogIndex, record.sku);

  return {
    ...record,
    title: details.title,
    productUrl: details.productUrl,
    imageUrl: details.imageUrl,
    missingCatalog: details.missingCatalog,
    missingImage: details.missingImage,
    brokenImage: details.brokenImage
  };
}

export function nextActiveSkuState(
  previous: ActiveSkuState,
  rows: ActiveSkuOrderInput[],
  options: {
    now?: Date;
    retentionDays?: number;
    catalogIndex?: CatalogIndex;
  } = {}
) {
  const now = options.now ?? new Date();
  const retentionDays = normalizeActiveSkuRetentionDays(options.retentionDays ?? previous.retentionDays);
  const seenAt = nowIso(now);
  const activeUntil = nowIso(activeUntilFor(now, retentionDays));
  const nextSkus: Record<string, ActiveSkuRecord> = {};

  for (const [sku, record] of Object.entries(previous.skus ?? {})) {
    const normalizedSku = normalizeSkuForMatching(sku);

    if (!normalizedSku) {
      continue;
    }

    const lastSeenDate = new Date(record.lastSeenAt);
    const recalculatedActiveUntil = Number.isFinite(lastSeenDate.getTime())
      ? nowIso(activeUntilFor(lastSeenDate, retentionDays))
      : record.activeUntil;
    const existingRecord = {
      ...record,
      activeUntil: recalculatedActiveUntil
    };

    nextSkus[normalizedSku] = enrichRecord(
      {
        ...existingRecord,
        sku: normalizedSku,
        active: isStillActive(existingRecord, now)
      },
      options.catalogIndex
    );
  }

  for (const [sku, group] of groupedOrderWindow(rows)) {
    const existing = nextSkus[sku];

    nextSkus[sku] = enrichRecord(
      {
        sku,
        active: true,
        firstSeenAt: existing?.firstSeenAt ?? seenAt,
        lastSeenAt: seenAt,
        activeUntil,
        quantityWindow: group.quantityWindow,
        orderCountWindow: group.orderCountWindow,
        title: existing?.title,
        productUrl: existing?.productUrl,
        imageUrl: existing?.imageUrl,
        missingCatalog: existing?.missingCatalog,
        missingImage: existing?.missingImage,
        brokenImage: existing?.brokenImage
      },
      options.catalogIndex
    );
  }

  return {
    version: 1 as const,
    generatedAt: seenAt,
    retentionDays,
    skus: nextSkus
  };
}

export function activeSkuRecords(state: ActiveSkuState) {
  return Object.values(state.skus).filter((record) => record.active);
}

export function activeSkuSummary(state: ActiveSkuState) {
  const active = activeSkuRecords(state);

  return {
    retentionDays: state.retentionDays,
    activeCount: active.length,
    missingCatalogCount: active.filter((record) => record.missingCatalog).length,
    missingImageCount: active.filter((record) => record.missingImage).length,
    brokenImageCount: active.filter((record) => record.brokenImage).length,
    active
  };
}

export function buildActiveImageCacheState(state: ActiveSkuState, now = new Date()): ActiveImageCacheState {
  const images: Record<string, ActiveImageCacheRecord> = {};

  for (const record of activeSkuRecords(state)) {
    images[record.sku] = {
      sku: record.sku,
      imageUrl: record.imageUrl ?? null,
      status: record.brokenImage ? "broken" : record.imageUrl ? "available" : "missing",
      source: "catalog",
      lastSeenAt: record.lastSeenAt
    };
  }

  return {
    version: 1,
    generatedAt: nowIso(now),
    images
  };
}

export async function markActiveSkusFromOrders(
  rows: ActiveSkuOrderInput[],
  options: {
    now?: Date;
    retentionDays?: number;
    catalogIndex?: CatalogIndex;
  } = {}
) {
  const previous = await loadActiveSkuState();
  const catalogIndex = options.catalogIndex ?? (await loadCatalogIndex());
  const next = nextActiveSkuState(previous, rows, {
    ...options,
    catalogIndex
  });

  await Promise.all([saveActiveSkuState(next), saveActiveImageCacheState(buildActiveImageCacheState(next, options.now))]);
  return next;
}

export async function updateActiveSkuRetentionDays(retentionDays: unknown) {
  const previous = await loadActiveSkuState();
  const next = nextActiveSkuState(previous, [], {
    retentionDays: normalizeActiveSkuRetentionDays(retentionDays),
    catalogIndex: await loadCatalogIndex()
  });

  await Promise.all([saveActiveSkuState(next), saveActiveImageCacheState(buildActiveImageCacheState(next))]);
  return next;
}
