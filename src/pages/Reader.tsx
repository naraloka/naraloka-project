import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  Download,
  ExternalLink,
  Highlighter,
  LoaderCircle,
  Minus,
  Plus,
} from "lucide-react";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import {
  getLockedBookAccessMessage,
  getLockedBookPrimaryAction,
} from "@/lib/accessMessaging";
import { useCatalogEbooks } from "@/lib/catalog";
import { downloadEbookAsText } from "@/lib/ebookDownload";
import { fetchPublishedReaderFileUrl } from "@/lib/readerFile";
import { getOfflineActionMessage, getReaderSyncNotice } from "@/lib/readerSyncMessaging";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/stores/libraryStore";
import { useSessionStore } from "@/stores/sessionStore";

type ReaderTheme = "paper" | "sepia" | "night";

function canReadFull(params: {
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

export default function Reader() {
  const { ebookId } = useParams();
  const navigate = useNavigate();
  const ebooks = useCatalogEbooks();

  const ebook = ebooks.find((b) => b.id === ebookId);
  const user = useSessionStore((s) => s.user);
  const uid = user?.id ?? "guest";
  const isGuestSession = !user;
  const membershipPlan = user?.membershipPlan ?? "FREE";

  const library = useLibraryStore((s) => s.libraryByUser);
  const addToLibrary = useLibraryStore((s) => s.addToLibrary);
  const updateProgress = useLibraryStore((s) => s.updateProgress);
  const toggleDownloaded = useLibraryStore((s) => s.toggleDownloaded);
  const toggleBookmark = useLibraryStore((s) => s.toggleBookmark);
  const bookmarksByUser = useLibraryStore((s) => s.bookmarksByUser);
  const addHighlight = useLibraryStore((s) => s.addHighlight);
  const highlightsByUser = useLibraryStore((s) => s.highlightsByUser);
  const setHighlightNote = useLibraryStore((s) => s.setHighlightNote);
  const removeHighlight = useLibraryStore((s) => s.removeHighlight);

  const [readerTheme, setReaderTheme] = useState<ReaderTheme>("paper");
  const [fontScale, setFontScale] = useState(0);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [highlightText, setHighlightText] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [readerFileUrl, setReaderFileUrl] = useState("");
  const [readerFileName, setReaderFileName] = useState("");
  const [readerFileMimeType, setReaderFileMimeType] = useState("");
  const [readerFileLoading, setReaderFileLoading] = useState(false);
  const [readerFileError, setReaderFileError] = useState("");
  const [guestPage, setGuestPage] = useState(1);

  const item = ebook ? library[uid]?.[ebook.id] : undefined;
  const owned = Boolean(item?.owned);
  const allowed = ebook
    ? canReadFull({
        owned,
        membershipPlan,
        access: ebook.access,
        requiredPlan: ebook.requiredPlan,
      })
    : false;
  const accessStatusLabel = useMemo(() => {
    if (!ebook) return "";
    if (allowed) return "Akses penuh";
    if (!user) return "Preview tamu";
    if (ebook.access === "PAID") return "Preview pembelian";
    if (ebook.access === "MEMBERSHIP") return "Preview membership";
    return "Preview terbatas";
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

  const totalPages = ebook?.pageCount ?? 0;
  const maxReadable = allowed ? totalPages : ebook?.previewPages.length ?? 0;

  const currentPage = useMemo(() => {
    if (!ebook) return 1;
    const page = isGuestSession ? guestPage : item?.progress.currentPage ?? 1;
    return Math.min(Math.max(page, 1), Math.max(maxReadable, 1));
  }, [ebook, guestPage, isGuestSession, item?.progress.currentPage, maxReadable]);

  const content = useMemo(() => {
    if (!ebook) return "";
    const index = currentPage - 1;
    return allowed ? ebook.pages[index] : ebook.previewPages[index] ?? ebook.previewPages[0] ?? "";
  }, [allowed, currentPage, ebook]);

  const isBookmarked = Boolean(
    (bookmarksByUser[uid]?.[ebook?.id ?? ""] ?? []).some((b) => b.page === currentPage)
  );

  const downloadActive = Boolean(item?.downloaded);
  const canUseOriginalSource = allowed && Boolean(ebook?.sourceStoragePath);
  const usingSourceDocumentReader = canUseOriginalSource;
  const usingOriginalPdfReader =
    usingSourceDocumentReader &&
    (readerFileMimeType || ebook?.sourceMimeType) === "application/pdf";
  const usingOriginalFileDownloadMode = usingSourceDocumentReader && !usingOriginalPdfReader;
  const readerSyncNotice = useMemo(
    () =>
      getReaderSyncNotice({
        isGuestSession,
        downloadActive,
        usingSourceDocumentReader,
      }),
    [downloadActive, isGuestSession, usingSourceDocumentReader]
  );
  const themeClass =
    readerTheme === "paper"
      ? "bg-white"
      : readerTheme === "sepia"
        ? "bg-[#f7f1e3]"
        : "bg-[#0b1020] text-white";

  const textClass = readerTheme === "night" ? "text-white/90" : "text-ink";
  const mutedClass = readerTheme === "night" ? "text-white/60" : "text-muted";

  useEffect(() => {
    setGuestPage(1);
    setHighlightOpen(false);
    setHighlightText("");
    setDownloadMessage("");
    setReaderFileMimeType("");
  }, [ebook?.id, isGuestSession]);

  useEffect(() => {
    let active = true;

    async function loadReaderFile() {
      if (!ebook?.id || !canUseOriginalSource) {
        setReaderFileUrl("");
        setReaderFileName("");
        setReaderFileMimeType("");
        setReaderFileError("");
        setReaderFileLoading(false);
        return;
      }

      setReaderFileLoading(true);
      setReaderFileError("");

      try {
        const result = await fetchPublishedReaderFileUrl(ebook.id);
        if (!active) return;
        setReaderFileUrl(result.signedUrl);
        setReaderFileName(result.fileName);
        setReaderFileMimeType(result.mimeType);
      } catch (error) {
        if (!active) return;
        setReaderFileUrl("");
        setReaderFileName("");
        setReaderFileMimeType("");
        setReaderFileError(
          error instanceof Error ? error.message : "Gagal memuat file sumber e-book untuk reader."
        );
      } finally {
        if (active) {
          setReaderFileLoading(false);
        }
      }
    }

    void loadReaderFile();

    return () => {
      active = false;
    };
  }, [canUseOriginalSource, ebook?.id]);

  async function handleDownloadOriginalFile() {
    if (!ebook?.id) return;

    setDownloadMessage("Menyiapkan file asli e-book...");

    try {
      const result = await fetchPublishedReaderFileUrl(ebook.id);
      setReaderFileUrl(result.signedUrl);
      setReaderFileName(result.fileName);
      setReaderFileMimeType(result.mimeType);
      const link = document.createElement("a");
      link.href = result.signedUrl;
      link.download = result.fileName || ebook.title;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDownloadMessage("File asli e-book berhasil diunduh.");
    } catch (error) {
      setDownloadMessage(
        error instanceof Error ? error.message : "Gagal mengunduh file asli e-book."
      );
    }
  }

  function goToPage(targetPage: number) {
    if (!ebook) return;
    const nextPage = Math.min(Math.max(targetPage, 1), Math.max(maxReadable, 1));
    if (isGuestSession) {
      setGuestPage(nextPage);
      return;
    }
    updateProgress(ebook.id, nextPage, ebook.pageCount);
  }

  if (!ebook) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-center">
        <div className="text-sm font-semibold text-ink">E-book tidak ditemukan</div>
        <div className="mt-4">
          <Link to="/katalog">
            <Button variant="secondary">Kembali</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-[2rem] border border-border shadow-soft", themeClass)}>
      <div className={cn("flex flex-col gap-4 border-b border-border/60 px-5 py-4 md:flex-row md:items-center", readerTheme === "night" && "border-white/10")}>
        <button
          type="button"
          onClick={() => navigate(`/ebook/${ebook.id}`)}
          className={cn(
            "inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80",
            textClass
          )}
        >
          <ArrowLeft size={18} />
          Detail
        </button>

        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-sm font-semibold", textClass)}>{ebook.title}</div>
          <div className={cn("mt-1 text-xs", mutedClass)}>
            {usingOriginalPdfReader
              ? !allowed
                ? lockedAccessMessage || "Preview terbatas"
                : "Menampilkan file PDF asli yang diupload penulis"
              : usingOriginalFileDownloadMode
                ? "Dokumen sumber asli tersedia untuk dibuka atau diunduh"
                : !allowed
                  ? `Halaman ${currentPage} / ${maxReadable || 1} • Preview`
                  : `Halaman ${currentPage} / ${maxReadable || 1}`}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!allowed ? (
            <Badge tone="warning">{accessStatusLabel}</Badge>
          ) : (
            <Badge tone="success">Akses penuh</Badge>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (usingOriginalPdfReader) {
                void handleDownloadOriginalFile();
                return;
              }
              if (usingOriginalFileDownloadMode) {
                void handleDownloadOriginalFile();
                return;
              }
              if (isGuestSession) {
                navigate("/login");
                return;
              }
              addToLibrary(ebook.id, ebook.pageCount);
              if (downloadActive) {
                toggleDownloaded(ebook.id, ebook.pageCount);
                setDownloadMessage(
                  getOfflineActionMessage({
                    isGuestSession,
                    fullAccess: allowed,
                    downloadActive: true,
                  })
                );
                return;
              }
              toggleDownloaded(ebook.id, ebook.pageCount);
              const result = downloadEbookAsText({
                ebook,
                owned,
                membershipPlan,
              });
              setDownloadMessage(
                getOfflineActionMessage({
                  isGuestSession,
                  fullAccess: result.fullAccess,
                  downloadActive: false,
                })
              );
            }}
            className={cn(
              readerTheme === "night" && "border-white/15 bg-white/5 text-white hover:bg-white/10",
              !usingOriginalPdfReader && downloadActive && "border-brand-2 bg-brand-2/10 text-brand-2"
            )}
            disabled={usingSourceDocumentReader && readerFileLoading}
          >
            {usingSourceDocumentReader && readerFileLoading ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {usingSourceDocumentReader
              ? usingOriginalPdfReader
                ? "Unduh PDF Asli"
                : "Unduh Dokumen Asli"
              : downloadActive
                ? "Hapus Offline"
                : "Unduh Offline"}
          </Button>
          {usingSourceDocumentReader && readerFileUrl ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                window.open(readerFileUrl, "_blank", "noopener,noreferrer");
              }}
              className={cn(
                readerTheme === "night" && "border-white/15 bg-white/5 text-white hover:bg-white/10"
              )}
            >
              <ExternalLink size={16} />
              {usingOriginalPdfReader ? "Buka PDF" : "Buka Dokumen"}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (isGuestSession) {
                    navigate("/login");
                    return;
                  }
                  toggleBookmark(ebook.id, currentPage);
                }}
                className={cn(
                  readerTheme === "night" && "border-white/15 bg-white/5 text-white hover:bg-white/10",
                  isBookmarked && "border-brand-2 bg-brand-2/10 text-brand-2"
                )}
              >
                <Bookmark size={16} className={cn(isBookmarked && "fill-current")} />
                {isGuestSession ? "Masuk untuk Bookmark" : "Bookmark"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (isGuestSession) {
                    navigate("/login");
                    return;
                  }
                  setHighlightOpen(true);
                }}
                className={cn(
                  readerTheme === "night" && "border-white/15 bg-white/5 text-white hover:bg-white/10"
                )}
              >
                <Highlighter size={16} />
                {isGuestSession ? "Masuk untuk Highlight" : "Highlight"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_360px]">
        <div className="px-5 py-6 md:px-10 md:py-10">
          <div className="mx-auto max-w-[760px]">
            {usingSourceDocumentReader ? (
              <div className="space-y-4">
                <div
                  className={cn(
                    "rounded-2xl border p-4 text-sm",
                    readerTheme === "night"
                      ? "border-white/10 bg-white/5 text-white/80"
                      : "border-border bg-surface text-muted"
                  )}
                >
                  {usingOriginalPdfReader
                    ? "Reader ini menampilkan file PDF asli yang diupload penulis agar isi naskah sama dengan dokumen sumber."
                    : "Dokumen sumber karya ini tersedia dalam file asli yang diupload penulis. Kamu bisa membukanya langsung atau mengunduhnya dari reader."}
                </div>

                {readerFileLoading ? (
                  <div
                    className={cn(
                      "flex min-h-[70vh] items-center justify-center rounded-2xl border",
                      readerTheme === "night"
                        ? "border-white/10 bg-white/5 text-white/80"
                        : "border-border bg-white text-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <LoaderCircle size={16} className="animate-spin" />
                      Memuat file sumber e-book...
                    </div>
                  </div>
                ) : usingOriginalPdfReader && readerFileUrl ? (
                  <iframe
                    src={readerFileUrl}
                    title={`PDF ${ebook.title}`}
                    className="min-h-[78vh] w-full rounded-2xl border border-border bg-white"
                  />
                ) : readerFileUrl ? (
                  <div
                    className={cn(
                      "rounded-2xl border p-5",
                      readerTheme === "night"
                        ? "border-white/10 bg-white/5 text-white/80"
                        : "border-border bg-white text-muted"
                    )}
                  >
                    <div className={cn("text-base font-semibold", textClass)}>Dokumen Asli Tersedia</div>
                    <div className={cn("mt-2 text-sm", mutedClass)}>
                      File sumber buku ini tidak ditampilkan inline karena formatnya bukan PDF.
                      Gunakan tombol di atas untuk membuka atau mengunduh dokumen asli.
                    </div>
                    <div className="mt-4 grid gap-3 text-sm">
                      <div>
                        <div className={cn("text-xs font-semibold uppercase tracking-wide", mutedClass)}>
                          Format file
                        </div>
                        <div className={cn("mt-1 break-all", textClass)}>
                          {readerFileMimeType || ebook.sourceMimeType || "Dokumen sumber"}
                        </div>
                      </div>
                      <div>
                        <div className={cn("text-xs font-semibold uppercase tracking-wide", mutedClass)}>
                          Ringkasan
                        </div>
                        <div className={cn("mt-1 leading-relaxed", textClass)}>
                          {ebook.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "rounded-2xl border p-4 text-sm",
                      readerTheme === "night"
                        ? "border-red-400/20 bg-red-500/10 text-red-100"
                        : "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {readerFileError || "File sumber e-book belum bisa dimuat."}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div
                  className={cn("whitespace-pre-wrap font-serif leading-relaxed", textClass)}
                  style={{ fontSize: `${16 + fontScale}px` }}
                >
                  {content}
                </div>

                <div className={cn("mt-8 flex items-center justify-between gap-3", mutedClass)}>
                  <button
                    type="button"
                    onClick={() => goToPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className={cn(
                      "rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-40",
                      readerTheme === "night"
                        ? "border-white/15 hover:bg-white/10"
                        : "border-border hover:bg-surface"
                    )}
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(Math.min(maxReadable, currentPage + 1))}
                    disabled={currentPage >= maxReadable}
                    className={cn(
                      "rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-40",
                      readerTheme === "night"
                        ? "border-white/15 hover:bg-white/10"
                        : "border-border hover:bg-surface"
                    )}
                  >
                    Berikutnya
                  </button>
                </div>
              </>
            )}

            {downloadMessage ? (
              <div className={cn("mt-4 text-sm", readerTheme === "night" ? "text-white/70" : "text-muted")}>
                {downloadMessage}
              </div>
            ) : null}
          </div>
        </div>

        <aside className={cn("border-t border-border/60 bg-surface/40 p-5 md:border-l md:border-t-0", readerTheme === "night" && "border-white/10 bg-white/5")}>
          <div className="space-y-6">
            {usingSourceDocumentReader ? (
              <div className="space-y-4">
                <div
                  className={cn(
                    "rounded-2xl border p-4",
                    readerTheme === "night" ? "border-white/15 bg-white/5" : "border-border bg-white"
                  )}
                >
                  <div className={cn("text-sm font-semibold", textClass)}>
                    {usingOriginalPdfReader ? "Mode PDF Asli" : "Mode Dokumen Asli"}
                  </div>
                  <div className={cn("mt-2 text-sm", mutedClass)}>
                    {usingOriginalPdfReader
                      ? "Isi reader diambil langsung dari file PDF yang diupload penulis saat submit naskah."
                      : "Reader mengutamakan file dokumen asli yang diupload penulis agar isi publikasi tetap konsisten dengan naskah sumber."}
                  </div>
                  <div className={cn("mt-3 text-xs", mutedClass)}>
                    Fitur bookmark halaman, highlight teks, dan mode offline teks tidak dipakai
                    saat reader memakai dokumen sumber asli.
                  </div>
                </div>

                {readerFileName ? (
                  <div
                    className={cn(
                      "rounded-2xl border p-4",
                      readerTheme === "night" ? "border-white/15 bg-white/5" : "border-border bg-white"
                    )}
                  >
                    <div className={cn("text-sm font-semibold", textClass)}>File Sumber</div>
                    <div className={cn("mt-2 break-all text-sm", mutedClass)}>{readerFileName}</div>
                    {readerFileMimeType ? (
                      <div className={cn("mt-2 break-all text-xs", mutedClass)}>{readerFileMimeType}</div>
                    ) : null}
                  </div>
                ) : null}

                {readerFileError ? (
                  <div
                    className={cn(
                      "rounded-2xl border p-4 text-sm",
                      readerTheme === "night"
                        ? "border-red-400/20 bg-red-500/10 text-red-100"
                        : "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {readerFileError}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    "rounded-2xl border p-4 text-sm",
                    readerTheme === "night"
                      ? "border-white/15 bg-white/5 text-white/80"
                      : "border-border bg-white text-muted"
                  )}
                >
                  {readerSyncNotice}
                </div>

                <div>
                  <div className={cn("text-sm font-semibold", textClass)}>Tampilan</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["paper", "sepia", "night"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setReaderTheme(t)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold transition",
                          readerTheme === t
                            ? readerTheme === "night"
                              ? "border-white/30 bg-white/10 text-white"
                              : "border-brand-2 bg-brand-2/10 text-brand-2"
                            : readerTheme === "night"
                              ? "border-white/15 bg-transparent text-white/70 hover:bg-white/10"
                              : "border-border bg-white text-muted hover:bg-surface"
                        )}
                      >
                        {t === "paper" ? "Light" : t === "sepia" ? "Sepia" : "Night"}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFontScale((v) => Math.max(-2, v - 1))}
                      className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                        readerTheme === "night"
                          ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
                          : "border-border bg-white text-ink hover:bg-surface"
                      )}
                      aria-label="Perkecil font"
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontScale((v) => Math.min(6, v + 1))}
                      className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                        readerTheme === "night"
                          ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
                          : "border-border bg-white text-ink hover:bg-surface"
                      )}
                      aria-label="Perbesar font"
                    >
                      <Plus size={16} />
                    </button>
                    <div className={cn("text-xs", mutedClass)}>Ukuran teks</div>
                  </div>
                </div>

                <div>
                  <div className={cn("text-sm font-semibold", textClass)}>Bookmark</div>
                  {isGuestSession ? (
                    <div
                      className={cn(
                        "mt-3 rounded-2xl border p-4 text-sm",
                        readerTheme === "night"
                          ? "border-white/15 bg-white/5 text-white/80"
                          : "border-border bg-white text-muted"
                      )}
                    >
                      Masuk untuk menyimpan bookmark lintas perangkat dan melanjutkan bacaan kapan
                      saja.
                    </div>
                  ) : (
                    <>
                      <div className={cn("mt-2 text-sm", mutedClass)}>
                        {(bookmarksByUser[uid]?.[ebook.id] ?? []).length} tersimpan
                      </div>
                      <div className="mt-3 space-y-2">
                        {(bookmarksByUser[uid]?.[ebook.id] ?? [])
                          .slice()
                          .sort((a, b) => a.page - b.page)
                          .slice(0, 6)
                          .map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => goToPage(b.page)}
                              className={cn(
                                "w-full rounded-2xl border px-4 py-2 text-left text-sm font-semibold transition",
                                readerTheme === "night"
                                  ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
                                  : "border-border bg-white text-ink hover:bg-surface"
                              )}
                            >
                              Halaman {b.page}
                            </button>
                          ))}
                        {(bookmarksByUser[uid]?.[ebook.id] ?? []).length > 6 ? (
                          <div className={cn("text-xs", mutedClass)}>+ lebih banyak di versi penuh</div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <div className={cn("text-sm font-semibold", textClass)}>Highlight & catatan</div>
                  {isGuestSession ? (
                    <div
                      className={cn(
                        "mt-3 rounded-2xl border p-4 text-sm",
                        readerTheme === "night"
                          ? "border-white/15 bg-white/5 text-white/80"
                          : "border-border bg-white text-muted"
                      )}
                    >
                      Masuk untuk menyimpan highlight, catatan, dan sinkronisasi progres bacaan.
                    </div>
                  ) : (
                    <>
                      <div className={cn("mt-2 text-sm", mutedClass)}>
                        {(highlightsByUser[uid]?.[ebook.id] ?? []).length} highlight
                      </div>

                      <div className="mt-3 space-y-3">
                        {(highlightsByUser[uid]?.[ebook.id] ?? [])
                          .slice()
                          .reverse()
                          .slice(0, 4)
                          .map((h) => (
                            <div
                              key={h.id}
                              className={cn(
                                "rounded-2xl border p-4",
                                readerTheme === "night"
                                  ? "border-white/15 bg-white/5"
                                  : "border-border bg-white"
                              )}
                            >
                              <div className={cn("text-xs font-semibold", mutedClass)}>
                                Halaman {h.page}
                              </div>
                              <div className={cn("mt-2 text-sm leading-relaxed", textClass)}>
                                {h.text}
                              </div>
                              <div className="mt-3 grid gap-2">
                                <Input
                                  value={h.note ?? ""}
                                  onChange={(e) => setHighlightNote(h.id, e.target.value)}
                                  placeholder="Catatan (opsional)"
                                  className={cn(
                                    readerTheme === "night" &&
                                      "border-white/15 bg-white/5 text-white placeholder:text-white/40"
                                  )}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={cn(
                                    "justify-start",
                                    readerTheme === "night"
                                      ? "text-white/80 hover:bg-white/10"
                                      : "text-muted hover:bg-surface"
                                  )}
                                  onClick={() => removeHighlight(h.id)}
                                >
                                  Hapus
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {!allowed ? (
              <div className={cn("rounded-2xl border p-4", readerTheme === "night" ? "border-white/15 bg-white/5" : "border-border bg-white")}>
                <div className={cn("text-sm font-semibold", textClass)}>Upgrade untuk akses penuh</div>
                <div className={cn("mt-2 text-sm", mutedClass)}>
                  {lockedAccessMessage}
                </div>
                <div className="mt-4">
                  <Link
                    to={
                      ebook.access === "PAID"
                        ? `/checkout?ebook=${ebook.id}`
                        : user
                          ? "/langganan"
                          : "/login"
                    }
                  >
                    <Button className="w-full" variant={readerTheme === "night" ? "secondary" : "primary"}>
                      {getLockedBookPrimaryAction({
                        access: ebook.access,
                        isLoggedIn: Boolean(user),
                      })}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {highlightOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-white p-5 shadow-lift">
            <div className="text-sm font-semibold text-ink">Tambah highlight</div>
            <div className="mt-2 text-sm text-muted">
              Simpan kutipan singkat dari halaman ini lalu tambahkan catatan bila diperlukan.
            </div>
            <textarea
              value={highlightText}
              onChange={(e) => setHighlightText(e.target.value)}
              placeholder="Ketik kutipan yang ingin di-highlight…"
              className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setHighlightOpen(false);
                  setHighlightText("");
                }}
              >
                Batal
              </Button>
              <Button
                onClick={() => {
                  const text = highlightText.trim();
                  if (!text) return;
                  addHighlight(ebook.id, currentPage, text);
                  setHighlightOpen(false);
                  setHighlightText("");
                }}
              >
                Simpan
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
