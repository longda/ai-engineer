import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricTileProps = {
  label: string;
  value: string;
  detail?: string;
  className?: string;
};

export function MetricTile({
  label,
  value,
  detail,
  className,
}: MetricTileProps) {
  return (
    <Card
      className={cn(
        "border border-stone-200/70 bg-stone-50/80 py-0 shadow-none",
        className
      )}
    >
      <CardContent className="flex flex-col gap-2 px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {detail ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}