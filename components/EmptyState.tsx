import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: {
    href: string;
    label: string;
  };
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-slate-200/90 text-center" padding="lg" tone="quiet">
      <span className="dw-kicker">Nothing queued</span>
      <h2 className="mt-4 text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">{description}</p>
      {action ? (
        <ButtonLink href={action.href} className="mt-6">
          {action.label}
        </ButtonLink>
      ) : null}
    </Card>
  );
}
