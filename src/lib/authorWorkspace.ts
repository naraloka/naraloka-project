import { t2i } from "@/utils/image";
import {
  buildPublishedManuscriptPages,
  estimatePublishedManuscriptPageCount,
} from "@/lib/publishedManuscript";
import { getReadableSupabaseError, supabase } from "@/lib/supabase";
import type {
  AuthorPayoutMethod,
  AuthorWorkspaceProfile,
  CollaborationRequest,
  CollaborationStatus,
  Manuscript,
  ManuscriptReviewDecision,
  ManuscriptReviewEntry,
  ManuscriptStatus,
  SuggestedMonetization,
} from "@/stores/publishingStore";
import type { BookAccess, BookCategory, Ebook, MembershipPlan, UserRole } from "@/types/domain";

type AuthorProfileRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  portfolio_url: string | null;
  payout_account: string | null;
  payout_method: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  ewallet_provider: string | null;
  ewallet_account_name: string | null;
  ewallet_account_number: string | null;
  payout_notes: string | null;
  specialty: string | null;
  updated_at: string | null;
};

type CollaborationRequestRow = {
  id: string;
  author_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  portfolio_url: string | null;
  pitch: string;
  status: string;
  sent_at: string | null;
};

type ManuscriptRow = {
  id: string;
  author_id: string;
  author_display_name: string | null;
  title: string;
  category: string;
  file_name: string;
  storage_bucket: string | null;
  storage_path: string | null;
  storage_mime_type: string | null;
  storage_size_bytes: number | null;
  storage_uploaded_at: string | null;
  cover_storage_bucket: string | null;
  cover_storage_path: string | null;
  cover_storage_mime_type: string | null;
  cover_storage_size_bytes: number | null;
  cover_storage_uploaded_at: string | null;
  cover_public_url: string | null;
  submitted_at: string | null;
  status: string;
  admin_note: string | null;
  synopsis: string | null;
  target_audience: string | null;
  tags: unknown;
  word_count: number | null;
  price_cents: number | null;
  suggested_monetization: string | null;
  monetization_note: string | null;
  updated_at: string | null;
  published_ebook_id: string | null;
  published_at: string | null;
  published_access: string | null;
  published_required_plan: string | null;
  published_price_cents: number | null;
  published_is_featured: boolean | null;
  published_is_best_seller: boolean | null;
};

type AuthorWorkspaceSnapshot = {
  authorProfilesByUser: Record<string, AuthorWorkspaceProfile>;
  collaborationRequests: CollaborationRequest[];
  manuscripts: Manuscript[];
  reviewEntriesByManuscript: Record<string, ManuscriptReviewEntry[]>;
  publishedEbooks: Ebook[];
};

type ManuscriptReviewRow = {
  id: string;
  manuscript_id: string;
  reviewer_id: string;
  reviewer_name: string;
  decision: string;
  note: string;
  created_at: string | null;
};

function emptySnapshot(): AuthorWorkspaceSnapshot {
  return {
    authorProfilesByUser: {},
    collaborationRequests: [],
    manuscripts: [],
    reviewEntriesByManuscript: {},
    publishedEbooks: [],
  };
}

function normalizeBookCategory(value: unknown): BookCategory {
  if (
    value === "Novel" ||
    value === "Edukasi" ||
    value === "Motivasi" ||
    value === "Cerpen" ||
    value === "Komik Digital"
  ) {
    return value;
  }

  return "Novel";
}

function normalizeManuscriptStatus(value: unknown): ManuscriptStatus {
  if (
    value === "SUBMITTED" ||
    value === "IN_REVIEW" ||
    value === "NEEDS_REVISION" ||
    value === "IN_EDITING" ||
    value === "READY_TO_PUBLISH" ||
    value === "REJECTED" ||
    value === "APPROVED"
  ) {
    return value === "APPROVED" ? "READY_TO_PUBLISH" : value;
  }
  return "DRAFT";
}

function normalizeCollaborationStatus(value: unknown): CollaborationStatus {
  if (value === "REVIEWING" || value === "CONTACTED") return value;
  return "SENT";
}

