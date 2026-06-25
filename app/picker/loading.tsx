import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function PickerLoading() {
  return <LoadingScreen title="Loading picking queue" description="Preparing SKU groups, product cards, and today’s work filters." />;
}
