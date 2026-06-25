"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeAwb, isValidAwb } from "@/lib/awb";
import { ProductImage } from "./ProductImage";
import { SubmitButton } from "./SubmitButton";

type AwbBarcodeScannerProps = {
  action: (formData: FormData) => void | Promise<void>;
  defaultAwb?: string;
};

type BarcodeResult = {
  getText: () => string;
};

type AwbSuggestion = {
  awb: string;
  sku: string;
  cachedImageUrl?: string | null;
  cacheStatus?: string | null;
  color?: string | null;
  qty: number;
  courier?: string | null;
  packStatus: string;
  matchType: "EXACT" | "SUFFIX" | "CONTAINS";
};

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function AwbBarcodeScanner({ action, defaultAwb }: AwbBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const hiddenFormRef = useRef<HTMLFormElement | null>(null);
  const hiddenAwbRef = useRef<HTMLInputElement | null>(null);
  const lastScanAtRef = useRef(0);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "scanning" | "stopped" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [httpsWarning, setHttpsWarning] = useState(false);
  const [detectedAwb, setDetectedAwb] = useState<string | null>(null);
  const [manualAwb, setManualAwb] = useState(defaultAwb ?? "");
  const [suggestions, setSuggestions] = useState<AwbSuggestion[]>([]);
  const [suggestionState, setSuggestionState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const stopVideoTracks = useCallback(() => {
    const stream = videoRef.current?.srcObject;

    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    stopVideoTracks();
    setCameraState((state) => (state === "scanning" || state === "starting" ? "stopped" : state));
  }, [stopVideoTracks]);

  useEffect(() => {
    setHttpsWarning(window.location.protocol !== "https:" && !isLocalhost(window.location.hostname));

    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      stopVideoTracks();
    };
  }, [stopVideoTracks]);

  useEffect(() => {
    const query = normalizeAwb(manualAwb);

    if (query.length < 5) {
      setSuggestions([]);
      setSuggestionState("idle");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSuggestionState("loading");
      fetch(`/packing/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json"
        }
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Search failed");
          }

          return response.json() as Promise<{ results?: AwbSuggestion[] }>;
        })
        .then((payload) => {
          setSuggestions(payload.results ?? []);
          setSuggestionState("ready");
        })
        .catch((caughtError) => {
          if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
            return;
          }

          setSuggestionState("error");
          setSuggestions([]);
        });
    }, 150);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [manualAwb]);

  function submitDetectedAwb(awb: string) {
    setDetectedAwb(awb);
    stopScanner();

    if (hiddenAwbRef.current && hiddenFormRef.current) {
      hiddenAwbRef.current.value = awb;
      hiddenFormRef.current.requestSubmit();
    }
  }

  async function startScanner() {
    setError(null);
    setDetectedAwb(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("error");
      setError("Camera scanner is not supported in this browser. Use manual AWB entry.");
      return;
    }

    if (!videoRef.current) {
      return;
    }

    try {
      setCameraState("starting");
      const reader = new BrowserMultiFormatReader();
      const callback = (result: BarcodeResult | undefined) => {
        if (!result) {
          return;
        }

        const now = Date.now();

        if (now - lastScanAtRef.current < 2000) {
          return;
        }

        const awb = normalizeAwb(result.getText());

        if (!isValidAwb(awb)) {
          setError("Barcode scanned, but it did not look like a valid AWB. Try again or enter it manually.");
          lastScanAtRef.current = now;
          return;
        }

        lastScanAtRef.current = now;
        navigator.vibrate?.(80);
        submitDetectedAwb(awb);
      };

      controlsRef.current = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        videoRef.current,
        callback
      );
      setCameraState("scanning");
    } catch (caughtError) {
      stopVideoTracks();
      setCameraState("error");

      if (caughtError instanceof DOMException && caughtError.name === "NotAllowedError") {
        setError("Camera permission was denied. Allow camera access or use manual AWB entry.");
      } else if (caughtError instanceof DOMException && caughtError.name === "NotFoundError") {
        setError("No camera was found on this device. Use manual AWB entry.");
      } else {
        setError("Camera could not start. Use manual AWB entry.");
      }
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="dw-card overflow-hidden bg-[linear-gradient(160deg,rgba(15,23,42,0.96)_0%,rgba(15,118,110,0.92)_120%)] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Camera scanner</p>
            <h2 className="mt-3 text-2xl font-semibold">Point at the AWB barcode</h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-white/80">
              This view is optimized for workers on mobile. Open the rear camera, scan once, and we’ll jump straight into the order.
            </p>
          </div>
          <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
            {cameraState === "scanning" ? "Scanning" : cameraState === "starting" ? "Starting" : "Ready"}
          </span>
        </div>

        {httpsWarning ? (
          <div className="mt-4 rounded-[22px] border border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm font-medium text-amber-50">
            Camera access may fail on insecure HTTP. Use HTTPS or switch to manual AWB entry below.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[22px] border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm font-medium text-rose-50">
            {error}
          </div>
        ) : null}

        <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60 sm:aspect-video">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-64 max-w-[78%] rounded-[24px] border-2 border-white shadow-[0_0_0_999px_rgba(2,6,23,0.42)]">
              <div className="mx-auto mt-1.5 h-0.5 w-28 bg-[var(--dw-accent)]" />
            </div>
          </div>
        </div>

        {detectedAwb ? (
          <p className="mt-3 rounded-[20px] bg-emerald-400/12 px-4 py-3 text-sm font-semibold text-emerald-50">
            Scanned AWB {detectedAwb}. Opening order...
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={startScanner}
            disabled={cameraState === "starting" || cameraState === "scanning"}
            className="inline-flex min-h-14 items-center justify-center rounded-[22px] bg-white px-5 py-3 text-base font-semibold text-slate-950 shadow-[0_18px_28px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:opacity-60 sm:min-h-12 sm:text-sm"
          >
            Start camera
          </button>
          <button
            type="button"
            onClick={stopScanner}
            className="inline-flex min-h-14 items-center justify-center rounded-[22px] border border-white/14 bg-white/8 px-5 py-3 text-base font-semibold text-white transition hover:bg-white/14 sm:min-h-12 sm:text-sm"
          >
            Stop
          </button>
        </div>
      </section>

      <section className="dw-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Manual fallback</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">Search by AWB</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Type the full AWB or the last 5 to 8 characters. Suggestions stay visible so workers can recover quickly when a barcode is unclear.
            </p>
          </div>
          <span className="dw-chip">Live suggestions</span>
        </div>

        <form action={action} className="mt-5 space-y-4">
          <label className="block">
            <span className="dw-label">AWB</span>
            <input
              name="awb"
              inputMode="text"
              autoComplete="off"
              value={manualAwb}
              onChange={(event) => setManualAwb(event.target.value)}
              placeholder="1490834915493571"
              className="dw-input mt-2 min-h-16 text-2xl font-semibold uppercase tracking-[0.02em] sm:min-h-14 sm:text-xl"
              required
            />
          </label>

          <div className="min-h-24 space-y-2">
            {normalizeAwb(manualAwb).length > 0 && normalizeAwb(manualAwb).length < 5 ? (
              <p className="text-sm font-medium text-slate-500">Type at least the last 5 AWB characters for live suggestions.</p>
            ) : null}
            {suggestionState === "loading" ? <p className="text-sm font-medium text-slate-500">Searching...</p> : null}
            {suggestionState === "error" ? (
              <p className="text-sm font-medium text-rose-700">Live suggestions failed. Manual submit still works.</p>
            ) : null}
            {suggestionState === "ready" && suggestions.length === 0 ? (
              <p className="text-sm font-medium text-amber-900">No matching AWB found for this account.</p>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">
                  {suggestions.length === 1 ? "One match found. Open it or submit the search." : `${suggestions.length} matches found. Choose the correct AWB.`}
                </p>
                <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                  {suggestions.map((suggestion) => (
                    <a
                      key={suggestion.awb}
                      href={`/packing/${encodeURIComponent(suggestion.awb)}`}
                      className="grid grid-cols-[5rem_1fr] gap-3 rounded-[24px] border border-white/80 bg-[rgba(248,250,252,0.9)] p-3 shadow-[0_14px_28px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:bg-white sm:grid-cols-[auto_1fr_auto]"
                    >
                      <ProductImage
                        src={suggestion.cachedImageUrl}
                        alt={`${suggestion.sku} ${suggestion.awb}`}
                        size="sm"
                        showBadge={false}
                        cacheStatus={suggestion.cacheStatus}
                      />
                      <span className="min-w-0">
                        <span className="block break-all text-lg font-semibold text-slate-950 sm:text-sm">{suggestion.awb}</span>
                        <span className="mt-1 block text-sm font-semibold text-slate-800 sm:font-medium sm:text-slate-600">
                          {suggestion.sku}
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">
                          Qty {suggestion.qty} / {suggestion.color ?? "Color unknown"} / {suggestion.courier ?? "Courier pending"}
                        </span>
                        <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 ring-1 ring-slate-200">
                          {suggestion.packStatus}
                        </span>
                      </span>
                      <span className="col-span-2 justify-self-start rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white sm:col-span-1 sm:self-center sm:justify-self-auto">
                        {suggestion.matchType}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <SubmitButton pendingText="Searching..." className="w-full">
            Find order
          </SubmitButton>
        </form>
      </section>

      <form ref={hiddenFormRef} action={action} className="hidden">
        <input ref={hiddenAwbRef} type="hidden" name="awb" />
        <input type="hidden" name="source" value="camera" />
      </form>
    </div>
  );
}