function normalizeSuggestedMonetization(value: unknown): SuggestedMonetization | undefined {
  if (
    value === "FREE" ||
    value === "MEMBERSHIP_PREMIUM" ||
    value === "MEMBERSHIP_EDU" ||
    value === "PAID"
  ) {
    return value;
  }

  return undefined;
}

function normalizeBookAccess(value: unknown): BookAccess | undefined {
  if (value === "OPEN" || value === "MEMBERSHIP" || value === "PAID") return value;
  return undefined;
}

function normalizeMembershipPlan(value: unknown): MembershipPlan | undefined {
  if (value === "FREE" || value === "PREMIUM" || value === "EDU") return value;
  return undefined;
}

function normalizeAuthorPayoutMethod(value: unknown): AuthorPayoutMethod | undefined {
  if (value === "BANK_TRANSFER" || value === "EWALLET") return value;
  return undefined;
}

function normalizeReviewDecision(value: unknown): ManuscriptReviewDecision {
  if (
    value === "APPROVED" ||
    value === "REJECTED" ||
    value === "IN_REVIEW" ||
    value === "NEEDS_REVISION" ||
    value === "IN_EDITING" ||
    value === "READY_TO_PUBLISH"
  ) {
    return value === "APPROVED" ? "READY_TO_PUBLISH" : value;
  }
  return "COMMENT";
}

function ensureStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.map((item) => String(item).trim()).filter(Boolean);
  return list.length ? list : undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function buildAuthorPayoutSummary(profile: {
  payoutMethod?: AuthorPayoutMethod;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  ewalletProvider?: string;
  ewalletAccountName?: string;
  ewalletAccountNumber?: string;
}) {
  if (profile.payoutMethod === "BANK_TRANSFER") {
    const parts = [profile.bankName, profile.bankAccountName, profile.bankAccountNumber]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return parts.join(" - ");
  }

  if (profile.payoutMethod === "EWALLET") {
    const parts = [profile.ewalletProvider, profile.ewalletAccountName, profile.ewalletAccountNumber]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return parts.join(" - ");
  }

  return "";
}

const authorManuscriptBucket =
  import.meta.env.VITE_SUPABASE_AUTHOR_MANUSCRIPT_BUCKET || "author-manuscripts";
const authorManuscriptCoverBucket = "author-manuscript-covers";
const authorProfileAvatarBucket = "author-profile-media";

function sanitizeFileName(name: string) {
  const [base, ...extParts] = name.trim().split(".");
  const safeBase = base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-") || "manuscript";
  const safeExt = extParts.join(".").toLowerCase().replace(/[^a-z0-9.]+/g, "");
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function getFileExtension(name: string) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(name);
  return match?.[1]?.toLowerCase() || "";
}

function assertSupportedManuscriptFile(file: File) {
  const extension = getFileExtension(file.name);
  const allowedExtensions = new Set(["pdf", "docx"]);
  const allowedMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  if (!allowedExtensions.has(extension) && !allowedMimeTypes.has(file.type)) {
    throw new Error("Format naskah harus PDF atau DOCX.");
  }

  const maxSizeBytes = 20 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error("Ukuran file naskah maksimal 20MB.");
  }
}

function assertSupportedCoverImage(file: File) {
  const extension = getFileExtension(file.name);
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (!allowedExtensions.has(extension) && !allowedMimeTypes.has(file.type)) {
    throw new Error("Format cover harus JPG, PNG, atau WEBP.");
  }

  const maxSizeBytes = 5 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error("Ukuran cover maksimal 5MB.");
  }
}

function assertSupportedAuthorAvatar(file: File) {
  const extension = getFileExtension(file.name);
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (!allowedExtensions.has(extension) && !allowedMimeTypes.has(file.type)) {
    throw new Error("Format foto profil penulis harus JPG, PNG, atau WEBP.");
  }

  const maxSizeBytes = 2 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error("Ukuran foto profil penulis maksimal 2MB.");
  }
}

