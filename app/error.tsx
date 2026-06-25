"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <ErrorState
        title="Something interrupted the workspace"
        description={error.message || "Refresh the page or try the action again. Nothing was reset automatically."}
        action={
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#115e59_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(15,118,110,0.24)] transition hover:-translate-y-0.5"
          >
            Try again
          </button>
        }
        link={{ href: "/login", label: "Back to login" }}
      />
    </main>
  );
}
