import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-hairline px-4 py-3 md:px-6",
        className,
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
