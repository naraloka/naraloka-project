import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BookAccess,
  BookCategory,
  Ebook,
  MembershipPlan,
  PaymentMethod,
  Review,
  TransactionStatus,
} from "@/types/domain";
import { t2i } from "@/utils/image";
import {
  buildPublishedManuscriptPages,
  estimatePublishedManuscriptPageCount,
} from "@/lib/publishedManuscript";
import {
  createCollaborationRequest,
  persistAuthorProfile,
  persistManuscript,
  persistManuscriptReviewEntry,
  reportAuthorWorkspaceSyncError,
} from "@/lib/authorWorkspace";
import {
  createMembershipPayoutStatusNotification,
  createRoyaltyPayoutStatusNotification,
  sortAuthorFinanceNotifications,
  type AuthorFinanceNotification,
} from "@/lib/payoutNotifications";

export type ManuscriptStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "NEEDS_REVISION"
  | "IN_EDITING"
  | "READY_TO_PUBLISH"
  | "APPROVED"
  | "REJECTED";
export type CollaborationStatus = "SENT" | "REVIEWING" | "CONTACTED";
export type ManuscriptReviewDecision =
  | "COMMENT"
  | "IN_REVIEW"
  | "NEEDS_REVISION"
  | "IN_EDITING"
  | "READY_TO_PUBLISH"
  | "REJECTED"
  | "APPROVED";
export type AuthorPayoutMethod = "BANK_TRANSFER" | "EWALLET";

export type AuthorWorkspaceProfile = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  bio: string;
  phone: string;
  portfolioUrl: string;
  payoutAccount: string;
  payoutMethod?: AuthorPayoutMethod;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  ewalletProvider: string;
  ewalletAccountName: string;
  ewalletAccountNumber: string;
  payoutNotes: string;
  specialty: string;
  updatedAtISO: string;
};

export type CollaborationRequest = {
  id: string;
  authorId: string;
  fullName: string;
  email: string;
  phone: string;
  portfolioUrl: string;
  pitch: string;
  status: CollaborationStatus;
  sentAtISO: string;
};

export type SuggestedMonetization =
  | "FREE"
  | "MEMBERSHIP_PREMIUM"
  | "MEMBERSHIP_EDU"
  | "PAID";

export type Manuscript = {
  id: string;
  authorId: string;
  authorDisplayName?: string;
  title: string;
  category: BookCategory;
  fileName: string;
  storageBucket?: string;
  storagePath?: string;
  storageMimeType?: string;
  storageSizeBytes?: number;
  storageUploadedAtISO?: string;
  coverStorageBucket?: string;
  coverStoragePath?: string;
  coverStorageMimeType?: string;
  coverStorageSizeBytes?: number;
  coverStorageUploadedAtISO?: string;
  coverPublicUrl?: string;
  submittedAtISO: string;
  status: ManuscriptStatus;
  adminNote?: string;
  synopsis?: string;
  targetAudience?: string;
  tags?: string[];
  wordCount?: number;
  priceCents?: number;
  suggestedMonetization?: SuggestedMonetization;
  monetizationNote?: string;
  updatedAtISO?: string;
  publishedEbookId?: string;
  publishedAtISO?: string;
  publishedAccess?: BookAccess;
  publishedRequiredPlan?: MembershipPlan;
  publishedPriceCents?: number;
  publishedIsFeatured?: boolean;
  publishedIsBestSeller?: boolean;
};

export type ManuscriptReviewEntry = {
  id: string;
  manuscriptId: string;
  reviewerId: string;
  reviewerName: string;
  decision: ManuscriptReviewDecision;
  note: string;
  createdAtISO: string;
};

export type AuthorRoyaltyLedgerStatus =
  | "PENDING"
  | "AVAILABLE"
  | "PROCESSING"
  | "PAID"
  | "VOID";

export type AuthorRoyaltyLedgerEntry = {
  orderId: string;
  authorId: string;
  userId?: string;
  ebookId?: string;
  itemLabel: string;
  grossAmountCents: number;
  platformCommissionPct?: number;
  platformCommissionCents: number;
  authorRoyaltyPct?: number;
  authorRoyaltyCents: number;
  paymentMethod?: PaymentMethod;
  paymentStatus: TransactionStatus;
  transactionState?: string;
  status: AuthorRoyaltyLedgerStatus;
  payoutReference?: string;
  payoutNote?: string;
  earnedAtISO?: string;
  processingAtISO?: string;
  paidAtISO?: string;
  createdAtISO: string;
  updatedAtISO: string;
};

export type AuthorMembershipRoyaltyLedgerStatus =
  | "PENDING"
  | "AVAILABLE"
  | "PROCESSING"
  | "PAID"
  | "VOID";

