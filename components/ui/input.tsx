import { cn } from "@/lib/utils";

export function Input({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 text-sm text-ink placeholder:text-ink-muted",
        "focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]",
        className,
      )}
      {...rest}
    />
  );
}

export function Label({
  className,
  htmlFor,
  children,
}: {
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block text-sm font-semibold text-ink-secondary",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 text-sm text-ink",
        "focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-5 w-5 rounded border-2 border-[#cbd5e1] text-emerald",
        "focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]",
        className,
      )}
      {...rest}
    />
  );
}
