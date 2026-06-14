import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "neutral" | "success" | "warning";

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

const tones: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand border-brand/20",
  neutral: "bg-surface text-muted border-border",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function Badge({ tone = "neutral", className, ...props }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

