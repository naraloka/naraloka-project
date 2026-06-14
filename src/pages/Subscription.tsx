import { useMemo, useState } from "react";
import { Crown, GraduationCap, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import PricingCard from "@/components/PricingCard";
import { supportEmail, supportEmailUrl, supportWhatsAppDisplay, supportWhatsAppUrl } from "@/constants/contact";
import { getMembershipPlanLabel } from "@/lib/accessMessaging";
import { useSessionStore } from "@/stores/sessionStore";
import { useTransactionStore } from "@/stores/transactionStore";
import type { MembershipPlan } from "@/types/domain";

export default function Subscription() {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const membershipPlan = user?.membershipPlan ?? "FREE";
  const transactionsByUser = useTransactionStore((s) => s.transactionsByUser);
  const [planMessage, setPlanMessage] = useState("");

  const planLabel = useMemo(() => getMembershipPlanLabel(membershipPlan), [membershipPlan]);
  const latestMembershipTransaction = useMemo(() => {
    const userTransactions = user?.id ? transactionsByUser[user.id] ?? [] : [];
    return [...userTransactions]
      .filter((transaction) => transaction.itemType === "MEMBERSHIP")
      .sort(
        (a, b) =>
          +new Date(b.updatedAtISO || b.createdAtISO || 0) -
          +new Date(a.updatedAtISO || a.createdAtISO || 0)
      )[0];
  }, [transactionsByUser, user?.id]);
  const planStatusMessage = useMemo(() => {
    if (!user) {
      return "Login untuk melihat paket aktif, riwayat checkout membership, dan status sinkronisasi pembayaran.";
    }

    if (
      latestMembershipTransaction?.status === "PENDING" &&
      latestMembershipTransaction.membershipPlan
    ) {
      return `Pembayaran paket ${getMembershipPlanLabel(
        latestMembershipTransaction.membershipPlan
      )} masih menunggu penyelesaian atau sinkronisasi. Paket aktif di akun tetap ${planLabel} sampai transaksi sukses masuk ke ledger.`;
    }

    if (
      latestMembershipTransaction?.status === "SUCCESS" &&
      latestMembershipTransaction.membershipPlan &&
      latestMembershipTransaction.membershipPlan !== membershipPlan
    ) {
      return "Pembayaran membership terakhir sudah sukses, tetapi paket aktif di sesi ini belum ikut berubah. Muat ulang sesi atau login ulang bila sinkronisasi belum masuk.";
    }

    if (membershipPlan !== "FREE") {
      return `Paket ${planLabel} aktif berdasarkan ledger pembayaran yang berhasil. Perpanjangan otomatis belum aktif; lakukan checkout baru saat ingin memperpanjang.`;
    }

    return "Akun kamu masih memakai paket Gratis sampai ada pembayaran membership yang sukses.";
  }, [latestMembershipTransaction, membershipPlan, planLabel, user]);

  const choose = async (plan: MembershipPlan) => {
    if (
      latestMembershipTransaction?.status === "PENDING" &&
      latestMembershipTransaction.membershipPlan === plan
    ) {
      setPlanMessage(
        `Pembayaran paket ${getMembershipPlanLabel(
          plan
        )} masih pending. Selesaikan atau cek status pembayaran terakhir dulu.`
      );
      return;
    }

    if (plan === membershipPlan) {
      setPlanMessage(
        membershipPlan === "FREE"
          ? "Akun kamu saat ini masih memakai paket Gratis."
          : `Paket ${planLabel} sudah aktif di akun kamu. Perpanjangan dilakukan lewat checkout baru, bukan toggle otomatis dari halaman ini.`
      );
      return;
    }

    if (plan === "FREE") {
      setPlanMessage(
        "Perubahan ke paket Gratis tidak dilakukan langsung dari browser. Jika ingin berhenti berlangganan, atur lewat alur billing atau hubungi support."
      );
      return;
    }

    setPlanMessage("");
    navigate(`/checkout?plan=${plan}`);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-muted">
              <Sparkles size={14} className="text-brand-2" />
              Membership Naraloka
            </div>
            <div className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-4xl">
              Pilih paket yang sesuai ritme bacamu
            </div>
            <div className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Premium untuk akses penuh + offline. Edukasi untuk konten belajar yang lebih terstruktur.
              Auto renewal dapat diaktifkan agar akses tidak terputus.
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="text-xs font-semibold text-muted">Paket aktif</div>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="brand">{planLabel}</Badge>
              {latestMembershipTransaction?.status === "PENDING" ? (
                <Badge tone="warning">Pembayaran Pending</Badge>
              ) : membershipPlan !== "FREE" ? (
                <Badge tone="success">Sinkron dari Ledger</Badge>
              ) : null}
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-white p-4 text-sm text-muted">
              {planStatusMessage}
            </div>
            <div className="mt-3 text-xs text-muted">
              Checkout membership sudah terhubung ke Midtrans. Status paket aktif mengikuti pembayaran yang sudah sukses dan tersinkron ke ledger.
            </div>
          </div>
        </div>

        {planMessage ? <div className="mt-4 text-sm text-muted">{planMessage}</div> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PricingCard
          title="Gratis"
          priceLabel="Rp0"
          description="Untuk coba pengalaman membaca dan akses konten terbuka."
          features={[
            "Akses e-book gratis",
            "Bookmark halaman",
            "Wishlist & rekomendasi dasar",
          ]}
          onSelect={() => choose("FREE")}
        />
        <PricingCard
          title="Premium"
          priceLabel="Rp49.000/bulan"
          description="Akses konten Premium + offline download."
          features={[
            "Akses konten Premium",
            "Download offline",
            "Highlight & catatan",
            "Notifikasi promo & rilis terbaru",
          ]}
          highlight
          onSelect={() => choose("PREMIUM")}
        />
        <PricingCard
          title="Edukasi"
          priceLabel="Rp29.000/bulan"
          description="Konten edukasi yang ringkas dan progres belajar."
          features={[
            "Akses konten Edukasi",
            "Catatan terstruktur",
            "Progress belajar",
          ]}
          onSelect={() => choose("EDU")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Crown size={16} className="text-brand-2" /> Premium
          </div>
          <div className="mt-2 text-sm text-muted">
            Cocok untuk pembaca rutin, koleksi besar, dan kebutuhan offline.
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <GraduationCap size={16} className="text-brand-2" /> Edukasi
          </div>
          <div className="mt-2 text-sm text-muted">
            Cocok untuk belajar mandiri: catatan, highlight, dan progres yang konsisten.
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="text-sm font-semibold text-ink">Metode pembayaran</div>
          <div className="mt-2 text-sm text-muted">
            QRIS, Transfer Bank, E-Wallet, Virtual Account, Kartu Kredit/Debit melalui checkout Midtrans.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 text-center">
        <div className="text-sm font-semibold text-ink">Butuh bantuan?</div>
        <div className="mt-1 text-sm text-muted">
          Hubungi WhatsApp Customer Service atau email support.
        </div>
        <div className="mt-3 flex flex-col items-center gap-1 text-xs text-muted">
          <div>WhatsApp: {supportWhatsAppDisplay}</div>
          <div>Email: {supportEmail}</div>
        </div>
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          <a href={supportWhatsAppUrl} className="sm:w-auto">
            <Button variant="secondary" className="w-full">
              WhatsApp CS
            </Button>
          </a>
          <a href={supportEmailUrl} className="sm:w-auto">
            <Button variant="secondary" className="w-full">
              Email
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