function manuscriptToPublishedEbook(manuscript: Manuscript, authorDisplayName?: string): Ebook | null {
  if (!manuscript.publishedAtISO || !manuscript.publishedAccess) return null;

  const pageCount = estimatePublishedManuscriptPageCount(manuscript);
  const title = manuscript.title.trim();
  const synopsis = manuscript.synopsis?.trim() || "Karya baru dari portal penulis Naraloka.";
  const coverPrompt = `Book cover for Indonesian ${manuscript.category.toLowerCase()} titled ${title}, author ${authorDisplayName || "Naraloka author"}, clean editorial composition, realistic printed cover, premium bookstore quality`;
  const generatedPages = buildPublishedManuscriptPages({
    manuscript,
    authorDisplayName,
    pageCount,
  });

  return {
    id: manuscript.publishedEbookId || `pub_${manuscript.id}`,
    title,
    authorId: manuscript.authorId,
    coverUrl: manuscript.coverPublicUrl || t2i(coverPrompt, "portrait_16_9"),
    category: manuscript.category,
    description: synopsis,
    ratingAvg: 0,
    ratingCount: 0,
    priceCents:
      manuscript.publishedAccess === "PAID"
        ? Math.max(0, manuscript.publishedPriceCents ?? manuscript.priceCents ?? 0)
        : 0,
    access: manuscript.publishedAccess,
    requiredPlan:
      manuscript.publishedAccess === "MEMBERSHIP" ? manuscript.publishedRequiredPlan : undefined,
    isBestSeller: Boolean(manuscript.publishedIsBestSeller),
    isFeatured: Boolean(manuscript.publishedIsFeatured),
    publishedAtISO: manuscript.publishedAtISO,
    pageCount,
    tags: manuscript.tags?.length ? manuscript.tags : [manuscript.category, "Karya Baru"],
    previewPages: generatedPages.previewPages,
    pages: generatedPages.pages,
    sourceFileName: manuscript.fileName || undefined,
    sourceStorageBucket: manuscript.storageBucket,
    sourceStoragePath: manuscript.storagePath,
    sourceMimeType: manuscript.storageMimeType,
  };
}

function mapAuthorProfileRow(row: AuthorProfileRow): AuthorWorkspaceProfile {
  const payoutMethod = normalizeAuthorPayoutMethod(row.payout_method);
  const hasStructuredPayout = Boolean(
    payoutMethod ||
      row.bank_name ||
      row.bank_account_name ||
      row.bank_account_number ||
      row.ewallet_provider ||
      row.ewallet_account_name ||
      row.ewallet_account_number
  );
  const payoutSummary =
    row.payout_account ||
    buildAuthorPayoutSummary({
      payoutMethod,
      bankName: row.bank_name || "",
      bankAccountName: row.bank_account_name || "",
      bankAccountNumber: row.bank_account_number || "",
      ewalletProvider: row.ewallet_provider || "",
      ewalletAccountName: row.ewallet_account_name || "",
      ewalletAccountNumber: row.ewallet_account_number || "",
    });

  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || undefined,
    bio: row.bio || "",
    phone: row.phone || "",
    portfolioUrl: row.portfolio_url || "",
    payoutAccount: payoutSummary,
    payoutMethod,
    bankName: row.bank_name || "",
    bankAccountName: row.bank_account_name || "",
    bankAccountNumber: row.bank_account_number || "",
    bankBranch: row.bank_branch || "",
    ewalletProvider: row.ewallet_provider || "",
    ewalletAccountName: row.ewallet_account_name || "",
    ewalletAccountNumber: row.ewallet_account_number || "",
    payoutNotes: row.payout_notes || (!hasStructuredPayout ? row.payout_account || "" : ""),
    specialty: row.specialty || "",
    updatedAtISO: row.updated_at || nowIso(),
  };
}

function mapCollaborationRequestRow(row: CollaborationRequestRow): CollaborationRequest {
  return {
    id: row.id,
    authorId: row.author_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || "",
    portfolioUrl: row.portfolio_url || "",
    pitch: row.pitch,
    status: normalizeCollaborationStatus(row.status),
    sentAtISO: row.sent_at || nowIso(),
  };
}

function mapReviewEntryRow(row: ManuscriptReviewRow): ManuscriptReviewEntry {
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    decision: normalizeReviewDecision(row.decision),
    note: row.note,
    createdAtISO: row.created_at || nowIso(),
  };
}

