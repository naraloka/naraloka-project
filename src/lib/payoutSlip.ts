import type {
  PayoutReportAuthorSummary,
  PayoutReportCsvRow,
  PayoutReportFilters,
} from "@/lib/payoutReport";

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatIdrFromCents(amountCents: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function buildFilterSummary(filters: PayoutReportFilters) {
  const parts: string[] = [];
  if (filters.startDate || filters.endDate) {
    parts.push(
      `Periode ${filters.startDate || "..."} s/d ${filters.endDate || "..."}`
    );
  }
  if (filters.payoutStatus && filters.payoutStatus !== "ALL") {
    parts.push(`Status ${filters.payoutStatus}`);
  }
  if (filters.sourceType && filters.sourceType !== "ALL") {
    parts.push(`Source ${filters.sourceType}`);
  }
  return parts.join(" • ") || "Semua payout aktif";
}

function getRowEffectiveDate(row: PayoutReportCsvRow) {
  return row.paidAtISO || row.processingAtISO || row.earnedAtISO || row.updatedAtISO || "";
}

export function buildPayoutSlipHtml(params: {
  summary: PayoutReportAuthorSummary;
  rows: PayoutReportCsvRow[];
  filters: PayoutReportFilters;
  generatedAtISO?: string;
  issuerName?: string;
  issuerTitle?: string;
  invoiceNumber?: string;
  generatedByName?: string;
}) {
  const generatedAtISO = params.generatedAtISO || new Date().toISOString();
  const filterSummary = buildFilterSummary(params.filters);
  const rowsHtml = params.rows
    .map((row) => {
      const sourceLabel = row.sourceType === "PAID_BOOK" ? "Paid Book" : "Membership Pool";
      return `
        <tr>
          <td>${escapeHtml(row.orderId)}</td>
          <td>${escapeHtml(sourceLabel)}</td>
          <td>${escapeHtml(row.itemLabel)}</td>
          <td>${escapeHtml(row.payoutStatus)}</td>
          <td>${escapeHtml(getRowEffectiveDate(row))}</td>
          <td class="num">${escapeHtml(formatIdrFromCents(row.authorRoyaltyCents))}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Slip Payout ${escapeHtml(params.summary.authorName)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
      .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
      .brand { font-size: 28px; font-weight: 700; }
      .muted { color: #6b7280; font-size: 12px; }
      .title { margin-top: 24px; font-size: 22px; font-weight: 700; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
      .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; }
      .label { color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .value { margin-top: 6px; font-size: 18px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; font-size: 13px; vertical-align: top; }
      th { background: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
      .num { text-align: right; white-space: nowrap; }
      .footer { margin-top: 24px; font-size: 12px; color: #6b7280; }
      @media print { body { margin: 18px; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">Naraloka</div>
        <div class="muted">${escapeHtml(params.issuerTitle || params.issuerName || "Slip / Invoice Payout Penulis")}</div>
      </div>
      <div class="muted">
        Dibuat ${escapeHtml(new Date(generatedAtISO).toLocaleString("id-ID"))}
      </div>
    </div>

    <div class="title">Slip Payout Penulis</div>
    <div class="muted">${escapeHtml(filterSummary)}</div>

    <div class="grid">
      <div class="card">
        <div class="label">Nomor Invoice</div>
        <div class="value">${escapeHtml(params.invoiceNumber || "Draft Slip")}</div>
        <div class="muted">${escapeHtml(params.generatedByName ? `Dibuat oleh ${params.generatedByName}` : "Dokumen payout resmi Naraloka")}</div>
      </div>
      <div class="card">
        <div class="label">Penulis</div>
        <div class="value">${escapeHtml(params.summary.authorName)}</div>
        <div class="muted">${escapeHtml(params.summary.authorId)}</div>
      </div>
      <div class="card">
        <div class="label">Total Payout</div>
        <div class="value">${escapeHtml(formatIdrFromCents(params.summary.totalRoyaltyCents))}</div>
        <div class="muted">${escapeHtml(`${params.summary.entryCount} entri payout`)}</div>
      </div>
      <div class="card">
        <div class="label">Membership Pool</div>
        <div class="value">${escapeHtml(formatIdrFromCents(params.summary.membershipRoyaltyCents))}</div>
      </div>
      <div class="card">
        <div class="label">Paid Book</div>
        <div class="value">${escapeHtml(formatIdrFromCents(params.summary.paidBookRoyaltyCents))}</div>
      </div>
      <div class="card">
        <div class="label">Siap Dibayar</div>
        <div class="value">${escapeHtml(formatIdrFromCents(params.summary.availableCents))}</div>
      </div>
      <div class="card">
        <div class="label">Diproses / Dibayar</div>
        <div class="value">${escapeHtml(
          `${formatIdrFromCents(params.summary.processingCents)} / ${formatIdrFromCents(params.summary.paidCents)}`
        )}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Sumber</th>
          <th>Item</th>
          <th>Status</th>
          <th>Tanggal</th>
          <th class="num">Royalti</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="footer">
      Dokumen ini dibuat dari ledger payout Naraloka berdasarkan filter aktif pada dashboard admin.
    </div>
  </body>
</html>`;
}

export function openPayoutSlipHtml(html: string, fileName = "naraloka-payout-slip.html") {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank", "noopener,noreferrer");
  if (tab) {
    tab.addEventListener(
      "load",
      () => {
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      { once: true }
    );
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
