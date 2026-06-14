import { getMembershipPlanLabel } from "@/lib/accessMessaging";
import type { ReaderTransaction, TransactionItemType, TransactionStatus } from "@/types/domain";

export type CheckoutUiState = "IDLE" | "PROCESSING" | "PENDING" | "SUCCESS" | "ERROR";

export function deriveCheckoutUiState(
  localState: CheckoutUiState,
  transactionStatus?: TransactionStatus
): CheckoutUiState {
  if (localState !== "IDLE") {
    return localState;
  }
  if (transactionStatus === "SUCCESS") {
    return "SUCCESS";
  }
  if (transactionStatus === "PENDING") {
    return "PENDING";
  }
  if (transactionStatus === "FAILED") {
    return "ERROR";
  }
  return "IDLE";
}

export function buildCheckoutStatusSummary(params: {
  uiState: CheckoutUiState;
  latestTransaction?: ReaderTransaction;
  itemType: TransactionItemType;
  buyerEmail: string;
  buyerWhatsApp: string;
}) {
  const { uiState, latestTransaction, itemType, buyerEmail, buyerWhatsApp } = params;

  if (uiState === "PROCESSING") {
    return "Naraloka sedang membuat order atau menyinkronkan status pembayaran terakhir dengan Midtrans.";
  }

  if (uiState === "PENDING") {
    if (latestTransaction?.itemType === "MEMBERSHIP" && latestTransaction.membershipPlan) {
      return `Pembayaran paket ${getMembershipPlanLabel(
        latestTransaction.membershipPlan
      )} sudah tercatat, tetapi masih menunggu penyelesaian atau sinkronisasi dari Midtrans.`;
    }

    if (itemType === "EBOOK") {
      return "Order buku sudah dibuat, tetapi pembayaran belum selesai. Kamu bisa melanjutkan pembayaran atau cek status lagi setelah transaksi diselesaikan.";
    }

    return "Order membership sudah dibuat, tetapi pembayaran belum selesai. Paket aktif baru berubah setelah transaksi sukses tervalidasi.";
  }

  if (uiState === "SUCCESS") {
    if (itemType === "EBOOK") {
      return `Pembayaran buku sudah tervalidasi. Akses baca penuh tersedia untuk akun ${buyerEmail || "kamu"}.`;
    }

    return `Pembayaran membership sudah tervalidasi. Status paket akun akan mengikuti ledger yang tersinkron ke ${buyerEmail || "akun kamu"}.`;
  }

  if (uiState === "ERROR") {
    return "Pembayaran terakhir belum berhasil tervalidasi. Kamu bisa cek status ulang, melanjutkan pembayaran yang masih terbuka, atau membuat order baru.";
  }

  if (latestTransaction?.itemType === "MEMBERSHIP" && latestTransaction.membershipPlan) {
    return `Belum ada pembayaran aktif yang sedang diproses. Jika ingin berlangganan paket ${getMembershipPlanLabel(
      latestTransaction.membershipPlan
    )}, lanjutkan lewat checkout baru.`;
  }

  if (itemType === "EBOOK") {
    return "Belum ada pembayaran yang sedang berjalan untuk buku ini. Isi data pembeli lalu lanjutkan ke Midtrans.";
  }

  return `Belum ada pembayaran yang sedang berjalan. Konfirmasi akan dikirim ke ${
    buyerWhatsApp || "WhatsApp aktif"
  } setelah transaksi berhasil.`;
}
