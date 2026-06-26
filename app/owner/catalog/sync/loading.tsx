import { AppShell } from "@/components/AppShell";
import { LoadingCard } from "@/components/ui/LoadingCard";

export default function OwnerCatalogSyncLoading() {
  return (
    <AppShell>
      <LoadingCard lines={4} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <LoadingCard key={index} lines={2} />
        ))}
      </section>
      <LoadingCard lines={5} />
      <section className="grid gap-5 xl:grid-cols-2">
        <LoadingCard lines={8} />
        <LoadingCard lines={6} />
      </section>
      <LoadingCard lines={7} />
    </AppShell>
  );
}
