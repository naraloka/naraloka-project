export type MembershipPlan = "FREE" | "PREMIUM" | "EDU";

export type UserRole = "READER" | "AUTHOR" | "ADMIN";

export type BookCategory =
  | "Novel"
  | "Edukasi"
  | "Motivasi"
  | "Cerpen"
  | "Komik Digital";

export type BookAccess = "OPEN" | "MEMBERSHIP" | "PAID";

export type PaymentMethod =
  | "QRIS"
  | "BANK_TRANSFER"
  | "E_WALLET"
  | "VIRTUAL_ACCOUNT"
  | "CARD";

export type Bank = "BCA" | "BRI" | "BNI" | "MANDIRI";

export type EWallet = "GOPAY" | "OVO" | "DANA" | "SHOPEEPAY" | "LINKAJA";

export type TransactionStatus = "PENDING" | "SUCCESS" | "FAILED";
export type TransactionItemType = "MEMBERSHIP" | "EBOOK";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  membershipPlan: MembershipPlan;
  avatarUrl?: string;
  phone?: string;
  city?: string;
  website?: string;
  bio?: string;
}

export interface AuthorProfile {
  id: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  followerCount: number;
}

export interface Ebook {
  id: string;
  title: string;
  authorId: string;
  coverUrl: string;
  category: BookCategory;
  description: string;
  ratingAvg: number;
  ratingCount: number;
  priceCents: number;
  access: BookAccess;
  requiredPlan?: MembershipPlan;
  isBestSeller: boolean;
  isFeatured: boolean;
  publishedAtISO: string;
  pageCount: number;
  tags: string[];
  previewPages: string[];
  pages: string[];
  sourceFileName?: string;
  sourceStorageBucket?: string;
  sourceStoragePath?: string;
  sourceMimeType?: string;
}

export interface Review {
  id: string;
  ebookId: string;
  userId: string;
  userName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAtISO: string;
  updatedAtISO: string;
}

export interface LibraryItem {
  userId: string;
  ebookId: string;
  owned: boolean;
  downloaded: boolean;
  lastReadAtISO?: string;
  progress: {
    currentPage: number;
    totalPages: number;
  };
}

export interface Bookmark {
  id: string;
  userId: string;
  ebookId: string;
  page: number;
  note?: string;
  createdAtISO: string;
}

export interface Highlight {
  id: string;
  userId: string;
  ebookId: string;
  page: number;
  text: string;
  note?: string;
  createdAtISO: string;
}

export interface ReaderTransaction {
  id: string;
  userId: string;
  orderId: string;
  itemType: TransactionItemType;
  itemId: string;
  itemLabel: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  buyerEmail: string;
  buyerWhatsApp: string;
  membershipPlan?: MembershipPlan;
  ebookId?: string;
  authorId?: string;
  platformCommissionPct?: number;
  platformCommissionCents?: number;
  authorRoyaltyPct?: number;
  authorRoyaltyCents?: number;
  redirectUrl?: string;
  createdAtISO: string;
  updatedAtISO: string;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  publishedAtISO: string;
  tags: string[];
  content: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  roleLabel: string;
  rating: 1 | 2 | 3 | 4 | 5;
  quote: string;
}
