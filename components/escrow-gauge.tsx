import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

/** วางเงินประกัน → ตรวจสอบสินค้า → ขนส่งขึ้นรถ → ปล่อยเงินโอน */
const STEPS: { status: OrderStatus; th: string; en: string }[] = [
  { status: "ESCROW_DEPOSITED", th: "วางเงินประกัน", en: "Escrow Deposited" },
  { status: "QUALITY_INSPECTED", th: "ตรวจสอบสินค้า", en: "Quality Inspected" },
  { status: "LOADED_SHIPPED", th: "ขนส่งขึ้นรถ", en: "Loaded & Shipped" },
  { status: "COMPLETED", th: "ปล่อยเงินโอน", en: "Payment Released" },
];

export function EscrowGauge({
  current,
  className,
}: {
  current: OrderStatus;
  className?: string;
}) {
  const currentIndex = STEPS.findIndex((s) => s.status === current);

  return (
    <ol className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>
      {STEPS.map((step, i) => {
        const done = currentIndex >= i && currentIndex !== -1;
        const isCurrent = currentIndex === i;
        return (
          <li
            key={step.status}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              done
                ? "border-optimal-border bg-optimal-bg text-optimal-fg"
                : "border-hairline bg-surface-2 text-ink-muted",
              isCurrent && "ring-[3px] ring-[rgba(21,128,61,0.15)]",
            )}
          >
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">
              {step.en}
            </div>
            <div className="font-semibold">{step.th}</div>
          </li>
        );
      })}
    </ol>
  );
}
