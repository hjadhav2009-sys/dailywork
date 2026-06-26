import { loadCatalogIndex, saveCatalogIndex } from "./master";
import { mergeCatalogProductFromSync } from "./sync-merge";
import { parseMeeshoProductDetailHtml } from "./sync-parser";
import {
  appendSyncError,
  loadSyncQueue,
  loadSyncState,
  nowIso,
  queueItemId,
  saveSyncQueue,
  saveSyncState,
  type CatalogSyncQueueItem,
  type CatalogSyncSettings,
  type CatalogSyncState
} from "./sync-storage";
import { launchMeeshoBrowserContext } from "./sync-browser";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isMeeshoProductUrl(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)meesho\.com$/i.test(url.hostname) && (/\/p\//i.test(url.pathname) || /product/i.test(url.pathname));
  } catch {
    return false;
  }
}

function normalizeProductUrl(value: string, baseUrl: string) {
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function queueWithDiscoveredUrls(queue: CatalogSyncQueueItem[], urls: string[]) {
  const existingIds = new Set(queue.map((item) => item.id));
  const now = nowIso();
  const additions: CatalogSyncQueueItem[] = [];

  for (const productUrl of urls) {
    const id = queueItemId(productUrl);

    if (existingIds.has(id)) {
      continue;
    }

    existingIds.add(id);
    additions.push({
      id,
      productUrl,
      status: "pending",
      attempts: 0,
      discoveredAt: now
    });
  }

  return [...queue, ...additions];
}

async function writeStatePatch(patch: Partial<CatalogSyncState>) {
  const state = await loadSyncState();
  await saveSyncState({
    ...state,
    ...patch,
    settings: {
      ...state.settings,
      ...patch.settings
    },
    stats: {
      ...state.stats,
      ...patch.stats
    }
  });
}

async function discoverProductUrls(settings: CatalogSyncSettings) {
  if (!isValidUrl(settings.shopUrl)) {
    throw new Error("Shop URL must be a valid http:// or https:// URL.");
  }

  const directProductUrl = isMeeshoProductUrl(settings.shopUrl) ? settings.shopUrl : "";

  if (directProductUrl) {
    return [directProductUrl];
  }

  const context = await launchMeeshoBrowserContext({
    headless: true,
    blockImages: true
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(settings.shopUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
    const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).href)
    );

    return Array.from(
      new Set(
        hrefs
          .map((href) => normalizeProductUrl(href, settings.shopUrl))
          .filter(isMeeshoProductUrl)
          .slice(0, settings.maxProductsPerRun)
      )
    );
  } finally {
    await context.close();
  }
}

async function markQueueItemFailed(item: CatalogSyncQueueItem, message: string) {
  const queue = await loadSyncQueue();
  const updatedQueue = queue.map((queueItem) =>
    queueItem.id === item.id
      ? {
          ...queueItem,
          status: "failed" as const,
          attempts: queueItem.attempts + 1,
          processedAt: nowIso(),
          error: message
        }
      : queueItem
  );
  const state = await loadSyncState();

  await Promise.all([
    saveSyncQueue(updatedQueue),
    appendSyncError({
      createdAt: nowIso(),
      productUrl: item.productUrl,
      sku: item.sku,
      errorType: "PRODUCT_URL_FAILED",
      message,
      rawValue: item.productUrl
    }),
    saveSyncState({
      ...state,
      status: "RUNNING",
      activeProductUrl: item.productUrl,
      lastMessage: message,
      stats: {
        ...state.stats,
        productsProcessed: state.stats.productsProcessed + 1,
        productsFailed: state.stats.productsFailed + 1
      }
    })
  ]);
}

