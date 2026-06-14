import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenText, Download } from "lucide-react";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { getMembershipPlanLabel } from "@/lib/accessMessaging";
import { useCatalogEbooks } from "@/lib/catalog";
import { downloadEbookAsText } from "@/lib/ebookDownload";
import { useLibraryStore } from "@/stores/libraryStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { cn } from "@/lib/utils";
import { formatIdrFromCents } from "@/utils/format";

const emptyTransactions: ReturnType<typeof useTransactionStore.getState>["transactionsByUser"][string] = [];

export default function LibraryPage() {
  const ebooks = useCatalogEbooks();
  const user = useSessionStore((s) => s.user);
  const uid = user?.id ?? "guest";
  const membershipPlan = user?.membershipPlan ?? "FREE";
  const library = useLibraryStore((s) => s.libraryByUser);
  const toggleDownloaded = useLibraryStore((s) => s.toggleDownloaded);
  const transactionsByUser = useTransactionStore((s) => s.transactionsByUser);
  const transactions = transactionsByUser[uid] ?? emptyTransactions;
  const [downloadMessage, setDownloadMessage] = useState("");
  const latestPendingMembershipTransaction = useMemo(() => {
    return [...transactions]
      .filter(
        (transaction) =>
          transaction.itemType === "MEMBERSHIP" &&
          transaction.status === "PENDING" &&
          transaction.membershipPlan
      )
      .sort(
        (a, b) =>
          +new Date(b.updatedAtISO || b.createdAtISO || 0) -
          +new Date(a.updatedAtISO || a.createdAtISO || 0)
      )[0];
  }, [transactions]);
  const latestSuccessfulMembershipTransaction = useMemo(() => {
    return [...transactions]
      .filter(
        (transaction) =>
          transaction.itemType === "MEMBERSHIP" &&
          transaction.status === "SUCCESS" &&
          transaction.membershipPlan
      )
      .sort(
        (a, b) =>
          +new Date(b.updatedAtISO || b.createdAtISO || 0) -
          +new Date(a.updatedAtISO || a.createdAtISO || 0)
      )[0];
  }, [transactions]);
  const latestSuccessfulEbookOrderById = useMemo(() => {
    const next = new Map<string, (typeof transactions)[number]>();
    for (const transaction of transactions) {
      if (
        transaction.itemType === "EBOOK" &&
        transaction.status === "SUCCESS" &&
        transaction.ebookId &&
        !next.has(transaction.ebookId)
      ) {
        next.set(transaction.ebookId, transaction);
      }
    }
    return next;
  }, [transactions]);

  const items = Object.values(library[uid] ?? {}).sort((a, b) => {
    const da = a.lastReadAtISO ? +new Date(a.lastReadAtISO) : 0;
    const db = b.lastReadAtISO ? +new Date(b.lastReadAtISO) : 0;
    return db - da;
  });

  const visibleItems = items
    .map((it) => ({ it, ebook: ebooks.find((b) => b.id === it.ebookId) }))
    .filter((x): x is { it: (typeof items)[number]; ebook: NonNullable<typeof x.ebook> } => Boolean(x.ebook));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Perpustakaan
        </div>
        <div className="mt-2 text-sm text-muted">
          Koleksi buku yang kamu simpan, beli, atau unduh untuk offline.
        </div>
        <div className="mt-2 text-xs text-muted">
          Status offline disimpan lokal per perangkat. Progres baca, bookmark, dan highlight tetap
          mengikuti sinkronisasi akun saat login.
        </div>
      </div>

      {latestPendingMembershipTransaction ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Pembayaran membership {getMembershipPlanLabel(latestPendingMembershipTransaction.membershipPlan!)} masih
          pending. Paket aktif di akun tetap {getMembershipPlanLabel(membershipPlan)} sampai transaksi sukses
          tervalidasi.
        </div>
      ) : null}

      {latestSuccessfulMembershipTransaction &&
      latestSuccessfulMembershipTransaction.membershipPlan !== membershipPlan ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          Membership terakhir sudah sukses, tetapi status paket aktif di sesi ini belum ikut berubah.
          Coba buka ulang halaman akun atau login ulang bila sinkronisasi belum masuk.
        </div>
      ) : null}

      {visibleItems.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleItems.map(({ it, ebook }) => {
            const progressPct = Math.round((it.progress.currentPage / it.progress.totalPages) * 100);
            const latestSuccessfulOrder = latestSuccessfulEbookOrderById.get(ebook.id);
            return (
              <div
                key={it.ebookId}
                className="grid gap-4 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:grid-cols-[120px_1fr]"
              >
                <div className="overflow-hidden rounded-2xl bg-surface">
                  <img src={ebook.coverUrl} alt={ebook.title} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{ebook.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        {ebook.category} • {ebook.pageCount} halaman
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {it.owned ? <Badge tone="success">Dimiliki</Badge> : <Badge tone="neutral">Tersimpan</Badge>}
                      {latestSuccessfulOrder ? <Badge tone="brand">Checkout Berhasil</Badge> : null}
                      {it.downloaded ? <Badge tone="brand">Offline</Badge> : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div className="h-full bg-brand-2" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-muted">
                      Halaman {it.progress.currentPage} / {it.progress.totalPages} • {progressPct}%
                    </div>
                  </div>

                  {latestSuccessfulOrder ? (
                    <div className="mt-3 text-xs text-muted">
                      Pembelian buku ini tervalidasi pada{" "}
                      {new Date(
                        latestSuccessfulOrder.updatedAtISO || latestSuccessfulOrder.createdAtISO
                      ).toLocaleString("id-ID")}
                      .
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link to={`/baca/${ebook.id}`} className="flex-1">
                      <Button className="w-full">
                        <BookOpenText size={16} />
                        Lanjut Baca
                      </Button>
                    </Link>
                    <Button
                      className={cn("flex-1", it.downloaded && "border-brand-2 bg-brand-2/10 text-brand-2")}
                      variant="secondary"
                      onClick={() => {
                        if (it.downloaded) {
                          toggleDownloaded(ebook.id, ebook.pageCount);
                          setDownloadMessage(`Status offline untuk "${ebook.title}" dihapus.`);
                          return;
                        }
                        toggleDownloaded(ebook.id, ebook.pageCount);
                        const result = downloadEbookAsText({
                          ebook,
                          owned: it.owned,
                          membershipPlan,
                        });
                        setDownloadMessage(
                          result.fullAccess
                            ? `"${ebook.title}" berhasil diunduh untuk offline.`
                            : `Preview "${ebook.title}" berhasil diunduh.`
                        );
                      }}
                    >
                      <Download size={16} />
                      {it.downloaded ? "Hapus Offline" : "Unduh Offline"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white p-6 text-center">
          <div className="text-sm font-semibold text-ink">Perpustakaan masih kosong</div>
          <div className="mt-1 text-sm text-muted">
            Tambahkan buku dari katalog atau dari halaman detail e-book.
          </div>
          <div className="mt-4">
            <Link to="/katalog">
              <Button variant="secondary">Jelajahi Katalog</Button>
            </Link>
          </div>
        </div>
      )}

      {downloadMessage ? (
        <div className="rounded-2xl border border-border bg-white p-4 text-sm text-muted">
          {downloadMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-semibold tracking-tight text-ink">Riwayat transaksi</div>
            <div className="mt-1 text-sm text-muted">
              Menyimpan transaksi pembelian atau langganan yang dilakukan pembaca.
            </div>
          </div>
          <div className="text-sm text-muted">{transactions.length} transaksi</div>
        </div>

        {transactions.length ? (
          <div className="mt-5 space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-ink">{transaction.itemLabel}</div>
                    <div className="mt-1 text-xs text-muted">
                      Order ID: {transaction.orderId}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {new Date(transaction.createdAtISO).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        transaction.status === "SUCCESS"
                          ? "success"
                          : transaction.status === "PENDING"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {transaction.status}
                    </Badge>
                    <Badge tone="neutral">{transaction.paymentMethod}</Badge>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                  <div className="text-muted">
                    Email: {transaction.buyerEmail} • WhatsApp: {transaction.buyerWhatsApp}
                  </div>
                  <div className="font-semibold text-ink">
                    {formatIdrFromCents(transaction.amountCents)}
                  </div>
                </div>

                {transaction.itemType === "MEMBERSHIP" && transaction.membershipPlan ? (
                  <div className="mt-3 text-xs text-muted">
                    Paket: {getMembershipPlanLabel(transaction.membershipPlan)}
                  </div>
                ) : null}

                {transaction.redirectUrl ? (
                  <div className="mt-3">
                    <a
                      href={transaction.redirectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-brand hover:underline"
                    >
                      Buka detail pembayaran
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
            Belum ada transaksi pembaca yang tersimpan.
          </div>
        )}
      </div>
    </div>
  );
}
