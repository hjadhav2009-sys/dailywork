import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  tone?: "default" | "quiet" | "accent";
};

const paddingClassName = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6 sm:p-7"
};

const toneClassName = {
  default: "bg-white/92",
  quiet: "bg-[rgba(250,248,243,0.92)]",
  accent:
    "bg-[linear-gradient(160deg,rgba(255,255,255,0.98)_0%,rgba(239,248,246,0.98)_52%,rgba(255,248,240,0.95)_100%)]"
};

export function Card<T extends ElementType = "section">({
  as,
  children,
  className,
  padding = "md",
  tone = "default",
  ...props
}: CardProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof CardProps<T>>) {
  const Component = as ?? "section";

  return (
    <Component className={cn("dw-card", paddingClassName[padding], toneClassName[tone], className)} {...props}>
      {children}
    </Component>
  );
}
