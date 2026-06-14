import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookCopy,
  Download,
  ExternalLink,
  FileCheck2,
  LineChart,
  LoaderCircle,
  Settings,
  Users,
} from "lucide-react";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { fetchAdminUsers, updateAdminUserAction, type AdminUserSummary } from "@/lib/adminUsers";
import { updateMembershipRoyaltyLedgerPayoutStatus } from "@/lib/membershipRoyaltyLedger";
import {
  fetchPlatformCommissionSettings,
  savePlatformCommissionSettings,
} from "@/lib/platformCommissionSettings";
import {
  buildPayoutReportCsv,
  createPayoutReportRows,
  filterPayoutReportRows,
  downloadPayoutReportCsv,
  summarizePayoutReportByAuthor,
} from "@/lib/payoutReport";
import { getAuthorPayoutDetailLines, getPayoutMethodLabel } from "@/lib/payoutProfile";
import { openPayoutSlipHtml } from "@/lib/payoutSlip";
import {
  archivePayoutSlipDocument,
  fetchPayoutSlipArchiveHtml,
} from "@/lib/payoutSlipArchive";
import { updateRoyaltyLedgerPayoutStatus } from "@/lib/royaltyLedger";
import { getAuthorManuscriptSignedUrl } from "@/lib/authorWorkspace";
import {
  getDecisionStatusLabel,
  getMonetizationDecisionStatus,
  getPublishedAccessLabel,
  getSuggestedMonetizationLabel,
  suggestionToPublishDefaults,
} from "@/lib/monetization";
import { cn } from "@/lib/utils";
import type { AuthorWorkspaceProfile, SuggestedMonetization } from "@/stores/publishingStore";
import type { BookAccess, MembershipPlan } from "@/types/domain";
import { usePublishingStore } from "@/stores/publishingStore";
import { useSessionStore } from "@/stores/sessionStore";
import { formatIdrFromCents } from "@/utils/format";

type TabKey =
  | "submissions"
  | "catalog"
  | "authors"
  | "users"
  | "reports"
  | "settings";