function mapManuscriptRow(row: ManuscriptRow): Manuscript {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    authorDisplayName: row.author_display_name || undefined,
    category: normalizeBookCategory(row.category),
    fileName: row.file_name,
    storageBucket: row.storage_bucket || undefined,
    storagePath: row.storage_path || undefined,
    storageMimeType: row.storage_mime_type || undefined,
    storageSizeBytes: row.storage_size_bytes ?? undefined,
    storageUploadedAtISO: row.storage_uploaded_at || undefined,
    coverStorageBucket: row.cover_storage_bucket || undefined,
    coverStoragePath: row.cover_storage_path || undefined,
    coverStorageMimeType: row.cover_storage_mime_type || undefined,
    coverStorageSizeBytes: row.cover_storage_size_bytes ?? undefined,
    coverStorageUploadedAtISO: row.cover_storage_uploaded_at || undefined,
    coverPublicUrl: row.cover_public_url || undefined,
    submittedAtISO: row.submitted_at || nowIso(),
    status: normalizeManuscriptStatus(row.status),
    adminNote: row.admin_note || undefined,
    synopsis: row.synopsis || undefined,
    targetAudience: row.target_audience || undefined,
    tags: ensureStringArray(row.tags),
    wordCount: row.word_count ?? undefined,
    priceCents: row.price_cents ?? undefined,
    suggestedMonetization: normalizeSuggestedMonetization(row.suggested_monetization),
    monetizationNote: row.monetization_note || undefined,
    updatedAtISO: row.updated_at || undefined,
    publishedEbookId: row.published_ebook_id || undefined,
    publishedAtISO: row.published_at || undefined,
    publishedAccess: normalizeBookAccess(row.published_access),
    publishedRequiredPlan: normalizeMembershipPlan(row.published_required_plan),
    publishedPriceCents: row.published_price_cents ?? undefined,
    publishedIsFeatured: Boolean(row.published_is_featured),
    publishedIsBestSeller: Boolean(row.published_is_best_seller),
  };
}

function reportWorkspaceError(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  console.error(`[author-workspace] ${action}: ${message}`);
}

