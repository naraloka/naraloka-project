import type { AuthorPayoutMethod, AuthorWorkspaceProfile } from "@/stores/publishingStore";

export const bankOptions = [
  "BCA",
  "Bank Mandiri",
  "BRI",
  "BNI",
  "CIMB Niaga",
  "Permata Bank",
  "BTN",
  "Bank Syariah Indonesia",
  "SeaBank",
  "Jenius / BTPN",
  "OCBC",
  "Danamon",
] as const;

export const ewalletOptions = ["DANA", "OVO", "GoPay", "ShopeePay", "LinkAja"] as const;

export function getPayoutMethodLabel(method?: AuthorPayoutMethod | "") {
  if (method === "BANK_TRANSFER") return "Transfer bank";
  if (method === "EWALLET") return "E-wallet";
  return "Belum dipilih";
}

export function buildPayoutProfileSummary(input: {
  payoutMethod?: AuthorPayoutMethod | "";
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  ewalletProvider?: string;
  ewalletAccountName?: string;
  ewalletAccountNumber?: string;
}) {
  if (input.payoutMethod === "BANK_TRANSFER") {
    return [input.bankName, input.bankAccountName, input.bankAccountNumber]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(" - ");
  }

  if (input.payoutMethod === "EWALLET") {
    return [input.ewalletProvider, input.ewalletAccountName, input.ewalletAccountNumber]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(" - ");
  }

  return "";
}

function isDigitsOnly(value: string) {
  return /^\d+$/.test(value);
}

export function validatePayoutProfile(input: {
  payoutMethod?: AuthorPayoutMethod | "";
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ewalletProvider: string;
  ewalletAccountName: string;
  ewalletAccountNumber: string;
}) {
  if (input.payoutMethod === "BANK_TRANSFER") {
    if (!input.bankName.trim() || !input.bankAccountName.trim() || !input.bankAccountNumber.trim()) {
      return "Lengkapi nama bank, nama pemilik rekening, dan nomor rekening untuk payout bank.";
    }

    const normalized = input.bankAccountNumber.replace(/\s+/g, "");
    if (!isDigitsOnly(normalized)) {
      return "Nomor rekening harus berupa angka saja.";
    }
    if (normalized.length < 8 || normalized.length > 20) {
      return "Nomor rekening harus 8-20 digit.";
    }
  }

  if (input.payoutMethod === "EWALLET") {
    if (
      !input.ewalletProvider.trim() ||
      !input.ewalletAccountName.trim() ||
      !input.ewalletAccountNumber.trim()
    ) {
      return "Lengkapi nama e-wallet, nama pemilik akun, dan nomor akun e-wallet.";
    }

    const normalized = input.ewalletAccountNumber.replace(/[\s+-]/g, "");
    if (!isDigitsOnly(normalized)) {
      return "Nomor akun e-wallet harus berupa angka saja.";
    }
    if (normalized.length < 10 || normalized.length > 16) {
      return "Nomor akun e-wallet harus 10-16 digit.";
    }
  }

  return "";
}

export function getAuthorPayoutDetailLines(profile?: Partial<AuthorWorkspaceProfile> | null) {
  if (!profile) {
    return [];
  }

  if (profile.payoutMethod === "BANK_TRANSFER") {
    return [
      `Bank: ${profile.bankName || "-"}`,
      `Nama: ${profile.bankAccountName || "-"}`,
      `Rekening: ${profile.bankAccountNumber || "-"}`,
      `Cabang: ${profile.bankBranch || "-"}`,
    ];
  }

  if (profile.payoutMethod === "EWALLET") {
    return [
      `E-wallet: ${profile.ewalletProvider || "-"}`,
      `Nama: ${profile.ewalletAccountName || "-"}`,
      `Nomor: ${profile.ewalletAccountNumber || "-"}`,
    ];
  }

  if (profile.payoutAccount) {
    return [`Payout: ${profile.payoutAccount}`];
  }

  return [];
}
