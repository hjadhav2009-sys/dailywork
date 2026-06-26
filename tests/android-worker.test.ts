import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  androidWorkerAbsoluteUrl,
  androidWorkerConnectionStatus,
  androidWorkerPackingResultRoute,
  androidWorkerRouteForMode,
  androidWorkerScannerTarget,
  normalizeAndroidWorkerServerUrl
} from "../lib/android-worker";

assert.deepEqual(
  normalizeAndroidWorkerServerUrl("192.168.1.20:3000"),
  { ok: true, url: "http://192.168.1.20:3000" },
  "Server URL helper adds http:// for local LAN IPs"
);
assert.deepEqual(
  normalizeAndroidWorkerServerUrl("http://192.168.1.20:3000/"),
  { ok: true, url: "http://192.168.1.20:3000" },
  "Server URL helper trims trailing slash"
);
assert.equal(normalizeAndroidWorkerServerUrl("https://dailywork.local:3000").ok, true, "Server URL helper allows local host names");
assert.equal(normalizeAndroidWorkerServerUrl("http://DESKTOP-DAILYWORK:3000").ok, true, "Server URL helper allows LAN PC names");
assert.equal(normalizeAndroidWorkerServerUrl("https://8.8.8.8:3000").ok, false, "Server URL helper rejects public IPv4 hosting");
assert.equal(normalizeAndroidWorkerServerUrl("https://dailywork.example.com").ok, false, "Server URL helper rejects public host names");

assert.equal(androidWorkerRouteForMode("picker"), "/picker", "Picker mode opens picker route");
assert.equal(androidWorkerRouteForMode("sku-search"), "/picker/search-sku", "SKU search mode opens catalog SKU search");
assert.equal(androidWorkerRouteForMode("packer"), "/packing", "Packer mode opens packing route");
assert.equal(androidWorkerRouteForMode("problems"), "/problems", "Problems mode opens problems route");
assert.equal(androidWorkerRouteForMode("logout"), "/auth/session-ended?reason=expired", "Logout mode uses existing session cleanup route");

assert.deepEqual(
  androidWorkerPackingResultRoute(" 1490 8349 1549 3571 "),
  { ok: true, awb: "1490834915493571", route: "/packing/1490834915493571" },
  "AWB route helper normalizes and opens packing result route"
);
assert.equal(androidWorkerPackingResultRoute("bad").ok, false, "AWB route helper rejects invalid AWBs");
assert.deepEqual(
  androidWorkerAbsoluteUrl("192.168.1.20:3000", "/picker"),
  { ok: true, url: "http://192.168.1.20:3000/picker" },
  "Absolute URL helper combines server URL and worker route"
);
assert.deepEqual(
  androidWorkerScannerTarget("192.168.1.20:3000", "SF3423949467FPL"),
  { ok: true, url: "http://192.168.1.20:3000/packing/SF3423949467FPL" },
  "Scanner target helper routes native scan results to packing result"
);

assert.deepEqual(
  androidWorkerConnectionStatus({ ok: true, status: 200 }),
  { status: "online", message: "PC server is reachable." },
  "Connection status helper marks 200 as online"
);
assert.deepEqual(
  androidWorkerConnectionStatus({ ok: false, error: "timeout" }),
  { status: "offline", message: "timeout" },
  "Connection status helper shows network errors"
);

const androidManifest = readFileSync("android-worker/app/src/main/AndroidManifest.xml", "utf8");
const androidMainActivity = readFileSync("android-worker/app/src/main/java/com/dailywork/worker/MainActivity.java", "utf8");
const androidRoutes = readFileSync("android-worker/app/src/main/java/com/dailywork/worker/DailyWorkRoutes.java", "utf8");
const androidDocs = readFileSync("docs/android-worker-app.md", "utf8");

assert.equal(existsSync("android-worker/app/build.gradle"), true, "Android worker Gradle app module exists");
assert.match(androidManifest, /android\.permission\.CAMERA/, "Android app requests camera permission for native scanning");
assert.match(androidManifest, /android\.permission\.INTERNET/, "Android app can reach the local PC server");
assert.match(androidManifest, /usesCleartextTraffic="true"/, "Android app allows local HTTP server URLs");
assert.match(androidMainActivity, /WebView/, "Android app wraps the existing DailyWork web app");
assert.match(androidMainActivity, /IntentIntegrator/, "Android app uses native barcode scanning");
assert.match(androidMainActivity, /SERVER_URL_KEY/, "Android app persists only the PC server URL setting");
assert.doesNotMatch(androidMainActivity, /password/i, "Android app code does not store passwords");
assert.match(androidRoutes, /\/packing\//, "Android routes open scanned AWBs in the packing result route");
assert.match(androidDocs, /gradle :app:assembleDebug/, "Android docs include the APK build command");
assert.match(androidDocs, /does not scrape Meesho/i, "Android docs confirm no scraping was added");

console.log("Android worker tests passed.");
