import { ButtonLink } from "./ButtonLink";
import { Card } from "./Card";

type PlaceholderPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  primaryAction?: {
    href: string;
    label: string;
  };
  secondaryAction?: {
    href: string;
    label: string;
  };
};

export function PlaceholderPanel({
  eyebrow,
  title,
  description,
  highlights,
  primaryAction,
  secondaryAction
}: PlaceholderPanelProps) {
  return (
    <Card padding="lg" tone="accent">
      <span className="dw-kicker">{eyebrow}</span>
      <div className="mt-4 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {highlights.map((item) => (
          <div key={item} className="rounded-3xl border border-white/80 bg-white/85 px-4 py-4 text-sm leading-6 text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
            {item}
          </div>
        ))}
      </div>

      {primaryAction || secondaryAction ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {primaryAction ? <ButtonLink href={primaryAction.href}>{primaryAction.label}</ButtonLink> : null}
          {secondaryAction ? <ButtonLink href={secondaryAction.href} variant="secondary">{secondaryAction.label}</ButtonLink> : null}
        </div>
      ) : null}
    </Card>
  );
}
