"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type CatalogUrlImageProps = {
  src?: string | null;
  alt: string;
  size?: "hero" | "thumb";
  className?: string;
};

const sizeClassName = {
  hero: "aspect-square w-full",
  thumb: "h-24 w-24"
};

function isDisplayableUrl(value: string | null | undefined) {
  if (!value || (!value.startsWith("http://") && !value.startsWith("https://"))) {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function CatalogUrlImage({ src, alt, size = "thumb", className }: CatalogUrlImageProps) {
  const validSrc = isDisplayableUrl(src) ? src : null;
  const [state, setState] = useState<"missing" | "loading" | "loaded" | "failed">(validSrc ? "loading" : "missing");

  useEffect(() => {
    setState(validSrc ? "loading" : "missing");
  }, [validSrc]);

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-2xl border border-white/80 bg-slate-100 shadow-[0_14px_30px_rgba(15,23,42,0.08)]",
        sizeClassName[size],
        className
      )}
      title={validSrc ?? "No image URL"}
    >
      {state === "loading" ? <div className="absolute inset-0 animate-pulse bg-slate-200" /> : null}
      {validSrc && state !== "failed" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={validSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn("h-full w-full object-cover transition-opacity", state === "loaded" ? "opacity-100" : "opacity-0")}
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {state === "failed" ? "Image failed to load" : "No image URL"}
          </span>
        </div>
      )}
      {state === "failed" && validSrc ? (
        <a
          href={validSrc}
          target="_blank"
          rel="noreferrer"
          className="absolute inset-x-2 bottom-2 rounded-xl bg-white/92 px-2 py-1 text-center text-[11px] font-semibold text-slate-700 shadow-sm"
        >
          Open URL
        </a>
      ) : null}
    </div>
  );
}
