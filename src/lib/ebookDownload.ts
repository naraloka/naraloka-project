import type { Ebook, MembershipPlan } from "@/types/domain";

export function canAccessFullEbook(params: {
  owned: boolean;
  membershipPlan: MembershipPlan;
  access: "OPEN" | "MEMBERSHIP" | "PAID";
  requiredPlan?: MembershipPlan;
}) {
  const { owned, membershipPlan, access, requiredPlan } = params;
  if (access === "OPEN") return true;
  if (access === "PAID") return owned;
  if (access === "MEMBERSHIP") {
    if (!requiredPlan) return membershipPlan !== "FREE";
    return membershipPlan === requiredPlan || membershipPlan === "PREMIUM";
  }
  return false;
}

function sanitizeFileName(value: string) {
  const withoutReservedCharacters = value.replace(/[<>:"/\\|?*]/g, "");
  const withoutControlCharacters = Array.from(withoutReservedCharacters)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 0x20;
    })
    .join("");
  return withoutControlCharacters.replace(/\s+/g, "-").toLowerCase();
}

export function downloadEbookAsText(params: {
  ebook: Ebook;
  owned: boolean;
  membershipPlan: MembershipPlan;
}) {
  const { ebook, owned, membershipPlan } = params;
  const fullAccess = canAccessFullEbook({
    owned,
    membershipPlan,
    access: ebook.access,
    requiredPlan: ebook.requiredPlan,
  });
  const pages = fullAccess ? ebook.pages : ebook.previewPages;
  const header = [
    `Naraloka Offline Export`,
    `Judul: ${ebook.title}`,
    `Kategori: ${ebook.category}`,
    `Mode akses: ${fullAccess ? "Penuh" : "Preview"}`,
    "",
  ].join("\n");
  const body = pages.map((page, index) => `=== Halaman ${index + 1} ===\n${page}`).join("\n\n");
  const blob = new Blob([`${header}${body}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFileName(ebook.title)}-${fullAccess ? "full" : "preview"}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { fullAccess };
}
