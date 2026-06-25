import { AppShell } from "@/components/AppShell";
import { LoadingCard } from "@/components/ui/LoadingCard";

export default function PickerSearchSkuLoading() {
  return (
    <AppShell>
      <LoadingCard lines={4} />
      <LoadingCard lines={2} />
      <section className="grid gap-5 xl:grid-cols-2">
        <LoadingCard lines={7} />
        <LoadingCard lines={7} />
      </section>
    </AppShell>
  );
}
