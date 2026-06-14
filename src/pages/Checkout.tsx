import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, CreditCard, Landmark, LoaderCircle, Mail, MessageCircleMore, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import {
  supportEmail,
  supportEmailUrl,
  supportWhatsAppDisplay,
  supportWhatsAppUrl,
} from "@/constants/contact";
import { getMembershipPlanLabel } from "@/lib/accessMessaging";
import { getAppUrl } from "@/lib/appUrl";
import {
  buildCheckoutStatusSummary,
  deriveCheckoutUiState,
  type CheckoutUiState,
} from "@/lib/checkoutMessaging";
import { startMidtransSnapPayment } from "@/lib/midtrans";
import { useCatalogEbooks } from "@/lib/catalog";
import { getSupabaseAccessToken } from "@/lib/supabase";
import {
  calculatePlatformOnlyBreakdown,
  calculateRoyaltyBreakdown,
} from "@/lib/royalty";
import { usePublishingStore } from "@/stores/publishingStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTransactionStore } from "@/stores/transactionStore";
import type { MembershipPlan, PaymentMethod } from "@/types/domain";
import { formatIdrFromCents } from "@/utils/format";

type Method = "QRIS" | "TRANSFER" | "EWALLET" | "VA" | "CARD";
type BankOption = "BCA" | "BRI" | "BNI" | "MANDIRI";
type WalletOption = "GOPAY" | "OVO" | "DANA" | "SHOPEEPAY" | "LINKAJA";
type PaymentState = CheckoutUiState;

type MidtransStatusResponse = {
  orderId: string;
  transactionStatus: string;
  fraudStatus: string;
};

function toPaymentMethod(method: Method): PaymentMethod {
  if (method === "TRANSFER") return "BANK_TRANSFER";
  if (method === "EWALLET") return "E_WALLET";
  if (method === "VA") return "VIRTUAL_ACCOUNT";
  return method;
}

