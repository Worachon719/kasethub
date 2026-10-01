import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "transactional" | "agrarian" | "neutral" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  // Solid harvest orange — commercial action (Place Bid / Buy Now)
  transactional:
    "bg-harvest text-white hover:bg-[#c2410c] focus-visible:ring-[#fed7aa]",
  // Solid emerald — agrarian action (Post Supply / Verified)
  agrarian: "bg-emerald text-white hover:bg-emerald-dark focus-visible:ring-[#bbf7d0]",
  neutral:
    "border-[1.5px] border-hairline bg-white text-ink hover:bg-[#f8fafc] hover:border-[#cbd5e1] focus-visible:ring-[#cbd5e1]",
  ghost: "text-ink-secondary hover:bg-surface-2 focus-visible:ring-[#cbd5e1]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "neutral",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "neutral",
  size = "md",
  className,
  href,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  );
}
