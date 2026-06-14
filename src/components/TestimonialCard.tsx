import { Quote } from "lucide-react";
import type { Testimonial } from "@/types/domain";
import RatingStars from "@/components/RatingStars";
import { cn } from "@/lib/utils";

type Props = {
  testimonial: Testimonial;
  className?: string;
};

export default function TestimonialCard({ testimonial, className }: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-2/10 blur-2xl" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-ink">{testimonial.name}</div>
          <div className="mt-0.5 text-xs text-muted">{testimonial.roleLabel}</div>
        </div>
        <Quote size={18} className="text-muted" />
      </div>

      <div className="mt-3">
        <RatingStars rating={testimonial.rating} />
      </div>
      <div className="mt-3 text-sm leading-relaxed text-ink">{testimonial.quote}</div>
    </div>
  );
}