export default function AdminDashboard() {
  const user = useSessionStore((s) => s.user);
  const role = user?.role ?? "READER";
  const [tab, setTab] = useState<TabKey>("submissions");
  const [catalogEditorTargetId, setCatalogEditorTargetId] = useState("");
  const [catalogEditorMode, setCatalogEditorMode] = useState<"edit" | "access">("edit");
  const [selectedAuthorId, setSelectedAuthorId] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([]);
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminUsersFeedback, setAdminUsersFeedback] = useState("");
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUserActionId, setAdminUserActionId] = useState("");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("");
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [currentAdminUserId, setCurrentAdminUserId] = useState("");
  const [royaltySettingsLoading, setRoyaltySettingsLoading] = useState(false);
  const [royaltySettingsSaving, setRoyaltySettingsSaving] = useState(false);
  const [royaltySettingsError, setRoyaltySettingsError] = useState("");
  const [royaltySettingsFeedback, setRoyaltySettingsFeedback] = useState("");
  const [payoutUpdatingOrderId, setPayoutUpdatingOrderId] = useState("");
  const [membershipPayoutUpdatingId, setMembershipPayoutUpdatingId] = useState("");
  const [payoutFeedback, setPayoutFeedback] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
  const [reportAuthorFilter, setReportAuthorFilter] = useState("ALL");
  const [reportSourceTypeFilter, setReportSourceTypeFilter] = useState("ALL");

  const authorProfilesByUser = usePublishingStore((s) => s.authorProfilesByUser);
  const manuscripts = usePublishingStore((s) => s.manuscripts);
  const reviewEntriesByManuscript = usePublishingStore((s) => s.reviewEntriesByManuscript);
  const royaltyLedgerEntries = usePublishingStore((s) => s.royaltyLedgerEntries);
  const membershipRoyaltyLedgerEntries = usePublishingStore((s) => s.membershipRoyaltyLedgerEntries);
  const payoutSlipArchives = usePublishingStore((s) => s.payoutSlipArchives);
  const publishedEbooks = usePublishingStore((s) => s.publishedEbooks);
  const approve = usePublishingStore((s) => s.approve);
  const reject = usePublishingStore((s) => s.reject);
  const addReviewComment = usePublishingStore((s) => s.addReviewComment);
  const setEditorialStatus = usePublishingStore((s) => s.setEditorialStatus);
  const publishManuscript = usePublishingStore((s) => s.publishManuscript);
  const upsertRoyaltyLedgerEntry = usePublishingStore((s) => s.upsertRoyaltyLedgerEntry);
  const upsertMembershipRoyaltyLedgerEntry = usePublishingStore(
    (s) => s.upsertMembershipRoyaltyLedgerEntry
  );
  const upsertPayoutSlipArchive = usePublishingStore((s) => s.upsertPayoutSlipArchive);
  const royalty = usePublishingStore((s) => s.royalty);
  const hydrateRoyaltyConfig = usePublishingStore((s) => s.hydrateRoyaltyConfig);
  const setCommissionPct = usePublishingStore((s) => s.setCommissionPct);

  const workflowQueue = manuscripts.filter((m) =>
    ["SUBMITTED", "IN_REVIEW", "NEEDS_REVISION", "IN_EDITING"].includes(m.status)
  );
  const readyToPublish = manuscripts.filter((m) =>
    ["READY_TO_PUBLISH", "APPROVED"].includes(m.status)
  );
  const decisionHistory = manuscripts.filter((m) => m.status !== "DRAFT").slice(0, 8);
  const publishedManuscripts = useMemo(
    () => manuscripts.filter((m) => m.publishedAtISO && m.publishedEbookId),
    [manuscripts]
  );
  const publishedManuscriptByEbookId = useMemo(() => {
    return publishedManuscripts.reduce<Record<string, (typeof publishedManuscripts)[number]>>(
      (acc, manuscript) => {
        if (manuscript.publishedEbookId) {
          acc[manuscript.publishedEbookId] = manuscript;
        }
        return acc;
      },
      {}
    );
  }, [publishedManuscripts]);
  const adminCatalogEbooks = useMemo(() => {
    return [...publishedEbooks].sort((a, b) =>
      new Date(b.publishedAtISO || 0).getTime() - new Date(a.publishedAtISO || 0).getTime()
    );
  }, [publishedEbooks]);
  const adminAuthors = useMemo(() => {
    const byAuthorId = new Map<
      string,
      {
        id: string;
        displayName: string;
        bio: string;
        avatarUrl?: string;
        phone?: string;
        portfolioUrl?: string;
        specialty?: string;
        manuscriptsCount: number;
        publishedBooksCount: number;
      }
    >();

    for (const profile of Object.values(authorProfilesByUser)) {
      byAuthorId.set(profile.userId, {
        id: profile.userId,
        displayName: profile.displayName || profile.userId,
        bio: profile.bio || "Profil penulis dari portal penulis Naraloka.",
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        portfolioUrl: profile.portfolioUrl,
        specialty: profile.specialty,
        manuscriptsCount: 0,
        publishedBooksCount: 0,
      });
    }

    for (const manuscript of manuscripts) {
      const current = byAuthorId.get(manuscript.authorId) || {
        id: manuscript.authorId,
        displayName: manuscript.authorDisplayName || manuscript.authorId,
        bio: "Profil penulis sedang dilengkapi.",
        avatarUrl: undefined,
        phone: "",
        portfolioUrl: "",
        specialty: "",
        manuscriptsCount: 0,
        publishedBooksCount: 0,
      };
      current.manuscriptsCount += 1;
      if (manuscript.publishedAtISO) {
        current.publishedBooksCount += 1;
      }
      if (!current.displayName && manuscript.authorDisplayName) {
        current.displayName = manuscript.authorDisplayName;
      }
      byAuthorId.set(manuscript.authorId, current);
    }

    return Array.from(byAuthorId.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "id")
    );
  }, [authorProfilesByUser, manuscripts]);
  const selectedAuthor = adminAuthors.find((author) => author.id === selectedAuthorId) || null;
  const selectedCatalogEbook =
    adminCatalogEbooks.find((ebook) => ebook.id === catalogEditorTargetId) || null;
  const selectedCatalogManuscript = selectedCatalogEbook
    ? publishedManuscriptByEbookId[selectedCatalogEbook.id] || null
    : null;
  const selectedAdminUser =
    adminUsers.find((adminUser) => adminUser.id === selectedAdminUserId) || null;

  const royaltySummary = useMemo(() => {
    return royaltyLedgerEntries.reduce(
      (summary, entry) => ({
        totalGrossCents: summary.totalGrossCents + entry.grossAmountCents,
        totalRoyaltyCents: summary.totalRoyaltyCents + entry.authorRoyaltyCents,
        availableCents:
          summary.availableCents +
          (entry.status === "AVAILABLE" ? entry.authorRoyaltyCents : 0),
        processingCents:
          summary.processingCents +
          (entry.status === "PROCESSING" ? entry.authorRoyaltyCents : 0),
        paidCents: summary.paidCents + (entry.status === "PAID" ? entry.authorRoyaltyCents : 0),
      }),
      {
        totalGrossCents: 0,
        totalRoyaltyCents: 0,
        availableCents: 0,
        processingCents: 0,
        paidCents: 0,
      }
    );
  }, [royaltyLedgerEntries]);

  const membershipPoolSummary = useMemo(() => {
    return membershipRoyaltyLedgerEntries.reduce(
      (summary, entry) => ({
        totalRoyaltyCents: summary.totalRoyaltyCents + entry.authorRoyaltyCents,
        totalPages: summary.totalPages + entry.allocationBasisPages,
        availableCents:
          summary.availableCents +
          (entry.status === "AVAILABLE" ? entry.authorRoyaltyCents : 0),
        processingCents:
          summary.processingCents +
          (entry.status === "PROCESSING" ? entry.authorRoyaltyCents : 0),
        paidCents: summary.paidCents + (entry.status === "PAID" ? entry.authorRoyaltyCents : 0),
      }),
      {
        totalRoyaltyCents: 0,
        totalPages: 0,
        availableCents: 0,
        processingCents: 0,
        paidCents: 0,
      }
    );
  }, [membershipRoyaltyLedgerEntries]);

  const kpis = useMemo(() => {
    const totalBooks = adminCatalogEbooks.length;
    const totalAuthors = adminAuthors.length;
    const totalTransactions = royaltyLedgerEntries.length + membershipRoyaltyLedgerEntries.length;
    const revenue = royaltySummary.totalGrossCents + membershipPoolSummary.totalRoyaltyCents;
    return { totalBooks, totalAuthors, totalTransactions, revenue };
  }, [
    adminAuthors.length,
    adminCatalogEbooks.length,
    membershipPoolSummary.totalRoyaltyCents,
    membershipRoyaltyLedgerEntries.length,
    royaltyLedgerEntries.length,
    royaltySummary.totalGrossCents,
  ]);

  const payoutReportRows = useMemo(() => {
    return createPayoutReportRows({
      royaltyEntries: royaltyLedgerEntries,
      membershipEntries: membershipRoyaltyLedgerEntries,
      resolveAuthorName: (authorId) => resolveAuthorName(authorId, authorProfilesByUser, manuscripts),
    });
  }, [authorProfilesByUser, manuscripts, membershipRoyaltyLedgerEntries, royaltyLedgerEntries]);

  const payoutAuthorOptions = useMemo(() => {
    const byAuthorId = new Map<string, string>();
    for (const row of payoutReportRows) {
      if (!row.authorId.trim()) continue;
      byAuthorId.set(
        row.authorId,
        row.authorName || resolveAuthorName(row.authorId, authorProfilesByUser, manuscripts)
      );
    }
    return Array.from(byAuthorId.entries())
      .map(([authorId, authorName]) => ({ authorId, authorName }))
      .sort((a, b) => a.authorName.localeCompare(b.authorName, "id"));
  }, [authorProfilesByUser, manuscripts, payoutReportRows]);

  function resolveAuthorPayoutProfile(authorId: string) {
    return authorProfilesByUser[authorId];
  }

  const filteredPayoutReportRows = useMemo(() => {
    return filterPayoutReportRows(payoutReportRows, {
      startDate: reportStartDate,
      endDate: reportEndDate,
      payoutStatus: reportStatusFilter,
      authorId: reportAuthorFilter,
      sourceType: reportSourceTypeFilter,
    });
  }, [
    payoutReportRows,
    reportAuthorFilter,
    reportEndDate,
    reportSourceTypeFilter,
    reportStartDate,
    reportStatusFilter,
  ]);

  const filteredRoyaltyLedgerEntries = useMemo(() => {
    const orderIds = new Set(
      filteredPayoutReportRows
        .filter((row) => row.sourceType === "PAID_BOOK")
        .map((row) => row.orderId)
    );
    return royaltyLedgerEntries.filter((entry) => orderIds.has(entry.orderId));
  }, [filteredPayoutReportRows, royaltyLedgerEntries]);

  const filteredMembershipRoyaltyLedgerEntries = useMemo(() => {
    const entryIds = new Set(
      filteredPayoutReportRows
        .filter((row) => row.sourceType === "MEMBERSHIP_POOL")
        .map((row) => row.entryId)
    );
    return membershipRoyaltyLedgerEntries.filter((entry) => entryIds.has(entry.entryId));
  }, [filteredPayoutReportRows, membershipRoyaltyLedgerEntries]);

  const filteredRoyaltySummary = useMemo(() => {
    return filteredRoyaltyLedgerEntries.reduce(
      (summary, entry) => ({
        availableCents:
          summary.availableCents + (entry.status === "AVAILABLE" ? entry.authorRoyaltyCents : 0),
        processingCents:
          summary.processingCents + (entry.status === "PROCESSING" ? entry.authorRoyaltyCents : 0),
        paidCents: summary.paidCents + (entry.status === "PAID" ? entry.authorRoyaltyCents : 0),
      }),
      {
        availableCents: 0,
        processingCents: 0,
        paidCents: 0,
      }
    );
  }, [filteredRoyaltyLedgerEntries]);

  const filteredMembershipPoolSummary = useMemo(() => {
    return filteredMembershipRoyaltyLedgerEntries.reduce(
      (summary, entry) => ({
        availableCents:
          summary.availableCents + (entry.status === "AVAILABLE" ? entry.authorRoyaltyCents : 0),
        processingCents:
          summary.processingCents + (entry.status === "PROCESSING" ? entry.authorRoyaltyCents : 0),
        paidCents: summary.paidCents + (entry.status === "PAID" ? entry.authorRoyaltyCents : 0),
      }),
      {
        availableCents: 0,
        processingCents: 0,
        paidCents: 0,
      }
    );
  }, [filteredMembershipRoyaltyLedgerEntries]);

  const filteredMembershipPoolByAuthor = useMemo(() => {
    const grouped = new Map<
      string,
      {
        authorId: string;
        authorName: string;
        totalRoyaltyCents: number;
        availableCents: number;
      }
    >();

    for (const entry of filteredMembershipRoyaltyLedgerEntries) {
      const current = grouped.get(entry.authorId) || {
        authorId: entry.authorId,
        authorName: resolveAuthorName(entry.authorId, authorProfilesByUser, manuscripts),
        totalRoyaltyCents: 0,
        availableCents: 0,
      };

      current.totalRoyaltyCents += entry.authorRoyaltyCents;
      if (entry.status === "AVAILABLE") current.availableCents += entry.authorRoyaltyCents;
      grouped.set(entry.authorId, current);
    }

    return Array.from(grouped.values()).sort((a, b) => b.totalRoyaltyCents - a.totalRoyaltyCents);
  }, [authorProfilesByUser, filteredMembershipRoyaltyLedgerEntries, manuscripts]);

  const filteredPayoutByAuthor = useMemo(() => {
    return summarizePayoutReportByAuthor(filteredPayoutReportRows);
  }, [filteredPayoutReportRows]);

  const filteredAdminUsers = useMemo(() => {
    const keyword = adminUserSearch.trim().toLowerCase();
    if (!keyword) return adminUsers;

    return adminUsers.filter((adminUser) =>
      [
        adminUser.name,
        adminUser.email,
        adminUser.role,
        adminUser.membershipPlan,
        adminUser.authorProfile.displayName,
        adminUser.authorProfile.specialty,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [adminUserSearch, adminUsers]);

  const adminUserStats = useMemo(() => {
    return {
      total: adminUsers.length,
      admins: adminUsers.filter((adminUser) => adminUser.role === "ADMIN").length,
      authors: adminUsers.filter(
        (adminUser) =>
          adminUser.role === "AUTHOR" || adminUser.stats.manuscriptCount || adminUser.stats.publishedBooksCount
      ).length,
      suspended: adminUsers.filter((adminUser) => adminUser.isSuspended).length,
    };
  }, [adminUsers]);

  const payoutSlipArchivesByAuthor = useMemo(() => {
    const grouped = new Map<string, typeof payoutSlipArchives>();
    for (const archive of payoutSlipArchives) {
      const current = grouped.get(archive.authorId) || [];
      current.push(archive);
      grouped.set(archive.authorId, current);
    }
    return grouped;
  }, [payoutSlipArchives]);

  async function loadAdminUsersData() {
    setAdminUsersLoading(true);
    setAdminUsersError("");

    try {
      const result = await fetchAdminUsers();
      setAdminUsers(result.users);
      setCurrentAdminUserId(result.currentAdminUserId);
    } catch (error) {
      setAdminUsersError(
        error instanceof Error ? error.message : "Gagal mengambil daftar pengguna admin."
      );
    } finally {
      setAdminUsersLoading(false);
    }
  }

  async function handleAdminUserStatusAction(targetUserId: string, action: "suspend" | "activate") {
    setAdminUsersFeedback("");
    setAdminUsersError("");
    setAdminUserActionId(targetUserId);

    try {
      const result = await updateAdminUserAction({ userId: targetUserId, action });
      setAdminUsers((current) =>
        [...current]
          .map((item) => (item.id === result.user.id ? result.user : item))
          .sort(sortAdminUsersByActivity)
      );
      setAdminUsersFeedback(result.message);
    } catch (error) {
      setAdminUsersError(
        error instanceof Error ? error.message : "Gagal memperbarui status pengguna admin."
      );
    } finally {
      setAdminUserActionId("");
    }
  }

  const loadPlatformCommissionSettingsData = useCallback(async (showFeedback = false) => {
    setRoyaltySettingsLoading(true);
    setRoyaltySettingsError("");

    try {
      const result = await fetchPlatformCommissionSettings();
      hydrateRoyaltyConfig(result.settings);
      if (showFeedback) {
        setRoyaltySettingsFeedback("Pengaturan komisi platform berhasil dimuat ulang.");
      }
    } catch (error) {
      setRoyaltySettingsError(
        error instanceof Error ? error.message : "Gagal mengambil pengaturan komisi platform."
      );
    } finally {
      setRoyaltySettingsLoading(false);
    }
  }, [hydrateRoyaltyConfig]);

  async function handleSavePlatformCommissionSettings() {
    setRoyaltySettingsSaving(true);
    setRoyaltySettingsError("");
    setRoyaltySettingsFeedback("");

    try {
      const result = await savePlatformCommissionSettings(royalty);
      hydrateRoyaltyConfig(result.settings);
      setRoyaltySettingsFeedback(result.message);
    } catch (error) {
      setRoyaltySettingsError(
        error instanceof Error ? error.message : "Gagal menyimpan pengaturan komisi platform."
      );
    } finally {
      setRoyaltySettingsSaving(false);
    }
  }

  useEffect(() => {
    if (role !== "ADMIN" || tab !== "users") return;
    void loadAdminUsersData();
  }, [role, tab]);

  useEffect(() => {
    if (role !== "ADMIN" || tab !== "settings") return;
    void loadPlatformCommissionSettingsData();
  }, [loadPlatformCommissionSettingsData, role, tab]);

  async function handleUpdatePayoutStatus(input: {
    orderId: string;
    status: "AVAILABLE" | "PROCESSING" | "PAID";
    payoutReference?: string;
    payoutNote?: string;
  }) {
    setPayoutFeedback("");
    setPayoutUpdatingOrderId(input.orderId);

    try {
      const updated = await updateRoyaltyLedgerPayoutStatus(input);
      upsertRoyaltyLedgerEntry(updated);
      setPayoutFeedback(`Status payout ${input.orderId} berhasil diubah ke ${getRoyaltyLedgerLabel(updated.status)}.`);
    } catch (error) {
      setPayoutFeedback(
        error instanceof Error ? error.message : "Gagal memperbarui payout royalti."
      );
    } finally {
      setPayoutUpdatingOrderId("");
    }
  }

  async function handleUpdateMembershipPayoutStatus(input: {
    entryId: string;
    status: "AVAILABLE" | "PROCESSING" | "PAID";
    payoutReference?: string;
    payoutNote?: string;
  }) {
    setPayoutFeedback("");
    setMembershipPayoutUpdatingId(input.entryId);

    try {
      const updated = await updateMembershipRoyaltyLedgerPayoutStatus(input);
      upsertMembershipRoyaltyLedgerEntry(updated);
      setPayoutFeedback(
        `Status payout membership ${updated.orderId} berhasil diubah ke ${getRoyaltyLedgerLabel(updated.status)}.`
      );
    } catch (error) {
      setPayoutFeedback(
        error instanceof Error ? error.message : "Gagal memperbarui payout membership pool."
      );
    } finally {
      setMembershipPayoutUpdatingId("");
    }
  }

  function handleExportPayoutCsv() {
    if (!filteredPayoutReportRows.length) {
      setPayoutFeedback("Belum ada data payout untuk diexport.");
      return;
    }

    const csv = buildPayoutReportCsv(filteredPayoutReportRows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadPayoutReportCsv(csv, `naraloka-payout-report-${stamp}.csv`);
    setPayoutFeedback(
      `Laporan payout CSV berhasil dibuat untuk ${filteredPayoutReportRows.length} entri sesuai filter.`
    );
  }

  function handleResetPayoutFilters() {
    setReportStartDate("");
    setReportEndDate("");
    setReportStatusFilter("ALL");
    setReportAuthorFilter("ALL");
    setReportSourceTypeFilter("ALL");
    setPayoutFeedback("");
  }

  async function handleCreatePayoutSlip(authorId: string) {
    if (!user?.id) {
      setPayoutFeedback("ID admin belum tersedia untuk membuat arsip slip payout.");
      return;
    }

    const summary = filteredPayoutByAuthor.find((item) => item.authorId === authorId);
    if (!summary) {
      setPayoutFeedback("Summary penulis untuk slip payout tidak ditemukan.");
      return;
    }

    const rows = filteredPayoutReportRows.filter((row) => row.authorId === authorId);
    if (!rows.length) {
      setPayoutFeedback("Belum ada entri payout untuk penulis ini pada filter aktif.");
      return;
    }
    if (!rows.every((row) => row.payoutStatus === "PAID")) {
      setPayoutFeedback(
        "Slip payout resmi hanya bisa diarsipkan dari entri yang sudah berstatus PAID. Filter laporan ke status PAID dulu."
      );
      return;
    }

    try {
      const result = await archivePayoutSlipDocument({
        summary,
        rows,
        filters: {
          startDate: reportStartDate,
          endDate: reportEndDate,
          payoutStatus: reportStatusFilter,
          authorId,
          sourceType: reportSourceTypeFilter,
        },
        generatedByUserId: user.id,
        generatedByName: user?.name || "Admin",
        issuerName: "Naraloka",
        issuerTitle: "Slip / Invoice Payout Naraloka",
      });

      upsertPayoutSlipArchive(result.archive);
      openPayoutSlipHtml(result.htmlContent, `${result.archive.invoiceNumber}.html`);
      setPayoutFeedback(
        `Slip payout ${result.archive.invoiceNumber} untuk ${summary.authorName} berhasil diarsipkan.`
      );
    } catch (error) {
      setPayoutFeedback(
        error instanceof Error ? error.message : "Gagal membuat arsip slip payout."
      );
    }
  }

  async function handleOpenArchivedPayoutSlip(archiveId: string) {
    try {
      const archive = await fetchPayoutSlipArchiveHtml(archiveId);
      openPayoutSlipHtml(archive.htmlContent, `${archive.invoiceNumber}.html`);
      setPayoutFeedback(`Arsip slip ${archive.invoiceNumber} berhasil dibuka.`);
    } catch (error) {
      setPayoutFeedback(
        error instanceof Error ? error.message : "Gagal membuka arsip slip payout."
      );
    }
  }

  if (role !== "ADMIN") {
    return (
      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-10">
        <div className="text-2xl font-semibold tracking-tight text-ink">Dashboard Admin</div>
        <div className="mt-2 text-sm text-muted">
          Halaman ini hanya tersedia untuk akun admin yang sudah diberi akses resmi.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-ink md:text-4xl">
              Dashboard Admin
            </div>
            <div className="mt-2 text-sm text-muted">
              Manajemen pengguna, penulis, persetujuan naskah, dan publish karya ke katalog pembaca.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="brand">Paid {royalty.paidBookPct}%</Badge>
              <Badge tone="neutral">Royalti paid {100 - royalty.paidBookPct}%</Badge>
              <Badge tone="neutral">Premium {royalty.membershipPremiumPct}%</Badge>
              <Badge tone="neutral">Edukasi {royalty.membershipEduPct}%</Badge>
              {royaltySummary.availableCents ? (
                <Badge tone="brand">Siap payout {formatIdrFromCents(royaltySummary.availableCents)}</Badge>
              ) : null}
              {membershipPoolSummary.availableCents ? (
                <Badge tone="brand">
                  Pool membership {formatIdrFromCents(membershipPoolSummary.availableCents)}
                </Badge>
              ) : null}
              {workflowQueue.length ? <Badge tone="warning">{workflowQueue.length} naskah editorial</Badge> : <Badge tone="success">Semua aman</Badge>}
              {publishedEbooks.length ? <Badge tone="success">{publishedEbooks.length} karya terbit</Badge> : null}
            </div>
          </div>
          <div className="grid w-full gap-3 md:max-w-md md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold text-muted">Transaksi</div>
              <div className="mt-2 text-xl font-semibold text-ink">
                {kpis.totalTransactions.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold text-muted">Pendapatan backend</div>
              <div className="mt-2 text-xl font-semibold text-ink">{formatIdrFromCents(kpis.revenue)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "submissions"} onClick={() => setTab("submissions")} icon={FileCheck2}>
          Persetujuan naskah
        </TabButton>
        <TabButton active={tab === "catalog"} onClick={() => setTab("catalog")} icon={BookCopy}>
          Katalog
        </TabButton>
        <TabButton active={tab === "authors"} onClick={() => setTab("authors")} icon={BadgeCheck}>
          Penulis
        </TabButton>
        <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users}>
          Pengguna
        </TabButton>
        <TabButton active={tab === "reports"} onClick={() => setTab("reports")} icon={LineChart}>
          Laporan
        </TabButton>
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon={Settings}>
          Komisi & royalti
        </TabButton>
      </div>

      {tab === "submissions" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-6">
              <div className="text-sm font-semibold text-ink">Antrian editorial</div>
              <div className="mt-4 space-y-3">
                {workflowQueue.length ? (
                  workflowQueue.map((m) => (
                    <ManuscriptCard
                      key={m.id}
                      title={m.title}
                      category={m.category}
                      fileName={m.fileName}
                      storageBucket={m.storageBucket}
                      storagePath={m.storagePath}
                      authorId={m.authorId}
                      authorName={resolveAuthorName(m.authorId, authorProfilesByUser, manuscripts)}
                      suggestedMonetization={m.suggestedMonetization}
                      monetizationNote={m.monetizationNote}
                      suggestedPriceCents={m.priceCents}
                      reviewEntries={reviewEntriesByManuscript[m.id] ?? []}
                      reviewerName={user?.name || "Admin"}
                      currentStatus={m.status}
                      onApprove={(note) =>
                        approve({
                          manuscriptId: m.id,
                          adminNote: note,
                          reviewerId: user?.id,
                          reviewerName: user?.name,
                        })
                      }
                      onReject={(note) =>
                        reject({
                          manuscriptId: m.id,
                          adminNote: note,
                          reviewerId: user?.id,
                          reviewerName: user?.name,
                        })
                      }
                      onComment={(note) =>
                        addReviewComment({
                          manuscriptId: m.id,
                          note,
                          reviewerId: user?.id,
                          reviewerName: user?.name,
                        })
                      }
                      onSetStatus={(status, note) =>
                        setEditorialStatus({
                          manuscriptId: m.id,
                          status,
                          note,
                          reviewerId: user?.id,
                          reviewerName: user?.name,
                        })
                      }
                    />
                  ))
                ) : (
                          <div className="text-sm text-muted">Tidak ada naskah di antrian editorial.</div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-white p-6">
              <div className="text-sm font-semibold text-ink">Siap publish ke katalog</div>
              <div className="mt-2 text-sm text-muted">
                Naskah yang sudah approved bisa diterbitkan ke portal pembaca dengan pengaturan akses.
              </div>
              <div className="mt-4 space-y-3">
                {readyToPublish.length ? (
                  readyToPublish.map((m) => (
                    <PublishManuscriptCard
                      key={m.id}
                      title={m.title}
                      category={m.category}
                      fileName={m.fileName}
                      storageBucket={m.storageBucket}
                      storagePath={m.storagePath}
                      authorName={resolveAuthorName(m.authorId, authorProfilesByUser, manuscripts)}
                      isPublished={Boolean(m.publishedAtISO)}
                      publishedAtISO={m.publishedAtISO}
                      defaultPriceCents={m.priceCents}
                      publishedAccess={m.publishedAccess}
                      publishedRequiredPlan={m.publishedRequiredPlan}
                      publishedPriceCents={m.publishedPriceCents}
                      publishedIsFeatured={m.publishedIsFeatured}
                      publishedIsBestSeller={m.publishedIsBestSeller}
                      suggestedMonetization={m.suggestedMonetization}
                      monetizationNote={m.monetizationNote}
                      decisionStatus={getMonetizationDecisionStatus({
                        suggestedMonetization: m.suggestedMonetization,
                        suggestedPriceCents: m.priceCents,
                        publishedAccess: m.publishedAccess,
                        publishedRequiredPlan: m.publishedRequiredPlan,
                        publishedPriceCents: m.publishedPriceCents,
                      })}
                      onPublish={(config) =>
                        publishManuscript({
                          manuscriptId: m.id,
                          authorDisplayName: resolveAuthorName(m.authorId, authorProfilesByUser, manuscripts),
                          ...config,
                        })
                      }
                    />
                  ))
                ) : (
                  <div className="text-sm text-muted">
                    Belum ada naskah approved. Approve naskah penulis lebih dulu agar bisa dipublish.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink">Riwayat keputusan & publish</div>
              <div className="text-xs text-muted">{decisionHistory.length} naskah</div>
            </div>
            <div className="mt-4 space-y-3">
              {decisionHistory.map((m) => (
                <div key={m.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{m.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        {m.category} • {resolveAuthorName(m.authorId, authorProfilesByUser, manuscripts)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={getManuscriptStatusTone(m.status)}>{getManuscriptStatusLabel(m.status)}</Badge>
                      {m.publishedAtISO ? <Badge tone="brand">PUBLISHED</Badge> : null}
                    </div>
                  </div>
                  {m.adminNote ? <div className="mt-3 text-sm text-muted">{m.adminNote}</div> : null}
                  <div className="mt-3">
                    <ManuscriptFileActions
                      fileName={m.fileName}
                      storageBucket={m.storageBucket}
                      storagePath={m.storagePath}
                    />
                  </div>
                  <div className="mt-3">
                    <ReviewHistoryList entries={reviewEntriesByManuscript[m.id] ?? []} />
                  </div>
                  {m.publishedAtISO ? (
                    <div className="mt-3 text-xs text-muted">
                      Terbit {new Date(m.publishedAtISO).toLocaleString("id-ID")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "catalog" ? (
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="text-sm font-semibold text-ink">Manajemen katalog</div>
          <div className="mt-2 text-sm text-muted">
            Semua karya terbit yang sudah benar-benar dipublish dari workflow penulis tampil di sini.
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {adminCatalogEbooks.map((b) => (
              <div key={b.id} className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
                <div className="h-20 w-16 overflow-hidden rounded-xl bg-white">
                  <img src={b.coverUrl} alt={b.title} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{b.title}</div>
                  <div className="mt-1 text-xs text-muted">
                    {b.category} • {b.access}
                    {b.requiredPlan ? ` • ${b.requiredPlan}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {b.isFeatured ? <Badge tone="brand">Unggulan</Badge> : null}
                    {b.isBestSeller ? <Badge tone="warning">Best Seller</Badge> : null}
                    {publishedEbooks.some((ebook) => ebook.id === b.id) ? <Badge tone="success">Portal Penulis</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setCatalogEditorMode("edit");
                      setCatalogEditorTargetId(b.id);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setCatalogEditorMode("access");
                      setCatalogEditorTargetId(b.id);
                    }}
                  >
                    Atur akses
                  </Button>
                </div>
              </div>
            ))}
            {!adminCatalogEbooks.length ? (
              <div className="text-sm text-muted">Belum ada buku terbit live di katalog admin.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "authors" ? (
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="text-sm font-semibold text-ink">Manajemen penulis</div>
          <div className="mt-2 text-sm text-muted">
            Menampilkan penulis live dari profil portal penulis dan manuskrip yang sudah masuk ke workflow.
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {adminAuthors.map((a) => (
              <div key={a.id} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
                <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white">
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} alt={a.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-brand-2">
                      {a.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{a.displayName}</div>
                  <div className="mt-1 line-clamp-1 text-xs text-muted">{a.bio}</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedAuthorId(a.id);
                  }}
                >
                  Detail
                </Button>
              </div>
            ))}
            {!adminAuthors.length ? (
              <div className="text-sm text-muted">Belum ada data penulis live di dashboard admin.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">Manajemen pengguna</div>
              <div className="mt-2 text-sm text-muted">
                Data diambil langsung dari Supabase Auth, transaksi, dan aktivitas baca user.
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void loadAdminUsersData();
              }}
              disabled={adminUsersLoading}
            >
              {adminUsersLoading ? <LoaderCircle size={14} className="animate-spin" /> : null}
              Refresh Data
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold text-muted">Total user</div>
              <div className="mt-1 text-lg font-semibold text-ink">{adminUserStats.total}</div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold text-muted">Admin</div>
              <div className="mt-1 text-lg font-semibold text-ink">{adminUserStats.admins}</div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold text-muted">Author aktif</div>
              <div className="mt-1 text-lg font-semibold text-ink">{adminUserStats.authors}</div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold text-muted">Ditangguhkan</div>
              <div className="mt-1 text-lg font-semibold text-ink">{adminUserStats.suspended}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={adminUserSearch}
              onChange={(e) => setAdminUserSearch(e.target.value)}
              placeholder="Cari nama, email, role, membership, atau profil penulis"
            />
            <div className="flex items-center text-xs text-muted">
              {filteredAdminUsers.length} / {adminUsers.length} pengguna
            </div>
          </div>

          {adminUsersError ? <div className="mt-4 text-sm text-red-600">{adminUsersError}</div> : null}
          {adminUsersFeedback ? (
            <div className="mt-4 text-sm text-emerald-700">{adminUsersFeedback}</div>
          ) : null}

          {adminUsersLoading && !adminUsers.length ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted">
              <LoaderCircle size={16} className="animate-spin" />
              Memuat data pengguna live...
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {filteredAdminUsers.map((adminUser) => {
              const isCurrentAdmin = adminUser.id === currentAdminUserId;
              const authorActivityCount =
                adminUser.stats.manuscriptCount + adminUser.stats.publishedBooksCount;

              return (
                <div
                  key={adminUser.id}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white">
                      {adminUser.avatarUrl ? (
                        <img
                          src={adminUser.avatarUrl}
                          alt={adminUser.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-brand-2">
                          {adminUser.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{adminUser.name}</div>
                      <div className="mt-1 truncate text-xs text-muted">{adminUser.email || "-"}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={getAdminUserRoleTone(adminUser.role)}>{adminUser.role}</Badge>
                        <Badge tone={getMembershipTone(adminUser.membershipPlan)}>
                          {adminUser.membershipPlan}
                        </Badge>
                        <Badge tone={adminUser.isSuspended ? "warning" : "success"}>
                          {adminUser.isSuspended ? "Ditangguhkan" : "Aktif"}
                        </Badge>
                        {isCurrentAdmin ? <Badge tone="brand">Admin aktif</Badge> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-muted md:grid-cols-2">
                    <div>Transaksi: {adminUser.stats.transactionCount}</div>
                    <div>Sukses: {adminUser.stats.successfulTransactionCount}</div>
                    <div>Buku dimiliki: {adminUser.stats.ownedBookCount}</div>
                    <div>Progres baca: {adminUser.stats.readingBookCount}</div>
                    <div>Total naskah: {adminUser.stats.manuscriptCount}</div>
                    <div>Sudah terbit: {adminUser.stats.publishedBooksCount}</div>
                  </div>

                  <div className="mt-3 text-xs text-muted">
                    Aktivitas terakhir{" "}
                    {adminUser.lastActivityAtISO
                      ? new Date(adminUser.lastActivityAtISO).toLocaleString("id-ID")
                      : "belum tercatat"}
                    {authorActivityCount
                      ? ` • Profil penulis ${adminUser.authorProfile.displayName || "tersedia"}`
                      : ""}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedAdminUserId(adminUser.id);
                      }}
                    >
                      Detail
                    </Button>
                    {adminUser.isSuspended ? (
                      <Button
                        size="sm"
                        disabled={adminUserActionId === adminUser.id}
                        onClick={() => {
                          void handleAdminUserStatusAction(adminUser.id, "activate");
                        }}
                      >
                        {adminUserActionId === adminUser.id ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : null}
                        Aktifkan
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isCurrentAdmin || adminUserActionId === adminUser.id}
                        onClick={() => {
                          void handleAdminUserStatusAction(adminUser.id, "suspend");
                        }}
                      >
                        {adminUserActionId === adminUser.id ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : null}
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {!adminUsersLoading && !filteredAdminUsers.length ? (
              <div className="text-sm text-muted">
                {adminUsers.length
                  ? "Tidak ada pengguna yang cocok dengan pencarian ini."
                  : "Belum ada data pengguna live yang bisa ditampilkan."}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedCatalogEbook && selectedCatalogManuscript ? (
        <CatalogEditorModal
          mode={catalogEditorMode}
          ebook={selectedCatalogEbook}
          manuscript={selectedCatalogManuscript}
          authorName={resolveAuthorName(
            selectedCatalogManuscript.authorId,
            authorProfilesByUser,
            manuscripts
          )}
          onClose={() => setCatalogEditorTargetId("")}
          onSave={(config) => {
            publishManuscript({
              manuscriptId: selectedCatalogManuscript.id,
              authorDisplayName: resolveAuthorName(
                selectedCatalogManuscript.authorId,
                authorProfilesByUser,
                manuscripts
              ),
              ...config,
            });
            setCatalogEditorTargetId("");
          }}
        />
      ) : null}

      {selectedAuthor ? (
        <AuthorDetailModal
          author={selectedAuthor}
          manuscripts={manuscripts.filter((manuscript) => manuscript.authorId === selectedAuthor.id)}
          onClose={() => setSelectedAuthorId("")}
        />
      ) : null}

      {selectedAdminUser ? (
        <AdminUserDetailModal
          adminUser={selectedAdminUser}
          isCurrentAdmin={selectedAdminUser.id === currentAdminUserId}
          busy={adminUserActionId === selectedAdminUser.id}
          onClose={() => setSelectedAdminUserId("")}
          onToggleStatus={(action) => {
            void handleAdminUserStatusAction(selectedAdminUser.id, action);
          }}
        />
      ) : null}

      {tab === "reports" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-white p-6 md:col-span-2">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">Filter laporan payout</div>
                  <div className="mt-1 text-xs text-muted">
                    Filter ini memengaruhi tampilan laporan dan file CSV yang diexport.
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={handleResetPayoutFilters}>
                  Reset Filter
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-muted">Dari tanggal</span>
                  <Input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-muted">Sampai tanggal</span>
                  <Input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-muted">Status payout</span>
                  <select
                    className="h-12 rounded-2xl border border-border bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                  >
                    <option value="ALL">Semua status</option>
                    <option value="PENDING">Pending</option>
                    <option value="AVAILABLE">Siap Dibayar</option>
                    <option value="PROCESSING">Sedang Diproses</option>
                    <option value="PAID">Sudah Dibayar</option>
                    <option value="VOID">Void</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-muted">Source type</span>
                  <select
                    className="h-12 rounded-2xl border border-border bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                    value={reportSourceTypeFilter}
                    onChange={(e) => setReportSourceTypeFilter(e.target.value)}
                  >
                    <option value="ALL">Semua source</option>
                    <option value="PAID_BOOK">Paid Book</option>
                    <option value="MEMBERSHIP_POOL">Membership Pool</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-muted">Penulis</span>
                  <select
                    className="h-12 rounded-2xl border border-border bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                    value={reportAuthorFilter}
                    onChange={(e) => setReportAuthorFilter(e.target.value)}
                  >
                    <option value="ALL">Semua penulis</option>
                    {payoutAuthorOptions.map((item) => (
                      <option key={item.authorId} value={item.authorId}>
                        {item.authorName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 text-xs text-muted">
                Hasil filter: {filteredPayoutReportRows.length} entri payout.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">Ledger payout royalti</div>
                <div className="mt-2 text-sm text-muted">
                  Semua entri ini berasal dari `payment_ledger` transaksi e-book yang sukses atau sedang diproses.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-muted">{filteredRoyaltyLedgerEntries.length} entri</div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleExportPayoutCsv}
                  disabled={!filteredPayoutReportRows.length}
                >
                  <Download size={14} />
                  Export CSV
                </Button>
              </div>
            </div>
            {payoutFeedback ? <div className="mt-4 text-sm text-muted">{payoutFeedback}</div> : null}
            <div className="mt-5 space-y-3">
              {filteredRoyaltyLedgerEntries.length ? (
                filteredRoyaltyLedgerEntries.slice(0, 8).map((entry) => (
                  <RoyaltyPayoutCard
                    key={entry.orderId}
                    entry={entry}
                    authorName={resolveAuthorName(entry.authorId, authorProfilesByUser, manuscripts)}
                    authorProfile={resolveAuthorPayoutProfile(entry.authorId)}
                    busy={payoutUpdatingOrderId === entry.orderId}
                    onUpdate={handleUpdatePayoutStatus}
                  />
                ))
              ) : (
                <div className="text-sm text-muted">
                  Belum ada entri royalty ledger dari transaksi backend.
                </div>
              )}
            </div>
            <div className="mt-8 border-t border-border pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">Ledger membership pool</div>
                  <div className="mt-2 text-sm text-muted">
                    Pool membership dibagi ke penulis berdasarkan halaman baca nyata dari pembeli paket.
                  </div>
                </div>
                <div className="text-xs text-muted">
                  {filteredMembershipRoyaltyLedgerEntries.length} entri
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {filteredMembershipRoyaltyLedgerEntries.length ? (
                  filteredMembershipRoyaltyLedgerEntries.slice(0, 8).map((entry) => (
                    <MembershipRoyaltyPayoutCard
                      key={entry.entryId}
                      entry={entry}
                      authorName={resolveAuthorName(entry.authorId, authorProfilesByUser, manuscripts)}
                      authorProfile={resolveAuthorPayoutProfile(entry.authorId)}
                      busy={membershipPayoutUpdatingId === entry.entryId}
                      onUpdate={handleUpdateMembershipPayoutStatus}
                    />
                  ))
                ) : (
                  <div className="text-sm text-muted">
                    Belum ada pembagian membership pool dari progres baca user.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="text-sm font-semibold text-ink">Ringkasan payout</div>
            <div className="mt-2 text-sm text-muted">Ikhtisar nominal payout penulis dari penjualan langsung dan membership pool.</div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-muted">Paid siap dibayar</div>
                <div className="mt-1 text-lg font-semibold text-ink">
                  {formatIdrFromCents(filteredRoyaltySummary.availableCents)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-muted">Membership siap dibayar</div>
                <div className="mt-1 text-lg font-semibold text-ink">
                  {formatIdrFromCents(filteredMembershipPoolSummary.availableCents)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-muted">Paid sedang diproses</div>
                <div className="mt-1 text-lg font-semibold text-ink">
                  {formatIdrFromCents(filteredRoyaltySummary.processingCents)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-muted">Membership sedang diproses</div>
                <div className="mt-1 text-lg font-semibold text-ink">
                  {formatIdrFromCents(filteredMembershipPoolSummary.processingCents)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-muted">Top penulis membership</div>
                <div className="mt-3 space-y-2">
                  {filteredMembershipPoolByAuthor.slice(0, 3).map((item) => (
                    <div key={item.authorId} className="rounded-xl border border-border bg-white p-3">
                      <div className="text-xs font-semibold text-ink">{item.authorName}</div>
                      <div className="mt-1 text-[11px] text-muted">
                        Total {formatIdrFromCents(item.totalRoyaltyCents)} • Siap {formatIdrFromCents(item.availableCents)}
                      </div>
                    </div>
                  ))}
                  {!filteredMembershipPoolByAuthor.length ? (
                    <div className="text-xs text-muted">Belum ada ringkasan penulis.</div>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-muted">Summary per penulis</div>
                <div className="mt-3 space-y-2">
                  {filteredPayoutByAuthor.slice(0, 4).map((item) => (
                    <div key={item.authorId} className="rounded-xl border border-border bg-white p-3">
                      <div className="text-xs font-semibold text-ink">{item.authorName}</div>
                      <div className="mt-1 text-[11px] text-muted">
                        Total {formatIdrFromCents(item.totalRoyaltyCents)} • Paid Book {formatIdrFromCents(item.paidBookRoyaltyCents)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        Membership {formatIdrFromCents(item.membershipRoyaltyCents)} • Entri {item.entryCount}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        Siap {formatIdrFromCents(item.availableCents)} • Proses {formatIdrFromCents(item.processingCents)} • Dibayar {formatIdrFromCents(item.paidCents)}
                      </div>
                      <div className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted">
                        <div className="font-semibold text-ink">
                          {getPayoutMethodLabel(resolveAuthorPayoutProfile(item.authorId)?.payoutMethod)}
                        </div>
                        {getAuthorPayoutDetailLines(resolveAuthorPayoutProfile(item.authorId)).map((line) => (
                          <div key={line} className="mt-1 break-all">
                            {line}
                          </div>
                        ))}
                        {resolveAuthorPayoutProfile(item.authorId)?.payoutNotes ? (
                          <div className="mt-1 break-all">
                            Catatan: {resolveAuthorPayoutProfile(item.authorId)?.payoutNotes}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            void handleCreatePayoutSlip(item.authorId);
                          }}
                        >
                          <ExternalLink size={14} />
                          Arsipkan Slip
                        </Button>
                        {(payoutSlipArchivesByAuthor.get(item.authorId) ?? []).slice(0, 2).map((archive) => (
                          <Button
                            key={archive.id}
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void handleOpenArchivedPayoutSlip(archive.id);
                            }}
                          >
                            <Download size={14} />
                            {archive.invoiceNumber}
                          </Button>
                        ))}
                      </div>
                      {(payoutSlipArchivesByAuthor.get(item.authorId) ?? []).length ? (
                        <div className="mt-2 text-[11px] text-muted">
                          Arsip terbaru {(payoutSlipArchivesByAuthor.get(item.authorId) ?? [])[0]?.invoiceNumber} • dibuat {(payoutSlipArchivesByAuthor.get(item.authorId) ?? [])[0]?.generatedByName}
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-muted">
                          Belum ada arsip slip resmi untuk penulis ini.
                        </div>
                      )}
                    </div>
                  ))}
                  {!filteredPayoutByAuthor.length ? (
                    <div className="text-xs text-muted">Belum ada summary penulis untuk filter ini.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">Pengaturan komisi & royalti</div>
              <div className="mt-2 text-sm text-muted">
                Atur komisi platform per tipe akses. Nilai ini sekarang disimpan di backend dan
                langsung dipakai saat checkout dan pembentukan ledger.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void loadPlatformCommissionSettingsData(true);
                }}
                disabled={royaltySettingsLoading || royaltySettingsSaving}
              >
                {royaltySettingsLoading ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : null}
                Reload
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void handleSavePlatformCommissionSettings();
                }}
                disabled={royaltySettingsLoading || royaltySettingsSaving}
              >
                {royaltySettingsSaving ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : null}
                Simpan Pengaturan
              </Button>
            </div>
          </div>

          {royaltySettingsError ? (
            <div className="mt-4 text-sm text-red-600">{royaltySettingsError}</div>
          ) : null}
          {royaltySettingsFeedback ? (
            <div className="mt-4 text-sm text-emerald-700">{royaltySettingsFeedback}</div>
          ) : null}

          <div className="mt-2 text-sm text-muted">
            Royalti buku `Paid` dan `Membership Pool` kini sama-sama masuk ke ledger backend dan
            bisa diproses payout oleh admin.
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="text-xs font-semibold text-muted">Gratis / Open</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                {royalty.freeAccessPct}%
              </div>
              <div className="mt-2 text-sm text-muted">
                Tidak ada transaksi pada buku gratis, jadi komisi tetap 0%.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="text-xs font-semibold text-muted">Paid / beli satuan</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                {royalty.paidBookPct}%
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={royalty.paidBookPct}
                onChange={(e) => setCommissionPct("PAID", Number(e.target.value))}
                className="mt-4 w-full"
              />
              <div className="mt-2 text-xs text-muted">
                Royalti penulis otomatis {100 - royalty.paidBookPct}% dari penjualan buku paid.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="text-xs font-semibold text-muted">Membership Premium</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                {royalty.membershipPremiumPct}%
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={royalty.membershipPremiumPct}
                onChange={(e) =>
                  setCommissionPct("MEMBERSHIP_PREMIUM", Number(e.target.value))
                }
                className="mt-4 w-full"
              />
              <div className="mt-2 text-sm text-muted">
                Komisi paket Premium. Sisa pendapatan paket dibagi ke penulis berdasarkan progres baca membership.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="text-xs font-semibold text-muted">Membership Edukasi</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                {royalty.membershipEduPct}%
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={royalty.membershipEduPct}
                onChange={(e) =>
                  setCommissionPct("MEMBERSHIP_EDU", Number(e.target.value))
                }
                className="mt-4 w-full"
              />
              <div className="mt-2 text-sm text-muted">
                Komisi paket Edukasi. Sisa pendapatan paket dibagi ke penulis berdasarkan progres baca membership.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 md:col-span-2 xl:col-span-4">
              <div className="text-xs font-semibold text-muted">Catatan implementasi</div>
              <div className="mt-2 text-sm text-muted">
                Buku `Paid` menghitung royalti penulis langsung per transaksi dan menyimpannya ke ledger payout backend. Paket `Membership Premium` dan `Membership Edukasi` membentuk pool distributable yang dibagi ke penulis berdasarkan halaman baca nyata pembeli paket.
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <Input value={`${royalty.freeAccessPct}% gratis`} readOnly />
                <Input value={`${royalty.paidBookPct}% paid`} readOnly />
                <Input value={`${royalty.membershipPremiumPct}% premium • ${royalty.membershipEduPct}% edukasi`} readOnly />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
        active
          ? "border-brand-2 bg-brand-2/10 text-brand-2"
          : "border-border bg-white text-muted hover:bg-surface"
      )}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}

function ManuscriptCard({
  title,
  category,
  fileName,
  storageBucket,
  storagePath,
  authorId,
  authorName,
  suggestedMonetization,
  monetizationNote,
  suggestedPriceCents,
  reviewEntries,
  reviewerName,
  currentStatus,
  onApprove,
  onReject,
  onComment,
  onSetStatus,
}: {
  title: string;
  category: string;
  fileName: string;
  storageBucket?: string;
  storagePath?: string;
  authorId: string;
  authorName: string;
  suggestedMonetization?: SuggestedMonetization;
  monetizationNote?: string;
  suggestedPriceCents?: number;
  reviewEntries: Array<{
    id: string;
    reviewerName: string;
    decision:
      | "COMMENT"
      | "IN_REVIEW"
      | "NEEDS_REVISION"
      | "IN_EDITING"
      | "READY_TO_PUBLISH"
      | "REJECTED"
      | "APPROVED";
    note: string;
    createdAtISO: string;
  }>;
  reviewerName: string;
  currentStatus: string;
  onApprove: (note?: string) => void;
  onReject: (note: string) => void;
  onComment: (note: string) => void;
  onSetStatus: (
    status: "IN_REVIEW" | "NEEDS_REVISION" | "IN_EDITING" | "READY_TO_PUBLISH" | "REJECTED",
    note?: string
  ) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{title}</div>
          <div className="mt-1 text-xs text-muted">
            {category} • {fileName}
          </div>
          <div className="mt-1 text-xs text-muted">Penulis: {authorName || authorId}</div>
        </div>
        <Badge tone={getManuscriptStatusTone(currentStatus)}>{getManuscriptStatusLabel(currentStatus)}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="brand">{formatSuggestedMonetization(suggestedMonetization)}</Badge>
        {suggestedMonetization === "PAID" && suggestedPriceCents ? (
          <Badge tone="neutral">Usulan harga {formatIdrFromCents(suggestedPriceCents)}</Badge>
        ) : null}
      </div>
      {monetizationNote ? <div className="mt-3 text-sm text-muted">Catatan: {monetizationNote}</div> : null}
      <div className="mt-3">
        <ManuscriptFileActions
          fileName={fileName}
          storageBucket={storageBucket}
          storagePath={storagePath}
        />
      </div>
      <div className="mt-3">
        <ReviewHistoryList entries={reviewEntries} emptyLabel="Belum ada histori review editor." />
      </div>

      <div className="mt-4 grid gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan admin (opsional)" />
        <div className="text-xs text-muted">
          Reviewer aktif: {reviewerName}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const nextNote = note.trim();
              if (!nextNote) return;
              onComment(nextNote);
              setNote("");
            }}
            disabled={!note.trim()}
          >
            Simpan Catatan
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onSetStatus("IN_REVIEW", note.trim() || "Naskah masuk tahap review editorial.");
              setNote("");
            }}
          >
            Mulai Review
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onSetStatus("IN_EDITING", note.trim() || "Naskah masuk tahap editing.");
              setNote("");
            }}
          >
            Masuk Editing
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onApprove(note.trim() || undefined);
              setNote("");
            }}
          >
            Siap Terbit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onSetStatus(
                "NEEDS_REVISION",
                note.trim() || "Mohon revisi naskah sesuai catatan editor."
              );
              setNote("");
            }}
          >
            Perlu Revisi
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              onReject(note.trim() || "Mohon revisi dan kirim ulang dengan perbaikan struktur.");
              setNote("");
            }}
          >
            Tolak
          </Button>
        </div>
      </div>
    </div>
  );
}

function PublishManuscriptCard({
  title,
  category,
  fileName,
  storageBucket,
  storagePath,
  authorName,
  isPublished,
  publishedAtISO,
  defaultPriceCents,
  publishedAccess,
  publishedRequiredPlan,
  publishedPriceCents,
  publishedIsFeatured,
  publishedIsBestSeller,
  suggestedMonetization,
  monetizationNote,
  decisionStatus,
  onPublish,
}: {
  title: string;
  category: string;
  fileName: string;
  storageBucket?: string;
  storagePath?: string;
  authorName: string;
  isPublished: boolean;
  publishedAtISO?: string;
  defaultPriceCents?: number;
  publishedAccess?: BookAccess;
  publishedRequiredPlan?: MembershipPlan;
  publishedPriceCents?: number;
  publishedIsFeatured?: boolean;
  publishedIsBestSeller?: boolean;
  suggestedMonetization?: SuggestedMonetization;
  monetizationNote?: string;
  decisionStatus: "PENDING" | "ACCEPTED" | "ADJUSTED";
  onPublish: (config: {
    access: BookAccess;
    requiredPlan?: MembershipPlan;
    priceCents?: number;
    isFeatured?: boolean;
    isBestSeller?: boolean;
  }) => void;
}) {
  const defaults = suggestionToPublishDefaults(suggestedMonetization, defaultPriceCents);
  const resolvedAccess = publishedAccess ?? defaults.access;
  const resolvedRequiredPlan = publishedRequiredPlan ?? defaults.requiredPlan ?? "PREMIUM";
  const resolvedPriceCents = publishedPriceCents ?? defaultPriceCents ?? 4_900_000;
  const [access, setAccess] = useState<BookAccess>(resolvedAccess);
  const [requiredPlan, setRequiredPlan] = useState<MembershipPlan>(resolvedRequiredPlan);
  const [priceInput, setPriceInput] = useState(String(Math.round(resolvedPriceCents / 100)));
  const [isFeatured, setIsFeatured] = useState(Boolean(publishedIsFeatured));
  const [isBestSeller, setIsBestSeller] = useState(Boolean(publishedIsBestSeller));

  useEffect(() => {
    setAccess(resolvedAccess);
    setRequiredPlan(resolvedRequiredPlan);
    setPriceInput(String(Math.round(resolvedPriceCents / 100)));
    setIsFeatured(Boolean(publishedIsFeatured));
    setIsBestSeller(Boolean(publishedIsBestSeller));
  }, [
    publishedAccess,
    publishedIsBestSeller,
    publishedIsFeatured,
    publishedPriceCents,
    publishedRequiredPlan,
    resolvedAccess,
    resolvedPriceCents,
    resolvedRequiredPlan,
  ]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{title}</div>
          <div className="mt-1 text-xs text-muted">
            {category} • {authorName}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="brand">{formatSuggestedMonetization(suggestedMonetization)}</Badge>
            {suggestedMonetization === "PAID" && defaultPriceCents ? (
              <Badge tone="neutral">Usulan {formatIdrFromCents(defaultPriceCents)}</Badge>
            ) : null}
            {isPublished ? (
              <Badge tone={decisionStatus === "ACCEPTED" ? "success" : "warning"}>
                {getDecisionStatusLabel(decisionStatus)}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">READY TO PUBLISH</Badge>
          {isPublished ? <Badge tone="brand">PUBLISHED</Badge> : null}
        </div>
      </div>
      {monetizationNote ? <div className="mt-3 text-sm text-muted">Catatan penulis: {monetizationNote}</div> : null}
      <div className="mt-3">
        <ManuscriptFileActions
          fileName={fileName}
          storageBucket={storageBucket}
          storagePath={storagePath}
        />
      </div>
      {isPublished ? (
        <div className="mt-3 rounded-xl border border-border bg-white px-3 py-2 text-xs text-muted">
          Hasil publish saat ini:{" "}
          {getPublishedAccessLabel(access, access === "MEMBERSHIP" ? requiredPlan : undefined)}
          {access === "PAID"
            ? ` • ${formatIdrFromCents(Math.max(0, Number(priceInput || "0")) * 100)}`
            : ""}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-xs font-semibold text-muted">
          Akses
          <select
            value={access}
            onChange={(e) => setAccess(e.target.value as BookAccess)}
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-ink outline-none"
          >
            <option value="OPEN">Gratis</option>
            <option value="MEMBERSHIP">Membership</option>
            <option value="PAID">Beli satuan</option>
          </select>
        </label>

        {access === "MEMBERSHIP" ? (
          <label className="grid gap-2 text-xs font-semibold text-muted">
            Paket wajib
            <select
              value={requiredPlan}
              onChange={(e) => setRequiredPlan(e.target.value as MembershipPlan)}
              className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-ink outline-none"
            >
              <option value="PREMIUM">Premium</option>
              <option value="EDU">Edukasi</option>
            </select>
          </label>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white px-3 py-2 text-xs text-muted">
            {access === "OPEN"
              ? "Buku akan bisa dibaca gratis tanpa membership."
              : "Buku akan dijual satuan dan muncul tombol checkout."}
          </div>
        )}

        {access === "PAID" ? (
          <label className="grid gap-2 text-xs font-semibold text-muted md:col-span-2">
            Harga jual (rupiah)
            <Input
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="49000"
            />
          </label>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsFeatured((value) => !value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition",
            isFeatured
              ? "border-brand-2 bg-brand-2/10 text-brand-2"
              : "border-border bg-white text-muted hover:bg-surface"
          )}
        >
          Tandai unggulan
        </button>
        <button
          type="button"
          onClick={() => setIsBestSeller((value) => !value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition",
            isBestSeller
              ? "border-brand-2 bg-brand-2/10 text-brand-2"
              : "border-border bg-white text-muted hover:bg-surface"
          )}
        >
          Tandai best seller
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted">
          {publishedAtISO ? `Terbit terakhir ${new Date(publishedAtISO).toLocaleString("id-ID")}` : "Belum pernah dipublish."}
        </div>
        <Button
          size="sm"
          onClick={() =>
            onPublish({
              access,
              requiredPlan: access === "MEMBERSHIP" ? requiredPlan : undefined,
              priceCents: access === "PAID" ? Math.max(0, Number(priceInput || "0")) * 100 : undefined,
              isFeatured,
              isBestSeller,
            })
          }
        >
          {isPublished ? "Update Publish" : "Publish ke Katalog"}
        </Button>
      </div>
    </div>
  );
}

function CatalogEditorModal({
  mode,
  ebook,
  manuscript,
  authorName,
  onSave,
  onClose,
}: {
  mode: "edit" | "access";
  ebook: {
    id: string;
    title: string;
    category: string;
    access: BookAccess;
    requiredPlan?: MembershipPlan;
    priceCents: number;
    isFeatured?: boolean;
    isBestSeller?: boolean;
    publishedAtISO?: string;
  };
  manuscript: {
    fileName: string;
    storageBucket?: string;
    storagePath?: string;
    suggestedMonetization?: SuggestedMonetization;
    monetizationNote?: string;
    publishedPriceCents?: number;
  };
  authorName: string;
  onSave: (config: {
    access: BookAccess;
    requiredPlan?: MembershipPlan;
    priceCents?: number;
    isFeatured?: boolean;
    isBestSeller?: boolean;
  }) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[2rem] border border-border bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-ink">
              {mode === "access" ? "Atur akses katalog" : "Edit katalog"}
            </div>
            <div className="mt-1 text-sm text-muted">
              Perubahan di sini langsung memperbarui konfigurasi publish buku yang sudah terbit.
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>
        <div className="mt-5">
          <PublishManuscriptCard
            title={ebook.title}
            category={ebook.category}
            fileName={manuscript.fileName}
            storageBucket={manuscript.storageBucket}
            storagePath={manuscript.storagePath}
            authorName={authorName}
            isPublished
            publishedAtISO={ebook.publishedAtISO}
            defaultPriceCents={ebook.priceCents || manuscript.publishedPriceCents}
            publishedAccess={ebook.access}
            publishedRequiredPlan={ebook.requiredPlan}
            publishedPriceCents={ebook.priceCents}
            publishedIsFeatured={ebook.isFeatured}
            publishedIsBestSeller={ebook.isBestSeller}
            suggestedMonetization={manuscript.suggestedMonetization}
            monetizationNote={manuscript.monetizationNote}
            decisionStatus="ACCEPTED"
            onPublish={onSave}
          />
        </div>
      </div>
    </div>
  );
}

function AuthorDetailModal({
  author,
  manuscripts,
  onClose,
}: {
  author: {
    id: string;
    displayName: string;
    bio: string;
    avatarUrl?: string;
    phone?: string;
    portfolioUrl?: string;
    specialty?: string;
    manuscriptsCount: number;
    publishedBooksCount: number;
  };
  manuscripts: Array<{
    id: string;
    title: string;
    status: string;
    publishedAtISO?: string;
  }>;
  onClose: () => void;
}) {
  const latestManuscripts = [...manuscripts]
    .sort((a, b) => +new Date(b.publishedAtISO || 0) - +new Date(a.publishedAtISO || 0))
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[2rem] border border-border bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-surface">
              {author.avatarUrl ? (
                <img src={author.avatarUrl} alt={author.displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-brand-2">
                  {author.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold text-ink">{author.displayName}</div>
              <div className="mt-1 text-sm text-muted">{author.specialty || "Profil penulis live"}</div>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-muted">Total naskah</div>
            <div className="mt-1 text-lg font-semibold text-ink">{author.manuscriptsCount}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-muted">Sudah terbit</div>
            <div className="mt-1 text-lg font-semibold text-ink">{author.publishedBooksCount}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-muted">Kontak</div>
            <div className="mt-1 text-sm text-ink">{author.phone || "Belum diisi"}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-sm font-semibold text-ink">Bio penulis</div>
            <div className="mt-2 text-sm text-muted">{author.bio || "Belum ada bio penulis."}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-sm font-semibold text-ink">Portofolio</div>
            <div className="mt-2 break-all text-sm text-muted">
              {author.portfolioUrl || "Belum ada link portofolio."}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-ink">Naskah terbaru</div>
          <div className="mt-3 space-y-2">
            {latestManuscripts.length ? (
              latestManuscripts.map((manuscript) => (
                <div key={manuscript.id} className="rounded-xl border border-border bg-white p-3">
                  <div className="text-sm font-semibold text-ink">{manuscript.title}</div>
                  <div className="mt-1 text-xs text-muted">
                    {getManuscriptStatusLabel(manuscript.status)}
                    {manuscript.publishedAtISO
                      ? ` • Terbit ${new Date(manuscript.publishedAtISO).toLocaleString("id-ID")}`
                      : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted">Belum ada naskah untuk penulis ini.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminUserDetailModal({
  adminUser,
  isCurrentAdmin,
  busy,
  onClose,
  onToggleStatus,
}: {
  adminUser: AdminUserSummary;
  isCurrentAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onToggleStatus: (action: "suspend" | "activate") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[2rem] border border-border bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-surface">
              {adminUser.avatarUrl ? (
                <img
                  src={adminUser.avatarUrl}
                  alt={adminUser.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-brand-2">
                  {adminUser.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold text-ink">{adminUser.name}</div>
              <div className="mt-1 text-sm text-muted">{adminUser.email || "Email belum tersedia"}</div>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone={getAdminUserRoleTone(adminUser.role)}>{adminUser.role}</Badge>
          <Badge tone={getMembershipTone(adminUser.membershipPlan)}>{adminUser.membershipPlan}</Badge>
          <Badge tone={adminUser.isSuspended ? "warning" : "success"}>
            {adminUser.isSuspended ? "Ditangguhkan" : "Aktif"}
          </Badge>
          {adminUser.emailConfirmed ? <Badge tone="success">Email terverifikasi</Badge> : <Badge tone="warning">Email belum verifikasi</Badge>}
          {isCurrentAdmin ? <Badge tone="brand">Admin aktif</Badge> : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-muted">Dibuat</div>
            <div className="mt-1 text-sm text-ink">
              {adminUser.createdAtISO
                ? new Date(adminUser.createdAtISO).toLocaleString("id-ID")
                : "Belum tercatat"}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-muted">Login terakhir</div>
            <div className="mt-1 text-sm text-ink">
              {adminUser.lastSignInAtISO
                ? new Date(adminUser.lastSignInAtISO).toLocaleString("id-ID")
                : "Belum pernah"}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-muted">Aktivitas terakhir</div>
            <div className="mt-1 text-sm text-ink">
              {adminUser.lastActivityAtISO
                ? new Date(adminUser.lastActivityAtISO).toLocaleString("id-ID")
                : "Belum tercatat"}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-sm font-semibold text-ink">Profil akun</div>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <div>ID: {adminUser.id}</div>
              <div>Telepon: {adminUser.phone || "Belum diisi"}</div>
              <div>Kota: {adminUser.city || "Belum diisi"}</div>
              <div>Website: {adminUser.website || "Belum diisi"}</div>
              <div>Penyedia login: {adminUser.providerList.length ? adminUser.providerList.join(", ") : "email"}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-sm font-semibold text-ink">Statistik penggunaan</div>
            <div className="mt-3 grid gap-2 text-sm text-muted">
              <div>Transaksi: {adminUser.stats.transactionCount}</div>
              <div>Transaksi sukses: {adminUser.stats.successfulTransactionCount}</div>
              <div>Buku dimiliki: {adminUser.stats.ownedBookCount}</div>
              <div>Progres baca aktif: {adminUser.stats.readingBookCount}</div>
              <div>Total naskah: {adminUser.stats.manuscriptCount}</div>
              <div>Buku terbit: {adminUser.stats.publishedBooksCount}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-sm font-semibold text-ink">Bio akun</div>
            <div className="mt-2 text-sm text-muted">
              {adminUser.bio || "Belum ada bio akun."}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-sm font-semibold text-ink">Profil penulis</div>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <div>Nama profil: {adminUser.authorProfile.displayName || "Belum ada"}</div>
              <div>Spesialisasi: {adminUser.authorProfile.specialty || "Belum ada"}</div>
              <div className="break-all">
                Portofolio: {adminUser.authorProfile.portfolioUrl || "Belum ada"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {adminUser.isSuspended ? (
            <Button size="sm" disabled={busy} onClick={() => onToggleStatus("activate")}>
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
              Aktifkan Kembali
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              disabled={isCurrentAdmin || busy}
              onClick={() => onToggleStatus("suspend")}
            >
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
              Suspend Pengguna
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function resolveAuthorName(
  authorId: string,
  authorProfilesByUser: Record<string, { displayName: string }>,
  manuscripts: Array<{ authorId: string; authorDisplayName?: string }> = []
) {
  return (
    authorProfilesByUser[authorId]?.displayName ||
    manuscripts.find((manuscript) => manuscript.authorId === authorId)?.authorDisplayName ||
    authorId
  );
}

function formatSuggestedMonetization(value?: SuggestedMonetization) {
  return `Usulan: ${getSuggestedMonetizationLabel(value)}`;
}

function getManuscriptStatusLabel(status: string) {
  if (status === "SUBMITTED") return "Baru Masuk";
  if (status === "IN_REVIEW") return "Sedang Direview";
  if (status === "NEEDS_REVISION") return "Perlu Revisi";
  if (status === "IN_EDITING") return "Masuk Editing";
  if (status === "READY_TO_PUBLISH" || status === "APPROVED") return "Siap Terbit";
  if (status === "REJECTED") return "Ditolak";
  if (status === "DRAFT") return "Draft";
  return status;
}

function getManuscriptStatusTone(status: string): "brand" | "success" | "warning" | "neutral" {
  if (status === "READY_TO_PUBLISH" || status === "APPROVED") return "success";
  if (status === "NEEDS_REVISION" || status === "REJECTED") return "warning";
  if (status === "SUBMITTED" || status === "IN_REVIEW" || status === "IN_EDITING") return "brand";
  return "neutral";
}

function getRoyaltyLedgerTone(status: string): "brand" | "success" | "warning" | "neutral" {
  if (status === "PAID") return "success";
  if (status === "AVAILABLE" || status === "PROCESSING") return "brand";
  if (status === "VOID") return "warning";
  return "neutral";
}

function getRoyaltyLedgerLabel(status: string) {
  if (status === "AVAILABLE") return "Siap Dibayar";
  if (status === "PROCESSING") return "Sedang Diproses";
  if (status === "PAID") return "Sudah Dibayar";
  if (status === "VOID") return "Void";
  return "Menunggu Payment";
}

function getAdminUserRoleTone(role: string): "brand" | "success" | "warning" | "neutral" {
  if (role === "ADMIN") return "brand";
  if (role === "AUTHOR") return "success";
  return "neutral";
}

function getMembershipTone(plan: string): "brand" | "success" | "warning" | "neutral" {
  if (plan === "PREMIUM") return "brand";
  if (plan === "EDU") return "success";
  return "neutral";
}

function sortAdminUsersByActivity(a: AdminUserSummary, b: AdminUserSummary) {
  return (
    new Date(b.lastActivityAtISO || b.createdAtISO || 0).getTime() -
    new Date(a.lastActivityAtISO || a.createdAtISO || 0).getTime()
  );
}

function getReviewDecisionLabel(
  decision: "COMMENT" | "IN_REVIEW" | "NEEDS_REVISION" | "IN_EDITING" | "READY_TO_PUBLISH" | "REJECTED" | "APPROVED"
) {
  return getManuscriptStatusLabel(decision === "COMMENT" ? "COMMENT" : decision);
}

function getReviewDecisionTone(
  decision: "COMMENT" | "IN_REVIEW" | "NEEDS_REVISION" | "IN_EDITING" | "READY_TO_PUBLISH" | "REJECTED" | "APPROVED"
): "brand" | "success" | "warning" | "neutral" {
  if (decision === "COMMENT") return "neutral";
  return getManuscriptStatusTone(decision);
}

function ReviewHistoryList({
  entries,
  emptyLabel = "Belum ada histori review.",
}: {
  entries: Array<{
    id: string;
    reviewerName: string;
    decision:
      | "COMMENT"
      | "IN_REVIEW"
      | "NEEDS_REVISION"
      | "IN_EDITING"
      | "READY_TO_PUBLISH"
      | "REJECTED"
      | "APPROVED";
    note: string;
    createdAtISO: string;
  }>;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="text-xs font-semibold text-muted">Histori review</div>
      <div className="mt-2 space-y-2">
        {entries.length ? (
          entries.slice(0, 4).map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-ink">{entry.reviewerName}</div>
                <Badge
                  tone={getReviewDecisionTone(entry.decision)}
                >
                  {entry.decision === "COMMENT" ? "Catatan" : getReviewDecisionLabel(entry.decision)}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted">{entry.note}</div>
              <div className="mt-2 text-[11px] text-muted">
                {new Date(entry.createdAtISO).toLocaleString("id-ID")}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-muted">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function RoyaltyPayoutCard({
  entry,
  authorName,
  authorProfile,
  busy,
  onUpdate,
}: {
  entry: {
    orderId: string;
    authorId: string;
    ebookId?: string;
    itemLabel: string;
    grossAmountCents: number;
    platformCommissionCents: number;
    authorRoyaltyCents: number;
    status: string;
    payoutReference?: string;
    payoutNote?: string;
    earnedAtISO?: string;
    updatedAtISO: string;
  };
  authorName: string;
  authorProfile?: AuthorWorkspaceProfile;
  busy: boolean;
  onUpdate: (input: {
    orderId: string;
    status: "AVAILABLE" | "PROCESSING" | "PAID";
    payoutReference?: string;
    payoutNote?: string;
  }) => Promise<void>;
}) {
  const [payoutReference, setPayoutReference] = useState(entry.payoutReference || "");
  const [payoutNote, setPayoutNote] = useState(entry.payoutNote || "");
  const payoutDetailLines = getAuthorPayoutDetailLines(authorProfile);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{entry.itemLabel}</div>
          <div className="mt-1 text-xs text-muted">
            {authorName} • Order {entry.orderId}
          </div>
        </div>
        <Badge tone={getRoyaltyLedgerTone(entry.status)}>
          {getRoyaltyLedgerLabel(entry.status)}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="text-[11px] font-semibold text-muted">Penjualan kotor</div>
          <div className="mt-1 text-sm font-semibold text-ink">
            {formatIdrFromCents(entry.grossAmountCents)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="text-[11px] font-semibold text-muted">Komisi platform</div>
          <div className="mt-1 text-sm font-semibold text-ink">
            {formatIdrFromCents(entry.platformCommissionCents)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="text-[11px] font-semibold text-muted">Royalti penulis</div>
          <div className="mt-1 text-sm font-semibold text-emerald-700">
            {formatIdrFromCents(entry.authorRoyaltyCents)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Input
          value={payoutReference}
          onChange={(e) => setPayoutReference(e.target.value)}
          placeholder="Referensi transfer / payout"
        />
        <Input
          value={payoutNote}
          onChange={(e) => setPayoutNote(e.target.value)}
          placeholder="Catatan payout (opsional)"
        />
      </div>
      <div className="mt-3 rounded-xl border border-border bg-white p-3">
        <div className="text-[11px] font-semibold text-muted">Tujuan payout penulis</div>
        <div className="mt-1 text-sm font-semibold text-ink">
          {getPayoutMethodLabel(authorProfile?.payoutMethod)}
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-muted">
          {payoutDetailLines.length ? (
            payoutDetailLines.map((line) => (
              <div key={line} className="break-all">
                {line}
              </div>
            ))
          ) : (
            <div>Data payout penulis belum lengkap.</div>
          )}
          {authorProfile?.payoutNotes ? (
            <div className="break-all">Catatan: {authorProfile.payoutNotes}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            void onUpdate({
              orderId: entry.orderId,
              status: "PROCESSING",
              payoutReference,
              payoutNote,
            });
          }}
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
          Proses Payout
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            void onUpdate({
              orderId: entry.orderId,
              status: "PAID",
              payoutReference,
              payoutNote,
            });
          }}
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
          Tandai Sudah Dibayar
        </Button>
        {entry.status === "PROCESSING" || entry.status === "PAID" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              void onUpdate({
                orderId: entry.orderId,
                status: "AVAILABLE",
                payoutReference,
                payoutNote,
              });
            }}
          >
            Reset ke Siap Dibayar
          </Button>
        ) : null}
      </div>
      <div className="mt-3 text-[11px] text-muted">
        Tercatat {new Date(entry.earnedAtISO || entry.updatedAtISO).toLocaleString("id-ID")}
      </div>
    </div>
  );
}

function MembershipRoyaltyPayoutCard({
  entry,
  authorName,
  authorProfile,
  busy,
  onUpdate,
}: {
  entry: {
    entryId: string;
    orderId: string;
    authorId: string;
    membershipPlan: string;
    itemLabel: string;
    distributablePoolCents: number;
    allocationBasisPages: number;
    allocationRatio: number;
    authorRoyaltyCents: number;
    status: string;
    payoutReference?: string;
    payoutNote?: string;
    earnedAtISO?: string;
    updatedAtISO: string;
  };
  authorName: string;
  authorProfile?: AuthorWorkspaceProfile;
  busy: boolean;
  onUpdate: (input: {
    entryId: string;
    status: "AVAILABLE" | "PROCESSING" | "PAID";
    payoutReference?: string;
    payoutNote?: string;
  }) => Promise<void>;
}) {
  const [payoutReference, setPayoutReference] = useState(entry.payoutReference || "");
  const [payoutNote, setPayoutNote] = useState(entry.payoutNote || "");
  const payoutDetailLines = getAuthorPayoutDetailLines(authorProfile);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{entry.itemLabel}</div>
          <div className="mt-1 text-xs text-muted">
            {authorName} • {entry.membershipPlan} • Order {entry.orderId}
          </div>
        </div>
        <Badge tone={getRoyaltyLedgerTone(entry.status)}>
          {getRoyaltyLedgerLabel(entry.status)}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="text-[11px] font-semibold text-muted">Pool distributable</div>
          <div className="mt-1 text-sm font-semibold text-ink">
            {formatIdrFromCents(entry.distributablePoolCents)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="text-[11px] font-semibold text-muted">Halaman baca</div>
          <div className="mt-1 text-sm font-semibold text-ink">
            {entry.allocationBasisPages.toLocaleString("id-ID")}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="text-[11px] font-semibold text-muted">Royalti penulis</div>
          <div className="mt-1 text-sm font-semibold text-emerald-700">
            {formatIdrFromCents(entry.authorRoyaltyCents)}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            Alokasi {(entry.allocationRatio * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Input
          value={payoutReference}
          onChange={(e) => setPayoutReference(e.target.value)}
          placeholder="Referensi transfer / payout"
        />
        <Input
          value={payoutNote}
          onChange={(e) => setPayoutNote(e.target.value)}
          placeholder="Catatan payout membership"
        />
      </div>
      <div className="mt-3 rounded-xl border border-border bg-white p-3">
        <div className="text-[11px] font-semibold text-muted">Tujuan payout penulis</div>
        <div className="mt-1 text-sm font-semibold text-ink">
          {getPayoutMethodLabel(authorProfile?.payoutMethod)}
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-muted">
          {payoutDetailLines.length ? (
            payoutDetailLines.map((line) => (
              <div key={line} className="break-all">
                {line}
              </div>
            ))
          ) : (
            <div>Data payout penulis belum lengkap.</div>
          )}
          {authorProfile?.payoutNotes ? (
            <div className="break-all">Catatan: {authorProfile.payoutNotes}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            void onUpdate({
              entryId: entry.entryId,
              status: "PROCESSING",
              payoutReference,
              payoutNote,
            });
          }}
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
          Proses Payout
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            void onUpdate({
              entryId: entry.entryId,
              status: "PAID",
              payoutReference,
              payoutNote,
            });
          }}
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
          Tandai Sudah Dibayar
        </Button>
        {entry.status === "PROCESSING" || entry.status === "PAID" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              void onUpdate({
                entryId: entry.entryId,
                status: "AVAILABLE",
                payoutReference,
                payoutNote,
              });
            }}
          >
            Reset ke Siap Dibayar
          </Button>
        ) : null}
      </div>
      <div className="mt-3 text-[11px] text-muted">
        Tercatat {new Date(entry.earnedAtISO || entry.updatedAtISO).toLocaleString("id-ID")}
      </div>
    </div>
  );
}

function ManuscriptFileActions({
  fileName,
  storageBucket,
  storagePath,
}: {
  fileName: string;
  storageBucket?: string;
  storagePath?: string;
}) {
  const [loadingAction, setLoadingAction] = useState<"preview" | "download" | "">("");
  const [errorMessage, setErrorMessage] = useState("");
  const hasFile = Boolean(storagePath);

  async function openFile(mode: "preview" | "download") {
    if (!hasFile) {
      setErrorMessage("File storage belum tersedia untuk naskah ini.");
      return;
    }

    setErrorMessage("");
    setLoadingAction(mode);

    try {
      const signedUrl = await getAuthorManuscriptSignedUrl({
        storageBucket,
        storagePath,
        fileName,
        download: mode === "download",
      });

      if (mode === "preview") {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } else {
        const link = document.createElement("a");
        link.href = signedUrl;
        link.download = fileName;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal membuka file naskah.");
    } finally {
      setLoadingAction("");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void openFile("preview");
          }}
          disabled={!hasFile || Boolean(loadingAction)}
        >
          {loadingAction === "preview" ? <LoaderCircle size={14} className="animate-spin" /> : <ExternalLink size={14} />}
          Preview File
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void openFile("download");
          }}
          disabled={!hasFile || Boolean(loadingAction)}
        >
          {loadingAction === "download" ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
          Unduh File
        </Button>
        <div className="text-xs text-muted">{hasFile ? fileName : "File belum diunggah ke storage."}</div>
      </div>
      {errorMessage ? <div className="mt-2 text-xs text-red-600">{errorMessage}</div> : null}
    </div>
  );
}
