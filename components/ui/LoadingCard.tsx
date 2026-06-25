import { cn } from "@/lib/cn";

type LoadingCardProps = {
  className?: string;
  lines?: number;
};

export function LoadingCard({ className, lines = 3 }: LoadingCardProps) {
  return (
    <div className={cn("dw-card p-5", className)}>
      <div className="h-4 w-28 rounded-full bg-slate-200/90" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-3 rounded-full bg-slate-200/80",
              index === 0 ? "w-full" : index === lines - 1 ? "w-2/3" : "w-5/6"
            )}
          />
        ))}
      </div>
    </div>
  );
}
