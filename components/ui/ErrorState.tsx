import type { ReactNode } from "react";
import { ButtonLink } from "./ButtonLink";
import { Card } from "./Card";

type ErrorStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  link?: {
    href: string;
    label: string;
  };
};

export function ErrorState({ title, description, action, link }: ErrorStateProps) {
  return (
    <Card className="mx-auto max-w-2xl text-center" padding="lg" tone="accent">
      <span className="dw-kicker mx-auto">Action needed</span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {action}
        {link ? <ButtonLink href={link.href} variant="secondary">{link.label}</ButtonLink> : null}
      </div>
    </Card>
  );
}
