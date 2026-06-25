import { titleCase } from "@/lib/format";

const statusTone: Record<string, string> = {
  READY: "bg-cyan-50/90 text-cyan-900 ring-cyan-200/90",
  FOUND: "bg-cyan-50/90 text-cyan-900 ring-cyan-200/90",
  PACKED: "bg-emerald-50/90 text-emerald-900 ring-emerald-200/90",
  PICKED: "bg-emerald-50/90 text-emerald-900 ring-emerald-200/90",
  PROBLEM: "bg-amber-50/90 text-amber-950 ring-amber-200/90",
  NOT_FOUND: "bg-rose-50/90 text-rose-900 ring-rose-200/90",
  MISSING_IMAGE: "bg-amber-50/90 text-amber-950 ring-amber-200/90",
  OK: "bg-emerald-50/90 text-emerald-900 ring-emerald-200/90",
  WARNING: "bg-amber-50/90 text-amber-950 ring-amber-200/90",
  NEEDS_ACTION: "bg-rose-50/90 text-rose-900 ring-rose-200/90",
  OPEN: "bg-amber-50/90 text-amber-950 ring-amber-200/90",
  RESOLVED: "bg-emerald-50/90 text-emerald-900 ring-emerald-200/90",
  IMPORTED: "bg-emerald-50/90 text-emerald-900 ring-emerald-200/90",
  REVIEWED: "bg-cyan-50/90 text-cyan-900 ring-cyan-200/90",
  PARSED: "bg-white/90 text-slate-700 ring-slate-200/90",
  UPLOADED: "bg-white/90 text-slate-700 ring-slate-200/90",
  ACTIVE: "bg-emerald-50/90 text-emerald-900 ring-emerald-200/90",
  INACTIVE: "bg-slate-100/90 text-slate-700 ring-slate-200/90",
  PASSWORD_REQUIRED: "bg-amber-50/90 text-amber-950 ring-amber-200/90",
  OWNER: "bg-teal-50/90 text-teal-900 ring-teal-200/90",
  PICKER: "bg-cyan-50/90 text-cyan-900 ring-cyan-200/90",
  PACKER: "bg-orange-50/90 text-orange-900 ring-orange-200/90",
  FAILED: "bg-rose-50/90 text-rose-900 ring-rose-200/90"
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ring-1 ${statusTone[value] ?? statusTone.UPLOADED}`}>
      {titleCase(value)}
    </span>
  );
}
