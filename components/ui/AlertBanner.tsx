import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AlertBannerProps = {
  title?: string;
  children: ReactNode;
  className?: string;
  tone?: "info" | "success" | "warning" | "error";
};

const toneClassName = {
  info: "border-cyan-200/80 bg-cyan-50/90 text-cyan-900",
  success: "border-emerald-200/80 bg-emerald-50/90 text-emerald-900",
  warning: "border-amber-200/80 bg-amber-50/90 text-amber-950",
  error: "border-rose-200/80 bg-rose-50/90 text-rose-900"
};

export function AlertBanner({ title, children, className, tone = "info" }: AlertBannerProps) {
  return (
    <div className={cn("dw-alert", toneClassName[tone], className)}>
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      <div className={cn("text-sm leading-6", title ? "mt-1" : undefined)}>{children}</div>
    </div>
  );
}
