import { redirect } from "next/navigation";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    expired?: string;
    inactive?: string;
    passwordChanged?: string;
    setup?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/accounts");
  }

  const params = await searchParams;
  const hasInvalidError = params?.error === "invalid";
  const hasLockedError = params?.error === "locked";
  const hasSessionError = params?.error === "session";
  const hasExpiredMessage = params?.expired === "1";
  const hasInactiveMessage = params?.inactive === "1";
  const hasPasswordChangedMessage = params?.passwordChanged === "1";
  const hasSetupComplete = params?.setup === "1";

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden" padding="lg" tone="accent">
          <span className="dw-kicker">DailyWork Pick &amp; Pack</span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Clean, fast warehouse flow for owners, pickers, and packers.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Phase 1 keeps the existing Meesho pick-and-pack workflow stable while upgrading the shell, mobile worker experience, and future catalog-ready structure.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/80 bg-white/88 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Owner</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">Uploads, mappings, workers, problems, reports, and system health in one shell.</p>
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/88 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Picker</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">Mobile-first SKU grouping with big actions and clearer product imagery.</p>
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/88 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Packer</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">Fast camera scanning, manual AWB fallback, and smoother dispatch flow.</p>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-200/80 bg-white/90 p-5">
            <p className="text-sm font-semibold text-slate-950">Seed users for local setup</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Username: <span className="font-semibold text-slate-900">owner</span>, <span className="font-semibold text-slate-900">picker</span>, <span className="font-semibold text-slate-900">packer</span>. Password: <span className="font-semibold text-slate-900">demo1234</span>.
            </p>
          </div>
        </Card>

        <Card className="self-center" padding="lg">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sign in</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Open today’s workspace</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">Use your DailyWork login to continue into the account-aware warehouse flow.</p>
          </div>

          <div className="mt-5 space-y-3">
            {hasSetupComplete ? <AlertBanner tone="success">Setup complete. Login with your owner account.</AlertBanner> : null}
            {hasPasswordChangedMessage ? <AlertBanner tone="info">Password changed. Login again.</AlertBanner> : null}
            {hasExpiredMessage ? <AlertBanner tone="warning">Session expired. Login again.</AlertBanner> : null}
            {hasInactiveMessage ? <AlertBanner tone="error">Account inactive. Ask the owner to reactivate this user.</AlertBanner> : null}
            {hasInvalidError || hasLockedError || hasSessionError ? (
              <AlertBanner tone="error">
                {hasLockedError ? "Too many failed attempts. Try again later or ask the owner." : null}
                {hasInvalidError ? "Invalid username or password." : null}
                {hasSessionError ? "Session creation failed. Try again." : null}
              </AlertBanner>
            ) : null}
          </div>

          <form action={loginAction} className="mt-6 space-y-4">
            <label className="block">
              <span className="dw-label">Username</span>
              <input name="username" autoComplete="username" className="dw-input mt-2" placeholder="owner" required />
            </label>

            <label className="block">
              <span className="dw-label">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                className="dw-input mt-2"
                placeholder="demo1234"
                required
              />
            </label>

            <SubmitButton pendingText="Signing in..." className="w-full">
              Sign in
            </SubmitButton>
          </form>
        </Card>
      </div>
    </main>
  );
}
