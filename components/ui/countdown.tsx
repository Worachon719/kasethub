"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/utils";

/**
 * Live auction countdown strip.
 * Client-side ticker so seconds stay in sync without a server round-trip.
 */
export function Countdown({
  target,
  label,
}: {
  target: string | null;
  label?: string;
}) {
  const [text, setText] = useState(() =>
    target ? formatCountdown(target) : "-- วัน : -- ชม. : -- นาที",
  );

  useEffect(() => {
    if (!target) return;
    setText(formatCountdown(target));
    const id = setInterval(() => setText(formatCountdown(target)), 30_000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-amber/10 px-3 py-1.5 text-xs font-semibold text-harvest">
      {label ? <span className="text-ink-secondary">{label}</span> : null}
      <span className="tabular">{text}</span>
    </div>
  );
}
