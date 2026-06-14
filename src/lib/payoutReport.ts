import type {
  AuthorMembershipRoyaltyLedgerEntry,
  AuthorRoyaltyLedgerEntry,
} from "@/stores/publishingStore";

export type PayoutReportCsvRow = {
  sourceType: "PAID_BOOK" | "MEMBERSHIP_POOL";
  entryId: string;
  orderId: string;
  authorId: string;
  authorName: string;
  buyerUserId: string;
  ebookIds: string;
  membershipPlan: string;
  itemLabel: string;
  grossAmountCents: number;
  poolAmountCents: number;
  distributablePoolCents: number;
  platformCommissionPct: number | "";
  platformCommissionCents: number;
  authorRoyaltyPct: number | "";
  authorRoyaltyCents: number;
  allocationBasisPages: number;
  allocationRatioPct: string;
  paymentMethod: string;
  paymentStatus: string;
  transactionState: string;
  payoutStatus: string;
  payoutReference: string;
  payoutNote: string;
  earnedAtISO: string;
  processingAtISO: string;
  paidAtISO: string;
  updatedAtISO: string;
};

export type PayoutReportFilters = {
  startDate?: string;
  endDate?: string;
  payoutStatus?: string;
  authorId?: string;
  sourceType?: string;
};

export type PayoutReportAuthorSummary = {
  authorId: string;
  authorName: string;
  entryCount: number;
  paidBookRoyaltyCents: number;
  membershipRoyaltyCents: number;
  totalRoyaltyCents: number;
  availableCents: number;
  processingCents: number;
  paidCents: number;
};

const payoutReportHeaders: Array<keyof PayoutReportCsvRow> = [
  "sourceType",
  "entryId",
  "orderId",
  "authorId",
  "authorName",
  "buyerUserId",
  "ebookIds",
  "membershipPlan",
  "itemLabel",
  "grossAmountCents",
  "poolAmountCents",
  "distributablePoolCents",
  "platformCommissionPct",
  "platformCommissionCents",
  "authorRoyaltyPct",
  "authorRoyaltyCents",
  "allocationBasisPages",
  "allocationRatioPct",
  "paymentMethod",
  "paymentStatus",
  "transactionState",
  "payoutStatus",
  "payoutReference",
  "payoutNote",
  "earnedAtISO",
  "processingAtISO",
  "paidAtISO",
  "updatedAtISO",
];

function escapeCsvCell(value: string | number) {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function normalizeDateInput(value: string | undefined, boundary: "start" | "end") {
  if (!value) return null;
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const iso = `${value}${suffix}`;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : null;
}

function getComparableRowTime(row: PayoutReportCsvRow) {
  const candidates = [row.paidAtISO, row.processingAtISO, row.earnedAtISO, row.updatedAtISO];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const time = Date.parse(candidate);
    if (Number.isFinite(time)) return time;
  }
  return null;
}

export function createPayoutReportRows(params: {
  royaltyEntries: AuthorRoyaltyLedgerEntry[];
  membershipEntries: AuthorMembershipRoyaltyLedgerEntry[];
  resolveAuthorName: (authorId: string) => string;
}) {
  const directRows: PayoutReportCsvRow[] = params.royaltyEntries.map((entry) => ({
    sourceType: "PAID_BOOK",
    entryId: entry.orderId,
    orderId: entry.orderId,
    authorId: entry.authorId,
    authorName: params.resolveAuthorName(entry.authorId),
    buyerUserId: entry.userId || "",
    ebookIds: entry.ebookId || "",
    membershipPlan: "",
    itemLabel: entry.itemLabel,
    grossAmountCents: entry.grossAmountCents,
    poolAmountCents: 0,
    distributablePoolCents: 0,
    platformCommissionPct: entry.platformCommissionPct ?? "",
    platformCommissionCents: entry.platformCommissionCents,
    authorRoyaltyPct: entry.authorRoyaltyPct ?? "",
    authorRoyaltyCents: entry.authorRoyaltyCents,
    allocationBasisPages: 0,
    allocationRatioPct: "",
    paymentMethod: entry.paymentMethod || "",
    paymentStatus: entry.paymentStatus,
    transactionState: entry.transactionState || "",
    payoutStatus: entry.status,
    payoutReference: entry.payoutReference || "",
    payoutNote: entry.payoutNote || "",
    earnedAtISO: entry.earnedAtISO || "",
    processingAtISO: entry.processingAtISO || "",
    paidAtISO: entry.paidAtISO || "",
    updatedAtISO: entry.updatedAtISO,
  }));

  const membershipRows: PayoutReportCsvRow[] = params.membershipEntries.map((entry) => ({
    sourceType: "MEMBERSHIP_POOL",
    entryId: entry.entryId,
    orderId: entry.orderId,
    authorId: entry.authorId,
    authorName: params.resolveAuthorName(entry.authorId),
    buyerUserId: entry.buyerUserId || "",
    ebookIds: entry.sourceEbookIds.join("|"),
    membershipPlan: entry.membershipPlan,
    itemLabel: entry.itemLabel,
    grossAmountCents: 0,
    poolAmountCents: entry.poolAmountCents,
    distributablePoolCents: entry.distributablePoolCents,
    platformCommissionPct: entry.platformCommissionPct ?? "",
    platformCommissionCents: entry.platformCommissionCents,
    authorRoyaltyPct: "",
    authorRoyaltyCents: entry.authorRoyaltyCents,
    allocationBasisPages: entry.allocationBasisPages,
    allocationRatioPct: (entry.allocationRatio * 100).toFixed(2),
    paymentMethod: "",
    paymentStatus: entry.paymentStatus,
    transactionState: "",
    payoutStatus: entry.status,
    payoutReference: entry.payoutReference || "",
    payoutNote: entry.payoutNote || "",
    earnedAtISO: entry.earnedAtISO || "",
    processingAtISO: entry.processingAtISO || "",
    paidAtISO: entry.paidAtISO || "",
    updatedAtISO: entry.updatedAtISO,
  }));

  return [...directRows, ...membershipRows].sort((a, b) =>
    b.updatedAtISO.localeCompare(a.updatedAtISO)
  );
}

