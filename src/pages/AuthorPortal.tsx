import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BellRing,
  BookCopy,
  Camera,
  CheckCheck,
  CircleDollarSign,
  FileText,
  FileUp,
  Handshake,
  Mail,
  Phone,
  Save,
  Trash2,
} from "lucide-react";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { supportEmailUrl, supportWhatsAppUrl } from "@/constants/contact";
import {
  getDecisionStatusLabel,
  getMonetizationDecisionStatus,
  getPublishedAccessLabel,
  getSuggestedMonetizationLabel,
} from "@/lib/monetization";
import {
  bankOptions,
  buildPayoutProfileSummary,
  ewalletOptions,
  validatePayoutProfile,
} from "@/lib/payoutProfile";
import { calculateRoyaltyBreakdown } from "@/lib/royalty";
import { openPayoutSlipHtml } from "@/lib/payoutSlip";
import { fetchPayoutSlipArchiveHtml } from "@/lib/payoutSlipArchive";
import {
  deleteAuthorManuscript,
  uploadAuthorProfileAvatar,
  uploadAuthorManuscriptCover,
  uploadAuthorManuscriptFile,
} from "@/lib/authorWorkspace";
import { cn } from "@/lib/utils";
import type { AuthorPayoutMethod, SuggestedMonetization } from "@/stores/publishingStore";
import { usePublishingStore } from "@/stores/publishingStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { BookCategory } from "@/types/domain";
import { formatIdrFromCents } from "@/utils/format";

type TabKey = "dashboard" | "profil" | "kerjasama" | "naskah";

function getWorkflowTone(status: string): "brand" | "success" | "warning" | "neutral" {
  if (status === "READY_TO_PUBLISH" || status === "APPROVED") return "success";
  if (status === "NEEDS_REVISION" || status === "REJECTED") return "warning";
  if (status === "SUBMITTED" || status === "IN_REVIEW" || status === "IN_EDITING") return "brand";
  return "neutral";
}

function getWorkflowLabel(status: string) {
  if (status === "SUBMITTED") return "Baru Masuk";
  if (status === "IN_REVIEW") return "Sedang Direview";
  if (status === "NEEDS_REVISION") return "Perlu Revisi";
  if (status === "IN_EDITING") return "Masuk Editing";
  if (status === "READY_TO_PUBLISH" || status === "APPROVED") return "Siap Terbit";
  if (status === "REJECTED") return "Ditolak";
  if (status === "DRAFT") return "Draft";
  return status;
}

