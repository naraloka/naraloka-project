import { getReadableSupabaseError, supabase } from "@/lib/supabase";

const userProfileAvatarBucket = "user-profile-media";

function getFileExtension(name: string) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(name);
  return match?.[1]?.toLowerCase() || "jpg";
}

function sanitizeFileName(name: string) {
  const [base, ...extParts] = name.trim().split(".");
  const safeBase =
    base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-") || "avatar";
  const safeExt = extParts.join(".").toLowerCase().replace(/[^a-z0-9.]+/g, "");
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function assertSupportedAvatar(file: File) {
  const extension = getFileExtension(file.name);
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (!allowedExtensions.has(extension) && !allowedMimeTypes.has(file.type)) {
    throw new Error("Format foto profil harus JPG, PNG, atau WEBP.");
  }

  const maxSizeBytes = 2 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error("Ukuran foto profil maksimal 2MB.");
  }
}

export async function uploadUserProfileAvatar(params: { userId: string; file: File }) {
  if (!supabase || !params.userId.trim()) {
    throw new Error("Supabase belum terhubung untuk upload foto profil.");
  }

  assertSupportedAvatar(params.file);

  const extension = getFileExtension(sanitizeFileName(params.file.name));
  const storagePath = `${params.userId}/avatar.${extension}`;
  const uploadResult = await supabase.storage
    .from(userProfileAvatarBucket)
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
  } = supabase.storage.from(userProfileAvatarBucket).getPublicUrl(storagePath);

  return {
    storageBucket: userProfileAvatarBucket,
    storagePath,
    publicUrl: `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`,
  };
}
