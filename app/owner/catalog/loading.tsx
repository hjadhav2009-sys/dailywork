import { AppShell } from "@/components/AppShell";
import { LoadingCard } from "@/components/ui/LoadingCard";

export default function OwnerCatalogLoading() {
  return (
    <AppShell>
      <LoadingCard lines={4} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <LoadingCard key={index} lines={2} />
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <LoadingCard lines={5} />
        <LoadingCard lines={5} />
      </section>
      <LoadingCard lines={6} />
    </AppShell>
  );
}
