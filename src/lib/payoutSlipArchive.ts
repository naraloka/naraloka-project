import type {
  PayoutReportAuthorSummary,
  PayoutReportCsvRow,
  PayoutReportFilters,
} from "@/lib/payoutReport";
import { buildPayoutSlipHtml } from "@/lib/payoutSlip";
import { getReadableSupabaseError, supabase } from "@/lib/supabase";
import type { PayoutSlipArchiveRecord } from "@/stores/publishingStore";
import type { UserRole } from "@/types/domain";

type PayoutSlipArchiveRow = {
  id: string;
  invoice_number: string;
  author_id: string;
  author_name: string;
  issuer_name: string;
  issuer_title: string | null;
  generated_by_user_id: string;
  generated_by_name: string;
  filter_start_date: string | null;
  filter_end_date: string | null;
  filter_payout_status: string | null;
  filter_source_type: string | null;
  entry_count: number;
  paid_book_royalty_cents: number;
  membership_royalty_cents: number;
  total_royalty_cents: number;
  available_cents: number;
  processing_cents: number;
  paid_cents: number;
  html_content?: string | null;
  issued_at: string | null;
  updated_at: string | null;
};

function mapRowToArchiveRecord(row: PayoutSlipArchiveRow): PayoutSlipArchiveRecord {
  return {
    id: String(row.id || "").trim(),
    invoiceNumber: String(row.invoice_number || "").trim(),
    authorId: String(row.author_id || "").trim(),
    authorName: String(row.author_name || "").trim() || "Penulis Naraloka",
    issuerName: String(row.issuer_name || "").trim() || "Naraloka",
    issuerTitle: String(row.issuer_title || "").trim() || undefined,
    generatedByUserId: String(row.generated_by_user_id || "").trim(),
    generatedByName: String(row.generated_by_name || "").trim() || "Admin",
    filterStartDate: row.filter_start_date || undefined,
    filterEndDate: row.filter_end_date || undefined,
    filterPayoutStatus: row.filter_payout_status || undefined,
    filterSourceType: row.filter_source_type || undefined,
    entryCount: Math.max(0, Number(row.entry_count || 0)),
    paidBookRoyaltyCents: Math.max(0, Number(row.paid_book_royalty_cents || 0)),
    membershipRoyaltyCents: Math.max(0, Number(row.membership_royalty_cents || 0)),
    totalRoyaltyCents: Math.max(0, Number(row.total_royalty_cents || 0)),
    availableCents: Math.max(0, Number(row.available_cents || 0)),
    processingCents: Math.max(0, Number(row.processing_cents || 0)),
    paidCents: Math.max(0, Number(row.paid_cents || 0)),
    issuedAtISO: row.issued_at || row.updated_at || new Date().toISOString(),
    updatedAtISO: row.updated_at || row.issued_at || new Date().toISOString(),
  };
}

const archiveSelect =
  "id,invoice_number,author_id,author_name,issuer_name,issuer_title,generated_by_user_id,generated_by_name,filter_start_date,filter_end_date,filter_payout_status,filter_source_type,entry_count,paid_book_royalty_cents,membership_royalty_cents,total_royalty_cents,available_cents,processing_cents,paid_cents,issued_at,updated_at";

export async function fetchPayoutSlipArchiveSnapshot(params: {
  userId: string;
  role: UserRole;
}) {
  if (!supabase || !params.userId.trim()) {
    return { error: "", data: [] as PayoutSlipArchiveRecord[] };
  }

  const query = supabase
    .from("author_payout_slip_archives")
    .select(archiveSelect)
    .order("issued_at", { ascending: false });

  const scopedQuery =
    params.role === "ADMIN" ? query : query.eq("author_id", params.userId);

  const { data, error } = await scopedQuery;
  if (error) {
    return {
      error: getReadableSupabaseError(error.message),
      data: [] as PayoutSlipArchiveRecord[],
    };
  }

  return {
    error: "",
    data: ((data ?? []) as PayoutSlipArchiveRow[]).map(mapRowToArchiveRecord),
  };
}