export type AuthorMembershipRoyaltyLedgerEntry = {
  entryId: string;
  orderId: string;
  buyerUserId?: string;
  authorId: string;
  membershipPlan: Exclude<MembershipPlan, "FREE">;
  itemLabel: string;
  poolAmountCents: number;
  platformCommissionPct?: number;
  platformCommissionCents: number;
  distributablePoolCents: number;
  allocationBasisPages: number;
  allocationRatio: number;
  authorRoyaltyCents: number;
  status: AuthorMembershipRoyaltyLedgerStatus;
  paymentStatus: TransactionStatus;
  payoutReference?: string;
  payoutNote?: string;
  sourceEbookIds: string[];
  earnedAtISO?: string;
  processingAtISO?: string;
  paidAtISO?: string;
  createdAtISO: string;
  updatedAtISO: string;
};

export type PayoutSlipArchiveRecord = {
  id: string;
  invoiceNumber: string;
  authorId: string;
  authorName: string;
  issuerName: string;
  issuerTitle?: string;
  generatedByUserId: string;
  generatedByName: string;
  filterStartDate?: string;
  filterEndDate?: string;
  filterPayoutStatus?: string;
  filterSourceType?: string;
  entryCount: number;
  paidBookRoyaltyCents: number;
  membershipRoyaltyCents: number;
  totalRoyaltyCents: number;
  availableCents: number;
  processingCents: number;
  paidCents: number;
  issuedAtISO: string;
  updatedAtISO: string;
};

export type AuthorPayoutNotificationState = {
  lastSeenIssuedAtISO?: string;
  lastOpenedArchiveId?: string;
  updatedAtISO: string;
};

export type RoyaltyConfig = {
  freeAccessPct: number;
  paidBookPct: number;
  membershipPremiumPct: number;
  membershipEduPct: number;
};

type PublishingState = {
  authorProfilesByUser: Record<string, AuthorWorkspaceProfile>;
  collaborationRequests: CollaborationRequest[];
  manuscripts: Manuscript[];
  reviewEntriesByManuscript: Record<string, ManuscriptReviewEntry[]>;
  reviews: Review[];
  royaltyLedgerEntries: AuthorRoyaltyLedgerEntry[];
  membershipRoyaltyLedgerEntries: AuthorMembershipRoyaltyLedgerEntry[];
  payoutSlipArchives: PayoutSlipArchiveRecord[];
  payoutNotificationStateByUser: Record<string, AuthorPayoutNotificationState>;
  authorFinanceNotifications: AuthorFinanceNotification[];
  publishedEbooks: Ebook[];
  royalty: RoyaltyConfig;
  upsertAuthorProfile: (input: Omit<AuthorWorkspaceProfile, "updatedAtISO">) => void;
  submitCollaborationRequest: (input: Omit<CollaborationRequest, "id" | "sentAtISO" | "status">) => void;
  saveManuscriptDraft: (
    input: Omit<Manuscript, "submittedAtISO" | "status" | "updatedAtISO">
  ) => void;
  submitManuscript: (
    input: Omit<Manuscript, "submittedAtISO" | "status" | "updatedAtISO">
  ) => void;
  resubmitManuscriptRevision: (input: {
    manuscriptId: string;
    authorId: string;
    authorDisplayName?: string;
    note?: string;
    fileName?: string;
    storageBucket?: string;
    storagePath?: string;
    storageMimeType?: string;
    storageSizeBytes?: number;
    storageUploadedAtISO?: string;
  }) => void;
  updateManuscriptCover: (input: {
    manuscriptId: string;
    authorId: string;
    coverStorageBucket?: string;
    coverStoragePath?: string;
    coverStorageMimeType?: string;
    coverStorageSizeBytes?: number;
    coverStorageUploadedAtISO?: string;
    coverPublicUrl?: string;
  }) => void;
  deleteManuscript: (input: {
    manuscriptId: string;
    authorId: string;
  }) => void;
  publishManuscript: (input: {
    manuscriptId: string;
    access: BookAccess;
    requiredPlan?: MembershipPlan;
    priceCents?: number;
    isFeatured?: boolean;
    isBestSeller?: boolean;
    authorDisplayName?: string;
  }) => void;
  setCommissionPct: (
    type: "PAID" | "MEMBERSHIP_PREMIUM" | "MEMBERSHIP_EDU",
    platformCommissionPct: number
  ) => void;
  approve: (input: {
    manuscriptId: string;
    adminNote?: string;
    reviewerId?: string;
    reviewerName?: string;
  }) => void;
  setEditorialStatus: (input: {
    manuscriptId: string;
    status: Exclude<ManuscriptStatus, "DRAFT" | "SUBMITTED" | "APPROVED">;
    note?: string;
    reviewerId?: string;
    reviewerName?: string;
  }) => void;
  reject: (input: {
    manuscriptId: string;
    adminNote: string;
    reviewerId?: string;
    reviewerName?: string;
  }) => void;
  addReviewComment: (input: {
    manuscriptId: string;
    note: string;
    reviewerId?: string;
    reviewerName?: string;
  }) => void;
  hydrateWorkspaceData: (input: {
    authorProfilesByUser: Record<string, AuthorWorkspaceProfile>;
    collaborationRequests: CollaborationRequest[];
    manuscripts: Manuscript[];
    reviewEntriesByManuscript: Record<string, ManuscriptReviewEntry[]>;
    publishedEbooks: Ebook[];
  }) => void;
  submitEbookReview: (input: {
    ebookId: string;
    userId: string;
    userName: string;
    rating: 1 | 2 | 3 | 4 | 5;
    comment: string;
  }) => void;
  hydrateRoyaltyLedger: (entries: AuthorRoyaltyLedgerEntry[]) => void;
  hydrateRoyaltyConfig: (config: RoyaltyConfig) => void;
  upsertRoyaltyLedgerEntry: (entry: AuthorRoyaltyLedgerEntry) => void;
  hydrateMembershipRoyaltyLedger: (entries: AuthorMembershipRoyaltyLedgerEntry[]) => void;
  upsertMembershipRoyaltyLedgerEntry: (entry: AuthorMembershipRoyaltyLedgerEntry) => void;
  hydratePayoutSlipArchives: (entries: PayoutSlipArchiveRecord[]) => void;
  upsertPayoutSlipArchive: (entry: PayoutSlipArchiveRecord) => void;
  markAuthorFinanceNotificationsRead: (input: {
    authorId: string;
    notificationIds?: string[];
  }) => void;
  markPayoutSlipNotificationsSeen: (input: {
    authorId: string;
    latestIssuedAtISO?: string;
    lastOpenedArchiveId?: string;
  }) => void;
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function appendReviewEntry(
  state: Pick<PublishingState, "reviewEntriesByManuscript">,
  entry: ManuscriptReviewEntry
) {
  const current = state.reviewEntriesByManuscript[entry.manuscriptId] ?? [];
  return {
    ...state.reviewEntriesByManuscript,
    [entry.manuscriptId]: [entry, ...current].sort(
      (a, b) => +new Date(b.createdAtISO) - +new Date(a.createdAtISO)
    ),
  };
}

function normalizeReadyStatus(status: ManuscriptStatus) {
  return status === "APPROVED" ? "READY_TO_PUBLISH" : status;
}

function manuscriptToPublishedEbook(input: {
  manuscript: Manuscript;
  access: BookAccess;
  requiredPlan?: MembershipPlan;
  priceCents?: number;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  authorDisplayName?: string;
}) {
  const { manuscript, access, requiredPlan, priceCents, isFeatured, isBestSeller, authorDisplayName } = input;
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
    priceCents: access === "PAID" ? Math.max(0, priceCents ?? manuscript.priceCents ?? 0) : 0,
    access,
    requiredPlan: access === "MEMBERSHIP" ? requiredPlan : undefined,
    isBestSeller: Boolean(isBestSeller),
    isFeatured: Boolean(isFeatured),
    publishedAtISO: new Date().toISOString(),
    pageCount,
    tags: manuscript.tags?.length ? manuscript.tags : [manuscript.category, "Karya Baru"],
    previewPages: generatedPages.previewPages,
    pages: generatedPages.pages,
    sourceFileName: manuscript.fileName || undefined,
    sourceStorageBucket: manuscript.storageBucket,
    sourceStoragePath: manuscript.storagePath,
    sourceMimeType: manuscript.storageMimeType,
  } satisfies Ebook;
}

