import type { BookAccess, MembershipPlan } from "@/types/domain";

export function getMembershipPlanLabel(plan: MembershipPlan) {
  if (plan === "PREMIUM") return "Premium";
  if (plan === "EDU") return "Edukasi";
  return "Gratis";
}

export function getRequiredMembershipLabel(requiredPlan?: MembershipPlan) {
  if (requiredPlan === "PREMIUM") return "Premium";
  if (requiredPlan === "EDU") return "Edukasi atau Premium";
  return "membership aktif";
}

export function getPublicAccessPriceLabel(params: {
  access: BookAccess;
  requiredPlan?: MembershipPlan;
}) {
  const { access, requiredPlan } = params;
  if (access === "OPEN") {
    return "Gratis";
  }
  if (access === "MEMBERSHIP") {
    return `Via ${getRequiredMembershipLabel(requiredPlan)}`;
  }
  return "";
}

export function getLockedBookAccessMessage(params: {
  access: BookAccess;
  requiredPlan?: MembershipPlan;
  isLoggedIn: boolean;
  membershipPlan: MembershipPlan;
}) {
  const { access, requiredPlan, isLoggedIn, membershipPlan } = params;

  if (access === "PAID") {
    return isLoggedIn
      ? "Buku ini tersedia lewat pembelian satuan. Selesaikan checkout untuk membuka akses penuh."
      : "Preview tersedia. Login dulu lalu lanjutkan checkout untuk membuka buku ini.";
  }

  if (access === "MEMBERSHIP") {
    if (!isLoggedIn) {
      return `Preview tersedia. Login dulu lalu aktifkan paket ${getRequiredMembershipLabel(
        requiredPlan
      )} untuk membuka buku ini.`;
    }

    if (membershipPlan === "FREE") {
      return `Paket aktif kamu masih Gratis. Buku ini membutuhkan ${getRequiredMembershipLabel(
        requiredPlan
      )}.`;
    }

    if (requiredPlan === "PREMIUM" && membershipPlan !== "PREMIUM") {
      return "Paket aktif kamu belum membuka buku ini. Upgrade ke Premium untuk akses penuh.";
    }

    return `Paket aktif kamu ${getMembershipPlanLabel(
      membershipPlan
    )}, tetapi akses buku ini belum tersedia. Periksa status membership atau sinkronisasi pembayaran terakhir.`;
  }

  return "Buku ini belum bisa dibuka penuh dari sesi saat ini.";
}

export function getLockedBookPrimaryAction(params: {
  access: BookAccess;
  isLoggedIn: boolean;
}) {
  const { access, isLoggedIn } = params;
  if (access === "PAID") {
    return isLoggedIn ? "Lanjut ke Checkout" : "Login untuk Checkout";
  }
  if (access === "MEMBERSHIP") {
    return isLoggedIn ? "Lihat Paket Membership" : "Login untuk Membership";
  }
  return "Lanjutkan";
}