export async function fetchAuthorWorkspaceSnapshot(params: {
  userId: string;
  role: UserRole;
}) {
  if (!supabase || !params.userId.trim()) {
    return { error: "", data: emptySnapshot() };
  }

  const isAdmin = params.role === "ADMIN";
  const [profilesResult, publishedResult, manuscriptResult, collaborationResult] = await Promise.all([
    (isAdmin
      ? supabase!
          .from("author_workspace_profiles")
          .select(
            "user_id,display_name,avatar_url,bio,phone,portfolio_url,payout_account,payout_method,bank_name,bank_account_name,bank_account_number,bank_branch,ewallet_provider,ewallet_account_name,ewallet_account_number,payout_notes,specialty,updated_at"
          )
      : supabase!
          .from("author_workspace_profiles")
          .select(
            "user_id,display_name,avatar_url,bio,phone,portfolio_url,payout_account,payout_method,bank_name,bank_account_name,bank_account_number,bank_branch,ewallet_provider,ewallet_account_name,ewallet_account_number,payout_notes,specialty,updated_at"
          )
          .eq("user_id", params.userId)),
    supabase!
      .from("author_manuscripts")
      .select(
        "id,author_id,author_display_name,title,category,file_name,storage_bucket,storage_path,storage_mime_type,storage_size_bytes,storage_uploaded_at,cover_storage_bucket,cover_storage_path,cover_storage_mime_type,cover_storage_size_bytes,cover_storage_uploaded_at,cover_public_url,submitted_at,status,admin_note,synopsis,target_audience,tags,word_count,price_cents,suggested_monetization,monetization_note,updated_at,published_ebook_id,published_at,published_access,published_required_plan,published_price_cents,published_is_featured,published_is_best_seller"
      )
      .not("published_at", "is", null),
    (isAdmin
      ? supabase!.from("author_manuscripts").select(
          "id,author_id,author_display_name,title,category,file_name,storage_bucket,storage_path,storage_mime_type,storage_size_bytes,storage_uploaded_at,cover_storage_bucket,cover_storage_path,cover_storage_mime_type,cover_storage_size_bytes,cover_storage_uploaded_at,cover_public_url,submitted_at,status,admin_note,synopsis,target_audience,tags,word_count,price_cents,suggested_monetization,monetization_note,updated_at,published_ebook_id,published_at,published_access,published_required_plan,published_price_cents,published_is_featured,published_is_best_seller"
        )
      : supabase!
          .from("author_manuscripts")
          .select(
            "id,author_id,author_display_name,title,category,file_name,storage_bucket,storage_path,storage_mime_type,storage_size_bytes,storage_uploaded_at,cover_storage_bucket,cover_storage_path,cover_storage_mime_type,cover_storage_size_bytes,cover_storage_uploaded_at,cover_public_url,submitted_at,status,admin_note,synopsis,target_audience,tags,word_count,price_cents,suggested_monetization,monetization_note,updated_at,published_ebook_id,published_at,published_access,published_required_plan,published_price_cents,published_is_featured,published_is_best_seller"
          )
          .eq("author_id", params.userId)),
    (isAdmin
      ? supabase!
          .from("author_collaboration_requests")
          .select("id,author_id,full_name,email,phone,portfolio_url,pitch,status,sent_at")
      : supabase!
          .from("author_collaboration_requests")
          .select("id,author_id,full_name,email,phone,portfolio_url,pitch,status,sent_at")
          .eq("author_id", params.userId)),
  ]);

  const firstError =
    profilesResult.error ||
    publishedResult.error ||
    manuscriptResult.error ||
    collaborationResult.error;

  if (firstError) {
    return {
      error: getReadableSupabaseError(firstError.message),
      data: emptySnapshot(),
    };
  }

  const authorProfilesByUser = Object.fromEntries(
    ((profilesResult.data ?? []) as AuthorProfileRow[]).map((row) => {
      const profile = mapAuthorProfileRow(row);
      return [profile.userId, profile];
    })
  );

  const mergedManuscripts = new Map<string, Manuscript>();
  for (const row of (publishedResult.data ?? []) as ManuscriptRow[]) {
    const manuscript = mapManuscriptRow(row);
    mergedManuscripts.set(manuscript.id, manuscript);
  }
  for (const row of (manuscriptResult.data ?? []) as ManuscriptRow[]) {
    const manuscript = mapManuscriptRow(row);
    mergedManuscripts.set(manuscript.id, manuscript);
  }

  const manuscripts = [...mergedManuscripts.values()].sort(
    (a, b) =>
      +new Date(b.updatedAtISO ?? b.submittedAtISO) - +new Date(a.updatedAtISO ?? a.submittedAtISO)
  );
  const readableManuscriptIds = manuscripts.map((manuscript) => manuscript.id);
  const collaborationRequests = ((collaborationResult.data ?? []) as CollaborationRequestRow[])
    .map(mapCollaborationRequestRow)
    .sort((a, b) => +new Date(b.sentAtISO) - +new Date(a.sentAtISO));
  const reviewQuery = supabase!
    .from("author_manuscript_reviews")
    .select("id,manuscript_id,reviewer_id,reviewer_name,decision,note,created_at")
    .order("created_at", { ascending: false });
  const reviewResult =
    isAdmin || readableManuscriptIds.length === 0
      ? await (isAdmin ? reviewQuery : Promise.resolve({ data: [], error: null }))
      : await reviewQuery.in("manuscript_id", readableManuscriptIds);

  if (reviewResult.error) {
    return {
      error: getReadableSupabaseError(reviewResult.error.message),
      data: emptySnapshot(),
    };
  }

  const reviewEntriesByManuscript = ((reviewResult.data ?? []) as ManuscriptReviewRow[]).reduce<
    Record<string, ManuscriptReviewEntry[]>
  >((acc, row) => {
    const entry = mapReviewEntryRow(row);
    acc[entry.manuscriptId] = [...(acc[entry.manuscriptId] ?? []), entry].sort(
      (a, b) => +new Date(b.createdAtISO) - +new Date(a.createdAtISO)
    );
    return acc;
  }, {});
  const publishedEbooks = manuscripts
    .map((manuscript) =>
      manuscriptToPublishedEbook(
        manuscript,
        manuscript.authorDisplayName || authorProfilesByUser[manuscript.authorId]?.displayName
      )
    )
    .filter((ebook): ebook is Ebook => Boolean(ebook));

  return {
    error: "",
    data: {
      authorProfilesByUser,
      collaborationRequests,
      manuscripts,
      reviewEntriesByManuscript,
      publishedEbooks,
    },
  };
}

