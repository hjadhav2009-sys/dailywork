import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(135deg,#0f766e_0%,#115e59_100%)] text-white shadow-[0_18px_30px_rgba(15,118,110,0.24)] hover:-translate-y-0.5 hover:shadow-[0_24px_34px_rgba(15,118,110,0.28)]",
  secondary:
    "border border-slate-200/80 bg-white/90 text-slate-900 shadow-[0_10px_25px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white",
  ghost: "border border-transparent bg-transparent text-slate-700 hover:border-white/80 hover:bg-white/70",
  danger:
    "bg-[linear-gradient(135deg,#be123c_0%,#9f1239_100%)] text-white shadow-[0_18px_30px_rgba(190,24,93,0.22)] hover:-translate-y-0.5 hover:shadow-[0_24px_34px_rgba(190,24,93,0.26)]"
};

export function buttonClassName(variant: ButtonVariant = "primary", className?: string) {
  return cn(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgba(15,118,110,0.28)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11",
    variantClassName[variant],
    className
  );
}
