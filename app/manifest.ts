import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DailyWork Pick & Pack",
    short_name: "DailyWork",
    description: "Warehouse picking and packing workflow for Meesho seller label batches.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5efe5",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