export async function fetchPublicAuthorWorkspaceSnapshot() {
  if (!supabase) {
    return { error: "", data: emptySnapshot() };
  }

  const publishedResult = await supabase!
    .from("author_manuscripts")
    .select(
      "id,author_id,author_display_name,title,category,file_name,storage_bucket,storage_path,storage_mime_type,storage_size_bytes,storage_uploaded_at,cover_storage_bucket,cover_storage_path,cover_storage_mime_type,cover_storage_size_bytes,cover_storage_uploaded_at,cover_public_url,submitted_at,status,admin_note,synopsis,target_audience,tags,word_count,price_cents,suggested_monetization,monetization_note,updated_at,published_ebook_id,published_at,published_access,published_required_plan,published_price_cents,published_is_featured,published_is_best_seller"
    )
    .not("published_at", "is", null);

  if (publishedResult.error) {
    return {
      error: getReadableSupabaseError(publishedResult.error.message),
      data: emptySnapshot(),
    };
  }

  const manuscripts = ((publishedResult.data ?? []) as ManuscriptRow[])
    .map(mapManuscriptRow)
    .sort(
      (a, b) =>
        +new Date(b.updatedAtISO ?? b.submittedAtISO) - +new Date(a.updatedAtISO ?? a.submittedAtISO)
    );
  const publishedEbooks = manuscripts
    .map((manuscript) => manuscriptToPublishedEbook(manuscript, manuscript.authorDisplayName))
    .filter((ebook): ebook is Ebook => Boolean(ebook));

  return {
    error: "",
    data: {
      authorProfilesByUser: {},
      collaborationRequests: [],
      manuscripts,
      reviewEntriesByManuscript: {},
      publishedEbooks,
    },
  };
}

export async function persistAuthorProfile(profile: Omit<AuthorWorkspaceProfile, "updatedAtISO"> | AuthorWorkspaceProfile) {
  if (!supabase || !profile.userId.trim()) return;

  const payoutSummary =
    profile.payoutAccount ||
    buildAuthorPayoutSummary({
      payoutMethod: profile.payoutMethod,
      bankName: profile.bankName,
      bankAccountName: profile.bankAccountName,
      bankAccountNumber: profile.bankAccountNumber,
      ewalletProvider: profile.ewalletProvider,
      ewalletAccountName: profile.ewalletAccountName,
      ewalletAccountNumber: profile.ewalletAccountNumber,
    });

  const { error } = await supabase!.from("author_workspace_profiles").upsert(
    {
      user_id: profile.userId,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl ?? null,
      bio: profile.bio,
      phone: profile.phone,
      portfolio_url: profile.portfolioUrl,
      payout_account: payoutSummary || null,
      payout_method: profile.payoutMethod ?? null,
      bank_name: profile.bankName || null,
      bank_account_name: profile.bankAccountName || null,
      bank_account_number: profile.bankAccountNumber || null,
      bank_branch: profile.bankBranch || null,
      ewallet_provider: profile.ewalletProvider || null,
      ewallet_account_name: profile.ewalletAccountName || null,
      ewallet_account_number: profile.ewalletAccountNumber || null,
      payout_notes: profile.payoutNotes || null,
      specialty: profile.specialty,
      updated_at: nowIso(),
    },
    { onConflict: "user_id", ignoreDuplicates: false }
  );

  if (error) throw error;
}