export const usePublishingStore = create<PublishingState>()(
  persist(
    (set) => ({
      authorProfilesByUser: {},
      collaborationRequests: [],
      manuscripts: [],
      reviewEntriesByManuscript: {},
      reviews: [],
      royaltyLedgerEntries: [],
      membershipRoyaltyLedgerEntries: [],
      payoutSlipArchives: [],
      payoutNotificationStateByUser: {},
      authorFinanceNotifications: [],
      publishedEbooks: [],
      royalty: {
        freeAccessPct: 0,
        paidBookPct: 20,
        membershipPremiumPct: 30,
        membershipEduPct: 25,
      },

      upsertAuthorProfile: (input) => {
        const nextProfile = {
          ...input,
          updatedAtISO: new Date().toISOString(),
        };
        set((state) => ({
          authorProfilesByUser: {
            ...state.authorProfilesByUser,
            [input.userId]: {
              ...state.authorProfilesByUser[input.userId],
              ...nextProfile,
            },
          },
        }));

        void persistAuthorProfile(nextProfile).catch((error) => {
          reportAuthorWorkspaceSyncError("persist upsertAuthorProfile", error);
        });
      },

      submitCollaborationRequest: (input) => {
        const nextRequest = {
          id: uid("col"),
          ...input,
          status: "SENT" as const,
          sentAtISO: new Date().toISOString(),
        };
        set((state) => ({
          collaborationRequests: [
            nextRequest,
            ...state.collaborationRequests,
          ],
        }));

        void createCollaborationRequest(nextRequest).catch((error) => {
          reportAuthorWorkspaceSyncError("persist submitCollaborationRequest", error);
        });
      },

      saveManuscriptDraft: (input) => {
        let nextManuscript: Manuscript | null = null;
        set((state) => {
          const existing = input.id?.trim()
            ? state.manuscripts.find((manuscript) => manuscript.id === input.id?.trim())
            : null;
          nextManuscript = {
            ...(existing ?? {}),
            ...input,
            id: input.id?.trim() || uid("ms"),
            authorDisplayName:
              input.authorDisplayName || state.authorProfilesByUser[input.authorId]?.displayName,
            fileName: input.fileName || existing?.fileName || "",
            storageBucket: input.storageBucket || existing?.storageBucket,
            storagePath: input.storagePath || existing?.storagePath,
            storageMimeType: input.storageMimeType || existing?.storageMimeType,
            storageSizeBytes: input.storageSizeBytes ?? existing?.storageSizeBytes,
            storageUploadedAtISO: input.storageUploadedAtISO || existing?.storageUploadedAtISO,
            coverStorageBucket: input.coverStorageBucket || existing?.coverStorageBucket,
            coverStoragePath: input.coverStoragePath || existing?.coverStoragePath,
            coverStorageMimeType: input.coverStorageMimeType || existing?.coverStorageMimeType,
            coverStorageSizeBytes: input.coverStorageSizeBytes ?? existing?.coverStorageSizeBytes,
            coverStorageUploadedAtISO:
              input.coverStorageUploadedAtISO || existing?.coverStorageUploadedAtISO,
            coverPublicUrl: input.coverPublicUrl || existing?.coverPublicUrl,
            status: "DRAFT" as const,
            submittedAtISO: existing?.submittedAtISO || new Date().toISOString(),
            updatedAtISO: new Date().toISOString(),
          };
          return {
            manuscripts: existing
              ? state.manuscripts.map((manuscript) =>
                  manuscript.id === nextManuscript?.id ? nextManuscript || manuscript : manuscript
                )
              : [nextManuscript, ...state.manuscripts],
          };
        });

        if (nextManuscript) {
          void persistManuscript(nextManuscript).catch((error) => {
            reportAuthorWorkspaceSyncError("persist saveManuscriptDraft", error);
          });
        }
      },

      submitManuscript: (input) => {
        let nextManuscript: Manuscript | null = null;
        set((state) => {
          const existing = input.id?.trim()
            ? state.manuscripts.find((manuscript) => manuscript.id === input.id?.trim())
            : null;
          nextManuscript = {
            ...(existing ?? {}),
            ...input,
            id: input.id?.trim() || uid("ms"),
            authorDisplayName:
              input.authorDisplayName || state.authorProfilesByUser[input.authorId]?.displayName,
            fileName: input.fileName || existing?.fileName || "",
            storageBucket: input.storageBucket || existing?.storageBucket,
            storagePath: input.storagePath || existing?.storagePath,
            storageMimeType: input.storageMimeType || existing?.storageMimeType,
            storageSizeBytes: input.storageSizeBytes ?? existing?.storageSizeBytes,
            storageUploadedAtISO: input.storageUploadedAtISO || existing?.storageUploadedAtISO,
            coverStorageBucket: input.coverStorageBucket || existing?.coverStorageBucket,
            coverStoragePath: input.coverStoragePath || existing?.coverStoragePath,
            coverStorageMimeType: input.coverStorageMimeType || existing?.coverStorageMimeType,
            coverStorageSizeBytes: input.coverStorageSizeBytes ?? existing?.coverStorageSizeBytes,
            coverStorageUploadedAtISO:
              input.coverStorageUploadedAtISO || existing?.coverStorageUploadedAtISO,
            coverPublicUrl: input.coverPublicUrl || existing?.coverPublicUrl,
            submittedAtISO: new Date().toISOString(),
            updatedAtISO: new Date().toISOString(),
            status: "SUBMITTED" as const,
          };
          return {
            manuscripts: existing
              ? state.manuscripts.map((manuscript) =>
                  manuscript.id === nextManuscript?.id ? nextManuscript || manuscript : manuscript
                )
              : [nextManuscript, ...state.manuscripts],
          };
        });

        if (nextManuscript) {
          void persistManuscript(nextManuscript).catch((error) => {
            reportAuthorWorkspaceSyncError("persist submitManuscript", error);
          });
        }
      },

      resubmitManuscriptRevision: ({
        manuscriptId,
        authorId,
        authorDisplayName,
        note,
        fileName,
        storageBucket,
        storagePath,
        storageMimeType,
        storageSizeBytes,
        storageUploadedAtISO,
      }) => {
        let nextManuscript: Manuscript | null = null;
        let nextReview: ManuscriptReviewEntry | null = null;
        set((state) => {
          const revisionNote = note?.trim();
          const currentManuscript = state.manuscripts.find((m) => m.id === manuscriptId);
          if (!currentManuscript) return state;
          if (currentManuscript.authorId !== authorId) return state;
          if (currentManuscript.status !== "NEEDS_REVISION") return state;

          const submittedAtISO = new Date().toISOString();
          nextManuscript = {
            ...currentManuscript,
            authorDisplayName:
              authorDisplayName ||
              currentManuscript.authorDisplayName ||
              state.authorProfilesByUser[authorId]?.displayName,
            fileName: fileName?.trim() || currentManuscript.fileName,
            storageBucket: storageBucket || currentManuscript.storageBucket,
            storagePath: storagePath || currentManuscript.storagePath,
            storageMimeType: storageMimeType || currentManuscript.storageMimeType,
            storageSizeBytes: storageSizeBytes ?? currentManuscript.storageSizeBytes,
            storageUploadedAtISO:
              storageUploadedAtISO || currentManuscript.storageUploadedAtISO,
            status: "SUBMITTED",
            adminNote: revisionNote
              ? `Revisi dikirim ulang penulis. ${revisionNote}`
              : "Revisi dikirim ulang penulis dan kembali ke antrean editorial.",
            submittedAtISO,
            updatedAtISO: submittedAtISO,
          };
          nextReview = {
            id: uid("rvw"),
            manuscriptId,
            reviewerId: authorId,
            reviewerName:
              authorDisplayName ||
              currentManuscript.authorDisplayName ||
              state.authorProfilesByUser[authorId]?.displayName ||
              "Penulis",
            decision: "COMMENT",
            note: revisionNote
              ? `Penulis mengirim revisi: ${revisionNote}`
              : "Penulis mengirim ulang revisi naskah untuk diproses editor.",
            createdAtISO: submittedAtISO,
          };

          return {
            ...state,
            manuscripts: state.manuscripts.map((m) =>
              m.id === manuscriptId ? nextManuscript || m : m
            ),
            reviewEntriesByManuscript: nextReview
              ? appendReviewEntry(state, nextReview)
              : state.reviewEntriesByManuscript,
          };
        });

        if (nextManuscript) {
          void persistManuscript(nextManuscript).catch((error) => {
            reportAuthorWorkspaceSyncError("persist resubmit revision", error);
          });
        }
        if (nextReview) {
          void persistManuscriptReviewEntry(nextReview).catch((error) => {
            reportAuthorWorkspaceSyncError("persist revision note", error);
          });
        }
      },

      updateManuscriptCover: ({
        manuscriptId,
        authorId,
        coverStorageBucket,
        coverStoragePath,
        coverStorageMimeType,
        coverStorageSizeBytes,
        coverStorageUploadedAtISO,
        coverPublicUrl,
      }) => {
        let nextManuscript: Manuscript | null = null;

        set((state) => {
          const currentManuscript = state.manuscripts.find((item) => item.id === manuscriptId);
          if (!currentManuscript) return state;
          if (currentManuscript.authorId !== authorId) return state;

          nextManuscript = {
            ...currentManuscript,
            coverStorageBucket: coverStorageBucket || currentManuscript.coverStorageBucket,
            coverStoragePath: coverStoragePath || currentManuscript.coverStoragePath,
            coverStorageMimeType: coverStorageMimeType || currentManuscript.coverStorageMimeType,
            coverStorageSizeBytes:
              coverStorageSizeBytes ?? currentManuscript.coverStorageSizeBytes,
            coverStorageUploadedAtISO:
              coverStorageUploadedAtISO || currentManuscript.coverStorageUploadedAtISO,
            coverPublicUrl: coverPublicUrl || currentManuscript.coverPublicUrl,
            updatedAtISO: new Date().toISOString(),
          };

          const nextPublishedEbooks = state.publishedEbooks.map((ebook) => {
            const matchesPublishedId =
              currentManuscript.publishedEbookId &&
              ebook.id === currentManuscript.publishedEbookId;
            const matchesFallbackId = ebook.id === `pub_${currentManuscript.id}`;
            if (!matchesPublishedId && !matchesFallbackId) {
              return ebook;
            }

            return {
              ...ebook,
              coverUrl: coverPublicUrl || ebook.coverUrl,
            };
          });

          return {
            manuscripts: state.manuscripts.map((item) =>
              item.id === manuscriptId ? nextManuscript || item : item
            ),
            publishedEbooks: nextPublishedEbooks,
          };
        });

        if (nextManuscript) {
          void persistManuscript(nextManuscript).catch((error) => {
            reportAuthorWorkspaceSyncError("persist update manuscript cover", error);
          });
        }
      },

      deleteManuscript: ({ manuscriptId, authorId }) => {
        set((state) => {
          const manuscript = state.manuscripts.find((item) => item.id === manuscriptId);
          if (!manuscript || manuscript.authorId !== authorId) return state;

          const publishedIds = new Set(
            [manuscript.publishedEbookId, `pub_${manuscript.id}`].filter(Boolean) as string[]
          );
          const nextReviewEntriesByManuscript = { ...state.reviewEntriesByManuscript };
          delete nextReviewEntriesByManuscript[manuscriptId];

          return {
            manuscripts: state.manuscripts.filter((item) => item.id !== manuscriptId),
            reviewEntriesByManuscript: nextReviewEntriesByManuscript,
            publishedEbooks: state.publishedEbooks.filter((ebook) => !publishedIds.has(ebook.id)),
            reviews: state.reviews.filter((review) => !publishedIds.has(review.ebookId)),
          };
        });
      },

      publishManuscript: ({
        manuscriptId,
        access,
        requiredPlan,
        priceCents,
        isFeatured,
        isBestSeller,
        authorDisplayName,
      }) => {
        let nextManuscript: Manuscript | null = null;
        set((state) => {
          const manuscript = state.manuscripts.find((item) => item.id === manuscriptId);
          if (!manuscript || normalizeReadyStatus(manuscript.status) !== "READY_TO_PUBLISH") return state;

          const publishedAtISO = new Date().toISOString();
          const nextEbook = manuscriptToPublishedEbook({
            manuscript,
            access,
            requiredPlan,
            priceCents,
            isFeatured,
            isBestSeller,
            authorDisplayName,
          });
          nextManuscript = {
            ...manuscript,
            publishedEbookId: nextEbook.id,
            publishedAtISO,
            publishedAccess: access,
            publishedRequiredPlan: access === "MEMBERSHIP" ? requiredPlan : undefined,
            publishedPriceCents:
              access === "PAID" ? Math.max(0, priceCents ?? manuscript.priceCents ?? 0) : 0,
            publishedIsFeatured: Boolean(isFeatured),
            publishedIsBestSeller: Boolean(isBestSeller),
            updatedAtISO: publishedAtISO,
          };

          return {
            ...state,
            publishedEbooks: [
              nextEbook,
              ...state.publishedEbooks.filter((ebook) => ebook.id !== nextEbook.id),
            ],
            manuscripts: state.manuscripts.map((item) =>
              item.id === manuscriptId ? nextManuscript || item : item
            ),
          };
        });

        if (nextManuscript) {
          void persistManuscript(nextManuscript).catch((error) => {
            reportAuthorWorkspaceSyncError("persist publishManuscript", error);
          });
        }
      },

      setCommissionPct: (type, platformCommissionPct) => {
        const pct = Math.min(60, Math.max(0, Math.round(platformCommissionPct)));
        set((state) => ({
          royalty: {
            ...state.royalty,
            paidBookPct: type === "PAID" ? pct : state.royalty.paidBookPct,
            membershipPremiumPct:
              type === "MEMBERSHIP_PREMIUM" ? pct : state.royalty.membershipPremiumPct,
            membershipEduPct:
              type === "MEMBERSHIP_EDU" ? pct : state.royalty.membershipEduPct,
          },
        }));
      },

      hydrateRoyaltyConfig: (config) => {
        set(() => ({
          royalty: {
            freeAccessPct: Math.min(60, Math.max(0, Math.round(config.freeAccessPct))),
            paidBookPct: Math.min(60, Math.max(0, Math.round(config.paidBookPct))),
            membershipPremiumPct: Math.min(
              60,
              Math.max(0, Math.round(config.membershipPremiumPct))
            ),
            membershipEduPct: Math.min(60, Math.max(0, Math.round(config.membershipEduPct))),
          },
        }));
      },

      approve: ({ manuscriptId, adminNote, reviewerId, reviewerName }) => {
        usePublishingStore.getState().setEditorialStatus({
          manuscriptId,
          status: "READY_TO_PUBLISH",
          note: adminNote,
          reviewerId,
          reviewerName,
        });
      },

      setEditorialStatus: ({ manuscriptId, status, note, reviewerId, reviewerName }) => {
        let nextManuscript: Manuscript | null = null;
        let nextReview: ManuscriptReviewEntry | null = null;
        set((state) => {
          const reviewNote = note?.trim();
          if (reviewNote) {
            nextReview = {
              id: uid("rvw"),
              manuscriptId,
              reviewerId: reviewerId || "admin",
              reviewerName: reviewerName || "Admin",
              decision: status,
              note: reviewNote,
              createdAtISO: new Date().toISOString(),
            };
          }

          return {
            manuscripts: state.manuscripts.map((m) =>
              m.id === manuscriptId
                ? {
                    ...m,
                    status,
                    adminNote: reviewNote || undefined,
                    updatedAtISO: new Date().toISOString(),
                  }
                : m
            ),
            reviewEntriesByManuscript: nextReview
              ? appendReviewEntry(state, nextReview)
              : state.reviewEntriesByManuscript,
          };
        });
        nextManuscript =
          usePublishingStore.getState().manuscripts.find((m) => m.id === manuscriptId) ?? null;
        if (nextManuscript) {
          void persistManuscript(nextManuscript).catch((error) => {
            reportAuthorWorkspaceSyncError("persist editorial status", error);
          });
        }
        if (nextReview) {
          void persistManuscriptReviewEntry(nextReview).catch((error) => {
            reportAuthorWorkspaceSyncError("persist editorial review", error);
          });
        }
      },

      reject: ({ manuscriptId, adminNote, reviewerId, reviewerName }) => {
        usePublishingStore.getState().setEditorialStatus({
          manuscriptId,
          status: "REJECTED",
          note: adminNote.trim() || "Naskah ditolak pada tahap editorial.",
          reviewerId,
          reviewerName,
        });
      },

      addReviewComment: ({ manuscriptId, note, reviewerId, reviewerName }) => {
        const reviewNote = note.trim();
        if (!reviewNote) return;

        let nextReview: ManuscriptReviewEntry | null = null;
        set((state) => {
          nextReview = {
            id: uid("rvw"),
            manuscriptId,
            reviewerId: reviewerId || "admin",
            reviewerName: reviewerName || "Admin",
            decision: "COMMENT",
            note: reviewNote,
            createdAtISO: new Date().toISOString(),
          };

          return {
            reviewEntriesByManuscript: appendReviewEntry(state, nextReview),
          };
        });

        if (nextReview) {
          void persistManuscriptReviewEntry(nextReview).catch((error) => {
            reportAuthorWorkspaceSyncError("persist comment review", error);
          });
        }
      },

      hydrateWorkspaceData: (input) => {
        set((state) => ({
          ...state,
          authorProfilesByUser: input.authorProfilesByUser,
          collaborationRequests: input.collaborationRequests,
          manuscripts: input.manuscripts,
          reviewEntriesByManuscript: input.reviewEntriesByManuscript,
          publishedEbooks: input.publishedEbooks,
        }));
      },

      submitEbookReview: (input) => {
        set((state) => {
          const ebookId = input.ebookId.trim();
          const userId = input.userId.trim();
          const comment = input.comment.trim();
          const userName = input.userName.trim() || "Pembaca Naraloka";
          if (!ebookId || !userId || !comment) {
            return state;
          }

          const rating = Math.max(1, Math.min(5, Number(input.rating || 0))) as 1 | 2 | 3 | 4 | 5;
          const now = new Date().toISOString();
          const existing = state.reviews.find(
            (review) => review.ebookId === ebookId && review.userId === userId
          );
          const nextReview: Review = existing
            ? {
                ...existing,
                userName,
                rating,
                comment,
                updatedAtISO: now,
              }
            : {
                id: uid("review"),
                ebookId,
                userId,
                userName,
                rating,
                comment,
                createdAtISO: now,
                updatedAtISO: now,
              };

          const nextById = new Map(state.reviews.map((review) => [review.id, review]));
          nextById.set(nextReview.id, nextReview);

          return {
            ...state,
            reviews: Array.from(nextById.values()).sort(
              (a, b) =>
                +new Date(b.updatedAtISO || b.createdAtISO) -
                +new Date(a.updatedAtISO || a.createdAtISO)
            ),
          };
        });
      },

      hydrateRoyaltyLedger: (entries) => {
        set((state) => {
          const previousByOrderId = new Map(
            state.royaltyLedgerEntries.map((entry) => [entry.orderId, entry])
          );
          const nextByOrderId = new Map<string, AuthorRoyaltyLedgerEntry>();
          const nextNotifications = new Map(
            state.authorFinanceNotifications.map((entry) => [entry.id, entry])
          );

          for (const entry of entries) {
            if (!entry.orderId.trim()) continue;
            const previousEntry = previousByOrderId.get(entry.orderId) || null;
            const nextNotification = createRoyaltyPayoutStatusNotification({
              entry,
              previousEntry,
            });
            if (nextNotification) {
              nextNotifications.set(nextNotification.id, {
                ...nextNotification,
                readAtISO: nextNotifications.get(nextNotification.id)?.readAtISO,
              });
            }
            nextByOrderId.set(entry.orderId, entry);
          }

          return {
            ...state,
            royaltyLedgerEntries: Array.from(nextByOrderId.values()).sort(
              (a, b) =>
                +new Date(b.earnedAtISO || b.updatedAtISO || b.createdAtISO) -
                +new Date(a.earnedAtISO || a.updatedAtISO || a.createdAtISO)
            ),
            authorFinanceNotifications: sortAuthorFinanceNotifications(
              Array.from(nextNotifications.values())
            ),
          };
        });
      },

      upsertRoyaltyLedgerEntry: (entry) => {
        set((state) => {
          const nextByOrderId = new Map(
            state.royaltyLedgerEntries.map((item) => [item.orderId, item])
          );
          const nextNotifications = new Map(
            state.authorFinanceNotifications.map((item) => [item.id, item])
          );
          if (entry.orderId.trim()) {
            const previousEntry = nextByOrderId.get(entry.orderId) || null;
            const nextNotification = createRoyaltyPayoutStatusNotification({
              entry,
              previousEntry,
            });
            if (nextNotification) {
              nextNotifications.set(nextNotification.id, {
                ...nextNotification,
                readAtISO: nextNotifications.get(nextNotification.id)?.readAtISO,
              });
            }
            nextByOrderId.set(entry.orderId, entry);
          }

          return {
            ...state,
            royaltyLedgerEntries: Array.from(nextByOrderId.values()).sort(
              (a, b) =>
                +new Date(b.earnedAtISO || b.updatedAtISO || b.createdAtISO) -
                +new Date(a.earnedAtISO || a.updatedAtISO || a.createdAtISO)
            ),
            authorFinanceNotifications: sortAuthorFinanceNotifications(
              Array.from(nextNotifications.values())
            ),
          };
        });
      },

      hydrateMembershipRoyaltyLedger: (entries) => {
        set((state) => {
          const previousByEntryId = new Map(
            state.membershipRoyaltyLedgerEntries.map((entry) => [entry.entryId, entry])
          );
          const nextByEntryId = new Map<string, AuthorMembershipRoyaltyLedgerEntry>();
          const nextNotifications = new Map(
            state.authorFinanceNotifications.map((entry) => [entry.id, entry])
          );

          for (const entry of entries) {
            if (!entry.entryId.trim()) continue;
            const previousEntry = previousByEntryId.get(entry.entryId) || null;
            const nextNotification = createMembershipPayoutStatusNotification({
              entry,
              previousEntry,
            });
            if (nextNotification) {
              nextNotifications.set(nextNotification.id, {
                ...nextNotification,
                readAtISO: nextNotifications.get(nextNotification.id)?.readAtISO,
              });
            }
            nextByEntryId.set(entry.entryId, entry);
          }

          return {
            ...state,
            membershipRoyaltyLedgerEntries: Array.from(nextByEntryId.values()).sort(
              (a, b) =>
                +new Date(b.earnedAtISO || b.updatedAtISO || b.createdAtISO) -
                +new Date(a.earnedAtISO || a.updatedAtISO || a.createdAtISO)
            ),
            authorFinanceNotifications: sortAuthorFinanceNotifications(
              Array.from(nextNotifications.values())
            ),
          };
        });
      },

      upsertMembershipRoyaltyLedgerEntry: (entry) => {
        set((state) => {
          const nextByEntryId = new Map(
            state.membershipRoyaltyLedgerEntries.map((item) => [item.entryId, item])
          );
          const nextNotifications = new Map(
            state.authorFinanceNotifications.map((item) => [item.id, item])
          );
          if (entry.entryId.trim()) {
            const previousEntry = nextByEntryId.get(entry.entryId) || null;
            const nextNotification = createMembershipPayoutStatusNotification({
              entry,
              previousEntry,
            });
            if (nextNotification) {
              nextNotifications.set(nextNotification.id, {
                ...nextNotification,
                readAtISO: nextNotifications.get(nextNotification.id)?.readAtISO,
              });
            }
            nextByEntryId.set(entry.entryId, entry);
          }

          return {
            ...state,
            membershipRoyaltyLedgerEntries: Array.from(nextByEntryId.values()).sort(
              (a, b) =>
                +new Date(b.earnedAtISO || b.updatedAtISO || b.createdAtISO) -
                +new Date(a.earnedAtISO || a.updatedAtISO || a.createdAtISO)
            ),
            authorFinanceNotifications: sortAuthorFinanceNotifications(
              Array.from(nextNotifications.values())
            ),
          };
        });
      },

      hydratePayoutSlipArchives: (entries) => {
        set((state) => ({
          ...state,
          payoutSlipArchives: entries
            .filter((entry) => entry.id.trim())
            .sort(
              (a, b) =>
                +new Date(b.issuedAtISO || b.updatedAtISO) -
                +new Date(a.issuedAtISO || a.updatedAtISO)
            ),
        }));
      },

      upsertPayoutSlipArchive: (entry) => {
        set((state) => {
          const nextById = new Map(state.payoutSlipArchives.map((item) => [item.id, item]));
          if (entry.id.trim()) {
            nextById.set(entry.id, entry);
          }

          return {
            ...state,
            payoutSlipArchives: Array.from(nextById.values()).sort(
              (a, b) => +new Date(b.issuedAtISO || b.updatedAtISO) - +new Date(a.issuedAtISO || a.updatedAtISO)
            ),
          };
        });
      },

      markAuthorFinanceNotificationsRead: (input) => {
        set((state) => {
          const authorId = input.authorId.trim();
          if (!authorId) {
            return state;
          }

          const targetIds =
            input.notificationIds && input.notificationIds.length
              ? new Set(input.notificationIds.map((id) => id.trim()).filter(Boolean))
              : null;
          const readAtISO = new Date().toISOString();

          return {
            ...state,
            authorFinanceNotifications: state.authorFinanceNotifications.map((item) => {
              if (item.authorId !== authorId || item.readAtISO) {
                return item;
              }
              if (targetIds && !targetIds.has(item.id)) {
                return item;
              }
              return {
                ...item,
                readAtISO,
              };
            }),
          };
        });
      },

      markPayoutSlipNotificationsSeen: (input) => {
        set((state) => {
          const authorId = input.authorId.trim();
          if (!authorId) {
            return state;
          }

          const current = state.payoutNotificationStateByUser[authorId];
          const currentSeenAt = current?.lastSeenIssuedAtISO
            ? +new Date(current.lastSeenIssuedAtISO)
            : 0;
          const nextSeenAt = input.latestIssuedAtISO ? +new Date(input.latestIssuedAtISO) : 0;
          const resolvedSeenAtISO =
            nextSeenAt >= currentSeenAt
              ? input.latestIssuedAtISO || current?.lastSeenIssuedAtISO
              : current?.lastSeenIssuedAtISO;

          return {
            ...state,
            payoutNotificationStateByUser: {
              ...state.payoutNotificationStateByUser,
              [authorId]: {
                lastSeenIssuedAtISO: resolvedSeenAtISO,
                lastOpenedArchiveId:
                  input.lastOpenedArchiveId?.trim() || current?.lastOpenedArchiveId,
                updatedAtISO: new Date().toISOString(),
              },
            },
          };
        });
      },
    }),
    { name: "naraloka_publishing_v4" }
  )
);
