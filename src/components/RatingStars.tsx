import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  rating: number;
  size?: "sm" | "md";
  className?: string;
};

export default function RatingStars({ rating, size = "sm", className }: Props) {
  const full = Math.floor(rating);
  const frac = rating - full;
  const showHalf = frac >= 0.35 && frac < 0.85;
  const total = 5;
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <div className={cn("inline-flex items-center gap-1 text-amber-500", className)}>
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const filled = idx <= full;
        const half = !filled && showHalf && idx === full + 1;
        return (
          <span key={idx} className="relative inline-flex">
            <Star size={iconSize} className={cn("text-amber-300", (filled || half) && "text-amber-500")} fill={filled ? "currentColor" : "none"} />
            {half ? (
              <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                <Star size={iconSize} className="text-amber-500" fill="currentColor" />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