export async function archivePayoutSlipDocument(params: {
  summary: PayoutReportAuthorSummary;
  rows: PayoutReportCsvRow[];
  filters: PayoutReportFilters;
  generatedByUserId: string;
  generatedByName: string;
  issuerName?: string;
  issuerTitle?: string;
}) {
  if (!supabase) {
    throw new Error("Supabase belum terhubung untuk mengarsipkan slip payout.");
  }

  const authorId = params.summary.authorId.trim();
  const generatedByUserId = params.generatedByUserId.trim();
  if (!authorId || !params.rows.length) {
    throw new Error("Data slip payout belum lengkap untuk diarsipkan.");
  }
  if (!generatedByUserId) {
    throw new Error("ID admin pembuat slip payout tidak tersedia.");
  }

  const insertPayload = {
    author_id: authorId,
    author_name: params.summary.authorName,
    issuer_name: params.issuerName?.trim() || "Naraloka",
    issuer_title: params.issuerTitle?.trim() || "Slip / Invoice Payout Naraloka",
    generated_by_user_id: generatedByUserId,
    generated_by_name: params.generatedByName.trim() || "Admin",
    filter_start_date: params.filters.startDate || null,
    filter_end_date: params.filters.endDate || null,
    filter_payout_status:
      params.filters.payoutStatus && params.filters.payoutStatus !== "ALL"
        ? params.filters.payoutStatus
        : null,
    filter_source_type:
      params.filters.sourceType && params.filters.sourceType !== "ALL"
        ? params.filters.sourceType
        : null,
    entry_count: params.summary.entryCount,
    paid_book_royalty_cents: params.summary.paidBookRoyaltyCents,
    membership_royalty_cents: params.summary.membershipRoyaltyCents,
    total_royalty_cents: params.summary.totalRoyaltyCents,
    available_cents: params.summary.availableCents,
    processing_cents: params.summary.processingCents,
    paid_cents: params.summary.paidCents,
    rows_json: params.rows,
    html_content: "<pending>",
  };

  const { data: createdRow, error: insertError } = await supabase
    .from("author_payout_slip_archives")
    .insert(insertPayload)
    .select(`${archiveSelect}, html_content`)
    .single();

  if (insertError || !createdRow) {
    throw new Error(
      getReadableSupabaseError(insertError?.message || "Gagal membuat arsip slip payout.")
    );
  }

  const html = buildPayoutSlipHtml({
    summary: params.summary,
    rows: params.rows,
    filters: params.filters,
    issuerName: createdRow.issuer_name,
    issuerTitle: createdRow.issuer_title || undefined,
    invoiceNumber: createdRow.invoice_number,
    generatedAtISO: createdRow.issued_at || undefined,
    generatedByName: createdRow.generated_by_name,
  });

  const { data: updatedRow, error: updateError } = await supabase
    .from("author_payout_slip_archives")
    .update({ html_content: html })
    .eq("id", createdRow.id)
    .select(`${archiveSelect}, html_content`)
    .single();

  if (updateError || !updatedRow) {
    throw new Error(
      getReadableSupabaseError(updateError?.message || "Gagal menyimpan HTML slip payout.")
    );
  }

  return {
    archive: mapRowToArchiveRecord(updatedRow as PayoutSlipArchiveRow),
    htmlContent: String(updatedRow.html_content || html),
  };
}

export async function fetchPayoutSlipArchiveHtml(archiveId: string) {
  if (!supabase) {
    throw new Error("Supabase belum terhubung untuk membuka arsip slip payout.");
  }

  const id = archiveId.trim();
  if (!id) {
    throw new Error("ID arsip slip payout wajib diisi.");
  }

  const { data, error } = await supabase
    .from("author_payout_slip_archives")
    .select("id,invoice_number,author_name,html_content")
    .eq("id", id)
    .single();

  if (error || !data?.html_content) {
    throw new Error(
      getReadableSupabaseError(error?.message || "Arsip slip payout tidak ditemukan.")
    );
  }

  return {
    id: String(data.id || "").trim(),
    invoiceNumber: String(data.invoice_number || "").trim(),
    authorName: String(data.author_name || "").trim() || "Penulis Naraloka",
    htmlContent: String(data.html_content || ""),
  };
}
