import { cn, type SpoilageLevel } from "@/lib/utils";

type UrgencyTone = "critical" | "moderate" | "optimal" | "neutral";

const tones: Record<UrgencyTone, string> = {
  critical: "bg-critical-bg border-critical-border text-critical-fg",
  moderate: "bg-moderate-bg border-moderate-border text-moderate-fg",
  optimal: "bg-optimal-bg border-optimal-border text-optimal-fg",
  neutral: "bg-surface-2 border-hairline text-ink-secondary",
};

export function Badge({
  tone = "neutral",
  pulse = false,
  className,
  children,
}: {
  tone?: UrgencyTone;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {pulse ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" />
      ) : null}
      {children}
    </span>
  );
}

/** เกษตรกรยืนยันตัวตน / Verified Grower */
export function VerifiedBadge() {
  return (
    <Badge tone="optimal">
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.7 6.2l-4 4a.8.8 0 01-1.1 0L4.5 8.1a.8.8 0 111.1-1.1l1.4 1.4 3.4-3.4a.8.8 0 111.2 1.1z" />
      </svg>
      เกษตรกรยืนยันตัวตน
    </Badge>
  );
}

/** ขายด่วนก่อนหมดอายุ — driven by remaining shelf life. */
export function SpoilageBadge({
  level,
  days,
}: {
  level: SpoilageLevel;
  days: number;
}) {
  if (level === "critical") {
    return (
      <Badge tone="critical" pulse>
        ขายด่วนก่อนหมดอายุ · {Math.max(days, 0)} วัน
      </Badge>
    );
  }
  if (level === "moderate") {
    return <Badge tone="moderate">เหลือ {days} วัน</Badge>;
  }
  return null;
}

/** เกรดส่งออก / Grade tag — deep slate outline. */
export function GradeBadge({ grade }: { grade: string }) {
  const label =
    grade === "A" ? "เกรดส่งออก" : grade === "B" ? "เกรด B" : grade;
  return (
    <span className="rounded-md border border-ink-secondary px-1.5 py-0.5 text-[11px] font-bold text-ink">
      {label}
    </span>
  );
}