function parseMembershipPlan(value: string | null): MembershipPlan | null {
  if (value === "PREMIUM" || value === "EDU") {
    return value;
  }

  return null;
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const ebooks = useCatalogEbooks();
  const user = useSessionStore((s) => s.user);
  const refreshCurrentUserSession = useSessionStore((s) => s.refreshCurrentUserSession);
  const royalty = usePublishingStore((s) => s.royalty);
  const upsertTransaction = useTransactionStore((s) => s.upsertTransaction);
  const updateTransactionStatus = useTransactionStore((s) => s.updateTransactionStatus);
  const transactionsByUser = useTransactionStore((s) => s.transactionsByUser);
  const [method, setMethod] = useState<Method>("QRIS");
  const [paymentState, setPaymentState] = useState<PaymentState>("IDLE");
  const [buyerName, setBuyerName] = useState(user?.name ?? "");
  const [buyerEmail, setBuyerEmail] = useState(user?.email ?? "");
  const [buyerWhatsApp, setBuyerWhatsApp] = useState(user?.phone ?? "");
  const [selectedBank, setSelectedBank] = useState<BankOption>("BCA");
  const [selectedWallet, setSelectedWallet] = useState<WalletOption>("GOPAY");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");
  const [lastRedirectUrl, setLastRedirectUrl] = useState("");
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const autoSyncedOrderIdRef = useRef("");
  const parsedPlan = parseMembershipPlan(searchParams.get("plan")?.toUpperCase() ?? null);
  const selectedPlan = parsedPlan ?? "PREMIUM";
  const selectedEbookId = searchParams.get("ebook") ?? "";
  const selectedEbook = selectedEbookId ? ebooks.find((ebook) => ebook.id === selectedEbookId) : undefined;
  const checkoutUserId = user?.id ?? "";
  const invalidEbookCheckout = Boolean(selectedEbookId) && (!selectedEbook || selectedEbook.access !== "PAID");
  const invalidMembershipCheckout = !selectedEbookId && Boolean(searchParams.get("plan")) && !parsedPlan;
  const orderIdFromUrl = searchParams.get("order_id") ?? searchParams.get("orderId") ?? "";

  const checkoutProduct = useMemo(() => {
    if (selectedEbook && selectedEbook.access === "PAID") {
      return {
        itemType: "EBOOK" as const,
        plan: null,
        ebookId: selectedEbook.id,
        authorId: selectedEbook.authorId,
        pageCount: selectedEbook.pageCount,
        label: selectedEbook.title,
        amount: Math.round(selectedEbook.priceCents / 100),
        code: `NRL-BOOK-${selectedEbook.id.toUpperCase()}`,
        itemId: selectedEbook.id,
      };
    }

    if (selectedPlan === "EDU") {
      return {
        itemType: "MEMBERSHIP" as const,
        plan: "EDU" as MembershipPlan,
        ebookId: undefined,
        authorId: undefined,
        pageCount: undefined,
        label: "Langganan Naraloka Edukasi",
        amount: 29000,
        code: "NRL-EDU",
        itemId: "naraloka-edu",
      };
    }

    return {
      itemType: "MEMBERSHIP" as const,
      plan: "PREMIUM" as MembershipPlan,
      ebookId: undefined,
      authorId: undefined,
      pageCount: undefined,
      label: "Langganan Naraloka Premium",
      amount: 49000,
      code: "NRL-PREMIUM",
      itemId: "naraloka-premium",
    };
  }, [selectedEbook, selectedPlan]);

  const amountLabel = formatIdrFromCents(checkoutProduct.amount * 100);
  const latestMatchingTransaction = useMemo(() => {
    const userTransactions = transactionsByUser[checkoutUserId] ?? [];
    if (!checkoutUserId) return undefined;

    if (orderIdFromUrl) {
      return userTransactions.find((transaction) => transaction.orderId === orderIdFromUrl);
    }

    return userTransactions.find((transaction) => {
      if (transaction.itemType !== checkoutProduct.itemType) return false;
      if (transaction.itemId !== checkoutProduct.itemId) return false;
      return transaction.status === "PENDING" || transaction.status === "SUCCESS";
    });
  }, [
    checkoutProduct.itemId,
    checkoutProduct.itemType,
    checkoutUserId,
    orderIdFromUrl,
    transactionsByUser,
  ]);
  const effectivePaymentState = useMemo(
    () => deriveCheckoutUiState(paymentState, latestMatchingTransaction?.status),
    [latestMatchingTransaction?.status, paymentState]
  );
  const resumableOrderId = orderIdFromUrl || latestMatchingTransaction?.orderId || "";
  const resumableRedirectUrl = latestMatchingTransaction?.redirectUrl || "";
  const activeOrderId = lastOrderId || resumableOrderId;
  const activeRedirectUrl = lastRedirectUrl || resumableRedirectUrl;
  const latestTransactionUpdatedAtLabel = useMemo(() => {
    const latestUpdatedAt =
      latestMatchingTransaction?.updatedAtISO || latestMatchingTransaction?.createdAtISO || "";
    return latestUpdatedAt ? new Date(latestUpdatedAt).toLocaleString("id-ID") : "";
  }, [latestMatchingTransaction?.createdAtISO, latestMatchingTransaction?.updatedAtISO]);
  const checkoutStatusSummary = useMemo(
    () =>
      buildCheckoutStatusSummary({
        uiState: effectivePaymentState,
        latestTransaction: latestMatchingTransaction,
        itemType: checkoutProduct.itemType,
        buyerEmail,
        buyerWhatsApp,
      }),
    [buyerEmail, buyerWhatsApp, checkoutProduct.itemType, effectivePaymentState, latestMatchingTransaction]
  );
  const postPaymentCta = useMemo(() => {
    if (effectivePaymentState === "SUCCESS") {
      return checkoutProduct.itemType === "EBOOK"
        ? {
            to: checkoutProduct.ebookId ? `/baca/${checkoutProduct.ebookId}` : "/perpustakaan",
            label: "Buka Reader",
          }
        : {
            to: "/langganan",
            label: "Lihat Paket Aktif",
          };
    }

    if (effectivePaymentState === "PENDING" && activeRedirectUrl) {
      return {
        href: activeRedirectUrl,
        label: "Lanjutkan Pembayaran",
      };
    }

    return null;
  }, [activeRedirectUrl, checkoutProduct.ebookId, checkoutProduct.itemType, effectivePaymentState]);
  const royaltyBreakdown = useMemo(() => {
    if (checkoutProduct.itemType === "EBOOK") {
      return calculateRoyaltyBreakdown(checkoutProduct.amount * 100, royalty.paidBookPct);
    }
    if (checkoutProduct.plan === "EDU") {
      return calculatePlatformOnlyBreakdown(
        checkoutProduct.amount * 100,
        royalty.membershipEduPct
      );
    }
    return calculatePlatformOnlyBreakdown(
      checkoutProduct.amount * 100,
      royalty.membershipPremiumPct
    );
  }, [
    checkoutProduct,
    royalty.membershipEduPct,
    royalty.membershipPremiumPct,
    royalty.paidBookPct,
  ]);

  const instructions = useMemo(() => {
    if (method === "QRIS") return "Pembayaran akan dibuka di popup Midtrans dengan opsi QRIS.";
    if (method === "TRANSFER") return `Pembayaran akan diarahkan ke Midtrans dengan preferensi transfer ${selectedBank}.`;
    if (method === "EWALLET")
      return `Pembayaran akan dibuka di Midtrans. Preferensi e-wallet kamu: ${selectedWallet}.`;
    if (method === "VA") return `Midtrans akan menampilkan Virtual Account dengan preferensi bank ${selectedBank}.`;
    return "Detail kartu akan diinput langsung di popup Midtrans, bukan di halaman ini.";
  }, [method, selectedBank, selectedWallet]);

  const statusTone = useMemo(() => {
    if (effectivePaymentState === "SUCCESS") return "success";
    if (effectivePaymentState === "PENDING") return "warning";
    if (effectivePaymentState === "ERROR") return "warning";
    if (effectivePaymentState === "PROCESSING") return "brand";
    return "neutral";
  }, [effectivePaymentState]);

  const statusLabel = useMemo(() => {
    if (effectivePaymentState === "SUCCESS") return "PAID";
    if (effectivePaymentState === "PENDING") return "PENDING";
    if (effectivePaymentState === "ERROR") return "FAILED";
    if (effectivePaymentState === "PROCESSING") return "PROCESSING";
    return "READY";
  }, [effectivePaymentState]);

  const verifyMidtransStatus = useCallback(async (orderId: string) => {
    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
    }

    const response = await fetch(`/api/midtrans/status?orderId=${encodeURIComponent(orderId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = (await response.json()) as MidtransStatusResponse & { message?: string };

    if (!response.ok) {
      throw new Error(data.message || "Gagal memeriksa status pembayaran ke server.");
    }

    return data;
  }, []);

  const syncGrantedAccess = useCallback(async (params: {
    orderId: string;
    redirectUrl?: string;
  }) => {
    const status = await verifyMidtransStatus(params.orderId);
    const transactionStatus = status.transactionStatus;
    const isSuccess =
      transactionStatus === "settlement" ||
      transactionStatus === "capture" ||
      transactionStatus === "success";
    const isPending = transactionStatus === "pending";

    if (!isSuccess && !isPending) {
      setPaymentState("ERROR");
      updateTransactionStatus(params.orderId, "FAILED", params.redirectUrl, checkoutUserId);
      setErrorMessage("Pembayaran belum tervalidasi sukses di server Midtrans.");
      return;
    }

    if (isPending) {
      setPaymentState("PENDING");
      updateTransactionStatus(params.orderId, "PENDING", params.redirectUrl, checkoutUserId);
      setStatusMessage("Order Midtrans masih berstatus pending. Selesaikan pembayaran lalu cek lagi.");
      return;
    }

    const refreshResult = await refreshCurrentUserSession();

    setPaymentState("SUCCESS");
    updateTransactionStatus(params.orderId, "SUCCESS", params.redirectUrl, checkoutUserId);
    setStatusMessage(
      refreshResult.error
        ? `Pembayaran tervalidasi, tetapi sinkronisasi akses akun perlu dicek ulang. ${refreshResult.error}`
        : `Pembayaran berhasil tervalidasi. Konfirmasi dikirim ke ${buyerEmail} dan WhatsApp ${buyerWhatsApp}.`
    );
  }, [
    buyerEmail,
    buyerWhatsApp,
    checkoutUserId,
    refreshCurrentUserSession,
    updateTransactionStatus,
    verifyMidtransStatus,
  ]);

  const handleCheckExistingPayment = useCallback(async (params?: {
    orderId?: string;
    redirectUrl?: string;
    source?: "manual" | "auto";
  }) => {
    const targetOrderId = params?.orderId || lastOrderId || resumableOrderId;
    const targetRedirectUrl = params?.redirectUrl || lastRedirectUrl || resumableRedirectUrl;

    if (!targetOrderId) {
      setErrorMessage("Belum ada order pembayaran yang bisa diperiksa.");
      return;
    }

    setErrorMessage("");
    setIsCheckingStatus(true);
    setPaymentState((current) => (current === "SUCCESS" ? current : "PROCESSING"));
    setStatusMessage(
      params?.source === "auto"
        ? "Order sebelumnya ditemukan. Sedang sinkronisasi status pembayaran ke server..."
        : "Sedang memeriksa status pembayaran terakhir ke server..."
    );

    try {
      await syncGrantedAccess({
        orderId: targetOrderId,
        redirectUrl: targetRedirectUrl,
      });
      setLastOrderId(targetOrderId);
      setLastRedirectUrl(targetRedirectUrl);
    } catch (error) {
      setPaymentState("ERROR");
      updateTransactionStatus(targetOrderId, "FAILED", targetRedirectUrl, checkoutUserId);
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memverifikasi status pembayaran ke server."
      );
    } finally {
      setIsCheckingStatus(false);
    }
  }, [
    checkoutUserId,
    lastOrderId,
    lastRedirectUrl,
    resumableOrderId,
    resumableRedirectUrl,
    syncGrantedAccess,
    updateTransactionStatus,
  ]);

  useEffect(() => {
    if (!latestMatchingTransaction) return;
    setLastOrderId((current) => current || latestMatchingTransaction.orderId);
    setLastRedirectUrl((current) => current || latestMatchingTransaction.redirectUrl || "");
    setBuyerEmail((current) => current || latestMatchingTransaction.buyerEmail);
    setBuyerWhatsApp((current) => current || latestMatchingTransaction.buyerWhatsApp);
  }, [latestMatchingTransaction]);

  useEffect(() => {
    setBuyerName((current) => current || user?.name || "");
    setBuyerEmail((current) => current || user?.email || "");
    setBuyerWhatsApp((current) => current || user?.phone || "");
  }, [user?.email, user?.name, user?.phone]);

  useEffect(() => {
    if (!checkoutUserId || !resumableOrderId || invalidEbookCheckout || isCheckingStatus) return;
    if (autoSyncedOrderIdRef.current === resumableOrderId) return;

    const shouldAutoSync = Boolean(orderIdFromUrl) || latestMatchingTransaction?.status === "PENDING";
    if (!shouldAutoSync) return;

    autoSyncedOrderIdRef.current = resumableOrderId;
    void handleCheckExistingPayment({
      orderId: resumableOrderId,
      redirectUrl: resumableRedirectUrl,
      source: "auto",
    });
  }, [
    checkoutUserId,
    invalidEbookCheckout,
    isCheckingStatus,
    latestMatchingTransaction?.status,
    orderIdFromUrl,
    resumableOrderId,
    resumableRedirectUrl,
    handleCheckExistingPayment,
  ]);

  if (invalidEbookCheckout) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-white p-6 text-center">
        <div className="text-lg font-semibold text-ink">E-book checkout tidak valid</div>
        <div className="mt-2 text-sm text-muted">
          Buku yang ingin dibeli tidak tersedia untuk pembelian satuan atau belum dipublish.
        </div>
        <div className="mt-4">
          <Link to="/katalog">
            <Button variant="secondary">Kembali ke Katalog</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (invalidMembershipCheckout) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-white p-6 text-center">
        <div className="text-lg font-semibold text-ink">Paket membership tidak valid</div>
        <div className="mt-2 text-sm text-muted">
          Paket yang dipilih tidak tersedia. Silakan kembali ke halaman langganan dan pilih paket yang benar.
        </div>
        <div className="mt-4">
          <Link to="/langganan">
            <Button variant="secondary">Kembali ke Langganan</Button>
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmitPayment() {
    if (!checkoutUserId) {
      setErrorMessage("Kamu harus login dengan akun pembeli sebelum memulai checkout.");
      return;
    }
    if (!buyerName.trim() || !buyerEmail.trim() || !buyerWhatsApp.trim()) {
      setErrorMessage("Nama, email, dan nomor WhatsApp wajib diisi.");
      return;
    }
    if (!buyerEmail.includes("@")) {
      setErrorMessage("Format email belum valid.");
      return;
    }

    setErrorMessage("");
    setCopied(false);
    setPaymentState("PROCESSING");
    setStatusMessage("Membuat transaksi Midtrans...");

    try {
      const accessToken = await getSupabaseAccessToken();
      if (!accessToken) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang sebelum checkout.");
      }

      const response = await fetch("/api/midtrans/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          orderCode: checkoutProduct.code,
          itemType: checkoutProduct.itemType,
          itemId: checkoutProduct.itemId,
          ebookId: checkoutProduct.ebookId,
          membershipPlan: checkoutProduct.plan ?? undefined,
          buyerName,
          buyerWhatsApp,
          paymentMethod: toPaymentMethod(method),
          preferredMethod: method,
          preferredBank: selectedBank,
          preferredWallet: selectedWallet,
          finishUrl: getAppUrl(
            checkoutProduct.itemType === "EBOOK" && checkoutProduct.ebookId
              ? `/checkout?ebook=${checkoutProduct.ebookId}`
              : checkoutProduct.plan
                ? `/checkout?plan=${checkoutProduct.plan}`
                : "/checkout"
          ),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Gagal membuat transaksi Midtrans.");
      }

      setLastOrderId(data.orderId || "");
      setLastRedirectUrl(data.redirectUrl || "");
      setStatusMessage("Popup Midtrans dibuka. Selesaikan pembayaran di sana.");
      upsertTransaction({
        itemType: checkoutProduct.itemType,
        itemId: checkoutProduct.itemId,
        orderId: data.orderId,
        itemLabel: checkoutProduct.label,
        amountCents: checkoutProduct.amount * 100,
        paymentMethod: toPaymentMethod(method),
        status: "PENDING",
        buyerEmail,
        buyerWhatsApp,
        membershipPlan: checkoutProduct.plan ?? undefined,
        ebookId: checkoutProduct.ebookId,
        authorId: checkoutProduct.authorId,
        platformCommissionPct: royaltyBreakdown?.platformCommissionPct,
        platformCommissionCents: royaltyBreakdown?.platformCommissionCents,
        authorRoyaltyPct: royaltyBreakdown?.authorRoyaltyPct,
        authorRoyaltyCents: royaltyBreakdown?.authorRoyaltyCents,
        redirectUrl: data.redirectUrl || "",
      });

      await startMidtransSnapPayment({
        token: data.token,
        clientKey: data.clientKey,
        environment: data.environment,
        callbacks: {
          onSuccess: () => {
            void (async () => {
              try {
                await syncGrantedAccess({
                  orderId: data.orderId,
                  redirectUrl: data.redirectUrl,
                });
              } catch (error) {
                setPaymentState("ERROR");
                updateTransactionStatus(data.orderId, "FAILED", data.redirectUrl, checkoutUserId);
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : "Gagal memverifikasi status pembayaran ke server."
                );
              }
            })();
          },
          onPending: () => {
            void (async () => {
              try {
                await syncGrantedAccess({
                  orderId: data.orderId,
                  redirectUrl: data.redirectUrl,
                });
              } catch {
                setPaymentState("PENDING");
                updateTransactionStatus(data.orderId, "PENDING", data.redirectUrl, checkoutUserId);
                setStatusMessage("Transaksi tercatat di Midtrans dan sedang menunggu penyelesaian pembayaran.");
              }
            })();
          },
          onError: () => {
            setPaymentState("ERROR");
            updateTransactionStatus(data.orderId, "FAILED", data.redirectUrl, checkoutUserId);
            setErrorMessage("Midtrans mengembalikan status gagal. Coba ulangi atau gunakan metode lain.");
          },
          onClose: () => {
            setPaymentState((current) => (current === "PROCESSING" ? "IDLE" : current));
            setStatusMessage((current) =>
              current || "Popup Midtrans ditutup sebelum pembayaran selesai."
            );
          },
        },
      });
    } catch (error) {
      setPaymentState("ERROR");
      setErrorMessage(error instanceof Error ? error.message : "Gagal memulai pembayaran Midtrans.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Checkout
        </div>
        <div className="mt-2 text-sm text-muted">
          {checkoutProduct.itemType === "EBOOK"
            ? `Checkout pembelian e-book: ${checkoutProduct.label}.`
            : `Checkout aktif untuk paket ${
                checkoutProduct.plan ? getMembershipPlanLabel(checkoutProduct.plan) : "membership"
              }.`}
        </div>
        <div className="mt-3">
          <Link
            to={checkoutProduct.itemType === "EBOOK" && checkoutProduct.ebookId ? `/ebook/${checkoutProduct.ebookId}` : "/langganan"}
            className="text-sm font-semibold text-brand hover:underline"
          >
            {checkoutProduct.itemType === "EBOOK" ? "Kembali ke detail e-book" : "Kembali ke pilihan paket"}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.85fr]">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-ink">Status pembayaran</div>
            <Badge tone={statusTone}>{statusLabel}</Badge>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
            <div className="text-sm font-semibold text-ink">Ringkasan status</div>
            <div className="mt-2 text-sm text-muted">{checkoutStatusSummary}</div>
            {latestTransactionUpdatedAtLabel ? (
              <div className="mt-3 text-xs text-muted">
                Status transaksi terakhir diperbarui pada {latestTransactionUpdatedAtLabel}.
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-ink">Data pembeli</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Nama lengkap" />
              <Input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="Email aktif"
              />
              <Input
                className="md:col-span-2"
                value={buyerWhatsApp}
                onChange={(e) => setBuyerWhatsApp(e.target.value)}
                placeholder="Nomor WhatsApp"
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-ink">Pilih metode pembayaran</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMethod("QRIS")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  method === "QRIS"
                    ? "border-brand-2 bg-brand-2/10"
                    : "border-border bg-white hover:bg-surface"
                }`}
              >
                <QrCode className={method === "QRIS" ? "text-brand-2" : "text-muted"} size={18} />
                <div>
                  <div className="text-sm font-semibold text-ink">QRIS</div>
                  <div className="text-xs text-muted">Cepat & universal</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMethod("TRANSFER")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  method === "TRANSFER"
                    ? "border-brand-2 bg-brand-2/10"
                    : "border-border bg-white hover:bg-surface"
                }`}
              >
                <Landmark className={method === "TRANSFER" ? "text-brand-2" : "text-muted"} size={18} />
                <div>
                  <div className="text-sm font-semibold text-ink">Transfer Bank</div>
                  <div className="text-xs text-muted">BCA, BRI, BNI, Mandiri</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMethod("EWALLET")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  method === "EWALLET"
                    ? "border-brand-2 bg-brand-2/10"
                    : "border-border bg-white hover:bg-surface"
                }`}
              >
                <Wallet className={method === "EWALLET" ? "text-brand-2" : "text-muted"} size={18} />
                <div>
                  <div className="text-sm font-semibold text-ink">E-Wallet</div>
                  <div className="text-xs text-muted">GoPay, OVO, DANA, ShopeePay, LinkAja</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMethod("VA")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  method === "VA"
                    ? "border-brand-2 bg-brand-2/10"
                    : "border-border bg-white hover:bg-surface"
                }`}
              >
                <ShieldCheck className={method === "VA" ? "text-brand-2" : "text-muted"} size={18} />
                <div>
                  <div className="text-sm font-semibold text-ink">Virtual Account</div>
                  <div className="text-xs text-muted">Pembayaran otomatis terverifikasi</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMethod("CARD")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition sm:col-span-2 ${
                  method === "CARD"
                    ? "border-brand-2 bg-brand-2/10"
                    : "border-border bg-white hover:bg-surface"
                }`}
              >
                <CreditCard className={method === "CARD" ? "text-brand-2" : "text-muted"} size={18} />
                <div>
                  <div className="text-sm font-semibold text-ink">Kartu Kredit / Debit</div>
                  <div className="text-xs text-muted">Visa & Mastercard</div>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            {instructions}
          </div>

          {method === "TRANSFER" || method === "VA" ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-ink">Pilih bank</span>
                <select
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-medium text-ink outline-none"
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value as BankOption)}
                >
                  <option value="BCA">BCA</option>
                  <option value="BRI">BRI</option>
                  <option value="BNI">BNI</option>
                  <option value="MANDIRI">Mandiri</option>
                </select>
              </label>
            </div>
          ) : null}

          {method === "EWALLET" ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-ink">Pilih e-wallet</span>
                <select
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-medium text-ink outline-none"
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value as WalletOption)}
                >
                  <option value="GOPAY">GoPay</option>
                  <option value="OVO">OVO</option>
                  <option value="DANA">DANA</option>
                  <option value="SHOPEEPAY">ShopeePay</option>
                  <option value="LINKAJA">LinkAja</option>
                </select>
              </label>
              <Input value={buyerWhatsApp} onChange={(e) => setBuyerWhatsApp(e.target.value)} placeholder="Nomor terdaftar e-wallet" />
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {statusMessage ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
              {statusMessage}
            </div>
          ) : null}

          {effectivePaymentState === "SUCCESS" ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Pembayaran berhasil diproses. Bukti dan instruksi lanjutan dikirim ke {buyerEmail} dan
              konfirmasi ke WhatsApp {buyerWhatsApp}.
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {postPaymentCta?.href ? (
              <a href={postPaymentCta.href} target="_blank" rel="noreferrer" className="sm:w-auto">
                <Button variant="secondary" className="w-full">
                  {postPaymentCta.label}
                </Button>
              </a>
            ) : null}
            {postPaymentCta?.to ? (
              <Link to={postPaymentCta.to} className="sm:w-auto">
                <Button variant="secondary" className="w-full">
                  {postPaymentCta.label}
                </Button>
              </Link>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                void handleCheckExistingPayment({ source: "manual" });
              }}
              disabled={isCheckingStatus || !activeOrderId}
            >
              {isCheckingStatus ? <LoaderCircle size={16} className="animate-spin" /> : null}
              Cek Status
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPaymentState("IDLE");
                setErrorMessage("");
                setStatusMessage("");
                setCopied(false);
                setLastOrderId("");
                setLastRedirectUrl("");
                autoSyncedOrderIdRef.current = "";
              }}
              disabled={
                paymentState === "IDLE" &&
                !errorMessage &&
                !statusMessage &&
                !lastOrderId &&
                !lastRedirectUrl
              }
            >
              Bersihkan Status
            </Button>
            <Button onClick={handleSubmitPayment} disabled={paymentState === "PROCESSING"}>
              {paymentState === "PROCESSING" ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {effectivePaymentState === "PENDING" ? "Buat Order Baru" : "Bayar via Midtrans"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="text-sm font-semibold text-ink">Ringkasan pesanan</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-ink">{checkoutProduct.label}</div>
                  <div className="mt-1 text-xs text-muted">Kode referensi: {checkoutProduct.code}</div>
                </div>
                <div className="font-semibold text-ink">{amountLabel}</div>
              </div>
              <div className="flex items-center justify-between gap-4 text-muted">
                <span>Biaya layanan</span>
                <span>Rp0</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                <span className="font-semibold text-ink">Total</span>
                <span className="font-semibold text-ink">{amountLabel}</span>
              </div>
            </div>
          </div>

          {royaltyBreakdown ? (
            <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="text-sm font-semibold text-ink">Bagi hasil penjualan buku</div>
              <div className="mt-2 text-sm text-muted">
                {checkoutProduct.itemType === "EBOOK"
                  ? "Breakdown ini dipakai untuk royalti penulis saat transaksi buku berhasil."
                  : "Paket membership memakai komisi platform khusus, tetapi royalti penulis belum dibagi dari paket pada fase ini."}
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted">Pendapatan kotor</span>
                  <span className="font-semibold text-ink">
                    {formatIdrFromCents(royaltyBreakdown.grossAmountCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted">
                    Komisi platform ({royaltyBreakdown.platformCommissionPct}%)
                  </span>
                  <span className="font-semibold text-ink">
                    {formatIdrFromCents(royaltyBreakdown.platformCommissionCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                  <span className="font-semibold text-ink">
                    {checkoutProduct.itemType === "EBOOK"
                      ? `Pendapatan bersih penulis (${royaltyBreakdown.authorRoyaltyPct}%)`
                      : "Royalti penulis dari paket"}
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {checkoutProduct.itemType === "EBOOK"
                      ? formatIdrFromCents(royaltyBreakdown.authorRoyaltyCents)
                      : "Belum dibagi"}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="text-sm font-semibold text-ink">Detail transaksi Midtrans</div>
            <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {activeOrderId ? "Order ID" : "Status"}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-ink">
                  {activeOrderId || "Token transaksi akan dibuat saat klik bayar"}
                </div>
                <button
                  type="button"
                  disabled={!activeOrderId}
                  onClick={async () => {
                    try {
                      if (!activeOrderId) return;
                      await navigator.clipboard.writeText(activeOrderId);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface disabled:opacity-50"
                >
                  <Copy size={14} />
                  {copied ? "Tersalin" : "Salin"}
                </button>
              </div>
            </div>
            {latestMatchingTransaction ? (
              <div className="mt-3 rounded-2xl border border-border bg-white p-3 text-xs text-muted">
                Status transaksi lokal: {latestMatchingTransaction.status}
                {latestTransactionUpdatedAtLabel ? ` • diperbarui ${latestTransactionUpdatedAtLabel}` : ""}
              </div>
            ) : null}
            <div className="mt-4 text-xs leading-relaxed text-muted">
              Setelah transaksi dibuat, Snap Midtrans akan membuka popup pembayaran. Jika popup diblokir,
              kamu masih bisa lanjut lewat tautan redirect cadangan di bawah.
            </div>
            {resumableOrderId && !lastOrderId ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Order sebelumnya terdeteksi dan bisa dicek ulang otomatis dari halaman ini.
              </div>
            ) : null}
            {activeRedirectUrl ? (
              <a
                href={activeRedirectUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline"
              >
                {effectivePaymentState === "PENDING"
                  ? "Lanjutkan pembayaran di Midtrans"
                  : "Buka halaman pembayaran Midtrans"}
              </a>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="text-sm font-semibold text-ink">Bantuan pembayaran</div>
            <div className="mt-2 text-sm text-muted">
              Jika ada kendala, hubungi tim Naraloka lewat WhatsApp atau email berikut.
            </div>
            <div className="mt-4 space-y-3">
              <a
                href={supportWhatsAppUrl}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <MessageCircleMore size={18} className="text-brand-2" />
                  <div>
                    <div className="text-sm font-semibold text-ink">WhatsApp CS</div>
                    <div className="text-xs text-muted">{supportWhatsAppDisplay}</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-brand">Hubungi</span>
              </a>
              <a
                href={supportEmailUrl}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-brand-2" />
                  <div>
                    <div className="text-sm font-semibold text-ink">Email Support</div>
                    <div className="text-xs text-muted">{supportEmail}</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-brand">Kirim Email</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
