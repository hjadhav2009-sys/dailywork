"use client";

import { useEffect, useState, type MouseEvent } from "react";
import {
  getInitialDisplayImageState,
  isDisplayableImageSrc,
  isLoadableImageUrl,
  productImageStateText,
  type ProductImageState
} from "@/lib/product-image";
import { markProductImageBrokenAction, markProductImageMappedAction } from "./product-image-actions";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  mappingId?: string | null;
  showDebug?: boolean;
  imageHealth?: string | null;
  cacheStatus?: string | null;
  originalImageUrl?: string | null;
};

const sizeClass = {
  sm: "h-20 w-20",
  md: "h-32 w-32",
  lg: "aspect-square w-full"
};

function initialState(src: string | null | undefined, imageHealth: string | null | undefined, cacheStatus: string | null | undefined) {
  return (imageHealth === "BROKEN" || cacheStatus === "BROKEN") && !src ? "broken" : getInitialDisplayImageState(src);
}

export function ProductImage({
  src,
  alt,
  size = "md",
  showBadge = true,
  mappingId,
  showDebug = false,
  imageHealth,
  cacheStatus,
  originalImageUrl
}: ProductImageProps) {
  const [state, setState] = useState<ProductImageState>(initialState(src, imageHealth, cacheStatus));
  const [slowLoading, setSlowLoading] = useState(false);
  const [manualCheck, setManualCheck] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const validSrc = isDisplayableImageSrc(src) ? src : null;
  const isExternalSrc = isLoadableImageUrl(validSrc);
  const hasSource = Boolean(validSrc);
  const stateText = productImageStateText(state, hasSource, slowLoading, cacheStatus);
  const previewSrc = validSrc ?? originalImageUrl ?? null;

  useEffect(() => {
    setState(initialState(src, imageHealth, cacheStatus));
    setSlowLoading(false);
    setManualCheck(false);
    setPreviewOpen(false);
    if (src && !validSrc && mappingId) {
      void markProductImageBrokenAction(mappingId);
    }
  }, [cacheStatus, imageHealth, mappingId, src, validSrc]);

  useEffect(() => {
    if (!validSrc || state !== "loading" || !isExternalSrc) {
      setSlowLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setSlowLoading(true);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [isExternalSrc, retryVersion, state, validSrc]);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [previewOpen]);

  function stopParentNavigation(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function retryImage(event: MouseEvent<HTMLButtonElement>) {
    stopParentNavigation(event);
    setSlowLoading(false);
    setManualCheck(true);
    setState(validSrc ? "loading" : getInitialDisplayImageState(src));
    setRetryVersion((version) => version + 1);
  }

  function openImageUrl(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();

    if (originalImageUrl ?? src) {
      window.open(originalImageUrl ?? src ?? "", "_blank", "noopener,noreferrer");
    }
  }

  function openPreview(event: MouseEvent<HTMLButtonElement>) {
    stopParentNavigation(event);

    if (previewSrc) {
      setPreviewOpen(true);
    }
  }

  const badge =
    state === "loaded"
      ? { label: "Image mapped", className: "bg-emerald-50/92 text-emerald-900 ring-emerald-200/90" }
      : state === "broken"
        ? { label: showDebug ? stateText : "Image issue", className: "bg-rose-50/92 text-rose-900 ring-rose-200/90" }
        : { label: stateText, className: "bg-amber-50/92 text-amber-950 ring-amber-200/90" };

  return (
    <>
      <div
        className={`relative flex shrink-0 overflow-hidden rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.9)_100%)] shadow-[0_16px_34px_rgba(15,23,42,0.08)] ${sizeClass[size]}`}
        title={src ? `${stateText}: ${src}` : stateText}
      >
        {state === "loading" ? <div className="absolute inset-0 animate-pulse bg-slate-200/80" /> : null}
        {validSrc && state !== "broken" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${validSrc}-${retryVersion}`}
            src={validSrc}
            alt={alt}
            className={`h-full w-full object-cover transition-opacity ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
            decoding="async"
            loading="lazy"
            onLoad={() => {
              setState("loaded");
              setSlowLoading(false);
              if (isExternalSrc && mappingId && (imageHealth === "BROKEN" || manualCheck)) {
                void markProductImageMappedAction(mappingId);
              }
              setManualCheck(false);
            }}
            onError={() => {
              setState("broken");
              setSlowLoading(false);
              setManualCheck(false);
              if (isExternalSrc && mappingId) {
                void markProductImageBrokenAction(mappingId);
              }
            }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {state === "broken" ? "Image URL failed" : stateText}
            </span>
            <span className="mt-1 text-xs leading-5 text-slate-500">
              {state === "missing" ? "Prepare images from owner upload review" : stateText}
            </span>
            {showDebug && state === "broken" && validSrc && isExternalSrc ? (
              <button
                type="button"
                onClick={retryImage}
                className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
              >
                Check this image
              </button>
            ) : null}
            {showDebug && originalImageUrl ? (
              <button type="button" onClick={openImageUrl} className="mt-2 text-xs font-semibold text-[var(--dw-brand)] underline">
                Open original URL
              </button>
            ) : null}
          </div>
        )}

        {state === "loading" && slowLoading && isExternalSrc ? (
          <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-white/92 px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-950">
            External image slow
          </div>
        ) : null}

        {showBadge ? (
          <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ${badge.className}`}>
            {badge.label}
          </span>
        ) : null}

        {previewSrc && state === "loaded" ? (
          <button
            type="button"
            onClick={openPreview}
            className="absolute bottom-2 right-2 rounded-full bg-slate-950/82 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)] backdrop-blur"
          >
            Preview
          </button>
        ) : null}

        {showDebug && state === "broken" && (originalImageUrl ?? src) ? (
          <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-white/95 px-2 py-1 text-[10px] font-medium text-slate-600">
            <button type="button" onClick={openImageUrl} className="font-semibold text-[var(--dw-brand)] underline">
              Open original URL
            </button>
            <p className="mt-1 truncate">{originalImageUrl ?? src}</p>
          </div>
        ) : null}
      </div>

      {previewOpen && previewSrc ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/14 bg-[linear-gradient(160deg,rgba(15,23,42,0.96)_0%,rgba(15,118,110,0.82)_120%)] shadow-[0_40px_120px_rgba(15,23,42,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/12 px-5 py-4 text-white sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Large preview</p>
                <p className="mt-1 truncate text-lg font-semibold">{alt}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {originalImageUrl ? (
                  <button
                    type="button"
                    onClick={() => openImageUrl()}
                    className="rounded-2xl border border-white/16 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16"
                  >
                    Open source
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08)_0%,transparent_45%)] p-4 sm:p-6">
              <div className="overflow-hidden rounded-[28px] border border-white/12 bg-white/6 p-3 sm:p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewSrc} alt={alt} className="mx-auto max-h-[68vh] w-auto rounded-[22px] object-contain" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
