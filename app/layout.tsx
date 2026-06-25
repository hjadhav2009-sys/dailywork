import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "DailyWork Pick & Pack",
  title: {
    default: "DailyWork Pick & Pack",
    template: "%s | DailyWork Pick & Pack"
  },
  description: "DailyWork warehouse pick-and-pack workspace for Meesho label batches, workers, and future catalog tools.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DailyWork",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
