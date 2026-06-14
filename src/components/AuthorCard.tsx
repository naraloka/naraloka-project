import type { AuthorProfile } from "@/types/domain";
import { formatCompactNumber } from "@/utils/format";
import { cn } from "@/lib/utils";

type Props = {
  author: AuthorProfile;
  className?: string;
};

export default function AuthorCard({ author, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:shadow-soft",
        className
      )}
    >
      <div className="h-12 w-12 overflow-hidden rounded-2xl bg-surface">
        {author.avatarUrl ? (
          <img src={author.avatarUrl} alt={author.displayName} className="h-full w-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{author.displayName}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-muted">{author.bio}</div>
      </div>
      <div className="text-right">
        <div className="text-xs font-semibold text-ink">{formatCompactNumber(author.followerCount)}</div>
        <div className="text-[11px] text-muted">pengikut</div>
      </div>
    </div>
  );
}