function getReviewDecisionLabel(decision: string) {
  return decision === "COMMENT" ? "Catatan" : getWorkflowLabel(decision);
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

export default function AuthorPortal() {
  const user = useSessionStore((s) => s.user);

  const [tab, setTab] = useState<TabKey>("dashboard");
  const authorProfilesByUser = usePublishingStore((s) => s.authorProfilesByUser);
  const collaborationRequests = usePublishingStore((s) => s.collaborationRequests);
  const manuscripts = usePublishingStore((s) => s.manuscripts);
  const reviewEntriesByManuscript = usePublishingStore((s) => s.reviewEntriesByManuscript);
  const royaltyLedgerEntries = usePublishingStore((s) => s.royaltyLedgerEntries);
  const membershipRoyaltyLedgerEntries = usePublishingStore((s) => s.membershipRoyaltyLedgerEntries);
  const payoutSlipArchives = usePublishingStore((s) => s.payoutSlipArchives);
  const payoutNotificationStateByUser = usePublishingStore((s) => s.payoutNotificationStateByUser);
  const authorFinanceNotifications = usePublishingStore((s) => s.authorFinanceNotifications);
  const publishedEbooks = usePublishingStore((s) => s.publishedEbooks);
  const upsertAuthorProfile = usePublishingStore((s) => s.upsertAuthorProfile);
  const submitCollaborationRequest = usePublishingStore((s) => s.submitCollaborationRequest);
  const saveManuscriptDraft = usePublishingStore((s) => s.saveManuscriptDraft);
  const submitManuscript = usePublishingStore((s) => s.submitManuscript);
  const resubmitManuscriptRevision = usePublishingStore((s) => s.resubmitManuscriptRevision);
  const updateManuscriptCover = usePublishingStore((s) => s.updateManuscriptCover);
  const deleteManuscript = usePublishingStore((s) => s.deleteManuscript);
  const markAuthorFinanceNotificationsRead = usePublishingStore(
    (s) => s.markAuthorFinanceNotificationsRead
  );
  const markPayoutSlipNotificationsSeen = usePublishingStore(
    (s) => s.markPayoutSlipNotificationsSeen
  );
  const royalty = usePublishingStore((s) => s.royalty);
  const authorId = user?.id ?? "";
  const profile = authorProfilesByUser[authorId];
  const myManuscripts = manuscripts.filter((m) => m.authorId === authorId);
  const myRequests = collaborationRequests.filter((request) => request.authorId === authorId);
  const myRoyaltyEntries = royaltyLedgerEntries.filter((entry) => entry.authorId === authorId);
  const myMembershipRoyaltyEntries = membershipRoyaltyLedgerEntries.filter(
    (entry) => entry.authorId === authorId
  );
  const myFinanceNotifications = authorFinanceNotifications.filter(
    (notification) => notification.authorId === authorId
  );
  const myPayoutSlipArchives = payoutSlipArchives.filter((archive) => archive.authorId === authorId);
  const payoutNotificationState = payoutNotificationStateByUser[authorId];

  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePortfolio, setProfilePortfolio] = useState("");
  const [profilePayoutMethod, setProfilePayoutMethod] = useState<AuthorPayoutMethod | "">("");
  const [profileBankName, setProfileBankName] = useState("");
  const [profileBankAccountName, setProfileBankAccountName] = useState("");
  const [profileBankAccountNumber, setProfileBankAccountNumber] = useState("");
  const [profileBankBranch, setProfileBankBranch] = useState("");
  const [profileEwalletProvider, setProfileEwalletProvider] = useState("");
  const [profileEwalletAccountName, setProfileEwalletAccountName] = useState("");
  const [profileEwalletAccountNumber, setProfileEwalletAccountNumber] = useState("");
  const [profilePayoutNotes, setProfilePayoutNotes] = useState("");
  const [profileSpecialty, setProfileSpecialty] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarPreviewUrl, setProfileAvatarPreviewUrl] = useState("");
  const [profileAvatarFileName, setProfileAvatarFileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const [proposalName, setProposalName] = useState("");
  const [proposalEmail, setProposalEmail] = useState("");
  const [proposalPhone, setProposalPhone] = useState("");
  const [proposalPortfolio, setProposalPortfolio] = useState("");
  const [proposalPitch, setProposalPitch] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<BookCategory>("Novel");
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCoverFileName, setUploadCoverFileName] = useState("");
  const [uploadCoverFile, setUploadCoverFile] = useState<File | null>(null);
  const [editingManuscriptId, setEditingManuscriptId] = useState("");
  const [uploadSynopsis, setUploadSynopsis] = useState("");
  const [uploadAudience, setUploadAudience] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadWordCount, setUploadWordCount] = useState("");
  const [uploadPrice, setUploadPrice] = useState("");
  const [uploadSuggestedMonetization, setUploadSuggestedMonetization] =
    useState<SuggestedMonetization>("FREE");
  const [uploadMonetizationNote, setUploadMonetizationNote] = useState("");
  const [manuscriptMessage, setManuscriptMessage] = useState("");
  const [isUploadingManuscript, setIsUploadingManuscript] = useState(false);
  const [revisionNotesById, setRevisionNotesById] = useState<Record<string, string>>({});
  const [revisionFilesById, setRevisionFilesById] = useState<Record<string, File | null>>({});
  const [revisionMessagesById, setRevisionMessagesById] = useState<Record<string, string>>({});
  const [revisionLoadingById, setRevisionLoadingById] = useState<Record<string, boolean>>({});
  const [coverFilesById, setCoverFilesById] = useState<Record<string, File | null>>({});
  const [coverMessagesById, setCoverMessagesById] = useState<Record<string, string>>({});
  const [coverLoadingById, setCoverLoadingById] = useState<Record<string, boolean>>({});
  const [deleteMessagesById, setDeleteMessagesById] = useState<Record<string, string>>({});
  const [deleteLoadingById, setDeleteLoadingById] = useState<Record<string, boolean>>({});
  const [financeNotificationMessage, setFinanceNotificationMessage] = useState("");
  const [payoutSlipMessage, setPayoutSlipMessage] = useState("");
  const [payoutSlipOpeningId, setPayoutSlipOpeningId] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editingDraft = myManuscripts.find((manuscript) => manuscript.id === editingManuscriptId) ?? null;

  useEffect(() => {
    setProfileName(profile?.displayName ?? user?.name ?? "");
    setProfileBio(profile?.bio ?? "");
    setProfilePhone(profile?.phone ?? "");
    setProfilePortfolio(profile?.portfolioUrl ?? "");
    setProfilePayoutMethod(profile?.payoutMethod ?? "");
    setProfileBankName(profile?.bankName ?? "");
    setProfileBankAccountName(profile?.bankAccountName ?? "");
    setProfileBankAccountNumber(profile?.bankAccountNumber ?? "");
    setProfileBankBranch(profile?.bankBranch ?? "");
    setProfileEwalletProvider(profile?.ewalletProvider ?? "");
    setProfileEwalletAccountName(profile?.ewalletAccountName ?? "");
    setProfileEwalletAccountNumber(profile?.ewalletAccountNumber ?? "");
    setProfilePayoutNotes(profile?.payoutNotes ?? profile?.payoutAccount ?? "");
    setProfileSpecialty(profile?.specialty ?? "");
    setProposalName(profile?.displayName ?? user?.name ?? "");
    setProposalEmail(user?.email ?? "");
    setProposalPhone(profile?.phone ?? "");
    setProposalPortfolio(profile?.portfolioUrl ?? "");
  }, [profile, user?.email, user?.name]);

  useEffect(() => {
    if (!profileAvatarFile) {
      setProfileAvatarPreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(profileAvatarFile);
    setProfileAvatarPreviewUrl(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [profileAvatarFile]);

  const payoutSummary = buildPayoutProfileSummary({
    payoutMethod: profilePayoutMethod || undefined,
    bankName: profileBankName,
    bankAccountName: profileBankAccountName,
    bankAccountNumber: profileBankAccountNumber,
    ewalletProvider: profileEwalletProvider,
    ewalletAccountName: profileEwalletAccountName,
    ewalletAccountNumber: profileEwalletAccountNumber,
  });

  const totals = useMemo(() => {
    const drafts = myManuscripts.filter((m) => m.status === "DRAFT").length;
    const reviewing = myManuscripts.filter((m) =>
      ["SUBMITTED", "IN_REVIEW", "IN_EDITING"].includes(m.status)
    ).length;
    const ready = myManuscripts.filter((m) =>
      ["READY_TO_PUBLISH", "APPROVED"].includes(m.status)
    ).length;
    const revision = myManuscripts.filter((m) => m.status === "NEEDS_REVISION").length;
    return { drafts, reviewing, ready, revision };
  }, [myManuscripts]);

  const recentActivities = useMemo(() => {
    return [...myManuscripts]
      .sort((a, b) => +new Date(b.updatedAtISO ?? b.submittedAtISO) - +new Date(a.updatedAtISO ?? a.submittedAtISO))
      .slice(0, 5);
  }, [myManuscripts]);

  const royaltyRows = useMemo(() => {
    return myManuscripts.map((manuscript) => {
      const publishedEbook = publishedEbooks.find((ebook) => ebook.id === manuscript.publishedEbookId);
      const directSalePriceCents =
        publishedEbook?.access === "PAID"
          ? publishedEbook.priceCents
          : manuscript.priceCents ?? 0;
      const estimatedPerSale =
        directSalePriceCents > 0
          ? calculateRoyaltyBreakdown(directSalePriceCents, royalty.paidBookPct)
          : null;
      const sales = myRoyaltyEntries.filter(
        (entry) =>
          entry.ebookId &&
          publishedEbook?.id &&
          entry.ebookId === publishedEbook.id &&
          entry.paymentStatus === "SUCCESS" &&
          entry.status !== "VOID"
      );
      const salesCount = sales.filter((entry) => entry.paymentStatus === "SUCCESS").length;
      const grossSalesCents = sales.reduce((sum, entry) => sum + entry.grossAmountCents, 0);
      const platformTotalCents = sales.reduce((sum, entry) => sum + entry.platformCommissionCents, 0);
      const authorTotalCents = sales.reduce((sum, entry) => sum + entry.authorRoyaltyCents, 0);
      const availableRoyaltyCents = sales
        .filter((entry) => entry.status === "AVAILABLE")
        .reduce((sum, entry) => sum + entry.authorRoyaltyCents, 0);
      const processingRoyaltyCents = sales
        .filter((entry) => entry.status === "PROCESSING")
        .reduce((sum, entry) => sum + entry.authorRoyaltyCents, 0);
      const paidRoyaltyCents = sales
        .filter((entry) => entry.status === "PAID")
        .reduce((sum, entry) => sum + entry.authorRoyaltyCents, 0);
      const latestRoyaltyEntry = [...sales].sort(
        (a, b) =>
          +new Date(b.earnedAtISO || b.updatedAtISO || b.createdAtISO) -
          +new Date(a.earnedAtISO || a.updatedAtISO || a.createdAtISO)
      )[0];

      return {
        manuscript,
        publishedEbook,
        directSaleEnabled: publishedEbook?.access === "PAID",
        estimatedPerSale,
        decisionStatus: getMonetizationDecisionStatus({
          suggestedMonetization: manuscript.suggestedMonetization,
          suggestedPriceCents: manuscript.priceCents,
          publishedAccess: manuscript.publishedAccess,
          publishedRequiredPlan: manuscript.publishedRequiredPlan,
          publishedPriceCents: manuscript.publishedPriceCents,
        }),
        salesCount,
        grossSalesCents,
        platformTotalCents,
        authorTotalCents,
        availableRoyaltyCents,
        processingRoyaltyCents,
        paidRoyaltyCents,
        latestRoyaltyEntry,
      };
    });
  }, [
    myManuscripts,
    myRoyaltyEntries,
    publishedEbooks,
    royalty.paidBookPct,
  ]);

  const royaltySummary = useMemo(() => {
    return royaltyRows.reduce(
      (summary, row) => ({
        salesCount: summary.salesCount + row.salesCount,
        grossSalesCents: summary.grossSalesCents + row.grossSalesCents,
        platformTotalCents: summary.platformTotalCents + row.platformTotalCents,
        authorTotalCents: summary.authorTotalCents + row.authorTotalCents,
        availableRoyaltyCents: summary.availableRoyaltyCents + row.availableRoyaltyCents,
        processingRoyaltyCents: summary.processingRoyaltyCents + row.processingRoyaltyCents,
        paidRoyaltyCents: summary.paidRoyaltyCents + row.paidRoyaltyCents,
      }),
      {
        salesCount: 0,
        grossSalesCents: 0,
        platformTotalCents: 0,
        authorTotalCents: 0,
        availableRoyaltyCents: 0,
        processingRoyaltyCents: 0,
        paidRoyaltyCents: 0,
      }
    );
  }, [royaltyRows]);

  const membershipPoolSummary = useMemo(() => {
    return myMembershipRoyaltyEntries.reduce(
      (summary, entry) => ({
        totalRoyaltyCents: summary.totalRoyaltyCents + entry.authorRoyaltyCents,
        totalPages: summary.totalPages + entry.allocationBasisPages,
        availableCents:
          summary.availableCents + (entry.status === "AVAILABLE" ? entry.authorRoyaltyCents : 0),
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
  }, [myMembershipRoyaltyEntries]);

  const unreadPayoutSlipArchives = useMemo(() => {
    const seenAt = payoutNotificationState?.lastSeenIssuedAtISO
      ? +new Date(payoutNotificationState.lastSeenIssuedAtISO)
      : 0;

    return myPayoutSlipArchives.filter((archive) => {
      const issuedAt = +new Date(archive.issuedAtISO || archive.updatedAtISO);
      return issuedAt > seenAt;
    });
  }, [myPayoutSlipArchives, payoutNotificationState?.lastSeenIssuedAtISO]);

  const latestPayoutSlipArchive = myPayoutSlipArchives[0];
  const unreadFinanceNotifications = useMemo(() => {
    return myFinanceNotifications.filter((notification) => !notification.readAtISO);
  }, [myFinanceNotifications]);
  const unreadDashboardNotificationsCount =
    unreadPayoutSlipArchives.length + unreadFinanceNotifications.length;

  function resetManuscriptForm() {
    setEditingManuscriptId("");
    setUploadTitle("");
    setUploadCategory("Novel");
    setUploadFileName("");
    setUploadFile(null);
    setUploadCoverFileName("");
    setUploadCoverFile(null);
    setUploadSynopsis("");
    setUploadAudience("");
    setUploadTags("");
    setUploadWordCount("");
    setUploadPrice("");
    setUploadSuggestedMonetization("FREE");
    setUploadMonetizationNote("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleEditDraft(manuscriptId: string) {
    const manuscript = myManuscripts.find((item) => item.id === manuscriptId);
    if (!manuscript || manuscript.status !== "DRAFT") return;

    setEditingManuscriptId(manuscript.id);
    setUploadTitle(manuscript.title);
    setUploadCategory(manuscript.category);
    setUploadFile(null);
    setUploadFileName(manuscript.fileName || "");
    setUploadCoverFile(null);
    setUploadCoverFileName(manuscript.coverPublicUrl ? "Cover manual tersimpan" : "");
    setUploadSynopsis(manuscript.synopsis ?? "");
    setUploadAudience(manuscript.targetAudience ?? "");
    setUploadTags((manuscript.tags ?? []).join(", "));
    setUploadWordCount(manuscript.wordCount ? String(manuscript.wordCount) : "");
    setUploadPrice(manuscript.priceCents ? String(Math.round(manuscript.priceCents / 100)) : "");
    setUploadSuggestedMonetization(manuscript.suggestedMonetization ?? "FREE");
    setUploadMonetizationNote(manuscript.monetizationNote ?? "");
    setManuscriptMessage(
      "Mode edit draft aktif. Ubah metadata, ganti file bila perlu, lalu simpan ulang draft atau kirim ke review."
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleManuscriptAction(mode: "draft" | "submit") {
    const title = uploadTitle.trim();
    const existingDraft =
      editingManuscriptId && editingDraft?.status === "DRAFT" ? editingDraft : null;
    if (!authorId || !title || (!uploadFile && !existingDraft?.storagePath)) {
      setManuscriptMessage("Judul naskah wajib diisi dan file naskah harus tersedia.");
      return;
    }

    setIsUploadingManuscript(true);
    setManuscriptMessage(
      uploadCoverFile
        ? "Sedang mengunggah file naskah dan cover ke storage..."
        : "Sedang mengunggah file naskah ke storage..."
    );

    try {
      const uploadedFile = uploadFile
        ? await uploadAuthorManuscriptFile({
            userId: authorId,
            manuscriptId: existingDraft?.id,
            file: uploadFile,
          })
        : null;
      const resolvedManuscriptId = existingDraft?.id || uploadedFile?.manuscriptId;
      if (!resolvedManuscriptId) {
        throw new Error("ID draft naskah tidak ditemukan.");
      }
      const uploadedCover = uploadCoverFile
        ? await uploadAuthorManuscriptCover({
            userId: authorId,
            manuscriptId: resolvedManuscriptId,
            file: uploadCoverFile,
          })
        : null;

      const payload = {
        id: resolvedManuscriptId,
        authorId,
        authorDisplayName: profileName.trim() || user?.name || undefined,
        title,
        category: uploadCategory,
        fileName: uploadedFile?.fileName || existingDraft?.fileName || "",
        storageBucket: uploadedFile?.storageBucket || existingDraft?.storageBucket,
        storagePath: uploadedFile?.storagePath || existingDraft?.storagePath,
        storageMimeType: uploadedFile?.storageMimeType || existingDraft?.storageMimeType,
        storageSizeBytes: uploadedFile?.storageSizeBytes ?? existingDraft?.storageSizeBytes,
        storageUploadedAtISO:
          uploadedFile?.storageUploadedAtISO || existingDraft?.storageUploadedAtISO,
        coverStorageBucket: uploadedCover?.storageBucket || existingDraft?.coverStorageBucket,
        coverStoragePath: uploadedCover?.storagePath || existingDraft?.coverStoragePath,
        coverStorageMimeType: uploadedCover?.storageMimeType || existingDraft?.coverStorageMimeType,
        coverStorageSizeBytes:
          uploadedCover?.storageSizeBytes ?? existingDraft?.coverStorageSizeBytes,
        coverStorageUploadedAtISO:
          uploadedCover?.storageUploadedAtISO || existingDraft?.coverStorageUploadedAtISO,
        coverPublicUrl: uploadedCover?.publicUrl || existingDraft?.coverPublicUrl,
        synopsis: uploadSynopsis.trim(),
        targetAudience: uploadAudience.trim(),
        tags: uploadTags.split(",").map((tag) => tag.trim()).filter(Boolean),
        wordCount: Number(uploadWordCount) || undefined,
        priceCents: Number(uploadPrice) ? Number(uploadPrice) * 100 : undefined,
        suggestedMonetization: uploadSuggestedMonetization,
        monetizationNote: uploadMonetizationNote.trim(),
      };

      if (mode === "draft") {
        saveManuscriptDraft(payload);
        setManuscriptMessage(
          existingDraft
            ? uploadedFile || uploadedCover
              ? "Draft berhasil diperbarui. Perubahan metadata dan file terbaru sudah disimpan."
              : "Draft berhasil diperbarui tanpa mengganti file tersimpan."
            : uploadedCover
              ? "Draft naskah berhasil disimpan. File naskah dan cover sudah diunggah."
              : "Draft naskah berhasil disimpan dan file sudah diunggah."
        );
      } else {
        submitManuscript(payload);
        setManuscriptMessage(
          existingDraft
            ? uploadedFile || uploadedCover
              ? "Draft berhasil diperbarui dan dikirim untuk review editor."
              : "Draft berhasil dikirim ke review editor menggunakan file yang sudah tersimpan."
            : uploadedCover
              ? "Naskah berhasil dikirim untuk review editor. File naskah dan cover sudah diunggah."
              : "Naskah berhasil dikirim untuk review editor dan file sudah diunggah."
        );
      }

      resetManuscriptForm();
    } catch (error) {
      setManuscriptMessage(
        error instanceof Error ? error.message : "Upload naskah gagal. Coba lagi."
      );
    } finally {
      setIsUploadingManuscript(false);
    }
  }

  async function handleUploadCoverForManuscript(manuscriptId: string) {
    const manuscript = myManuscripts.find((item) => item.id === manuscriptId);
    const coverFile = coverFilesById[manuscriptId] ?? null;
    if (!manuscript || !authorId || !coverFile) {
      setCoverMessagesById((state) => ({
        ...state,
        [manuscriptId]: "Pilih file cover JPG/PNG/WEBP terlebih dahulu.",
      }));
      return;
    }

    setCoverLoadingById((state) => ({ ...state, [manuscriptId]: true }));
    setCoverMessagesById((state) => ({
      ...state,
      [manuscriptId]: "Sedang mengunggah cover manual...",
    }));

    try {
      const uploadedCover = await uploadAuthorManuscriptCover({
        userId: authorId,
        manuscriptId,
        file: coverFile,
      });

      updateManuscriptCover({
        manuscriptId,
        authorId,
        coverStorageBucket: uploadedCover.storageBucket,
        coverStoragePath: uploadedCover.storagePath,
        coverStorageMimeType: uploadedCover.storageMimeType,
        coverStorageSizeBytes: uploadedCover.storageSizeBytes,
        coverStorageUploadedAtISO: uploadedCover.storageUploadedAtISO,
        coverPublicUrl: uploadedCover.publicUrl,
      });

      setCoverFilesById((state) => ({ ...state, [manuscriptId]: null }));
      setCoverMessagesById((state) => ({
        ...state,
        [manuscriptId]:
          manuscript.publishedAtISO
            ? "Cover manual berhasil disimpan dan langsung dipakai di katalog."
            : "Cover manual berhasil disimpan untuk naskah ini.",
      }));
    } catch (error) {
      setCoverMessagesById((state) => ({
        ...state,
        [manuscriptId]:
          error instanceof Error ? error.message : "Gagal mengunggah cover manual.",
      }));
    } finally {
      setCoverLoadingById((state) => ({ ...state, [manuscriptId]: false }));
    }
  }

  async function handleDeleteManuscript(manuscriptId: string) {
    const manuscript = myManuscripts.find((item) => item.id === manuscriptId);
    if (!manuscript || !authorId) return;

    const isPublished = Boolean(manuscript.publishedAtISO);
    const confirmed = window.confirm(
      isPublished
        ? "Hapus buku yang sudah publish ini dari katalog pembaca? Tindakan ini akan menghapus naskah dari portal penulis dan mengeluarkannya dari katalog."
        : "Hapus draft ini dari portal penulis?"
    );
    if (!confirmed) return;

    setDeleteLoadingById((state) => ({ ...state, [manuscriptId]: true }));
    setDeleteMessagesById((state) => ({
      ...state,
      [manuscriptId]: isPublished ? "Sedang menghapus buku publish..." : "Sedang menghapus draft...",
    }));

    try {
      await deleteAuthorManuscript({
        manuscriptId,
        authorId,
        storageBucket: manuscript.storageBucket,
        storagePath: manuscript.storagePath,
        coverStorageBucket: manuscript.coverStorageBucket,
        coverStoragePath: manuscript.coverStoragePath,
      });
      deleteManuscript({ manuscriptId, authorId });
      if (editingManuscriptId === manuscriptId) {
        resetManuscriptForm();
      }
      setCoverFilesById((state) => {
        const next = { ...state };
        delete next[manuscriptId];
        return next;
      });
      setCoverMessagesById((state) => {
        const next = { ...state };
        delete next[manuscriptId];
        return next;
      });
      setCoverLoadingById((state) => {
        const next = { ...state };
        delete next[manuscriptId];
        return next;
      });
      setRevisionNotesById((state) => {
        const next = { ...state };
        delete next[manuscriptId];
        return next;
      });
      setRevisionFilesById((state) => {
        const next = { ...state };
        delete next[manuscriptId];
        return next;
      });
      setRevisionMessagesById((state) => {
        const next = { ...state };
        delete next[manuscriptId];
        return next;
      });
      setRevisionLoadingById((state) => {
        const next = { ...state };
        delete next[manuscriptId];
        return next;
      });
      setDeleteMessagesById((state) => {
        const next = { ...state };
        delete next[manuscriptId];
        return next;
      });
      setManuscriptMessage(
        isPublished
          ? "Buku publish berhasil dihapus dari portal penulis dan katalog pembaca."
          : "Draft berhasil dihapus dari portal penulis."
      );
    } catch (error) {
      setDeleteMessagesById((state) => ({
        ...state,
        [manuscriptId]:
          error instanceof Error ? error.message : "Gagal menghapus naskah. Silakan coba lagi.",
      }));
    } finally {
      setDeleteLoadingById((state) => ({ ...state, [manuscriptId]: false }));
    }
  }

  async function handleResubmitRevision(manuscriptId: string) {
    const manuscript = myManuscripts.find((item) => item.id === manuscriptId);
    if (!manuscript || manuscript.status !== "NEEDS_REVISION") return;
    if (!authorId) {
      setRevisionMessagesById((state) => ({
        ...state,
        [manuscriptId]: "Login penulis diperlukan untuk mengirim ulang revisi.",
      }));
      return;
    }

    const revisionNote = revisionNotesById[manuscriptId]?.trim() || "";
    const revisionFile = revisionFilesById[manuscriptId] ?? null;

    setRevisionLoadingById((state) => ({ ...state, [manuscriptId]: true }));
    setRevisionMessagesById((state) => ({
      ...state,
      [manuscriptId]: revisionFile
        ? "Mengunggah file revisi dan mengirim ulang ke editor..."
        : "Mengirim ulang revisi ke editor...",
    }));

    try {
      const uploadedFile = revisionFile
        ? await uploadAuthorManuscriptFile({
            userId: authorId,
            manuscriptId,
            file: revisionFile,
          })
        : null;

      resubmitManuscriptRevision({
        manuscriptId,
        authorId,
        authorDisplayName: profileName.trim() || user?.name || manuscript.authorDisplayName,
        note: revisionNote,
        fileName: uploadedFile?.fileName,
        storageBucket: uploadedFile?.storageBucket,
        storagePath: uploadedFile?.storagePath,
        storageMimeType: uploadedFile?.storageMimeType,
        storageSizeBytes: uploadedFile?.storageSizeBytes,
        storageUploadedAtISO: uploadedFile?.storageUploadedAtISO,
      });

      setRevisionNotesById((state) => ({ ...state, [manuscriptId]: "" }));
      setRevisionFilesById((state) => ({ ...state, [manuscriptId]: null }));
      setRevisionMessagesById((state) => ({
        ...state,
        [manuscriptId]: uploadedFile
          ? "Revisi berhasil dikirim ulang. File baru tersimpan dan status kembali ke antrean editorial."
          : "Revisi berhasil dikirim ulang dan status kembali ke antrean editorial.",
      }));
    } catch (error) {
      setRevisionMessagesById((state) => ({
        ...state,
        [manuscriptId]:
          error instanceof Error ? error.message : "Gagal mengirim ulang revisi. Coba lagi.",
      }));
    } finally {
      setRevisionLoadingById((state) => ({ ...state, [manuscriptId]: false }));
    }
  }

  async function handleOpenPayoutSlipArchive(archiveId: string) {
    setPayoutSlipOpeningId(archiveId);
    setPayoutSlipMessage("");

    try {
      const archive = await fetchPayoutSlipArchiveHtml(archiveId);
      openPayoutSlipHtml(archive.htmlContent, `${archive.invoiceNumber}.html`);

      const openedRecord = myPayoutSlipArchives.find((item) => item.id === archiveId);
      if (authorId && openedRecord) {
        markPayoutSlipNotificationsSeen({
          authorId,
          latestIssuedAtISO: openedRecord.issuedAtISO,
          lastOpenedArchiveId: openedRecord.id,
        });
      }

      setPayoutSlipMessage(`Slip payout ${archive.invoiceNumber} berhasil dibuka.`);
    } catch (error) {
      setPayoutSlipMessage(
        error instanceof Error ? error.message : "Gagal membuka arsip slip payout."
      );
    } finally {
      setPayoutSlipOpeningId("");
    }
  }

  function handleMarkPayoutNotificationsSeen() {
    if (!authorId || !latestPayoutSlipArchive) return;

    markPayoutSlipNotificationsSeen({
      authorId,
      latestIssuedAtISO: latestPayoutSlipArchive.issuedAtISO,
      lastOpenedArchiveId:
        payoutNotificationState?.lastOpenedArchiveId || latestPayoutSlipArchive.id,
    });
    setPayoutSlipMessage("Notifikasi slip payout ditandai sudah dibaca.");
  }

  function handleMarkFinanceNotificationsRead() {
    if (!authorId || !unreadFinanceNotifications.length) return;

    markAuthorFinanceNotificationsRead({
      authorId,
      notificationIds: unreadFinanceNotifications.map((item) => item.id),
    });
    setFinanceNotificationMessage("Notifikasi payout terbaru ditandai sudah dibaca.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-ink md:text-4xl">
              Portal Penulis
            </div>
            <div className="mt-2 text-sm text-muted">
              Kelola profil penulis, ajukan kerja sama, kirim naskah, dan pantau status karya dari akun kamu sendiri.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="brand">Royalti paid {100 - royalty.paidBookPct}%</Badge>
              <Badge tone="neutral">Komisi paid {royalty.paidBookPct}%</Badge>
              <Badge tone="neutral">Membership premium {royalty.membershipPremiumPct}%</Badge>
              <Badge tone="neutral">Membership edukasi {royalty.membershipEduPct}%</Badge>
              <Badge tone="neutral">{myManuscripts.length} naskah tersimpan</Badge>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white">
              {profileAvatarPreviewUrl || profile?.avatarUrl ? (
                <img
                  src={profileAvatarPreviewUrl || profile?.avatarUrl}
                  alt={profileName || user?.name || "Penulis"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-brand-2">
                  {(profileName || user?.name || "P").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{profileName || user?.name || "Penulis"}</div>
              <div className="mt-1 text-xs text-muted">
                {profileSpecialty || "Tambahkan spesialisasi dan bio di tab Profil Penulis."}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("profil")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
            tab === "profil"
              ? "border-brand-2 bg-brand-2/10 text-brand-2"
              : "border-border bg-white text-muted hover:bg-surface"
          )}
        >
          <Save size={16} />
          Profil Penulis
        </button>
        <button
          type="button"
          onClick={() => setTab("dashboard")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
            tab === "dashboard"
              ? "border-brand-2 bg-brand-2/10 text-brand-2"
              : "border-border bg-white text-muted hover:bg-surface"
          )}
        >
          <BarChart3 size={16} />
          Dashboard
          {unreadDashboardNotificationsCount ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
              {unreadDashboardNotificationsCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setTab("kerjasama")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
            tab === "kerjasama"
              ? "border-brand-2 bg-brand-2/10 text-brand-2"
              : "border-border bg-white text-muted hover:bg-surface"
          )}
        >
          <Handshake size={16} />
          Kerja Sama
        </button>
        <button
          type="button"
          onClick={() => setTab("naskah")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
            tab === "naskah"
              ? "border-brand-2 bg-brand-2/10 text-brand-2"
              : "border-border bg-white text-muted hover:bg-surface"
          )}
        >
          <BookCopy size={16} />
          Naskah Saya
        </button>
      </div>

      {tab === "profil" ? (
        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="text-sm font-semibold text-ink">Profil penulis</div>
            <div className="mt-2 text-sm text-muted">
              Informasi ini dipakai untuk identitas penulis, pengajuan kerja sama, dan halaman internal tim editor.
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-white text-4xl font-semibold text-brand-2">
                  {profileAvatarPreviewUrl || profile?.avatarUrl ? (
                    <img
                      src={profileAvatarPreviewUrl || profile?.avatarUrl}
                      alt={profileName || user?.name || "Penulis"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (profileName || user?.name || "P").slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <label className="block">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setProfileAvatarFile(file);
                        setProfileAvatarFileName(file?.name ?? "");
                      }}
                      disabled={profileSaving}
                    />
                    <span className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface">
                      <Camera size={16} />
                      Pilih Foto Profil
                    </span>
                  </label>
                  <div className="text-xs text-muted">
                    {profileAvatarFileName
                      ? `Foto dipilih: ${profileAvatarFileName}`
                      : "Format JPG/PNG/WEBP, maksimal 2MB."}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Nama pena"
                />
                <Input
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="Nomor WhatsApp"
                />
                <Input
                  className="md:col-span-2"
                  value={profilePortfolio}
                  onChange={(e) => setProfilePortfolio(e.target.value)}
                  placeholder="Link portofolio / media sosial"
                />
                <Input
                  className="md:col-span-2"
                  value={profileSpecialty}
                  onChange={(e) => setProfileSpecialty(e.target.value)}
                  placeholder="Spesialisasi, misalnya Novel Romansa / Edukasi Produktivitas"
                />
                <div className="md:col-span-2 rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-sm font-semibold text-ink">Informasi payout</div>
                  <div className="mt-2 text-sm text-muted">
                    Lengkapi rekening atau e-wallet penarikan royalti agar tim admin bisa memproses
                    payout dengan lebih rapi.
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-semibold text-ink">Metode payout</span>
                      <select
                        value={profilePayoutMethod}
                        onChange={(e) =>
                          setProfilePayoutMethod((e.target.value as AuthorPayoutMethod | "") || "")
                        }
                        className="w-full rounded-2xl border border-border bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                      >
                        <option value="">Pilih metode payout</option>
                        <option value="BANK_TRANSFER">Transfer bank</option>
                        <option value="EWALLET">E-wallet</option>
                      </select>
                    </label>

                    {profilePayoutMethod === "BANK_TRANSFER" ? (
                      <>
                        <Input
                          list="author-bank-options"
                          value={profileBankName}
                          onChange={(e) => setProfileBankName(e.target.value)}
                          placeholder="Nama bank, misalnya BCA / BRI / Mandiri"
                        />
                        <datalist id="author-bank-options">
                          {bankOptions.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                        <Input
                          value={profileBankBranch}
                          onChange={(e) => setProfileBankBranch(e.target.value)}
                          placeholder="Cabang bank (opsional)"
                        />
                        <Input
                          value={profileBankAccountName}
                          onChange={(e) => setProfileBankAccountName(e.target.value)}
                          placeholder="Nama pemilik rekening"
                        />
                        <Input
                          value={profileBankAccountNumber}
                          onChange={(e) => setProfileBankAccountNumber(e.target.value)}
                          placeholder="Nomor rekening"
                        />
                      </>
                    ) : null}

                    {profilePayoutMethod === "EWALLET" ? (
                      <>
                        <Input
                          list="author-ewallet-options"
                          value={profileEwalletProvider}
                          onChange={(e) => setProfileEwalletProvider(e.target.value)}
                          placeholder="Nama e-wallet, misalnya DANA / OVO / GoPay"
                        />
                        <datalist id="author-ewallet-options">
                          {ewalletOptions.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                        <Input
                          value={profileEwalletAccountNumber}
                          onChange={(e) => setProfileEwalletAccountNumber(e.target.value)}
                          placeholder="Nomor akun / nomor HP e-wallet"
                        />
                        <Input
                          className="md:col-span-2"
                          value={profileEwalletAccountName}
                          onChange={(e) => setProfileEwalletAccountName(e.target.value)}
                          placeholder="Nama pemilik akun e-wallet"
                        />
                      </>
                    ) : null}

                    <label className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-semibold text-ink">Catatan payout</span>
                      <textarea
                        className="min-h-24 w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                        value={profilePayoutNotes}
                        onChange={(e) => setProfilePayoutNotes(e.target.value)}
                        placeholder="Contoh: hanya menerima transfer atas nama yang sama, jadwal payout mingguan, atau catatan rekening lama."
                      />
                    </label>
                  </div>
                </div>
                <textarea
                  className="md:col-span-2 min-h-32 w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Bio penulis, pengalaman, tema tulisan, dan target pembaca."
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={async () => {
                  if (!authorId || !profileName.trim()) {
                    setProfileMessage("Nama pena wajib diisi.");
                    return;
                  }
                  const payoutValidationError = validatePayoutProfile({
                    payoutMethod: profilePayoutMethod,
                    bankName: profileBankName,
                    bankAccountName: profileBankAccountName,
                    bankAccountNumber: profileBankAccountNumber,
                    ewalletProvider: profileEwalletProvider,
                    ewalletAccountName: profileEwalletAccountName,
                    ewalletAccountNumber: profileEwalletAccountNumber,
                  });
                  if (payoutValidationError) {
                    setProfileMessage(payoutValidationError);
                    return;
                  }
                  setProfileSaving(true);
                  setProfileMessage("");

                  let nextAvatarUrl = profile?.avatarUrl ?? "";
                  try {
                    if (profileAvatarFile) {
                      const uploadedAvatar = await uploadAuthorProfileAvatar({
                        userId: authorId,
                        file: profileAvatarFile,
                      });
                      nextAvatarUrl = uploadedAvatar.publicUrl;
                    }
                  } catch (error) {
                    setProfileSaving(false);
                    setProfileMessage(
                      error instanceof Error
                        ? error.message
                        : "Upload foto profil penulis gagal. Coba lagi."
                    );
                    return;
                  }

                  upsertAuthorProfile({
                    userId: authorId,
                    displayName: profileName.trim(),
                    avatarUrl: nextAvatarUrl || undefined,
                    bio: profileBio.trim(),
                    phone: profilePhone.trim(),
                    portfolioUrl: profilePortfolio.trim(),
                    payoutAccount: payoutSummary,
                    payoutMethod: profilePayoutMethod || undefined,
                    bankName: profileBankName.trim(),
                    bankAccountName: profileBankAccountName.trim(),
                    bankAccountNumber: profileBankAccountNumber.trim(),
                    bankBranch: profileBankBranch.trim(),
                    ewalletProvider: profileEwalletProvider.trim(),
                    ewalletAccountName: profileEwalletAccountName.trim(),
                    ewalletAccountNumber: profileEwalletAccountNumber.trim(),
                    payoutNotes: profilePayoutNotes.trim(),
                    specialty: profileSpecialty.trim(),
                  });
                  setProfileAvatarFile(null);
                  setProfileAvatarFileName("");
                  setProfileSaving(false);
                  setProfileMessage("Profil penulis berhasil disimpan.");
                }}
                disabled={profileSaving}
              >
                <Save size={16} />
                {profileSaving ? "Menyimpan..." : "Simpan Profil"}
              </Button>
              {profileMessage ? <div className="text-sm text-muted">{profileMessage}</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="text-sm font-semibold text-ink">Kelengkapan profil</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="font-semibold text-ink">Foto profil</div>
                <div className="mt-2 h-16 w-16 overflow-hidden rounded-2xl bg-white">
                  {profileAvatarPreviewUrl || profile?.avatarUrl ? (
                    <img
                      src={profileAvatarPreviewUrl || profile?.avatarUrl}
                      alt={profileName || user?.name || "Penulis"}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="mt-2 text-muted">
                  {profileAvatarPreviewUrl || profile?.avatarUrl ? "Foto profil aktif." : "Belum ada foto profil."}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="font-semibold text-ink">Nama pena</div>
                <div className="mt-1 text-muted">{profileName || "Belum diisi"}</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="font-semibold text-ink">Kontak utama</div>
                <div className="mt-1 text-muted">{profilePhone || user?.email || "Belum diisi"}</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="font-semibold text-ink">Portofolio</div>
                <div className="mt-1 break-all text-muted">{profilePortfolio || "Belum diisi"}</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="font-semibold text-ink">Metode payout</div>
                <div className="mt-1 text-muted">
                  {profilePayoutMethod === "BANK_TRANSFER"
                    ? "Transfer bank"
                    : profilePayoutMethod === "EWALLET"
                      ? "E-wallet"
                      : "Belum dipilih"}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="font-semibold text-ink">Ringkasan payout</div>
                <div className="mt-1 break-all text-muted">{payoutSummary || "Belum diisi"}</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="font-semibold text-ink">Catatan payout</div>
                <div className="mt-1 whitespace-pre-wrap text-muted">
                  {profilePayoutNotes || "Tidak ada catatan tambahan"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 md:col-span-3">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <CircleDollarSign size={16} className="text-emerald-700" />
                  Update status payout
                </div>
                <div className="mt-2 text-sm text-muted">
                  Notifikasi ini muncul otomatis saat payout royalti kamu masuk tahap{" "}
                  <span className="font-semibold text-ink">PROCESSING</span> atau{" "}
                  <span className="font-semibold text-ink">PAID</span> dari ledger backend.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={unreadFinanceNotifications.length ? "warning" : "success"}>
                    {unreadFinanceNotifications.length
                      ? `${unreadFinanceNotifications.length} update payout belum dibaca`
                      : "Tidak ada update payout baru"}
                  </Badge>
                  {myFinanceNotifications[0] ? (
                    <Badge tone="neutral">
                      Update terbaru {new Date(myFinanceNotifications[0].createdAtISO).toLocaleString("id-ID")}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {unreadFinanceNotifications.length ? (
                <Button variant="secondary" onClick={handleMarkFinanceNotificationsRead}>
                  <CheckCheck size={16} />
                  Tandai Update Dibaca
                </Button>
              ) : null}
            </div>

            {financeNotificationMessage ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-muted">
                {financeNotificationMessage}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {myFinanceNotifications.length ? (
                myFinanceNotifications.slice(0, 6).map((notification) => (
                  <div key={notification.id} className="rounded-2xl border border-emerald-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-ink">{notification.title}</div>
                          <Badge tone={notification.eventStatus === "PAID" ? "success" : "brand"}>
                            {notification.eventStatus}
                          </Badge>
                          <Badge tone={notification.readAtISO ? "neutral" : "warning"}>
                            {notification.readAtISO ? "Sudah dibaca" : "Baru"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm text-muted">{notification.message}</div>
                        <div className="mt-2 text-xs text-muted">
                          {notification.sourceType === "PAID_BOOK" ? "Paid Book" : "Membership Pool"} •{" "}
                          {new Date(notification.createdAtISO).toLocaleString("id-ID")}
                        </div>
                        {notification.payoutReference ? (
                          <div className="mt-1 text-xs text-muted">
                            Referensi payout: {notification.payoutReference}
                          </div>
                        ) : null}
                        {notification.payoutNote ? (
                          <div className="mt-1 text-xs text-muted">
                            Catatan admin: {notification.payoutNote}
                          </div>
                        ) : null}
                      </div>

                      {!notification.readAtISO ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (!authorId) return;
                            markAuthorFinanceNotificationsRead({
                              authorId,
                              notificationIds: [notification.id],
                            });
                            setFinanceNotificationMessage(
                              `Update payout untuk ${notification.itemLabel} ditandai sudah dibaca.`
                            );
                          }}
                        >
                          <CheckCheck size={16} />
                          Tandai Dibaca
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-muted">
                  Belum ada update payout `PROCESSING` atau `PAID` untuk akun penulis ini.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-brand-2/5 p-6 md:col-span-3">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <BellRing size={16} className="text-brand-2" />
                  Notifikasi payout penulis
                </div>
                <div className="mt-2 text-sm text-muted">
                  Setiap slip payout yang diarsipkan admin akan muncul di portal penulis ini dan
                  bisa dibuka ulang kapan saja.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={unreadPayoutSlipArchives.length ? "warning" : "success"}>
                    {unreadPayoutSlipArchives.length
                      ? `${unreadPayoutSlipArchives.length} slip baru belum dibaca`
                      : "Tidak ada slip payout baru"}
                  </Badge>
                  {latestPayoutSlipArchive ? (
                    <Badge tone="neutral">
                      Arsip terbaru {latestPayoutSlipArchive.invoiceNumber}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {unreadPayoutSlipArchives.length ? (
                <Button variant="secondary" onClick={handleMarkPayoutNotificationsSeen}>
                  <CheckCheck size={16} />
                  Tandai Sudah Dibaca
                </Button>
              ) : null}
            </div>

            {payoutSlipMessage ? (
              <div className="mt-4 rounded-2xl border border-border bg-white p-4 text-sm text-muted">
                {payoutSlipMessage}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {unreadPayoutSlipArchives.length ? (
                unreadPayoutSlipArchives.slice(0, 3).map((archive) => (
                  <div key={archive.id} className="rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-ink">{archive.invoiceNumber}</div>
                        <div className="mt-1 text-xs text-muted">
                          Diterbitkan {new Date(archive.issuedAtISO).toLocaleString("id-ID")}
                        </div>
                      </div>
                      <Badge tone="warning">Baru</Badge>
                    </div>
                    <div className="mt-3 text-sm text-muted">
                      Total payout {formatIdrFromCents(archive.totalRoyaltyCents)} •{" "}
                      {archive.entryCount.toLocaleString("id-ID")} entri
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => {
                          void handleOpenPayoutSlipArchive(archive.id);
                        }}
                        disabled={payoutSlipOpeningId === archive.id}
                      >
                        <FileText size={16} />
                        {payoutSlipOpeningId === archive.id ? "Membuka..." : "Buka Slip"}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-white p-4 text-sm text-muted md:col-span-3">
                  Belum ada notifikasi slip payout baru. Jika admin mengarsipkan invoice payout,
                  notifikasinya akan muncul di sini.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs font-semibold text-muted">Draft aktif</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {totals.drafts.toLocaleString("id-ID")}
            </div>
            <div className="mt-1 text-sm text-muted">naskah yang masih kamu siapkan</div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs font-semibold text-muted">Sedang direview</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {totals.reviewing.toLocaleString("id-ID")}
            </div>
            <div className="mt-1 text-sm text-muted">naskah di review atau editing editorial</div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs font-semibold text-muted">Siap terbit</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {totals.ready.toLocaleString("id-ID")}
            </div>
            <div className="mt-1 text-sm text-muted">karya siap dibahas untuk terbit</div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs font-semibold text-muted">Perlu revisi</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {totals.revision.toLocaleString("id-ID")}
            </div>
            <div className="mt-1 text-sm text-muted">naskah menunggu perbaikan penulis</div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs font-semibold text-muted">Royalti tercatat</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {formatIdrFromCents(royaltySummary.authorTotalCents)}
            </div>
            <div className="mt-1 text-sm text-muted">
              dari {royaltySummary.salesCount.toLocaleString("id-ID")} transaksi sukses di ledger backend
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs font-semibold text-muted">Royalti siap dibayar</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {formatIdrFromCents(royaltySummary.availableRoyaltyCents)}
            </div>
            <div className="mt-1 text-sm text-muted">
              diproses {formatIdrFromCents(royaltySummary.processingRoyaltyCents)} • dibayar {formatIdrFromCents(royaltySummary.paidRoyaltyCents)}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs font-semibold text-muted">Membership pool tercatat</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {formatIdrFromCents(membershipPoolSummary.totalRoyaltyCents)}
            </div>
            <div className="mt-1 text-sm text-muted">
              dari {membershipPoolSummary.totalPages.toLocaleString("id-ID")} halaman baca membership
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs font-semibold text-muted">Membership siap dibayar</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {formatIdrFromCents(membershipPoolSummary.availableCents)}
            </div>
            <div className="mt-1 text-sm text-muted">
              diproses {formatIdrFromCents(membershipPoolSummary.processingCents)} • dibayar {formatIdrFromCents(membershipPoolSummary.paidCents)}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 md:col-span-2">
            <div className="text-sm font-semibold text-ink">Aktivitas terbaru</div>
            <div className="mt-4 space-y-4">
              {recentActivities.length ? (
                recentActivities.map((manuscript) => (
                  <div key={manuscript.id} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-ink">{manuscript.title}</div>
                        <div className="mt-1 text-xs text-muted">
                          {manuscript.category} • {manuscript.fileName}
                        </div>
                      </div>
                      <Badge
                        tone={getWorkflowTone(manuscript.status)}
                      >
                        {getWorkflowLabel(manuscript.status)}
                      </Badge>
                    </div>
                    {manuscript.adminNote ? (
                      <div className="mt-3 text-sm text-muted">{manuscript.adminNote}</div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted">Belum ada aktivitas naskah untuk akun ini.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="text-sm font-semibold text-ink">Ringkasan royalti</div>
            <div className="mt-2 text-sm text-muted">
              Ledger payout nyata dari transaksi buku paid yang sudah tercatat di backend.
            </div>
            <div className="mt-4 space-y-3">
              {royaltyRows.length ? (
                royaltyRows.slice(0, 3).map((row) => (
                  <div key={row.manuscript.id} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-sm font-semibold text-ink">{row.manuscript.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {row.directSaleEnabled
                        ? `Estimasi bersih per penjualan ${formatIdrFromCents(row.estimatedPerSale?.authorRoyaltyCents ?? 0)}`
                        : "Belum dijual satuan atau belum dipublish."}
                    </div>
                    <div className="mt-2 text-xs text-muted">
                      Royalti tercatat {formatIdrFromCents(row.authorTotalCents)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="brand">
                        Siap bayar {formatIdrFromCents(row.availableRoyaltyCents)}
                      </Badge>
                      <Badge tone="neutral">
                        Diproses {formatIdrFromCents(row.processingRoyaltyCents)}
                      </Badge>
                      <Badge tone="success">
                        Dibayar {formatIdrFromCents(row.paidRoyaltyCents)}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted">Belum ada naskah untuk dihitung royalti.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="text-sm font-semibold text-ink">Ringkasan membership pool</div>
            <div className="mt-2 text-sm text-muted">
              Pembagian pool membership dihitung dari progres baca nyata pembaca pada buku membership yang sesuai paket.
            </div>
            <div className="mt-4 space-y-3">
              {myMembershipRoyaltyEntries.length ? (
                myMembershipRoyaltyEntries.slice(0, 3).map((entry) => (
                  <div key={entry.entryId} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-ink">{entry.itemLabel}</div>
                        <div className="mt-1 text-xs text-muted">
                          Pool {entry.membershipPlan} • Order {entry.orderId}
                        </div>
                      </div>
                      <Badge tone={getRoyaltyLedgerTone(entry.status)}>
                        {getRoyaltyLedgerLabel(entry.status)}
                      </Badge>
                    </div>
                    <div className="mt-3 text-xs text-muted">
                      Royalti {formatIdrFromCents(entry.authorRoyaltyCents)} dari{" "}
                      {entry.allocationBasisPages.toLocaleString("id-ID")} halaman baca •
                      alokasi {(entry.allocationRatio * 100).toFixed(1)}%
                    </div>
                    {entry.payoutReference ? (
                      <div className="mt-2 text-[11px] text-muted">
                        Referensi payout: {entry.payoutReference}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted">
                  Belum ada pembagian membership pool untuk akun penulis ini.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="text-sm font-semibold text-ink">Ringkasan kerja sama</div>
            <div className="mt-2 text-sm text-muted">Status komunikasi awal dengan tim Naraloka.</div>
            <div className="mt-4 space-y-3">
              {myRequests.length ? (
                myRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-muted">Pengajuan kerja sama</div>
                      <Badge tone={request.status === "CONTACTED" ? "success" : "brand"}>{request.status}</Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-ink">{request.fullName}</div>
                    <div className="mt-1 text-xs text-muted">
                      {new Date(request.sentAtISO).toLocaleString("id-ID")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted">Belum ada pengajuan kerja sama yang tersimpan.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 md:col-span-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-ink">Arsip slip payout</div>
                <div className="mt-2 text-sm text-muted">
                  Arsip invoice payout resmi yang sudah dibuat admin untuk akun penulis ini.
                </div>
              </div>
              {latestPayoutSlipArchive ? (
                <div className="text-xs text-muted">
                  Arsip terbaru {latestPayoutSlipArchive.invoiceNumber} •{" "}
                  {new Date(latestPayoutSlipArchive.issuedAtISO).toLocaleString("id-ID")}
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {myPayoutSlipArchives.length ? (
                myPayoutSlipArchives.slice(0, 6).map((archive) => {
                  const isUnread = unreadPayoutSlipArchives.some((item) => item.id === archive.id);
                  return (
                    <div key={archive.id} className="rounded-2xl border border-border bg-surface p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-ink">
                              {archive.invoiceNumber}
                            </div>
                            <Badge tone={isUnread ? "warning" : "neutral"}>
                              {isUnread ? "Belum dibaca" : "Arsip"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            Diterbitkan {new Date(archive.issuedAtISO).toLocaleString("id-ID")} •
                            dibuat oleh {archive.generatedByName}
                          </div>
                          <div className="mt-2 text-sm text-muted">
                            Total {formatIdrFromCents(archive.totalRoyaltyCents)} • Paid book{" "}
                            {formatIdrFromCents(archive.paidBookRoyaltyCents)} • Membership{" "}
                            {formatIdrFromCents(archive.membershipRoyaltyCents)}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            Status saat arsip dibuat: siap bayar{" "}
                            {formatIdrFromCents(archive.availableCents)} • diproses{" "}
                            {formatIdrFromCents(archive.processingCents)} • dibayar{" "}
                            {formatIdrFromCents(archive.paidCents)}
                          </div>
                        </div>

                        <Button
                          variant={isUnread ? "primary" : "secondary"}
                          onClick={() => {
                            void handleOpenPayoutSlipArchive(archive.id);
                          }}
                          disabled={payoutSlipOpeningId === archive.id}
                        >
                          <FileText size={16} />
                          {payoutSlipOpeningId === archive.id ? "Membuka..." : "Buka Arsip Slip"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
                  Belum ada arsip slip payout untuk akun penulis ini.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "kerjasama" ? (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="text-sm font-semibold text-ink">Form pengajuan kerja sama</div>
          <div className="mt-2 text-sm text-muted">
            Isi data profil dan arah karya. Riwayat pengajuan akan tersimpan di akun penulis ini.
          </div>

          {proposalMessage ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {proposalMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Input value={proposalName} onChange={(e) => setProposalName(e.target.value)} placeholder="Nama penulis" />
            <Input value={proposalEmail} onChange={(e) => setProposalEmail(e.target.value)} placeholder="Email" />
            <Input value={proposalPhone} onChange={(e) => setProposalPhone(e.target.value)} placeholder="Nomor WhatsApp" />
            <Input value={proposalPortfolio} onChange={(e) => setProposalPortfolio(e.target.value)} placeholder="Link portofolio (opsional)" />
            <textarea
              className="md:col-span-2 min-h-28 w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
              value={proposalPitch}
              onChange={(e) => setProposalPitch(e.target.value)}
              placeholder="Ceritakan karya dan target pembaca…"
            />
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                if (!authorId || !proposalName.trim() || !proposalEmail.trim() || !proposalPitch.trim()) {
                  setProposalMessage("Nama, email, dan penjelasan karya wajib diisi.");
                  return;
                }
                submitCollaborationRequest({
                  authorId,
                  fullName: proposalName.trim(),
                  email: proposalEmail.trim(),
                  phone: proposalPhone.trim(),
                  portfolioUrl: proposalPortfolio.trim(),
                  pitch: proposalPitch.trim(),
                });
                setProposalMessage("Pengajuan kerja sama berhasil dikirim dan tersimpan di akun penulis.");
                setProposalPitch("");
              }}
            >
              <Handshake size={16} />
              Kirim Pengajuan
            </Button>
            <a href={supportWhatsAppUrl} className="sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto">
                <Phone size={16} />
                WhatsApp CS
              </Button>
            </a>
            <a href={supportEmailUrl} className="sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto">
                <Mail size={16} />
                Email
              </Button>
            </a>
          </div>
        </div>
      ) : null}

      {tab === "naskah" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="text-sm font-semibold text-ink">
              {editingDraft ? "Edit draft naskah" : "Kirim naskah"}
            </div>
            <div className="mt-2 text-sm text-muted">
              {editingDraft
                ? "Perbarui metadata draft, ganti file bila perlu, lalu simpan ulang atau kirim untuk review editor."
                : "Lengkapi metadata naskah, simpan sebagai draft, atau kirim untuk review editor."}
            </div>

            <div className="mt-5 grid gap-3">
              <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Judul naskah" />
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as BookCategory)}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-ink outline-none"
              >
                <option value="Novel">Novel</option>
                <option value="Edukasi">Edukasi</option>
                <option value="Motivasi">Motivasi</option>
                <option value="Cerpen">Cerpen</option>
                <option value="Komik Digital">Komik Digital</option>
              </select>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border file:border-border file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setUploadFile(f ?? null);
                  setUploadFileName(f?.name ?? "");
                }}
              />
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border file:border-border file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setUploadCoverFile(f ?? null);
                  setUploadCoverFileName(f?.name ?? "");
                }}
              />
              <div className="text-xs text-muted">
                {uploadFileName
                  ? `File naskah: ${uploadFile ? uploadFileName : `${uploadFileName} (tersimpan)`}`
                  : "Pilih file naskah PDF/DOCX."}
                <br />
                {uploadCoverFileName
                  ? `Cover manual dipilih: ${uploadCoverFileName}`
                  : "Opsional: unggah cover JPG/PNG/WEBP agar katalog tidak menunggu generate otomatis."}
              </div>
              <Input
                value={uploadAudience}
                onChange={(e) => setUploadAudience(e.target.value)}
                placeholder="Target pembaca, misalnya mahasiswa / pembaca fiksi urban"
              />
              <Input
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="Tag dipisahkan koma, misalnya romansa, kota, reflektif"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={uploadWordCount}
                  onChange={(e) => setUploadWordCount(e.target.value)}
                  placeholder="Perkiraan jumlah kata"
                />
                <Input
                  value={uploadPrice}
                  onChange={(e) => setUploadPrice(e.target.value)}
                  placeholder="Harga usulan (rupiah)"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-ink">Usulan akses</span>
                  <select
                    value={uploadSuggestedMonetization}
                    onChange={(e) =>
                      setUploadSuggestedMonetization(e.target.value as SuggestedMonetization)
                    }
                    className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-ink outline-none"
                  >
                    <option value="FREE">Gratis / Open</option>
                    <option value="MEMBERSHIP_PREMIUM">Membership Premium</option>
                    <option value="MEMBERSHIP_EDU">Membership Edukasi</option>
                    <option value="PAID">Paid / Beli Satuan</option>
                  </select>
                </label>
                <Input
                  value={uploadMonetizationNote}
                  onChange={(e) => setUploadMonetizationNote(e.target.value)}
                  placeholder="Catatan monetisasi untuk admin (opsional)"
                />
              </div>
              <textarea
                className="min-h-28 w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                value={uploadSynopsis}
                onChange={(e) => setUploadSynopsis(e.target.value)}
                placeholder="Sinopsis naskah"
              />
              {manuscriptMessage ? <div className="text-sm text-muted">{manuscriptMessage}</div> : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  onClick={() => {
                    void handleManuscriptAction("draft");
                  }}
                  disabled={isUploadingManuscript}
                >
                  <Save size={16} />
                  {isUploadingManuscript
                    ? "Mengunggah..."
                    : editingDraft
                      ? "Perbarui Draft"
                      : "Simpan Draft"}
                </Button>
                <Button
                  onClick={() => {
                    void handleManuscriptAction("submit");
                  }}
                  disabled={isUploadingManuscript}
                >
                  <FileUp size={16} />
                  {isUploadingManuscript
                    ? "Mengunggah..."
                    : editingDraft
                      ? "Perbarui & Kirim Review"
                      : "Kirim untuk Review"}
                </Button>
                {editingDraft ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      resetManuscriptForm();
                      setManuscriptMessage("Mode edit draft dibatalkan.");
                    }}
                    disabled={isUploadingManuscript}
                  >
                    Batal Edit
                  </Button>
                ) : null}
              </div>
              <div className="text-xs text-muted">
                Format file: DOCX/PDF, maksimal 20MB. File naskah akan diunggah ke storage Supabase.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="text-sm font-semibold text-ink">Daftar naskah</div>
            <div className="mt-4 space-y-3">
              {royaltyRows.length ? (
                royaltyRows.map((row) => {
                  const m = row.manuscript;
                  return (
                    <div key={m.id} className="rounded-2xl border border-border bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">{m.title}</div>
                          <div className="mt-1 text-xs text-muted">
                            {m.category} • {m.fileName}
                          </div>
                          {m.storagePath ? (
                            <div className="mt-1 text-xs text-muted">Storage aktif tersimpan</div>
                          ) : null}
                          {m.targetAudience ? (
                            <div className="mt-1 text-xs text-muted">Target: {m.targetAudience}</div>
                          ) : null}
                        </div>
                        <Badge
                          tone={getWorkflowTone(m.status)}
                        >
                          {getWorkflowLabel(m.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="brand">
                          {getSuggestedMonetizationLabel(m.suggestedMonetization)}
                        </Badge>
                        <Badge
                          tone={
                            row.decisionStatus === "ACCEPTED"
                              ? "success"
                              : row.decisionStatus === "ADJUSTED"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {getDecisionStatusLabel(row.decisionStatus)}
                        </Badge>
                        {m.publishedAtISO ? <Badge tone="brand">PUBLISHED</Badge> : null}
                        {row.directSaleEnabled ? <Badge tone="success">Buku berbayar</Badge> : null}
                        {m.coverPublicUrl ? <Badge tone="success">Cover Manual</Badge> : null}
                      </div>
                      {m.status === "DRAFT" ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              handleEditDraft(m.id);
                            }}
                          >
                            <Save size={16} />
                            Edit Draft
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              void handleDeleteManuscript(m.id);
                            }}
                            disabled={Boolean(deleteLoadingById[m.id])}
                          >
                            <Trash2 size={16} />
                            {deleteLoadingById[m.id] ? "Menghapus..." : "Hapus Draft"}
                          </Button>
                        </div>
                      ) : null}
                      {m.publishedAtISO ? (
                        <div className="mt-3">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              void handleDeleteManuscript(m.id);
                            }}
                            disabled={Boolean(deleteLoadingById[m.id])}
                          >
                            <Trash2 size={16} />
                            {deleteLoadingById[m.id] ? "Menghapus..." : "Hapus Buku Publish"}
                          </Button>
                        </div>
                      ) : null}
                      {deleteMessagesById[m.id] ? (
                        <div className="mt-2 text-xs text-muted">{deleteMessagesById[m.id]}</div>
                      ) : null}
                      <div className="mt-3 flex items-start gap-4">
                        <div className="h-32 w-24 overflow-hidden rounded-2xl border border-border bg-white">
                          {m.coverPublicUrl ? (
                            <img
                              src={m.coverPublicUrl}
                              alt={`Cover ${m.title}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
                              Belum ada cover manual
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 rounded-2xl border border-border bg-white p-4">
                          <div className="text-xs font-semibold text-muted">Cover buku</div>
                          <div className="mt-2 text-xs text-muted">
                            Unggah cover manual supaya katalog memakai gambar ini dan tidak menunggu generate otomatis.
                          </div>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                            className="mt-3 block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border file:border-border file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              setCoverFilesById((state) => ({
                                ...state,
                                [m.id]: file,
                              }));
                            }}
                          />
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                void handleUploadCoverForManuscript(m.id);
                              }}
                              disabled={Boolean(coverLoadingById[m.id])}
                            >
                              <FileUp size={16} />
                              {coverLoadingById[m.id] ? "Mengunggah Cover..." : "Simpan Cover Manual"}
                            </Button>
                            <div className="text-xs text-muted">
                              {coverFilesById[m.id]
                                ? `File cover dipilih: ${coverFilesById[m.id]?.name}`
                                : "Format JPG/PNG/WEBP, maksimal 5MB."}
                            </div>
                          </div>
                          {coverMessagesById[m.id] ? (
                            <div className="mt-2 text-xs text-muted">{coverMessagesById[m.id]}</div>
                          ) : null}
                        </div>
                      </div>
                      {m.adminNote ? (
                        <div className="mt-3 text-sm text-muted">{m.adminNote}</div>
                      ) : null}
                      {m.status === "NEEDS_REVISION" ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="text-xs font-semibold text-amber-900">
                            Kirim ulang revisi penulis
                          </div>
                          <div className="mt-2 text-xs text-amber-800">
                            Unggah file revisi bila ada versi terbaru, lalu kirim ulang agar naskah
                            kembali masuk antrean editorial.
                          </div>
                          <div className="mt-3 grid gap-3">
                            <textarea
                              className="min-h-24 w-full resize-none rounded-2xl border border-amber-200 bg-white p-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                              value={revisionNotesById[m.id] ?? ""}
                              onChange={(e) =>
                                setRevisionNotesById((state) => ({
                                  ...state,
                                  [m.id]: e.target.value,
                                }))
                              }
                              placeholder="Catatan revisi untuk editor, misalnya bab 3 diperjelas, typo diperbaiki, dan ending direvisi."
                            />
                            <input
                              type="file"
                              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border file:border-amber-200 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-amber-100"
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setRevisionFilesById((state) => ({
                                  ...state,
                                  [m.id]: file,
                                }));
                              }}
                            />
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Button
                                onClick={() => {
                                  void handleResubmitRevision(m.id);
                                }}
                                disabled={Boolean(revisionLoadingById[m.id])}
                              >
                                <FileUp size={16} />
                                {revisionLoadingById[m.id]
                                  ? "Mengirim Revisi..."
                                  : "Kirim Ulang Revisi"}
                              </Button>
                              <div className="text-xs text-amber-900">
                                {revisionFilesById[m.id]
                                  ? `File baru dipilih: ${revisionFilesById[m.id]?.name}`
                                  : "Jika tidak ada file baru, sistem memakai file storage sebelumnya."}
                              </div>
                            </div>
                            {revisionMessagesById[m.id] ? (
                              <div className="text-xs text-amber-900">
                                {revisionMessagesById[m.id]}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {m.synopsis ? (
                        <div className="mt-3 text-sm text-muted line-clamp-3">{m.synopsis}</div>
                      ) : null}
                      {m.monetizationNote ? (
                        <div className="mt-3 text-sm text-muted">
                          Catatan monetisasi: {m.monetizationNote}
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-2xl border border-border bg-white p-4">
                        <div className="text-xs font-semibold text-muted">Histori review editor</div>
                        <div className="mt-3 space-y-2">
                          {(reviewEntriesByManuscript[m.id] ?? []).length ? (
                            (reviewEntriesByManuscript[m.id] ?? []).slice(0, 4).map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-xl border border-border bg-surface p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-xs font-semibold text-ink">
                                    {entry.reviewerName}
                                  </div>
                                  <Badge
                                    tone={entry.decision === "COMMENT" ? "neutral" : getWorkflowTone(entry.decision)}
                                  >
                                    {getReviewDecisionLabel(entry.decision)}
                                  </Badge>
                                </div>
                                <div className="mt-2 text-xs text-muted">{entry.note}</div>
                                <div className="mt-2 text-[11px] text-muted">
                                  {new Date(entry.createdAtISO).toLocaleString("id-ID")}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-muted">
                              Belum ada histori review editor untuk naskah ini.
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-white p-4 md:col-span-2">
                          <div className="text-xs font-semibold text-muted">
                            Hasil publish dibanding usulan
                          </div>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="text-xs text-muted">Usulan penulis</div>
                              <div className="mt-1 text-sm font-semibold text-ink">
                                {getSuggestedMonetizationLabel(m.suggestedMonetization)}
                              </div>
                              {m.suggestedMonetization === "PAID" && m.priceCents ? (
                                <div className="mt-1 text-xs text-muted">
                                  Harga usulan {formatIdrFromCents(m.priceCents)}
                                </div>
                              ) : null}
                            </div>
                            <div>
                              <div className="text-xs text-muted">Hasil akhir publish</div>
                              <div className="mt-1 text-sm font-semibold text-ink">
                                {getPublishedAccessLabel(
                                  m.publishedAccess,
                                  m.publishedRequiredPlan
                                )}
                              </div>
                              {m.publishedAccess === "PAID" &&
                              typeof m.publishedPriceCents === "number" ? (
                                <div className="mt-1 text-xs text-muted">
                                  Harga publish {formatIdrFromCents(m.publishedPriceCents)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-white p-4">
                          <div className="text-xs font-semibold text-muted">Estimasi per penjualan</div>
                          <div className="mt-2 text-sm font-semibold text-ink">
                            {row.directSaleEnabled && row.estimatedPerSale
                              ? formatIdrFromCents(row.estimatedPerSale.authorRoyaltyCents)
                              : "Belum tersedia"}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            {row.directSaleEnabled && row.estimatedPerSale
                              ? `Kotor ${formatIdrFromCents(row.estimatedPerSale.grossAmountCents)} • Komisi ${row.estimatedPerSale.platformCommissionPct}%`
                              : "Muncul setelah buku dipublish sebagai buku berbayar."}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-white p-4">
                          <div className="text-xs font-semibold text-muted">Royalti terealisasi</div>
                          <div className="mt-2 text-sm font-semibold text-emerald-700">
                            {formatIdrFromCents(row.authorTotalCents)}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            {row.salesCount
                              ? `${row.salesCount} transaksi sukses • Komisi platform ${formatIdrFromCents(row.platformTotalCents)}`
                              : "Belum ada transaksi buku sukses untuk naskah ini."}
                          </div>
                          {row.latestRoyaltyEntry ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Badge tone={getRoyaltyLedgerTone(row.latestRoyaltyEntry.status)}>
                                {getRoyaltyLedgerLabel(row.latestRoyaltyEntry.status)}
                              </Badge>
                              <div className="text-[11px] text-muted">
                                Order {row.latestRoyaltyEntry.orderId}
                              </div>
                            </div>
                          ) : null}
                          {row.latestRoyaltyEntry?.payoutReference ? (
                            <div className="mt-2 text-[11px] text-muted">
                              Referensi payout: {row.latestRoyaltyEntry.payoutReference}
                            </div>
                          ) : null}
                          {row.latestRoyaltyEntry?.payoutNote ? (
                            <div className="mt-1 text-[11px] text-muted">
                              Catatan payout: {row.latestRoyaltyEntry.payoutNote}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.tags?.map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted">Belum ada pengajuan.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
