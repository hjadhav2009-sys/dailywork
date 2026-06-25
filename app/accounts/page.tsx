import { redirect } from "next/navigation";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { getAvailableAccounts, requireUser, roleHomePath } from "@/lib/auth";
import { selectAccountAction } from "./actions";

type AccountsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const user = await requireUser();
  const accounts = await getAvailableAccounts(user);
  const params = await searchParams;

  if (accounts.length === 1 && !params?.error) {
    redirect(roleHomePath(user.role));
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Card padding="lg" tone="accent">
          <span className="dw-kicker">Account selection</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Choose the seller account for this session</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Uploads, SKU image mappings, pick lists, packing scans, workers, and reports remain scoped to the selected account so daily work stays clean.
          </p>

          {params?.error ? (
            <AlertBanner tone="error" className="mt-5">
              Select a valid account before continuing.
            </AlertBanner>
          ) : null}

          <form action={selectAccountAction} className="mt-6 space-y-4">
            <div className="space-y-3">
              {accounts.map((account, index) => (
                <label
                  key={account.id}
                  className="flex items-center justify-between gap-4 rounded-[26px] border border-white/90 bg-white/90 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <span>
                    <span className="block text-lg font-semibold text-slate-950">{account.name}</span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {account.code} {!account.active ? "/ inactive" : ""}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="accountId"
                    value={account.id}
                    defaultChecked={index === 0}
                    className="h-5 w-5 accent-[var(--dw-brand)]"
                  />
                </label>
              ))}
            </div>

            <SubmitButton className="w-full sm:w-auto">Select account</SubmitButton>
          </form>
        </Card>
      </div>
    </main>
  );
}
