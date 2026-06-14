import { Link } from "react-router-dom";
import { HeartOff } from "lucide-react";
import Button from "@/components/Button";
import BookCard from "@/components/BookCard";
import { getMembershipPlanLabel } from "@/lib/accessMessaging";
import { useCatalogEbooks } from "@/lib/catalog";
import { useLibraryStore } from "@/stores/libraryStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTransactionStore } from "@/stores/transactionStore";

export default function Wishlist() {
  const ebooks = useCatalogEbooks();
  const user = useSessionStore((s) => s.user);
  const uid = user?.id ?? "guest";
  const membershipPlan = user?.membershipPlan ?? "FREE";
  const wishlist = useLibraryStore((s) => s.wishlistByUser);
  const toggleWishlist = useLibraryStore((s) => s.toggleWishlist);
  const transactionsByUser = useTransactionStore((s) => s.transactionsByUser);
  const transactions = transactionsByUser[uid] ?? [];

  const ids = Object.keys(wishlist[uid] ?? {});
  const list = ids
    .map((id) => ebooks.find((b) => b.id === id))
    .filter((ebook): ebook is NonNullable<typeof ebook> => Boolean(ebook));
  const pendingMembershipTransaction = [...transactions]
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            Wishlist
          </div>
          <div className="mt-2 text-sm text-muted">
            Simpan buku untuk dibeli atau dibaca nanti.
          </div>
        </div>
        {ids.length ? (
          <Button
            variant="secondary"
            onClick={() => ids.forEach((id) => toggleWishlist(id))}
          >
            <HeartOff size={16} />
            Bersihkan
          </Button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 text-sm text-muted">
        Wishlist membantu menyimpan buku yang menarik, tetapi belum selalu berarti aksesnya aktif.
        Cek badge buku untuk membedakan akses gratis, membership, atau beli satuan.
      </div>

      {pendingMembershipTransaction ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Pembayaran membership {getMembershipPlanLabel(pendingMembershipTransaction.membershipPlan!)} masih
          pending. Paket aktif kamu saat ini tetap {getMembershipPlanLabel(membershipPlan)} sampai transaksi
          tervalidasi.
        </div>
      ) : null}

      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <BookCard key={b.id} ebook={b} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white p-6 text-center">
          <div className="text-sm font-semibold text-ink">Belum ada wishlist</div>
          <div className="mt-1 text-sm text-muted">
            Tambahkan buku dari kartu e-book atau halaman detail.
          </div>
          <div className="mt-4">
            <Link to="/katalog">
              <Button variant="secondary">Cari Buku</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
