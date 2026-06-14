import type {
  AuthorMembershipRoyaltyLedgerEntry,
  AuthorRoyaltyLedgerEntry,
} from "@/stores/publishingStore";
import { formatIdrFromCents } from "@/utils/format";

export type AuthorFinanceNotification = {
  id: string;
  authorId: string;
  sourceType: "PAID_BOOK" | "MEMBERSHIP_POOL";
  sourceId: string;
  eventStatus: "PROCESSING" | "PAID";
  title: string;
  message: string;
  itemLabel: string;
  amountCents: number;
  payoutReference?: string;
  payoutNote?: string;
  createdAtISO: string;
  readAtISO?: string;
};

function normalizeNotificationTime(value?: string) {
  const time = value ? +new Date(value) : 0;
  return Number.isFinite(time) ? time : 0;
}

function buildNotificationId(params: {
  sourceType: "PAID_BOOK" | "MEMBERSHIP_POOL";
  sourceId: string;
  eventStatus: "PROCESSING" | "PAID";
  createdAtISO: string;
}) {
  return `ntf_${params.sourceType}_${params.sourceId}_${params.eventStatus}_${params.createdAtISO}`;
}

function resolveNotificationTimestamp(params: {
  status: string;
  processingAtISO?: string;
  paidAtISO?: string;
  updatedAtISO?: string;
  createdAtISO?: string;
}) {
  if (params.status === "PAID") {
    return (
      params.paidAtISO ||
      params.updatedAtISO ||
      params.processingAtISO ||
      params.createdAtISO ||
      new Date().toISOString()
    );
  }

  return (
    params.processingAtISO ||
    params.updatedAtISO ||
    params.createdAtISO ||
    new Date().toISOString()
  );
}

function shouldNotifyStatusTransition(params: {
  currentStatus: string;
  previousStatus?: string;
}) {
  const currentStatus = String(params.currentStatus || "").trim().toUpperCase();
  const previousStatus = String(params.previousStatus || "").trim().toUpperCase();
  if (currentStatus !== "PROCESSING" && currentStatus !== "PAID") {
    return false;
  }

  return currentStatus !== previousStatus;
}

function buildNotificationCopy(params: {
  sourceLabel: string;
  status: "PROCESSING" | "PAID";
  itemLabel: string;
  amountCents: number;
  payoutReference?: string;
  payoutNote?: string;
}) {
  const nominal = formatIdrFromCents(params.amountCents);
  const statusLabel =
    params.status === "PAID" ? "sudah dibayar" : "sedang diproses untuk payout";
  const title =
    params.status === "PAID" ? "Payout sudah dibayar" : "Payout sedang diproses";
  const baseMessage = `${params.sourceLabel} untuk ${params.itemLabel} sebesar ${nominal} ${statusLabel}.`;
  const referenceMessage = params.payoutReference
    ? ` Referensi: ${params.payoutReference}.`
    : "";
  const noteMessage = params.payoutNote ? ` Catatan: ${params.payoutNote}.` : "";

  return {
    title,
    message: `${baseMessage}${referenceMessage}${noteMessage}`.trim(),
  };
}

export function createRoyaltyPayoutStatusNotification(params: {
  entry: AuthorRoyaltyLedgerEntry;
  previousEntry?: AuthorRoyaltyLedgerEntry | null;
}) {
  if (
    !shouldNotifyStatusTransition({
      currentStatus: params.entry.status,
      previousStatus: params.previousEntry?.status,
    })
  ) {
    return null;
  }

  const eventStatus = params.entry.status as "PROCESSING" | "PAID";
  const createdAtISO = resolveNotificationTimestamp({
    status: eventStatus,
    processingAtISO: params.entry.processingAtISO,
    paidAtISO: params.entry.paidAtISO,
    updatedAtISO: params.entry.updatedAtISO,
    createdAtISO: params.entry.createdAtISO,
  });
  const copy = buildNotificationCopy({
    sourceLabel: "Royalti buku",
    status: eventStatus,
    itemLabel: params.entry.itemLabel,
    amountCents: params.entry.authorRoyaltyCents,
    payoutReference: params.entry.payoutReference,
    payoutNote: params.entry.payoutNote,
  });

  return {
    id: buildNotificationId({
      sourceType: "PAID_BOOK",
      sourceId: params.entry.orderId,
      eventStatus,
      createdAtISO,
    }),
    authorId: params.entry.authorId,
    sourceType: "PAID_BOOK" as const,
    sourceId: params.entry.orderId,
    eventStatus,
    title: copy.title,
    message: copy.message,
    itemLabel: params.entry.itemLabel,
    amountCents: params.entry.authorRoyaltyCents,
    payoutReference: params.entry.payoutReference,
    payoutNote: params.entry.payoutNote,
    createdAtISO,
  } satisfies AuthorFinanceNotification;
}

export function createMembershipPayoutStatusNotification(params: {
  entry: AuthorMembershipRoyaltyLedgerEntry;
  previousEntry?: AuthorMembershipRoyaltyLedgerEntry | null;
}) {
  if (
    !shouldNotifyStatusTransition({
      currentStatus: params.entry.status,
      previousStatus: params.previousEntry?.status,
    })
  ) {
    return null;
  }

  const eventStatus = params.entry.status as "PROCESSING" | "PAID";
  const createdAtISO = resolveNotificationTimestamp({
    status: eventStatus,
    processingAtISO: params.entry.processingAtISO,
    paidAtISO: params.entry.paidAtISO,
    updatedAtISO: params.entry.updatedAtISO,
    createdAtISO: params.entry.createdAtISO,
  });
  const copy = buildNotificationCopy({
    sourceLabel: "Membership pool",
    status: eventStatus,
    itemLabel: params.entry.itemLabel,
    amountCents: params.entry.authorRoyaltyCents,
    payoutReference: params.entry.payoutReference,
    payoutNote: params.entry.payoutNote,
  });

  return {
    id: buildNotificationId({
      sourceType: "MEMBERSHIP_POOL",
      sourceId: params.entry.entryId,
      eventStatus,
      createdAtISO,
    }),
    authorId: params.entry.authorId,
    sourceType: "MEMBERSHIP_POOL" as const,
    sourceId: params.entry.entryId,
    eventStatus,
    title: copy.title,
    message: copy.message,
    itemLabel: params.entry.itemLabel,
    amountCents: params.entry.authorRoyaltyCents,
    payoutReference: params.entry.payoutReference,
    payoutNote: params.entry.payoutNote,
    createdAtISO,
  } satisfies AuthorFinanceNotification;
}

export function sortAuthorFinanceNotifications<T extends { createdAtISO: string }>(entries: T[]) {
  return [...entries].sort(
    (a, b) => normalizeNotificationTime(b.createdAtISO) - normalizeNotificationTime(a.createdAtISO)
  );
}
