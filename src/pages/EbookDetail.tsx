import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bookmark, BookOpenText, Heart, MessageSquareText, ShoppingBag } from "lucide-react";
import Badge from "@/components/Badge";
import BookCard from "@/components/BookCard";
import Button from "@/components/Button";
import {
  getLockedBookAccessMessage,
  getLockedBookPrimaryAction,
} from "@/lib/accessMessaging";
import RatingStars from "@/components/RatingStars";
import { useCatalogEbooks } from "@/lib/catalog";
import { getVisibleReviews, sortReviewsNewestFirst } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePublishingStore } from "@/stores/publishingStore";
import { useSessionStore } from "@/stores/sessionStore";
import { formatIdrFromCents } from "@/utils/format";

function hasAccess(params: {
  owned: boolean;
  membershipPlan: "FREE" | "PREMIUM" | "EDU";
  access: "OPEN" | "MEMBERSHIP" | "PAID";
  requiredPlan?: "FREE" | "PREMIUM" | "EDU";
}) {
  const { owned, membershipPlan, access, requiredPlan } = params;
  if (access === "OPEN") return true;
  if (access === "PAID") return owned;
  if (access === "MEMBERSHIP") {
    if (!requiredPlan) return membershipPlan !== "FREE";
    return membershipPlan === requiredPlan || membershipPlan === "PREMIUM";
  }
  return false;
}

