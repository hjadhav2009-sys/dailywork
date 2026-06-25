import { LoadingCard } from "./LoadingCard";

type LoadingScreenProps = {
  title: string;
  description?: string;
};

export function LoadingScreen({ title, description }: LoadingScreenProps) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="dw-card overflow-hidden p-6 sm:p-7">
          <div className="h-3 w-24 rounded-full bg-slate-200/90" />
          <div className="mt-4 h-9 w-64 rounded-2xl bg-slate-200/90" />
          <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-slate-200/80" />
          <div className="mt-2 h-4 w-3/4 rounded-full bg-slate-200/60" />
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="h-11 w-36 rounded-2xl bg-slate-200/90" />
            <div className="h-11 w-40 rounded-2xl bg-slate-200/60" />
          </div>
        </section>

        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <LoadingCard lines={4} />
            <LoadingCard lines={5} />
            <LoadingCard lines={4} />
          </div>
        </section>
      </div>
    </main>
  );
}
