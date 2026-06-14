import { Link } from "react-router-dom";
import Badge from "@/components/Badge";
import { editorialArticles } from "@/content/editorialArticles";

export default function Articles() {
  const sortedArticles = [...editorialArticles].sort(
    (a, b) => +new Date(b.publishedAtISO) - +new Date(a.publishedAtISO)
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Artikel & rekomendasi
        </div>
        <div className="mt-2 text-sm text-muted">
          Tips membaca, rekomendasi pilihan, dan update fitur Naraloka.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedArticles.map((article) => (
          <Link
            key={article.id}
            to={`/artikel/${article.id}`}
            className="rounded-2xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <div className="text-xs text-muted">
              {new Date(article.publishedAtISO).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div className="mt-2 text-base font-semibold text-ink">{article.title}</div>
            <div className="mt-2 text-sm leading-relaxed text-muted">{article.excerpt}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="mt-5 text-sm font-semibold text-brand">Baca artikel</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