export default function EbookDetail() {
  const { ebookId } = useParams();
  const navigate = useNavigate();
  const ebooks = useCatalogEbooks();

  const user = useSessionStore((s) => s.user);
  const membershipPlan = user?.membershipPlan ?? "FREE";
  const uid = user?.id ?? "guest";

  const addToLibrary = useLibraryStore((s) => s.addToLibrary);
  const toggleWishlist = useLibraryStore((s) => s.toggleWishlist);
  const library = useLibraryStore((s) => s.libraryByUser);
  const wishlist = useLibraryStore((s) => s.wishlistByUser);
  const reviews = usePublishingStore((s) => s.reviews);
  const submitEbookReview = usePublishingStore((s) => s.submitEbookReview);

  const ebook = ebooks.find((b) => b.id === ebookId);
  const owned = Boolean(library[uid]?.[ebook?.id ?? ""]?.owned);
  const allowed = ebook
    ? hasAccess({
        owned,
        membershipPlan,
        access: ebook.access,
        requiredPlan: ebook.requiredPlan,
      })
    : false;
  const accessStatusLabel = useMemo(() => {
    if (!ebook) return "";
    if (allowed) return "Siap dibaca";
    if (!user) return "Perlu login";
    if (ebook.access === "PAID") return "Perlu pembelian";
    if (ebook.access === "MEMBERSHIP") return "Butuh membership";
    return "Perlu akses";
  }, [allowed, ebook, user]);
  const lockedAccessMessage = useMemo(() => {
    if (!ebook || allowed) return "";
    return getLockedBookAccessMessage({
      access: ebook.access,
      requiredPlan: ebook.requiredPlan,
      isLoggedIn: Boolean(user),
      membershipPlan,
    });
  }, [allowed, ebook, membershipPlan, user]);

  const isWishlisted = ebook ? Boolean(wishlist[uid]?.[ebook.id]) : false;
  const [reviewRating, setReviewRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  const similar = useMemo(() => {
    if (!ebook) return [];
    return ebooks
      .filter((b) => b.id !== ebook.id && (b.category === ebook.category || b.authorId === ebook.authorId))
      .slice(0, 6);
  }, [ebook, ebooks]);

  const ebookReviews = useMemo(() => {
    if (!ebook) return [];
    return sortReviewsNewestFirst(reviews.filter((review) => review.ebookId === ebook.id));
  }, [ebook, reviews]);

  const visibleReviews = useMemo(() => getVisibleReviews(ebookReviews), [ebookReviews]);
  const myReview = useMemo(() => {
    if (!ebook || !user?.id) return null;
    return ebookReviews.find((review) => review.userId === user.id) || null;
  }, [ebook, ebookReviews, user?.id]);
  const canReview = Boolean(user?.id) && (allowed || ebook?.access === "OPEN");

  useEffect(() => {
    if (!myReview) return;
    setReviewRating(myReview.rating);
    setReviewComment(myReview.comment);
  }, [myReview]);

  if (!ebook) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-center">
        <div className="text-sm font-semibold text-ink">E-book tidak ditemukan</div>
        <div className="mt-1 text-sm text-muted">Coba kembali ke katalog.</div>
        <div className="mt-4">
          <Link to="/katalog">
            <Button variant="secondary">Kembali</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-soft">
            <img src={ebook.coverUrl} alt={ebook.title} className="w-full object-cover" />
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap gap-2">
              {ebook.isBestSeller ? <Badge tone="warning">Best Seller</Badge> : null}
              {ebook.isFeatured ? <Badge tone="brand">Unggulan</Badge> : null}
              {ebook.access === "OPEN" ? <Badge tone="neutral">Gratis</Badge> : null}
              {ebook.access === "MEMBERSHIP" ? (
                <Badge tone="success">
                  Membership{ebook.requiredPlan ? ` • ${ebook.requiredPlan}` : ""}
                </Badge>
              ) : null}
              {ebook.access === "PAID" ? <Badge tone="neutral">Beli satuan</Badge> : null}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink">Akses</div>
              <div className={cn("text-sm font-semibold", allowed ? "text-emerald-700" : "text-muted")}>
                {accessStatusLabel}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {ebook.access === "PAID" ? (
                <Button
                  onClick={() => {
                    navigate(`/checkout?ebook=${ebook.id}`);
                  }}
                  disabled={allowed}
                >
                  <ShoppingBag size={16} />
                  {allowed
                    ? "Sudah Dimiliki"
                    : user
                      ? `Beli Sekarang • ${formatIdrFromCents(ebook.priceCents)}`
                      : "Login untuk Checkout"}
                </Button>
              ) : null}

              <Button
                variant={allowed ? "primary" : "secondary"}
                onClick={() => {
                  if (allowed || ebook.access === "OPEN") {
                    addToLibrary(ebook.id, ebook.pageCount);
                    navigate(`/baca/${ebook.id}`);
                    return;
                  }

                  if (ebook.access === "MEMBERSHIP") {
                    navigate(user ? "/langganan" : "/login");
                    return;
                  }

                  navigate(`/checkout?ebook=${ebook.id}`);
                }}
              >
                <BookOpenText size={16} />
                {allowed
                  ? "Baca Sekarang"
                  : getLockedBookPrimaryAction({
                      access: ebook.access,
                      isLoggedIn: Boolean(user),
                    })}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleWishlist(ebook.id);
                  }}
                  className={cn(isWishlisted && "border-brand-2 bg-brand-2/10 text-brand-2")}
                >
                  <Heart size={16} className={cn(isWishlisted && "fill-current")} />
                  Wishlist
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (allowed || ebook.access === "OPEN") {
                      addToLibrary(ebook.id, ebook.pageCount);
                      navigate("/perpustakaan");
                      return;
                    }

                    navigate(
                      ebook.access === "PAID"
                        ? `/checkout?ebook=${ebook.id}`
                        : user
                          ? "/langganan"
                          : "/login"
                    );
                  }}
                >
                  <Bookmark size={16} />
                  {allowed || ebook.access === "OPEN" ? "Perpustakaan" : "Akses Buku"}
                </Button>
              </div>
            </div>
            {!allowed ? <div className="mt-4 text-sm text-muted">{lockedAccessMessage}</div> : null}
          </div>
        </div>

        <div className="space-y-8">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                  {ebook.title}
                </div>
                <div className="mt-2 text-sm text-muted">
                  {ebook.category} • {ebook.pageCount} halaman
                </div>
              </div>
              {ebook.tags.length ? (
                <div className="flex flex-wrap gap-2">
                  {ebook.tags.slice(0, 3).map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-5 text-sm leading-relaxed text-muted">{ebook.description}</div>

            <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  Rating
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="text-3xl font-semibold tracking-tight text-ink">
                    {ebook.ratingAvg.toFixed(1)}
                  </div>
                  <RatingStars rating={ebook.ratingAvg} size="md" />
                </div>
                <div className="mt-1 text-sm text-muted">
                  {ebook.ratingCount.toLocaleString("id-ID")} total rating
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  Ulasan tayang
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-ink">
                  {visibleReviews.length.toLocaleString("id-ID")}
                </div>
                <div className="mt-1 text-sm text-muted">
                  semua ulasan pembaca yang sudah dipublikasikan
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  Ulasan kamu
                </div>
                <div className="mt-2">
                  <Badge tone={myReview ? "success" : "neutral"}>
                    {myReview ? "Sudah tayang" : "Belum ada ulasan"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted">
                  {myReview
                    ? "Jika kamu mengubah ulasan, versi terbaru akan langsung diperbarui di halaman buku."
                    : "Kirim ulasan untuk membantu pembaca lain memilih buku."}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-ink">Preview beberapa halaman</div>
                <div className="mt-1 text-sm text-muted">
                  {allowed
                    ? "Kamu bisa lanjut membaca di Reader."
                    : lockedAccessMessage || "Preview terbatas. Buka akses penuh untuk lanjut membaca."}
                </div>
              </div>
              <Link to={`/baca/${ebook.id}`}>
                <Button variant={allowed ? "primary" : "secondary"} size="sm">
                  {allowed ? "Buka Reader" : "Coba Preview"}
                </Button>
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              {ebook.previewPages.slice(0, 3).map((p, idx) => (
                <div key={idx} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="text-xs font-semibold text-muted">Halaman {idx + 1}</div>
                  <div className="mt-2 whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink">
                    {p}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
                <MessageSquareText size={18} />
                Tulis ulasan
              </div>
              <div className="mt-2 text-sm text-muted">
                Ulasan dan rating akan langsung tayang di halaman buku tanpa approval admin.
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  Rating kamu
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReviewRating(value as 1 | 2 | 3 | 4 | 5)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition",
                        reviewRating === value
                          ? "border-brand-2 bg-brand-2/10 text-brand-2"
                          : "border-border bg-white text-muted hover:bg-surface"
                      )}
                    >
                      {value} Bintang
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <RatingStars rating={reviewRating} size="md" />
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  Ulasan
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Ceritakan kesan membaca, kualitas isi, atau siapa yang cocok membaca buku ini."
                  className="mt-3 min-h-32 w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                />
              </div>

              {myReview ? (
                <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Ulasan terakhir kamu:</span>
                    <Badge tone="success">Sudah tayang</Badge>
                  </div>
                </div>
              ) : null}

              {reviewMessage ? (
                <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
                  {reviewMessage}
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => {
                    if (!user?.id) {
                      setReviewMessage("Login pembaca diperlukan untuk mengirim ulasan.");
                      return;
                    }
                    if (!canReview) {
                      setReviewMessage(
                        "Ulasan tersedia setelah kamu punya akses baca ke buku ini."
                      );
                      return;
                    }
                    if (reviewComment.trim().length < 12) {
                      setReviewMessage("Tulis ulasan yang lebih jelas, minimal 12 karakter.");
                      return;
                    }

                    submitEbookReview({
                      ebookId: ebook.id,
                      userId: user.id,
                      userName: user.name,
                      rating: reviewRating,
                      comment: reviewComment.trim(),
                    });
                    setReviewMessage(
                      myReview
                        ? "Perubahan ulasan berhasil disimpan dan langsung diperbarui."
                        : "Ulasan berhasil dikirim dan langsung tayang."
                    );
                  }}
                  disabled={!user?.id}
                >
                  {myReview ? "Perbarui Ulasan" : "Kirim Ulasan"}
                </Button>
                {!user?.id ? (
                  <Link to="/login">
                    <Button variant="secondary">Login untuk Ulasan</Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight text-ink">
                    Ulasan pembaca
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    Semua ulasan pembaca tampil langsung tanpa moderasi admin.
                  </div>
                </div>
                <div className="text-sm text-muted">
                  {visibleReviews.length.toLocaleString("id-ID")} ulasan
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {visibleReviews.length ? (
                  visibleReviews.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-border bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">{review.userName}</div>
                          <div className="mt-1 text-xs text-muted">
                            {new Date(review.updatedAtISO || review.createdAtISO).toLocaleString(
                              "id-ID"
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <RatingStars rating={review.rating} />
                          <div className="text-sm font-semibold text-ink">
                            {review.rating.toFixed(1)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm leading-relaxed text-muted">{review.comment}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
                    Belum ada ulasan yang tayang untuk buku ini.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-lg font-semibold tracking-tight text-ink">Rekomendasi serupa</div>
                <div className="mt-1 text-sm text-muted">
                  Berdasarkan kategori dan tema bacaan yang mirip.
                </div>
              </div>
              <Link to="/katalog" className="text-sm font-semibold text-brand hover:underline">
                Kembali ke katalog
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((b) => (
                <BookCard key={b.id} ebook={b} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
