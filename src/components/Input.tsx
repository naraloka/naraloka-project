import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-ink placeholder:text-muted shadow-[0_1px_0_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15",
        className
      )}
      {...props}
    />
  );
}

