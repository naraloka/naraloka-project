import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import Badge from "@/components/Badge";
import Button from "@/components/Button";

type Props = {
  title: string;
  priceLabel: string;
  description: string;
  features: string[];
  highlight?: boolean;
  onSelect: () => void;
};

export default function PricingCard({
  title,
  priceLabel,
  description,
  features,
  highlight,
  onSelect,
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        highlight && "border-brand-2 shadow-soft"
      )}
    >
      {highlight ? (
        <div className="absolute right-4 top-4">
          <Badge tone="brand">Paling populer</Badge>
        </div>
      ) : null}

      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-ink">{priceLabel}</div>
      <div className="mt-2 text-sm text-muted">{description}</div>

      <div className="mt-5 space-y-3">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm text-ink">
            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Check size={14} />
            </span>
            <span className="leading-snug">{f}</span>
          </div>
        ))}
      </div>

      <Button
        onClick={onSelect}
        className="mt-6 w-full"
        variant={highlight ? "primary" : "secondary"}
      >
        Pilih Paket
      </Button>
    </div>
  );
}

