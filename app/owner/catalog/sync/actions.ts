"use server";

import { spawn } from "node:child_process";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { loadCatalogIndex, searchCatalogByExactSku } from "@/lib/catalog/master";
import {
  appendSyncError,
  defaultSyncState,
  loadSyncQueue,
  loadSyncState,
  newRunId,
  normalizeSyncSettings,
  nowIso,
  queueItemId,
  saveSyncErrors,
  saveSyncQueue,
  saveSyncState,
  type CatalogSyncQueueItem,
  type CatalogSyncSettings
} from "@/lib/catalog/sync-storage";
import { getRequestMeta } from "@/lib/request-context";

function spawnTsxScript(scriptPath: string, args: string[] = []) {
  const child = spawn(process.execPath, ["--import", "tsx/esm", scriptPath, ...args], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();
}

function redirectBack(status: string) {
  revalidatePath("/owner/catalog/sync");
  redirect(`/owner/catalog/sync?status=${status}`);
}

function formSettings(formData: FormData): CatalogSyncSettings {
  return normalizeSyncSettings({
    shopUrl: String(formData.get("shopUrl") ?? ""),
    maxProductsPerRun: Number(formData.get("maxProductsPerRun") ?? 25),
    delayMs: Number(formData.get("delayMs") ?? 1500),
    resumeFromLastProduct: formData.get("resumeFromLastProduct") === "on",
    skuExtractionRule: formData.get("skuExtractionRule") as CatalogSyncSettings["skuExtractionRule"],
    customRegex: String(formData.get("customRegex") ?? "")
  });
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function openMeeshoLoginAction(formData: FormData) {
  const user = await requireUser(["OWNER"]);
  const request = await getRequestMeta();
  const state = await loadSyncState();
  const rawLoginUrl = String(formData.get("loginUrl") ?? state.settings.shopUrl ?? "");
  const loginUrl = isValidUrl(rawLoginUrl) ? rawLoginUrl : "https://www.meesho.com/";

  spawnTsxScript(join(process.cwd(), "scripts", "catalog", "open-meesho-login.ts"), [loginUrl]);

  await recordAuditLog({
    userId: user.id,
    action: "CATALOG_SYNC_OPEN_LOGIN",
    entityType: "CatalogSync",
    metadata: { loginUrl },
    request
  });

  redirectBack("login-opened");
}

export async function startCatalogSyncAction(formData: FormData) {
  const user = await requireUser(["OWNER"]);
  const request = await getRequestMeta();
  const settings = formSettings(formData);

  if (!isValidUrl(settings.shopUrl)) {
    await appendSyncError({
      createdAt: nowIso(),
      errorType: "INVALID_SHOP_URL",
      message: "Shop URL must be a valid http:// or https:// URL.",
      rawValue: settings.shopUrl
    });
    redirectBack("invalid-url");
  }

  const existingQueue = await loadSyncQueue();
  const queue = settings.resumeFromLastProduct
    ? existingQueue.map((item) => (item.status === "processing" ? { ...item, status: "pending" as const } : item))
    : [];
  const defaultState = defaultSyncState();

  if (!settings.resumeFromLastProduct) {
    await saveSyncErrors([]);
  }

  await saveSyncQueue(queue);
  await saveSyncState({
    ...defaultState,
    status: "RUNNING",
    activeRunId: newRunId(),
    startedAt: nowIso(),
    settings,
    stats: settings.resumeFromLastProduct
      ? {
          ...defaultState.stats,
          totalProductsDiscovered: queue.length,
          productsProcessed: queue.filter((item) => item.status === "processed" || item.status === "failed").length,
          productsFailed: queue.filter((item) => item.status === "failed").length
        }
      : defaultState.stats,
    lastMessage: "Catalog sync queued."
  });

  spawnTsxScript(join(process.cwd(), "scripts", "catalog", "run-catalog-sync.ts"));

  await recordAuditLog({
    userId: user.id,
    action: "CATALOG_SYNC_STARTED",
    entityType: "CatalogSync",
    metadata: {
      shopUrl: settings.shopUrl,
      maxProductsPerRun: settings.maxProductsPerRun,
      delayMs: settings.delayMs,
      resumeFromLastProduct: settings.resumeFromLastProduct,
      skuExtractionRule: settings.skuExtractionRule
    },
    request
  });

  redirectBack("started");
}

export async function pauseCatalogSyncAction() {
  await requireUser(["OWNER"]);
  const state = await loadSyncState();

  await saveSyncState({
    ...state,
    status: "PAUSED",
    lastMessage: "Pause requested. The runner will stop after the current product."
  });

  redirectBack("paused");
}

export async function resumeCatalogSyncAction() {
  await requireUser(["OWNER"]);
  const state = await loadSyncState();

  await saveSyncState({
    ...state,
    status: "RUNNING",
    lastMessage: "Resume requested."
  });
  spawnTsxScript(join(process.cwd(), "scripts", "catalog", "run-catalog-sync.ts"));
  redirectBack("resumed");
}

export async function stopCatalogSyncAction() {
  await requireUser(["OWNER"]);
  const state = await loadSyncState();

  await saveSyncState({
    ...state,
    status: "STOPPING",
    lastMessage: "Stop requested. The runner will stop after the current product."
  });

  redirectBack("stopping");
}

export async function refreshFailedCatalogItemsAction() {
  await requireUser(["OWNER"]);
  const state = await loadSyncState();
  const queue = await loadSyncQueue();
  const updatedQueue = queue.map((item) =>
    item.status === "failed"
      ? {
          ...item,
          status: "pending" as const,
          error: undefined
        }
      : item
  );
  const refreshed = updatedQueue.filter((item, index) => queue[index]?.status === "failed" && item.status === "pending").length;

  await saveSyncQueue(updatedQueue);
  await saveSyncState({
    ...state,
    status: "PAUSED",
    lastMessage: `Refreshed ${refreshed} failed item(s). Resume when ready.`,
    stats: {
      ...state.stats,
      totalProductsDiscovered: updatedQueue.length
    }
  });

  redirectBack("failed-refreshed");
}

export async function refreshSelectedSkuAction(formData: FormData) {
  await requireUser(["OWNER"]);
  const sku = String(formData.get("selectedSku") ?? "").trim();
  const index = await loadCatalogIndex();
  const product = searchCatalogByExactSku(index, sku);

  if (!product?.productUrl) {
    await appendSyncError({
      createdAt: nowIso(),
      sku,
      errorType: "SKU_REFRESH_NOT_FOUND",
      message: "Selected SKU was not found in the catalog or does not have a product URL.",
      rawValue: sku
    });
    redirectBack("sku-not-found");
    return;
  }

  const queue = await loadSyncQueue();
  const id = queueItemId(product.productUrl);
  const exists = queue.some((item) => item.id === id);
  const queueItem: CatalogSyncQueueItem = {
    id,
    productUrl: product.productUrl,
    sku: product.sku,
    title: product.title,
    status: "pending",
    attempts: 0,
    discoveredAt: nowIso()
  };
  const updatedQueue = exists ? queue.map((item) => (item.id === id ? { ...item, status: "pending" as const, error: undefined } : item)) : [queueItem, ...queue];
  const state = await loadSyncState();

  await saveSyncQueue(updatedQueue);
  await saveSyncState({
    ...state,
    status: "PAUSED",
    lastMessage: `Queued ${product.sku} for refresh. Resume when ready.`,
    stats: {
      ...state.stats,
      totalProductsDiscovered: updatedQueue.length
    }
  });

  redirectBack("sku-queued");
}
