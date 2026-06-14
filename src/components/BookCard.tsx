import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import type { Ebook } from "@/types/domain";
import {
  getPublicAccessPriceLabel,
  getRequiredMembershipLabel,
} from "@/lib/accessMessaging";
import { cn } from "@/lib/utils";
import Badge from "@/components/Badge";
import { formatIdrFromCents } from "@/utils/format";
import { useLibraryStore } from "@/stores/libraryStore";
import { useSessionStore } from "@/stores/sessionStore";

type Props = {
  ebook: Ebook;
  className?: string;
};

export default function BookCard({ ebook, className }: Props) {
  const toggleWishlist = useLibraryStore((s) => s.toggleWishlist);
  const uid = useSessionStore((s) => s.user?.id ?? "guest");
  const isWishlisted = useLibraryStore((s) => Boolean(s.wishlistByUser[uid]?.[ebook.id]));

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-soft",
        className
      )}
    >
      <Link to={`/ebook/${ebook.id}`} className="block">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface">
          <img
            src={ebook.coverUrl}
            alt={ebook.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {ebook.isBestSeller ? <Badge tone="warning">Best Seller</Badge> : null}
            {ebook.isFeatured ? <Badge tone="brand">Unggulan</Badge> : null}
            {ebook.access === "MEMBERSHIP" ? (
              <Badge tone="success">
                Membership{ebook.requiredPlan ? ` • ${getRequiredMembershipLabel(ebook.requiredPlan)}` : ""}
              </Badge>
            ) : null}
            {ebook.access === "OPEN" ? <Badge tone="neutral">Gratis</Badge> : null}
            {ebook.access === "PAID" ? <Badge tone="neutral">Beli satuan</Badge> : null}
          </div>
        </div>
      </Link>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/ebook/${ebook.id}`} className="block">
              <div className="line-clamp-2 text-sm font-semibold leading-snug text-ink hover:text-brand">
                {ebook.title}
              </div>
            </Link>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleWishlist(ebook.id);
            }}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface",
              isWishlisted && "border-brand-2 bg-brand-2/10 text-brand-2"
            )}
            aria-label="Tambah ke wishlist"
          >
            <Heart size={16} className={cn(isWishlisted && "fill-current")} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted">
            {ebook.category} • {ebook.pageCount} halaman
          </div>

          <div className="text-sm font-semibold text-ink">
            {ebook.access === "PAID"
              ? formatIdrFromCents(ebook.priceCents)
              : getPublicAccessPriceLabel({
                  access: ebook.access,
                  requiredPlan: ebook.requiredPlan,
                })}
          </div>
        </div>
      </div>
    </div>
  );
}