export async function uploadAuthorProfileAvatar(params: { userId: string; file: File }) {
  if (!supabase || !params.userId.trim()) {
    throw new Error("Supabase belum terhubung untuk upload foto profil penulis.");
  }

  assertSupportedAuthorAvatar(params.file);

  const storagePath = `${params.userId}/author-avatar`;
  const uploadResult = await supabase.storage
    .from(authorProfileAvatarBucket)
    .upload(storagePath, params.file, {
      upsert: true,
      contentType: params.file.type || undefined,
      cacheControl: "3600",
    });

  if (uploadResult.error) {
    throw new Error(getReadableSupabaseError(uploadResult.error.message));
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(authorProfileAvatarBucket).getPublicUrl(storagePath);

  return {
    storageBucket: authorProfileAvatarBucket,
    storagePath,
    publicUrl: `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`,
  };
}

export async function createCollaborationRequest(
  input: Omit<CollaborationRequest, "sentAtISO" | "status">
) {
  if (!supabase || !input.authorId.trim()) return;

  const { error } = await supabase!.from("author_collaboration_requests").insert({
    id: input.id,
    author_id: input.authorId,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    portfolio_url: input.portfolioUrl,
    pitch: input.pitch,
    status: "SENT",
    sent_at: nowIso(),
  });

  if (error) throw error;
}

export async function uploadAuthorManuscriptFile(params: {
  userId: string;
  manuscriptId?: string;
  file: File;
}) {
  if (!supabase || !params.userId.trim()) {
    throw new Error("Supabase belum terhubung untuk upload naskah.");
  }

  assertSupportedManuscriptFile(params.file);

  const manuscriptId = params.manuscriptId || crypto.randomUUID();
  const fileName = sanitizeFileName(params.file.name);
  const storagePath = `${params.userId}/${manuscriptId}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage
    .from(authorManuscriptBucket)
    .upload(storagePath, params.file, {
      upsert: false,
      contentType: params.file.type || undefined,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(getReadableSupabaseError(error.message));
  }

  return {
    manuscriptId,
    fileName: params.file.name,
    storageBucket: authorManuscriptBucket,
    storagePath,
    storageMimeType: params.file.type || undefined,
    storageSizeBytes: params.file.size,
    storageUploadedAtISO: nowIso(),
  };
}

export async function uploadAuthorManuscriptCover(params: {
  userId: string;
  manuscriptId?: string;
  file: File;
}) {
  if (!supabase || !params.userId.trim()) {
    throw new Error("Supabase belum terhubung untuk upload cover.");
  }

  assertSupportedCoverImage(params.file);

  const manuscriptId = params.manuscriptId || crypto.randomUUID();
  const fileName = sanitizeFileName(params.file.name);
  const storagePath = `${params.userId}/${manuscriptId}/${Date.now()}-${fileName}`;
  const uploadResult = await supabase.storage
    .from(authorManuscriptCoverBucket)
    .upload(storagePath, params.file, {
      upsert: true,
      contentType: params.file.type || undefined,
      cacheControl: "3600",
    });

  if (uploadResult.error) {
    throw new Error(getReadableSupabaseError(uploadResult.error.message));
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(authorManuscriptCoverBucket).getPublicUrl(storagePath);

  return {
    manuscriptId,
    storageBucket: authorManuscriptCoverBucket,
    storagePath,
    storageMimeType: params.file.type || undefined,
    storageSizeBytes: params.file.size,
    storageUploadedAtISO: nowIso(),
    publicUrl,
  };
}

export async function getAuthorManuscriptSignedUrl(params: {
  storageBucket?: string;
  storagePath?: string;
  fileName?: string;
  download?: boolean;
  expiresInSeconds?: number;
}) {
  if (!supabase) {
    throw new Error("Supabase belum terhubung untuk membuka file naskah.");
  }

  const storageBucket = params.storageBucket || authorManuscriptBucket;
  const storagePath = String(params.storagePath || "").trim();
  if (!storagePath) {
    throw new Error("File naskah belum tersedia di storage.");
  }

  const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(storagePath, params.expiresInSeconds ?? 300, {
    download: params.download ? params.fileName || "manuscript" : undefined,
  });

  if (error || !data?.signedUrl) {
    throw new Error(getReadableSupabaseError(error?.message || "Gagal membuat tautan file naskah."));
  }

  return data.signedUrl;
}

export async function persistManuscriptReviewEntry(entry: ManuscriptReviewEntry) {
  if (!supabase || !entry.manuscriptId.trim() || !entry.id.trim()) return;

  const { error } = await supabase.from("author_manuscript_reviews").insert({
    id: entry.id,
    manuscript_id: entry.manuscriptId,
    reviewer_id: entry.reviewerId,
    reviewer_name: entry.reviewerName,
    decision: entry.decision,
    note: entry.note,
    created_at: entry.createdAtISO,
  });

  if (error) throw error;
}

function manuscriptToRow(input: Manuscript) {
  return {
    id: input.id,
    author_id: input.authorId,
    author_display_name: input.authorDisplayName ?? null,
    title: input.title,
    category: input.category,
    file_name: input.fileName,
    storage_bucket: input.storageBucket ?? null,
    storage_path: input.storagePath ?? null,
    storage_mime_type: input.storageMimeType ?? null,
    storage_size_bytes: input.storageSizeBytes ?? null,
    storage_uploaded_at: input.storageUploadedAtISO ?? null,
    cover_storage_bucket: input.coverStorageBucket ?? null,
    cover_storage_path: input.coverStoragePath ?? null,
    cover_storage_mime_type: input.coverStorageMimeType ?? null,
    cover_storage_size_bytes: input.coverStorageSizeBytes ?? null,
    cover_storage_uploaded_at: input.coverStorageUploadedAtISO ?? null,
    cover_public_url: input.coverPublicUrl ?? null,
    submitted_at: input.submittedAtISO,
    status: input.status,
    admin_note: input.adminNote ?? null,
    synopsis: input.synopsis ?? null,
    target_audience: input.targetAudience ?? null,
    tags: input.tags ?? [],
    word_count: input.wordCount ?? null,
    price_cents: input.priceCents ?? null,
    suggested_monetization: input.suggestedMonetization ?? null,
    monetization_note: input.monetizationNote ?? null,
    updated_at: input.updatedAtISO ?? nowIso(),
    published_ebook_id: input.publishedEbookId ?? null,
    published_at: input.publishedAtISO ?? null,
    published_access: input.publishedAccess ?? null,
    published_required_plan: input.publishedRequiredPlan ?? null,
    published_price_cents: input.publishedPriceCents ?? null,
    published_is_featured: input.publishedIsFeatured ?? false,
    published_is_best_seller: input.publishedIsBestSeller ?? false,
  };
}

export async function persistManuscript(manuscript: Manuscript) {
  if (!supabase || !manuscript.authorId.trim() || !manuscript.id.trim()) return;

  const { error } = await supabase!
    .from("author_manuscripts")
    .upsert(manuscriptToRow(manuscript), {
      onConflict: "id",
      ignoreDuplicates: false,
    });

  if (error) throw error;
}

export async function deleteAuthorManuscript(params: {
  manuscriptId: string;
  authorId: string;
  storageBucket?: string;
  storagePath?: string;
  coverStorageBucket?: string;
  coverStoragePath?: string;
}) {
  if (!supabase || !params.authorId.trim() || !params.manuscriptId.trim()) return;

  if (params.storageBucket && params.storagePath) {
    const deleteFileResult = await supabase.storage
      .from(params.storageBucket)
      .remove([params.storagePath]);
    if (deleteFileResult.error) {
      throw new Error(getReadableSupabaseError(deleteFileResult.error.message));
    }
  }

  if (params.coverStorageBucket && params.coverStoragePath) {
    const deleteCoverResult = await supabase.storage
      .from(params.coverStorageBucket)
      .remove([params.coverStoragePath]);
    if (deleteCoverResult.error) {
      throw new Error(getReadableSupabaseError(deleteCoverResult.error.message));
    }
  }

  const { error } = await supabase
    .from("author_manuscripts")
    .delete()
    .eq("id", params.manuscriptId)
    .eq("author_id", params.authorId);

  if (error) throw new Error(getReadableSupabaseError(error.message));
}

export function reportAuthorWorkspaceSyncError(action: string, error: unknown) {
  reportWorkspaceError(action, error);
}
