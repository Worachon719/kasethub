import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duplicating conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a THB amount: 45000 -> "฿45,000" */
export function formatThb(amount: number): string {
  return `฿${new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

/** Format price per kilogram, e.g. 45 -> "฿45 / กก." */
export function formatPricePerKg(price: number): string {
  return `${formatThb(price)} / กก.`;
}

/** Kilograms as tonnes when large, e.g. 12000 -> "12 ตัน" */
export function formatWeight(kg: number): string {
  if (kg >= 1000) {
    const tonnes = kg / 1000;
    return `${new Intl.NumberFormat("th-TH", {
      maximumFractionDigits: 2,
    }).format(tonnes)} ตัน`;
  }
  return `${new Intl.NumberFormat("th-TH").format(kg)} กก.`;
}

/** จำนวนวันถึงหมดอายุ — negative when already expired. */
export function daysUntil(date: Date | string): number {
  const target = typeof date === "string" ? new Date(date) : date;
  const ms = target.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export type SpoilageLevel = "critical" | "moderate" | "optimal";

/** Map remaining shelf life to the design system's urgency tiers. */
export function spoilageLevel(expiresAt: Date | string | null): SpoilageLevel {
  if (!expiresAt) return "optimal";
  const days = daysUntil(expiresAt);
  if (days < 2) return "critical";
  if (days <= 5) return "moderate";
  return "optimal";
}

/** 02 วัน : 14 ชม. : 32 นาที */
export function formatCountdown(target: Date | string): string {
  const end = typeof target === "string" ? new Date(target) : target;
  let seconds = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000));
  const days = Math.floor(seconds / 86_400);
  seconds -= days * 86_400;
  const hours = Math.floor(seconds / 3_600);
  seconds -= hours * 3_600;
  const minutes = Math.floor(seconds / 60);
  return `${String(days).padStart(2, "0")} วัน : ${String(hours).padStart(2, "0")} ชม. : ${String(minutes).padStart(2, "0")} นาที`;
}

/** Absolute site URL, safe to call during metadata generation. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
