import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type BrowserContext } from "playwright-core";

export const meeshoBrowserProfileDir = join(process.cwd(), "storage", "browser", "meesho-profile");
export const defaultMeeshoLoginUrl = "https://www.meesho.com/";

const windowsBrowserPaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

function candidateBrowserPaths() {
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env["PROGRAMFILES(X86)"];
  const candidates = [
    ...windowsBrowserPaths,
    localAppData ? join(localAppData, "Google", "Chrome", "Application", "chrome.exe") : "",
    programFiles ? join(programFiles, "Google", "Chrome", "Application", "chrome.exe") : "",
    programFilesX86 ? join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe") : "",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ];

  return candidates.filter(Boolean);
}

export function findInstalledBrowserExecutable() {
  return candidateBrowserPaths().find((path) => existsSync(path)) ?? null;
}

async function blockHeavyResources(context: BrowserContext) {
  await context.route("**/*", async (route) => {
    const resourceType = route.request().resourceType();

    if (["image", "media", "font"].includes(resourceType)) {
      await route.abort();
      return;
    }

    await route.continue();
  });
}

export async function launchMeeshoBrowserContext(input: { headless: boolean; blockImages?: boolean }) {
  const executablePath = findInstalledBrowserExecutable();

  if (!executablePath) {
    throw new Error("Chrome or Edge is required for Meesho catalog sync.");
  }

  await mkdir(meeshoBrowserProfileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(meeshoBrowserProfileDir, {
    executablePath,
    headless: input.headless,
    viewport: { width: 1366, height: 900 }
  });

  if (input.blockImages !== false) {
    await blockHeavyResources(context);
  }

  return context;
}

export async function openManualMeeshoLogin(url = defaultMeeshoLoginUrl) {
  const context = await launchMeeshoBrowserContext({
    headless: false,
    blockImages: false
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  return context;
}
