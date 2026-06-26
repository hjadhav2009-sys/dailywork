package com.dailywork.worker;

import android.net.Uri;

import java.util.Locale;
import java.util.regex.Pattern;

final class DailyWorkRoutes {
    private static final Pattern PRIVATE_IPV4 = Pattern.compile(
            "^(10\\.(\\d{1,3}\\.){2}\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[0-1])\\.\\d{1,3}\\.\\d{1,3}|127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})$"
    );
    private static final Pattern AWB = Pattern.compile("^[A-Z0-9]{8,24}$");

    private DailyWorkRoutes() {
    }

    static String normalizeServerUrl(String value) {
        String trimmed = value == null ? "" : value.trim().replaceAll("/+$", "");

        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Enter the PC IP address or local server URL.");
        }

        String withScheme = trimmed.matches("(?i)^https?://.*") ? trimmed : "http://" + trimmed;
        Uri uri = Uri.parse(withScheme);
        String scheme = uri.getScheme();
        String host = uri.getHost();

        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            throw new IllegalArgumentException("DailyWork Worker supports http:// or https:// server URLs only.");
        }

        if (host == null || host.trim().isEmpty()) {
            throw new IllegalArgumentException("Enter the PC IP address or host name.");
        }

        if (hasValidIpv4Octets(host) && !PRIVATE_IPV4.matcher(host).matches()) {
            throw new IllegalArgumentException("Use a local Wi-Fi, hotspot, or LAN IP address. Public hosting is not required.");
        }

        if (!hasValidIpv4Octets(host) && !isAllowedLocalHostname(host)) {
            throw new IllegalArgumentException("Use a local PC name, .local host name, or LAN IP address.");
        }

        return withScheme.replaceAll("/+$", "");
    }

    static String routeForMode(String mode) {
        if ("picker".equals(mode)) {
            return "/picker";
        }
        if ("sku-search".equals(mode)) {
            return "/picker/search-sku";
        }
        if ("problems".equals(mode)) {
            return "/problems";
        }
        if ("logout".equals(mode)) {
            return "/auth/session-ended?reason=expired";
        }
        return "/packing";
    }

    static String normalizeAwb(String value) {
        String raw = value == null ? "" : value.trim();
        return raw.replaceAll("[\\u0000-\\u001f\\u007f-\\u009f\\s]", "")
                .replaceAll("[^A-Za-z0-9]", "")
                .toUpperCase(Locale.ROOT);
    }

    static boolean isValidAwb(String value) {
        String awb = normalizeAwb(value);
        return AWB.matcher(awb).matches() && !awb.matches("^0+$");
    }

    static String packingRoute(String value) {
        String awb = normalizeAwb(value);

        if (!isValidAwb(awb)) {
            throw new IllegalArgumentException("Scan or enter a valid AWB.");
        }

        return "/packing/" + Uri.encode(awb);
    }

    static String absoluteUrl(String serverUrl, String route) {
        String normalized = normalizeServerUrl(serverUrl);
        String path = route.startsWith("/") ? route : "/" + route;
        return normalized + path;
    }

    private static boolean hasValidIpv4Octets(String host) {
        String[] parts = host.split("\\.");

        if (parts.length != 4) {
            return false;
        }

        for (String part : parts) {
            if (!part.matches("^\\d{1,3}$")) {
                return false;
            }

            int value = Integer.parseInt(part);
            if (value < 0 || value > 255) {
                return false;
            }
        }

        return true;
    }

    private static boolean isAllowedLocalHostname(String host) {
        String normalized = host.toLowerCase(Locale.ROOT);
        return "localhost".equals(normalized) || normalized.endsWith(".local") || !normalized.contains(".");
    }
}
