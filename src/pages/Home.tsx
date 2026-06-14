import { useMemo, type ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import BookCard from "@/components/BookCard";
import Button from "@/components/Button";
import PricingCard from "@/components/PricingCard";
import Badge from "@/components/Badge";
import { editorialArticles } from "@/content/editorialArticles";
import { useCatalogEbooks } from "@/lib/catalog";

function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {title}
        </div>
        {subtitle ? <div className="mt-2 text-sm text-muted">{subtitle}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function Home() {
  const ebooks = useCatalogEbooks();
  const featured = ebooks.filter((b) => b.isFeatured).slice(0, 6);
  const bestSeller = ebooks.filter((b) => b.isBestSeller).slice(0, 6);
  const latestArticles = [...editorialArticles].slice(0, 3);
  const categories = useMemo(() => {
    return Array.from(new Set(ebooks.map((ebook) => ebook.category)))
      .sort((a, b) => a.localeCompare(b, "id"))
      .slice(0, 6);
  }, [ebooks]);

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-10">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-brand-2/15 blur-3xl" />
        <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />

        <div className="relative grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-muted">
              <Sparkles size={14} className="text-brand-2" />
              Platform kerja sama penulis & pengalaman membaca yang fokus
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink md:text-5xl">
              Baca dengan tenang. Dukung penulis. Bangun perpustakaan digitalmu.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base">
              Naraloka menggabungkan katalog terkurasi, membership, dan reader yang bersih.
              Simpan progress, buat highlight, dan temukan rekomendasi berdasarkan minatmu.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/katalog">
                <Button className="w-full sm:w-auto">
                  Jelajahi Katalog <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/langganan">
                <Button className="w-full sm:w-auto" variant="secondary">
                  Lihat Paket
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <Badge tone="brand">Offline mode</Badge>
              <Badge tone="neutral">Bookmark & catatan</Badge>
              <Badge tone="neutral">Rekomendasi minat</Badge>
              <Badge tone="neutral">Bagi hasil penulis</Badge>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="text-sm font-semibold text-ink">Kategori populer</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {categories.length ? (
                  categories.map((c) => (
                    <Link
                      key={c}
                      to={`/katalog?cat=${encodeURIComponent(c)}`}
                      className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-soft"
                    >
                      <div className="text-xs text-muted">Kategori</div>
                      <div className="mt-1">{c}</div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-2 rounded-2xl border border-dashed border-border bg-white px-4 py-6 text-sm text-muted">
                    Kategori akan tampil setelah ada buku live yang dipublish.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-5">
              <div className="text-sm font-semibold text-ink">Sedang tren</div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {bestSeller.slice(0, 3).map((b) => (
                  <Link key={b.id} to={`/ebook/${b.id}`} className="group">
                    <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-surface">
                      <img
                        src={b.coverUrl}
                        alt={b.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs font-semibold text-ink">
                      {b.title}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <SectionTitle
          title="E-book unggulan"
          subtitle="Pilihan editor dengan label akses yang lebih jelas: gratis, membership, atau beli satuan."
          action={
            <Link to="/katalog" className="text-sm font-semibold text-brand hover:underline">
              Lihat semua
            </Link>
          }
        />
        {featured.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((b) => (
              <BookCard key={b.id} ebook={b} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-white p-6 text-sm text-muted">
            Belum ada e-book yang tersedia.
          </div>
        )}
      </section>

      <section className="space-y-6">
        <SectionTitle
          title="Best Seller"
          subtitle="Bacaan yang paling sering dibeli dan diselesaikan pembaca."
        />
        {bestSeller.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bestSeller.map((b) => (
              <BookCard key={b.id} ebook={b} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-white p-6 text-sm text-muted">
            Belum ada e-book yang tersedia.
          </div>
        )}
      </section>

      <section className="space-y-6">
        <SectionTitle
          title="Paket berlangganan"
          subtitle="Mulai gratis, upgrade kapan pun. Paket aktif mengikuti pembayaran yang sukses dan tersinkron ke ledger."
          action={
            <Link to="/langganan">
              <Button variant="secondary">Kelola paket</Button>
            </Link>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <PricingCard
            title="Gratis"
            priceLabel="Rp0"
            description="Untuk coba pengalaman membaca dan akses konten terbuka."
            features={[
              "Akses e-book gratis & promo terbatas",
              "Bookmark halaman",
              "Wishlist & rekomendasi dasar",
            ]}
            onSelect={() => {
              window.location.href = "/langganan";
            }}
          />
          <PricingCard
            title="Premium"
            priceLabel="Rp49.000/bulan"
            description="Akses membership lengkap + download untuk offline."
            features={[
              "Akses konten Premium",
              "Download offline",
              "Highlight & catatan",
              "Notifikasi rilis terbaru",
            ]}
            highlight
            onSelect={() => {
              window.location.href = "/langganan";
            }}
          />
          <PricingCard
            title="Edukasi"
            priceLabel="Rp29.000/bulan"
            description="Konten edukasi, ringkas, dan progres belajar."
            features={[
              "Akses konten Edukasi",
              "Catatan terstruktur",
              "Progress belajar per bab",
            ]}
            onSelect={() => {
              window.location.href = "/langganan";
            }}
          />
        </div>
      </section>

      <section className="space-y-6">
        <SectionTitle
          title="Artikel & rekomendasi terbaru"
          subtitle="Tips membaca, rekomendasi, dan update fitur."
          action={
            <Link to="/artikel" className="text-sm font-semibold text-brand hover:underline">
              Lihat semua
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-3">
          {latestArticles.map((a) => (
            <Link
              key={a.id}
              to={`/artikel/${a.id}`}
              className="rounded-2xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="text-xs text-muted">
                {new Date(a.publishedAtISO).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div className="mt-2 text-sm font-semibold text-ink">{a.title}</div>
              <div className="mt-2 text-sm leading-relaxed text-muted">{a.excerpt}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {a.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="mt-5 text-sm font-semibold text-brand">Baca artikel</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