export function filterPayoutReportRows(
  rows: PayoutReportCsvRow[],
  filters: PayoutReportFilters
) {
  const startTime = normalizeDateInput(filters.startDate, "start");
  const endTime = normalizeDateInput(filters.endDate, "end");
  const targetStatus = String(filters.payoutStatus || "").trim().toUpperCase();
  const targetAuthorId = String(filters.authorId || "").trim();
  const targetSourceType = String(filters.sourceType || "").trim().toUpperCase();

  return rows.filter((row) => {
    if (targetSourceType && targetSourceType !== "ALL" && row.sourceType !== targetSourceType) {
      return false;
    }

    if (targetStatus && targetStatus !== "ALL" && row.payoutStatus !== targetStatus) {
      return false;
    }

    if (targetAuthorId && targetAuthorId !== "ALL" && row.authorId !== targetAuthorId) {
      return false;
    }

    if (startTime !== null || endTime !== null) {
      const rowTime = getComparableRowTime(row);
      if (rowTime === null) return false;
      if (startTime !== null && rowTime < startTime) return false;
      if (endTime !== null && rowTime > endTime) return false;
    }

    return true;
  });
}

export function summarizePayoutReportByAuthor(rows: PayoutReportCsvRow[]) {
  const grouped = new Map<string, PayoutReportAuthorSummary>();

  for (const row of rows) {
    const authorId = String(row.authorId || "").trim();
    if (!authorId) continue;

    const current = grouped.get(authorId) || {
      authorId,
      authorName: row.authorName || authorId,
      entryCount: 0,
      paidBookRoyaltyCents: 0,
      membershipRoyaltyCents: 0,
      totalRoyaltyCents: 0,
      availableCents: 0,
      processingCents: 0,
      paidCents: 0,
    };

    current.entryCount += 1;
    current.totalRoyaltyCents += row.authorRoyaltyCents;
    if (row.sourceType === "PAID_BOOK") {
      current.paidBookRoyaltyCents += row.authorRoyaltyCents;
    } else {
      current.membershipRoyaltyCents += row.authorRoyaltyCents;
    }
    if (row.payoutStatus === "AVAILABLE") current.availableCents += row.authorRoyaltyCents;
    if (row.payoutStatus === "PROCESSING") current.processingCents += row.authorRoyaltyCents;
    if (row.payoutStatus === "PAID") current.paidCents += row.authorRoyaltyCents;

    grouped.set(authorId, current);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.totalRoyaltyCents !== a.totalRoyaltyCents) {
      return b.totalRoyaltyCents - a.totalRoyaltyCents;
    }
    return a.authorName.localeCompare(b.authorName, "id");
  });
}

export function buildPayoutReportCsv(rows: PayoutReportCsvRow[]) {
  const headerLine = payoutReportHeaders.join(",");
  const dataLines = rows.map((row) =>
    payoutReportHeaders.map((header) => escapeCsvCell(row[header])).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

export function downloadPayoutReportCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
