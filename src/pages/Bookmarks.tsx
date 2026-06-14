import { useMemo } from "react";
import { Bookmark, BookOpenText, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import {
  getLockedBookAccessMessage,
  getLockedBookPrimaryAction,
} from "@/lib/accessMessaging";
import { useCatalogEbooks } from "@/lib/catalog";
import { useLibraryStore } from "@/stores/libraryStore";
import { useSessionStore } from "@/stores/sessionStore";

function canAccessBook(params: {
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

export default function BookmarksPage() {
  const ebooks = useCatalogEbooks();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const uid = user?.id ?? "guest";
  const membershipPlan = user?.membershipPlan ?? "FREE";
  const bookmarksByUser = useLibraryStore((s) => s.bookmarksByUser);
  const toggleBookmark = useLibraryStore((s) => s.toggleBookmark);
  const updateProgress = useLibraryStore((s) => s.updateProgress);
  const libraryByUser = useLibraryStore((s) => s.libraryByUser);

  const bookmarkGroups = useMemo(() => {
    const map = bookmarksByUser[uid] ?? {};
    return Object.entries(map)
      .map(([ebookId, bookmarks]) => {
        const ebook = ebooks.find((item) => item.id === ebookId);
        if (!ebook || !bookmarks.length) return null;
        return {
          ebook,
          bookmarks: [...bookmarks].sort((a, b) => a.page - b.page),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [bookmarksByUser, ebooks, uid]);

  const totalBookmarks = bookmarkGroups.reduce((sum, group) => sum + group.bookmarks.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Bookmark</div>
          <div className="mt-2 text-sm text-muted">
            Semua halaman yang kamu tandai untuk dibuka lagi dengan cepat.
          </div>
        </div>
        <Badge tone={totalBookmarks ? "brand" : "neutral"}>{totalBookmarks} tersimpan</Badge>
      </div>

      {bookmarkGroups.length ? (
        <div className="space-y-4">
          {bookmarkGroups.map(({ ebook, bookmarks }) => (
            (() => {
              const owned = Boolean(libraryByUser[uid]?.[ebook.id]?.owned);
              const allowed = canAccessBook({
                owned,
                membershipPlan,
                access: ebook.access,
                requiredPlan: ebook.requiredPlan,
              });
              const lockedMessage = allowed
                ? ""
                : getLockedBookAccessMessage({
                    access: ebook.access,
                    requiredPlan: ebook.requiredPlan,
                    isLoggedIn: Boolean(user),
                    membershipPlan,
                  });

              return (
                <div
                  key={ebook.id}
                  className="grid gap-4 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] md:grid-cols-[120px_1fr]"
                >
                  <Link to={`/ebook/${ebook.id}`} className="overflow-hidden rounded-2xl bg-surface">
                    <img src={ebook.coverUrl} alt={ebook.title} className="h-full w-full object-cover" />
                  </Link>

                  <div className="min-w-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link to={`/ebook/${ebook.id}`} className="text-sm font-semibold text-ink hover:text-brand">
                          {ebook.title}
                        </Link>
                        <div className="mt-1 text-xs text-muted">
                          {ebook.category} • {bookmarks.length} bookmark
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={allowed ? "success" : "warning"}>
                            {allowed ? "Akses aktif" : "Perlu akses"}
                          </Badge>
                          {ebook.access === "MEMBERSHIP" ? (
                            <Badge tone="neutral">
                              Membership{ebook.requiredPlan ? ` • ${ebook.requiredPlan}` : ""}
                            </Badge>
                          ) : null}
                          {ebook.access === "PAID" ? <Badge tone="neutral">Beli satuan</Badge> : null}
                        </div>
                      </div>
                      <Link to={allowed ? `/baca/${ebook.id}` : `/ebook/${ebook.id}`}>
                        <Button variant="secondary" size="sm">
                          <BookOpenText size={16} />
                          {allowed
                            ? "Buka Reader"
                            : getLockedBookPrimaryAction({
                                access: ebook.access,
                                isLoggedIn: Boolean(user),
                              })}
                        </Button>
                      </Link>
                    </div>

                    {!allowed ? <div className="mt-3 text-sm text-muted">{lockedMessage}</div> : null}

                    <div className="mt-4 grid gap-2">
                      {bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="text-sm font-semibold text-ink">Halaman {bookmark.page}</div>
                            <div className="mt-1 text-xs text-muted">
                              {new Date(bookmark.createdAtISO).toLocaleString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                if (!allowed) {
                                  navigate(ebook.access === "PAID" ? `/ebook/${ebook.id}` : "/langganan");
                                  return;
                                }
                                updateProgress(ebook.id, bookmark.page, ebook.pageCount);
                                navigate(`/baca/${ebook.id}`);
                              }}
                            >
                              <Bookmark size={16} />
                              {allowed ? "Buka Halaman" : "Lihat Akses"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleBookmark(ebook.id, bookmark.page)}
                            >
                              <Trash2 size={16} />
                              Hapus
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white p-6 text-center">
          <div className="text-sm font-semibold text-ink">Belum ada bookmark</div>
          <div className="mt-1 text-sm text-muted">
            Tandai halaman saat membaca e-book, lalu bookmark akan muncul di sini.
          </div>
          <div className="mt-4">
            <Link to="/perpustakaan">
              <Button variant="secondary">Buka Perpustakaan</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
