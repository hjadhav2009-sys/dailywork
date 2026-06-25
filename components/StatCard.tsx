import { Card } from "@/components/ui/Card";

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: "berry" | "mint" | "clay" | "slate";
};

const toneClass = {
  berry:
    "bg-[linear-gradient(165deg,rgba(15,118,110,0.18)_0%,rgba(255,255,255,0.95)_100%)] text-slate-950",
  mint:
    "bg-[linear-gradient(165deg,rgba(16,185,129,0.14)_0%,rgba(255,255,255,0.95)_100%)] text-slate-950",
  clay:
    "bg-[linear-gradient(165deg,rgba(197,106,45,0.18)_0%,rgba(255,255,255,0.95)_100%)] text-slate-950",
  slate: "bg-white/94 text-slate-950"
};

export function StatCard({ label, value, tone = "slate" }: StatCardProps) {
  return (
    <Card className={toneClass[tone]} padding="md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--dw-brand)] shadow-[0_0_0_8px_rgba(15,118,110,0.08)]" />
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
    </Card>
  );
}