async function processQueueItem(item: CatalogSyncQueueItem, settings: CatalogSyncSettings) {
  const context = await launchMeeshoBrowserContext({
    headless: true,
    blockImages: true
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(item.productUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
    const html = await page.content();
    const detail = parseMeeshoProductDetailHtml(html, page.url());
    const index = await loadCatalogIndex();
    const result = mergeCatalogProductFromSync({
      index,
      detail,
      productUrl: item.productUrl,
      skuExtractionRule: settings.skuExtractionRule,
      customRegex: settings.customRegex,
      scrapedAt: nowIso()
    });
    const savedIndex = await saveCatalogIndex(result.index);
    const queue = await loadSyncQueue();
    const state = await loadSyncState();
    const updatedQueue = queue.map((queueItem) =>
      queueItem.id === item.id
        ? {
            ...queueItem,
            sku: result.sku,
            title: detail.title,
            status: result.failed ? ("failed" as const) : ("processed" as const),
            attempts: queueItem.attempts + 1,
            processedAt: nowIso(),
            error: result.failed ? result.message : undefined
          }
        : queueItem
    );
    const failedIncrement = result.failed ? 1 : 0;

    await saveSyncQueue(updatedQueue);
    await saveSyncState({
      ...state,
      status: "RUNNING",
      activeProductUrl: item.productUrl,
      lastSyncDate: nowIso(),
      lastMessage: result.message,
      stats: {
        ...state.stats,
        totalProductsDiscovered: updatedQueue.length,
        productsProcessed: state.stats.productsProcessed + 1,
        productsAdded: state.stats.productsAdded + (result.added ? 1 : 0),
        productsUpdated: state.stats.productsUpdated + (result.updated ? 1 : 0),
        productsFailed: state.stats.productsFailed + failedIncrement,
        brokenImageUrlCount: savedIndex.images.filter((image) => image.status === "broken").length
      }
    });

    if (result.failed) {
      await appendSyncError({
        createdAt: nowIso(),
        productUrl: item.productUrl,
        sku: result.sku,
        errorType: "PRODUCT_URL_FAILED",
        message: result.message,
        rawValue: item.productUrl
      });
    }
  } finally {
    await context.close();
  }
}

export async function runCatalogSync() {
  let state = await loadSyncState();
  const settings = state.settings;

  if (!settings.shopUrl) {
    await writeStatePatch({
      status: "FAILED",
      lastMessage: "Shop URL is required before starting catalog sync."
    });
    return;
  }

  try {
    await writeStatePatch({
      status: "DISCOVERING",
      lastMessage: "Discovering product URLs from configured source."
    });

    const discoveredUrls = await discoverProductUrls(settings);
    const currentQueue = settings.resumeFromLastProduct ? await loadSyncQueue() : [];
    const discoveredQueue = queueWithDiscoveredUrls(currentQueue, discoveredUrls);
    await saveSyncQueue(discoveredQueue);
    state = await loadSyncState();
    await saveSyncState({
      ...state,
      status: "RUNNING",
      startedAt: state.startedAt ?? nowIso(),
      lastMessage: `Discovered ${discoveredUrls.length} product URL(s).`,
      stats: {
        ...state.stats,
        totalProductsDiscovered: discoveredQueue.length
      }
    });

    let processedThisRun = 0;

    for (;;) {
      state = await loadSyncState();

      if (state.status === "PAUSED") {
        await writeStatePatch({
          activeProductUrl: undefined,
          lastMessage: "Catalog sync paused."
        });
        return;
      }

      if (state.status === "STOPPING" || state.status === "STOPPED") {
        await writeStatePatch({
          status: "STOPPED",
          activeProductUrl: undefined,
          lastMessage: "Catalog sync stopped."
        });
        return;
      }

      const queue = await loadSyncQueue();
      const nextItem = queue.find((item) => item.status === "pending");

      if (!nextItem) {
        await writeStatePatch({
          status: "COMPLETED",
          activeProductUrl: undefined,
          lastSyncDate: nowIso(),
          lastMessage: "Catalog sync completed."
        });
        return;
      }

      if (processedThisRun >= settings.maxProductsPerRun) {
        await writeStatePatch({
          status: "PAUSED",
          activeProductUrl: undefined,
          lastSyncDate: nowIso(),
          lastMessage: `Run limit reached after ${settings.maxProductsPerRun} product(s). Resume to continue.`
        });
        return;
      }

      const processingQueue = queue.map((item) => (item.id === nextItem.id ? { ...item, status: "processing" as const } : item));
      await saveSyncQueue(processingQueue);

      try {
        await processQueueItem(nextItem, settings);
      } catch (error) {
        await markQueueItemFailed(nextItem, error instanceof Error ? error.message : "Unknown sync error.");
      }

      processedThisRun += 1;
      await sleep(settings.delayMs);
    }
  } catch (error) {
    await writeStatePatch({
      status: "FAILED",
      activeProductUrl: undefined,
      lastMessage: error instanceof Error ? error.message : "Catalog sync failed."
    });
    await appendSyncError({
      createdAt: nowIso(),
      errorType: "SYNC_FAILED",
      message: error instanceof Error ? error.message : "Catalog sync failed.",
      rawValue: settings.shopUrl
    });
  }
}
