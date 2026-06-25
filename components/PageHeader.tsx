import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: {
    href: string;
    label: string;
  };
  children?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action, children }: PageHeaderProps) {
  return (
    <section className="dw-card relative overflow-hidden p-6 sm:p-7">
      <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.18)_0%,transparent_68%)]" />
      <div className="absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(197,106,45,0.18)_0%,transparent_68%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? <p className="dw-kicker">{eyebrow}</p> : null}
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {children}
          {action ? <ButtonLink href={action.href}>{action.label}</ButtonLink> : null}
        </div>
      </div>
    </section>
  );
}
