import { Link, useParams } from "react-router-dom";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { editorialArticles } from "@/content/editorialArticles";

export default function ArticleDetail() {
  const { articleId } = useParams();
  const article = editorialArticles.find((item) => item.id === articleId);

  if (!article) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-center">
        <div className="text-sm font-semibold text-ink">Artikel tidak ditemukan</div>
        <div className="mt-1 text-sm text-muted">Coba kembali ke daftar artikel dan rekomendasi.</div>
        <div className="mt-4">
          <Link to="/artikel">
            <Button variant="secondary">Lihat artikel</Button>
          </Link>
        </div>
      </div>
    );
  }

  const related = editorialArticles.filter((item) => item.id !== article.id).slice(0, 2);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <article className="rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-8">
        <div className="text-xs text-muted">
          {new Date(article.publishedAtISO).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          {article.title}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-6 space-y-4 text-sm leading-7 text-muted md:text-base">
          {article.content.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-semibold tracking-tight text-ink">Rekomendasi terkait</div>
            <div className="mt-1 text-sm text-muted">
              Artikel lain yang masih relevan dengan topik ini.
            </div>
          </div>
          <Link to="/artikel" className="text-sm font-semibold text-brand hover:underline">
            Lihat semua artikel
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {related.map((item) => (
            <Link
              key={item.id}
              to={`/artikel/${item.id}`}
              className="rounded-2xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="text-sm font-semibold text-ink">{item.title}</div>
              <div className="mt-2 text-sm leading-relaxed text-muted">{item.excerpt}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
