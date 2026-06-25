import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function OwnerLoading() {
  return <LoadingScreen title="Loading owner dashboard" description="Pulling operational totals, batches, and account health." />;
}
