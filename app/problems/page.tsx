import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { requireAccount, requireUser } from "@/lib/auth";
import { getProblemOrders } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { resolveProblemOrderAction } from "./actions";

type ProblemsPageProps = {
  searchParams?: Promise<{
    resolved?: string;
    error?: string;
  }>;
};

export default async function ProblemOrdersPage({ searchParams }: ProblemsPageProps) {
  const user = await requireUser(["OWNER", "PICKER", "PACKER"]);
  const account = await requireAccount(user);
  const [params, problems] = await Promise.all([searchParams, getProblemOrders(account.id)]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Problems"
        title="Problem orders"
        description="Orders that need owner or packer attention before they can move back into the ready queue."
      />

      <div className="space-y-3">
        {params?.resolved ? <AlertBanner tone="success">Problem resolved and order returned to the ready queue.</AlertBanner> : null}
        {params?.error ? <AlertBanner tone="error">Could not update that problem order.</AlertBanner> : null}
      </div>

      {problems.length === 0 ? (
        <EmptyState
          title="No problem orders"
          description="When workers mark missing items, color mismatches, or other exceptions, they will appear here."
        />
      ) : (
        <section className="space-y-4">
          {problems.map((problem) => (
            <Card key={problem.id} className="overflow-hidden" padding="lg">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold text-slate-950">AWB {problem.order.awb}</h2>
                    <StatusBadge value={problem.status} />
                  </div>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{problem.reason}</p>
                  {problem.details ? <p className="mt-2 text-sm leading-7 text-slate-600">{problem.details}</p> : null}
                </div>
                <div className="text-sm text-slate-500 sm:text-right">
                  <p>{formatDateTime(problem.createdAt)}</p>
                  <p className="mt-1">By {problem.reportedBy?.name ?? "Unknown"}</p>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 rounded-[24px] border border-white/80 bg-[rgba(248,250,252,0.82)] p-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="font-medium text-slate-500">SKU</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{problem.order.sku}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Qty</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{problem.order.qty}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Color</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{problem.order.color ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Order</dt>
                  <dd className="mt-1 break-words font-semibold text-slate-950">{problem.order.orderNo}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href={`/packing/${problem.order.awb}`} className="text-sm font-semibold text-[var(--dw-brand)] hover:underline">
                  Open scan result
                </Link>
                {problem.status === "OPEN" && user.role !== "PICKER" ? (
                  <form action={resolveProblemOrderAction}>
                    <input type="hidden" name="problemId" value={problem.id} />
                    <SubmitButton pendingText="Resolving..." variant="secondary">
                      Resolve
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            </Card>
          ))}
        </section>
      )}
    </AppShell>
  );
}
