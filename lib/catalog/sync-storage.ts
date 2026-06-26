import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { catalogStorageDir } from "./master";
import type { SkuExtractionRule } from "./sku-extraction";

export const syncQueuePath = join(catalogStorageDir, "sync-queue.json");
export const syncStatePath = join(catalogStorageDir, "sync-state.json");
export const syncErrorsPath = join(catalogStorageDir, "sync-errors.json");

export type CatalogSyncStatus = "IDLE" | "DISCOVERING" | "RUNNING" | "PAUSED" | "STOPPING" | "STOPPED" | "COMPLETED" | "FAILED";
export type CatalogSyncQueueStatus = "pending" | "processing" | "processed" | "failed";

export type CatalogSyncSettings = {
  shopUrl: string;
  maxProductsPerRun: number;
  delayMs: number;
  resumeFromLastProduct: boolean;
  skuExtractionRule: SkuExtractionRule;
  customRegex?: string;
};

export type CatalogSyncQueueItem = {
  id: string;
  productUrl: string;
  sku?: string;
  title?: string;
  status: CatalogSyncQueueStatus;
  attempts: number;
  discoveredAt: string;
  processedAt?: string;
  error?: string;
};

export type CatalogSyncStats = {
  totalProductsDiscovered: number;
  productsProcessed: number;
  productsAdded: number;
  productsUpdated: number;
  productsFailed: number;
  brokenImageUrlCount: number;
};

export type CatalogSyncState = {
  version: 1;
  status: CatalogSyncStatus;
  activeRunId?: string;
  startedAt?: string;
  lastSyncDate?: string;
  activeProductUrl?: string;
  lastMessage?: string;
  settings: CatalogSyncSettings;
  stats: CatalogSyncStats;
};

export type CatalogSyncError = {
  createdAt: string;
  productUrl?: string;
  sku?: string;
  errorType: string;
  message: string;
  rawValue?: string;
};

const defaultSettings: CatalogSyncSettings = {
  shopUrl: "",
  maxProductsPerRun: 25,
  delayMs: 1500,
  resumeFromLastProduct: true,
  skuExtractionRule: "default"
};

const defaultStats: CatalogSyncStats = {
  totalProductsDiscovered: 0,
  productsProcessed: 0,
  productsAdded: 0,
  productsUpdated: 0,
  productsFailed: 0,
  brokenImageUrlCount: 0
};

export function defaultSyncState(): CatalogSyncState {
  return {
    version: 1,
    status: "IDLE",
    settings: defaultSettings,
    stats: defaultStats
  };
}

export function nowIso() {
  return new Date().toISOString();
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

export async function loadSyncQueue() {
  return readJsonFile<CatalogSyncQueueItem[]>(syncQueuePath, []);
}

export async function saveSyncQueue(queue: CatalogSyncQueueItem[]) {
  await writeJsonFile(syncQueuePath, queue);
}

export async function loadSyncState() {
  const state = await readJsonFile<CatalogSyncState>(syncStatePath, defaultSyncState());

  return {
    ...defaultSyncState(),
    ...state,
    settings: {
      ...defaultSettings,
      ...state.settings
    },
    stats: {
      ...defaultStats,
      ...state.stats
    }
  };
}

export async function saveSyncState(state: CatalogSyncState) {
  await writeJsonFile(syncStatePath, state);
}

export async function loadSyncErrors() {
  return readJsonFile<CatalogSyncError[]>(syncErrorsPath, []);
}

export async function saveSyncErrors(errors: CatalogSyncError[]) {
  await writeJsonFile(syncErrorsPath, errors);
}

export async function appendSyncError(error: CatalogSyncError) {
  const errors = await loadSyncErrors();
  errors.unshift(error);
  await saveSyncErrors(errors.slice(0, 500));
}

export function normalizeSyncSettings(input: Partial<CatalogSyncSettings>): CatalogSyncSettings {
  const maxProductsPerRun = Math.min(Math.max(Math.trunc(Number(input.maxProductsPerRun) || defaultSettings.maxProductsPerRun), 1), 250);
  const delayMs = Math.min(Math.max(Math.trunc(Number(input.delayMs) || defaultSettings.delayMs), 500), 60000);

  return {
    shopUrl: String(input.shopUrl ?? "").trim(),
    maxProductsPerRun,
    delayMs,
    resumeFromLastProduct: input.resumeFromLastProduct !== false,
    skuExtractionRule: input.skuExtractionRule ?? "default",
    customRegex: input.customRegex?.trim() || undefined
  };
}

export function syncProgressPercent(state: CatalogSyncState) {
  if (state.stats.totalProductsDiscovered === 0) {
    return 0;
  }

  return Math.min(100, Math.round((state.stats.productsProcessed / state.stats.totalProductsDiscovered) * 100));
}

export function newRunId() {
  return `sync-${Date.now().toString(36)}`;
}

export function queueItemId(productUrl: string) {
  try {
    return new URL(productUrl).toString().toLowerCase();
  } catch {
    return productUrl.trim().toLowerCase();
  }
}
