import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, Search } from "lucide-react";
import BookCard from "@/components/BookCard";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Badge from "@/components/Badge";
import { useCatalogEbooks } from "@/lib/catalog";
import { usePublishingStore } from "@/stores/publishingStore";
import type { BookAccess, BookCategory, MembershipPlan } from "@/types/domain";

type SortKey = "terbaru" | "terlaris" | "rating";
type AccessFilter = "ALL" | BookAccess;
type PlanFilter = "ALL" | Exclude<MembershipPlan, "FREE">;
type PriceFilter = "ALL" | "FREE" | "UNDER_50000" | "ABOVE_50000";

function parseAccess(v: string | null): AccessFilter {
  if (v === "OPEN" || v === "MEMBERSHIP" || v === "PAID") return v;
  return "ALL";
}

function parsePlan(v: string | null): PlanFilter {
  if (v === "PREMIUM" || v === "EDU") return v;
  return "ALL";
}

function parsePrice(v: string | null): PriceFilter {
  if (v === "FREE" || v === "UNDER_50000" || v === "ABOVE_50000") return v;
  return "ALL";
}

function parseSort(v: string | null): SortKey {
  if (v === "terlaris" || v === "rating") return v;
  return "terbaru";
}

export default function Catalog() {
  const ebooks = useCatalogEbooks();
  const authorProfilesByUser = usePublishingStore((s) => s.authorProfilesByUser);
  const manuscripts = usePublishingStore((s) => s.manuscripts);
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = (params.get("cat") ?? "") as BookCategory | "";
  const sort = parseSort(params.get("sort"));
  const access = parseAccess(params.get("access"));
  const plan = parsePlan(params.get("plan"));
  const price = parsePrice(params.get("price"));
  const featuredOnly = params.get("featured") === "1";
  const bestSellerOnly = params.get("bestseller") === "1";

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const authorNameById = useMemo(() => {
    const names = new Map<string, string>();
    for (const [userId, profile] of Object.entries(authorProfilesByUser)) {
      if (profile.displayName.trim()) {
        names.set(userId, profile.displayName.trim());
      }
    }
    for (const manuscript of manuscripts) {
      if (manuscript.authorId && manuscript.authorDisplayName?.trim()) {
        names.set(manuscript.authorId, manuscript.authorDisplayName.trim());
      }
    }
    return names;
  }, [authorProfilesByUser, manuscripts]);

  const categories = useMemo(() => {
    return Array.from(new Set(ebooks.map((ebook) => ebook.category))).sort((a, b) =>
      a.localeCompare(b, "id")
    );
  }, [ebooks]);

  const updateParam = (key: string, value?: string | null) => {
    const next = new URLSearchParams(params);
    if (!value || value === "ALL") next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams();
    if (sort !== "terbaru") {
      next.set("sort", sort);
    }
    setParams(next);
  };

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    let list = ebooks.slice();

    if (cat) list = list.filter((b) => b.category === cat);
    if (access !== "ALL") list = list.filter((b) => b.access === access);
    if (plan !== "ALL") list = list.filter((b) => b.requiredPlan === plan);
    if (price === "FREE") list = list.filter((b) => b.priceCents <= 0 || b.access !== "PAID");
    if (price === "UNDER_50000") {
      list = list.filter((b) => b.access === "PAID" && b.priceCents > 0 && b.priceCents < 5000000);
    }
    if (price === "ABOVE_50000") {
      list = list.filter((b) => b.access === "PAID" && b.priceCents >= 5000000);
    }
    if (featuredOnly) list = list.filter((b) => b.isFeatured);
    if (bestSellerOnly) list = list.filter((b) => b.isBestSeller);

    if (qLower) {
      list = list.filter((b) => {
        const authorName = authorNameById.get(b.authorId)?.toLowerCase() ?? "";
        return (
          b.title.toLowerCase().includes(qLower) ||
          authorName.includes(qLower) ||
          b.description.toLowerCase().includes(qLower) ||
          b.category.toLowerCase().includes(qLower) ||
          b.tags.some((t) => t.toLowerCase().includes(qLower))
        );
      });
    }
    if (sort === "rating") list.sort((a, b) => b.ratingAvg - a.ratingAvg);
    if (sort === "terlaris") list.sort((a, b) => b.ratingCount - a.ratingCount);
    if (sort === "terbaru")
      list.sort((a, b) => +new Date(b.publishedAtISO) - +new Date(a.publishedAtISO));
    return list;
  }, [access, authorNameById, bestSellerOnly, cat, ebooks, featuredOnly, plan, price, q, sort]);

  const activeFilterCount = [
    Boolean(q.trim()),
    Boolean(cat),
    access !== "ALL",
    plan !== "ALL",
    price !== "ALL",
    featuredOnly,
    bestSellerOnly,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            Katalog
          </div>
          <div className="mt-2 text-sm text-muted">
            Pencarian cepat, filter kategori, dan rekomendasi berdasarkan minat.
          </div>
          <div className="mt-2 text-xs text-muted">
            Badge buku kini membedakan akses gratis, membership sesuai paket, dan pembelian satuan.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="md:hidden"
            onClick={() => setMobileFilterOpen((v) => !v)}
          >
            <Filter size={16} />
            Filter
          </Button>
          <select
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-ink outline-none"
            value={sort}
            onChange={(e) => {
              updateParam("sort", e.target.value);
            }}
            aria-label="Urutkan"
          >
            <option value="terbaru">Terbaru</option>
            <option value="terlaris">Terlaris</option>
            <option value="rating">Rating tertinggi</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside
          className={`space-y-4 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] ${
            mobileFilterOpen ? "block" : "hidden md:block"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-ink">Pencarian & filter</div>
            {activeFilterCount ? (
              <button
                type="button"
                className="text-xs font-semibold text-brand-2 hover:underline"
                onClick={clearAllFilters}
              >
                Reset semua
              </button>
            ) : null}
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <Search size={16} />
            </span>
            <Input
              value={q}
              onChange={(e) => {
                const value = e.target.value;
                updateParam("q", value);
              }}
              placeholder="Judul, penulis, tag, atau kategori…"
              className="pl-9"
            />
          </div>

          <div className="pt-2">
            <div className="text-sm font-semibold text-ink">Kategori</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  !cat
                    ? "border-brand-2 bg-brand-2/10 text-brand-2"
                    : "border-border bg-white text-muted hover:bg-surface"
                }`}
                onClick={() => updateParam("cat", null)}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    cat === c
                      ? "border-brand-2 bg-brand-2/10 text-brand-2"
                      : "border-border bg-white text-muted hover:bg-surface"
                  }`}
                  onClick={() => updateParam("cat", c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="text-sm font-semibold text-ink">Tipe akses</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: "ALL", label: "Semua akses" },
                { value: "OPEN", label: "Gratis" },
                { value: "MEMBERSHIP", label: "Membership" },
                { value: "PAID", label: "Beli satuan" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    access === item.value
                      ? "border-brand-2 bg-brand-2/10 text-brand-2"
                      : "border-border bg-white text-muted hover:bg-surface"
                  }`}
                  onClick={() => updateParam("access", item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="text-sm font-semibold text-ink">Paket membership</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: "ALL", label: "Semua paket" },
                { value: "PREMIUM", label: "Premium" },
                { value: "EDU", label: "Edukasi" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    plan === item.value
                      ? "border-brand-2 bg-brand-2/10 text-brand-2"
                      : "border-border bg-white text-muted hover:bg-surface"
                  }`}
                  onClick={() => updateParam("plan", item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="text-sm font-semibold text-ink">Harga</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: "ALL", label: "Semua harga" },
                { value: "FREE", label: "Gratis / Termasuk akses" },
                { value: "UNDER_50000", label: "Di bawah 50rb" },
                { value: "ABOVE_50000", label: "50rb ke atas" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    price === item.value
                      ? "border-brand-2 bg-brand-2/10 text-brand-2"
                      : "border-border bg-white text-muted hover:bg-surface"
                  }`}
                  onClick={() => updateParam("price", item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="text-sm font-semibold text-ink">Filter cepat</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  featuredOnly
                    ? "border-brand-2 bg-brand-2/10 text-brand-2"
                    : "border-border bg-white text-muted hover:bg-surface"
                }`}
                onClick={() => updateParam("featured", featuredOnly ? null : "1")}
              >
                Unggulan
              </button>
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  bestSellerOnly
                    ? "border-brand-2 bg-brand-2/10 text-brand-2"
                    : "border-border bg-white text-muted hover:bg-surface"
                }`}
                onClick={() => updateParam("bestseller", bestSellerOnly ? null : "1")}
              >
                Best Seller
              </button>
              <button
                type="button"
                className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted transition hover:bg-surface"
                onClick={() => updateParam("sort", "rating")}
              >
                Rating tinggi
              </button>
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {q ? (
              <Badge tone="neutral">
                Pencarian: <span className="font-semibold text-ink">{q}</span>
              </Badge>
            ) : null}
            {cat ? (
              <Badge tone="neutral">
                Kategori: <span className="font-semibold text-ink">{cat}</span>
              </Badge>
            ) : null}
            {access !== "ALL" ? (
              <Badge tone="neutral">
                Akses: <span className="font-semibold text-ink">{access}</span>
              </Badge>
            ) : null}
            {plan !== "ALL" ? (
              <Badge tone="neutral">
                Paket: <span className="font-semibold text-ink">{plan}</span>
              </Badge>
            ) : null}
            {price !== "ALL" ? (
              <Badge tone="neutral">
                Harga: <span className="font-semibold text-ink">{price}</span>
              </Badge>
            ) : null}
            {featuredOnly ? <Badge tone="neutral">Unggulan</Badge> : null}
            {bestSellerOnly ? <Badge tone="neutral">Best Seller</Badge> : null}
            <div className="ml-auto text-sm text-muted">{filtered.length} hasil</div>
          </div>

          {filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((b) => (
                <BookCard key={b.id} ebook={b} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-6 text-sm text-muted">
              Tidak ada e-book yang cocok dengan pencarian atau filter aktif. Coba ubah kata kunci
              atau reset filter.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
