import { isValidAwb, normalizeAwb } from "@/lib/awb";

export type AndroidWorkerMode = "picker" | "sku-search" | "packer" | "scanner" | "problems" | "logout";
export type ConnectionProbeResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

const privateIpv4Patterns = [
  /^10\.(\d{1,3}\.){2}\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
];

function hasValidIpv4Octets(hostname: string) {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    const value = Number(part);
    return /^\d{1,3}$/.test(part) && value >= 0 && value <= 255;
  });
}

function isAllowedLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (normalized === "localhost" || normalized.endsWith(".local")) {
    return true;
  }

  if (!normalized.includes(".")) {
    return true;
  }

  return false;
}

export function normalizeAndroidWorkerServerUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;

  try {
    url = new URL(withScheme);
  } catch {
    return {
      ok: false as const,
      error: "Enter a valid PC server URL, such as http://192.168.1.20:3000."
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false as const,
      error: "DailyWork Worker supports http:// or https:// server URLs only."
    };
  }

  if (!url.hostname) {
    return {
      ok: false as const,
      error: "Enter the PC IP address or host name."
    };
  }

  if (hasValidIpv4Octets(url.hostname) && !privateIpv4Patterns.some((pattern) => pattern.test(url.hostname))) {
    return {
      ok: false as const,
      error: "Use a local Wi-Fi, hotspot, or LAN IP address. Public hosting is not required."
    };
  }

  if (!hasValidIpv4Octets(url.hostname) && !isAllowedLocalHostname(url.hostname)) {
    return {
      ok: false as const,
      error: "Use a local PC name, .local host name, or LAN IP address."
    };
  }

  return {
    ok: true as const,
    url: url.toString().replace(/\/+$/, "")
  };
}

export function androidWorkerRouteForMode(mode: AndroidWorkerMode) {
  switch (mode) {
    case "picker":
      return "/picker";
    case "sku-search":
      return "/picker/search-sku";
    case "packer":
    case "scanner":
      return "/packing";
    case "problems":
      return "/problems";
    case "logout":
      return "/auth/session-ended?reason=expired";
  }
}

export function androidWorkerPackingResultRoute(rawAwb: string) {
  const awb = normalizeAwb(rawAwb);

  if (!isValidAwb(awb)) {
    return {
      ok: false as const,
      error: "Scan or enter a valid AWB."
    };
  }

  return {
    ok: true as const,
    awb,
    route: `/packing/${encodeURIComponent(awb)}`
  };
}

export function androidWorkerAbsoluteUrl(serverUrl: string, route: string) {
  const normalized = normalizeAndroidWorkerServerUrl(serverUrl);

  if (!normalized.ok) {
    return normalized;
  }

  const path = route.startsWith("/") ? route : `/${route}`;
  return {
    ok: true as const,
    url: `${normalized.url}${path}`
  };
}

export function androidWorkerScannerTarget(serverUrl: string, rawAwb: string) {
  const route = androidWorkerPackingResultRoute(rawAwb);

  if (!route.ok) {
    return route;
  }

  return androidWorkerAbsoluteUrl(serverUrl, route.route);
}

export function androidWorkerConnectionStatus(result: ConnectionProbeResult) {
  if (result.ok && result.status && result.status >= 200 && result.status < 500) {
    return {
      status: "online" as const,
      message: "PC server is reachable."
    };
  }

  if (result.status) {
    return {
      status: "error" as const,
      message: `PC server responded with HTTP ${result.status}.`
    };
  }

  return {
    status: "offline" as const,
    message: result.error || "PC server is unreachable. Check Wi-Fi, hotspot, IP address, and port 3000."
  };
}
