import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Camera,
  CreditCard,
  Heart,
  KeyRound,
  LogOut,
  Mail,
  PenSquare,
  Trash2,
  UserRound,
} from "lucide-react";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { uploadUserProfileAvatar } from "@/lib/accountProfile";
import { getMembershipPlanLabel } from "@/lib/accessMessaging";
import { useSessionStore } from "@/stores/sessionStore";
import { useTransactionStore } from "@/stores/transactionStore";

export default function Account() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const updateProfile = useSessionStore((s) => s.updateProfile);
  const updateEmail = useSessionStore((s) => s.updateEmail);
  const updatePassword = useSessionStore((s) => s.updatePassword);
  const transactionsByUser = useTransactionStore((s) => s.transactionsByUser);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileWebsite, setProfileWebsite] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("");

  useEffect(() => {
    setProfileName(user?.name ?? "");
    setProfilePhone(user?.phone ?? "");
    setProfileCity(user?.city ?? "");
    setProfileWebsite(user?.website ?? "");
    setProfileBio(user?.bio ?? "");
    setEmailInput(user?.email ?? "");
  }, [user?.bio, user?.city, user?.email, user?.name, user?.phone, user?.website]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [avatarFile]);

  const transactions = useMemo(() => {
    return user ? transactionsByUser[user.id] ?? [] : [];
  }, [transactionsByUser, user]);
  const roleLabel =
    user?.role === "ADMIN" ? "Admin" : user?.role === "AUTHOR" ? "Penulis" : "Pembaca";
  const planLabel = getMembershipPlanLabel(user?.membershipPlan ?? "FREE");
  const resolvedAvatarUrl = avatarPreviewUrl || user?.avatarUrl || "";
  const avatarInitial = (profileName || user?.name || "P").slice(0, 1).toUpperCase();
  const avatarSubtitle = useMemo(() => {
    const segments = [profileCity.trim(), profileWebsite.trim()].filter(Boolean);
    return segments.length ? segments.join(" • ") : "Lengkapi foto, bio, dan kontak profil kamu.";
  }, [profileCity, profileWebsite]);
  const accessNotice = useMemo(() => {
    const state = location.state as
      | {
          deniedFrom?: string;
          requiredRoles?: string[];
          autoUpgradeError?: string;
        }
      | null;

    if (state?.deniedFrom === "/admin") {
      return "Akun ini belum memiliki akses admin. Gunakan akun admin untuk membuka dashboard admin.";
    }
    if (state?.deniedFrom === "/penulis") {
      return state.autoUpgradeError
        ? `Portal penulis belum bisa diaktifkan otomatis untuk akun ini. ${state.autoUpgradeError}`
        : "Portal penulis akan mengaktifkan peran Penulis secara otomatis saat kamu membukanya.";
    }
    return "";
  }, [location.state]);
  const latestMembershipTransaction = useMemo(() => {
    return [...transactions]
      .filter(
        (transaction) => transaction.itemType === "MEMBERSHIP" && transaction.membershipPlan
      )
      .sort(
        (a, b) =>
          +new Date(b.updatedAtISO || b.createdAtISO || 0) -
          +new Date(a.updatedAtISO || a.createdAtISO || 0)
      )[0];
  }, [transactions]);
  const latestSuccessfulEbookTransaction = useMemo(() => {
    return [...transactions]
      .filter((transaction) => transaction.itemType === "EBOOK" && transaction.status === "SUCCESS")
      .sort(
        (a, b) =>
          +new Date(b.updatedAtISO || b.createdAtISO || 0) -
          +new Date(a.updatedAtISO || a.createdAtISO || 0)
      )[0];
  }, [transactions]);
  const membershipStatusNote = useMemo(() => {
    if (!latestMembershipTransaction) {
      return user?.membershipPlan === "FREE"
        ? "Belum ada pembayaran membership yang sukses. Paket aktif kamu masih Gratis."
        : `Paket ${planLabel} aktif di akun ini.`;
    }

    if (
      latestMembershipTransaction.status === "PENDING" &&
      latestMembershipTransaction.membershipPlan
    ) {
      return `Pembayaran membership ${getMembershipPlanLabel(
        latestMembershipTransaction.membershipPlan
      )} masih pending. Paket aktif tetap ${planLabel} sampai transaksi tervalidasi.`;
    }

    if (
      latestMembershipTransaction.status === "SUCCESS" &&
      latestMembershipTransaction.membershipPlan !== user.membershipPlan
    ) {
      return "Pembayaran membership terakhir sudah sukses, tetapi status paket di sesi ini belum ikut berubah. Muat ulang sesi bila sinkronisasi belum masuk.";
    }

    return `Paket ${planLabel} aktif berdasarkan sinkronisasi ledger pembayaran terakhir.`;
  }, [latestMembershipTransaction, planLabel, user?.membershipPlan]);
  const purchaseStatusNote = useMemo(() => {
    if (!latestSuccessfulEbookTransaction) {
      return "Belum ada pembelian buku yang tervalidasi sukses di akun ini.";
    }

    return `Pembelian buku terakhir berhasil tervalidasi pada ${new Date(
      latestSuccessfulEbookTransaction.updatedAtISO || latestSuccessfulEbookTransaction.createdAtISO
    ).toLocaleString("id-ID")}. Buku yang dibeli akan muncul di perpustakaan setelah sinkronisasi selesai.`;
  }, [latestSuccessfulEbookTransaction]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {accessNotice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {accessNotice}
        </div>
      ) : null}

      {latestMembershipTransaction?.status === "PENDING" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Pembayaran membership terakhir masih pending. Paket aktif baru berubah setelah Midtrans dan ledger selesai sinkron.
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-2/10 text-2xl font-semibold text-brand-2">
              {resolvedAvatarUrl ? (
                <img src={resolvedAvatarUrl} alt={profileName || user.name} className="h-full w-full object-cover" />
              ) : (
                avatarInitial
              )}
            </div>
            <div>
              <div className="text-2xl font-semibold tracking-tight text-ink">{user.name}</div>
              <div className="mt-1 text-sm text-muted">{user.email}</div>
              <div className="mt-1 text-xs text-muted">{avatarSubtitle}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{roleLabel}</Badge>
            <Badge tone={user.membershipPlan === "FREE" ? "neutral" : "success"}>{planLabel}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CreditCard size={16} className="text-brand-2" />
            Membership
          </div>
          <div className="mt-3 text-sm text-muted">
            Paket aktif kamu saat ini adalah <span className="font-semibold text-ink">{planLabel}</span>.
          </div>
          <div className="mt-3 text-xs text-muted">{membershipStatusNote}</div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <UserRound size={16} className="text-brand-2" />
            Peran Akun
          </div>
          <div className="mt-3 text-sm text-muted">
            Peran akun aktif saat ini adalah <span className="font-semibold text-ink">{roleLabel}</span>.
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="text-sm font-semibold text-ink">Info Akun</div>
          <div className="mt-3 text-sm text-muted">
            Pengaturan akun mencakup profil, email, password, paket aktif, dan peran akun.
          </div>
          <div className="mt-3 text-xs text-muted">{purchaseStatusNote}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="text-sm font-semibold text-ink">Edit profil</div>
        <div className="mt-2 text-sm text-muted">
          Lengkapi profil akun seperti nama tampilan, foto profil, bio singkat, kontak, kota, dan website.
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr]">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-brand-2/10 text-4xl font-semibold text-brand-2">
              {resolvedAvatarUrl ? (
                <img src={resolvedAvatarUrl} alt={profileName || user.name} className="h-full w-full object-cover" />
              ) : (
                avatarInitial
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
                    setAvatarFile(file);
                    setAvatarFileName(file?.name ?? "");
                  }}
                  disabled={profileLoading}
                />
                <span className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface">
                  <Camera size={16} />
                  Pilih Foto
                </span>
              </label>
              <Button
                variant="ghost"
                className="w-full"
                onClick={async () => {
                  setProfileLoading(true);
                  setProfileMessage("");
                  const result = await updateProfile({
                    name: profileName,
                    phone: profilePhone,
                    city: profileCity,
                    website: profileWebsite,
                    bio: profileBio,
                    avatarUrl: "",
                  });
                  setProfileLoading(false);
                  setAvatarFile(null);
                  setAvatarFileName("");
                  setProfileMessage(result.error || "Foto profil berhasil dihapus.");
                }}
                disabled={profileLoading || (!user.avatarUrl && !avatarPreviewUrl)}
              >
                <Trash2 size={16} />
                Hapus Foto
              </Button>
              <div className="text-xs text-muted">
                {avatarFileName ? `Foto dipilih: ${avatarFileName}` : "Format JPG/PNG/WEBP, maksimal 2MB."}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-ink">Nama akun</span>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Nama akun"
                disabled={profileLoading}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-ink">Nomor WhatsApp</span>
              <Input
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                disabled={profileLoading}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-ink">Kota / domisili</span>
              <Input
                value={profileCity}
                onChange={(e) => setProfileCity(e.target.value)}
                placeholder="Jakarta, Bandung, Surabaya..."
                disabled={profileLoading}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-ink">Website / media sosial</span>
              <Input
                value={profileWebsite}
                onChange={(e) => setProfileWebsite(e.target.value)}
                placeholder="https://..."
                disabled={profileLoading}
              />
            </label>
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-semibold text-ink">Bio singkat</span>
              <textarea
                className="min-h-28 w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm text-ink outline-none transition focus:border-brand-2 focus:ring-2 focus:ring-brand-2/15"
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                placeholder="Ceritakan singkat tentang dirimu, minat baca, profesi, atau fokus menulis."
                disabled={profileLoading}
              />
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={async () => {
              setProfileLoading(true);
              setProfileMessage("");
              let nextAvatarUrl: string | undefined = undefined;
              try {
                if (avatarFile) {
                  const uploadedAvatar = await uploadUserProfileAvatar({
                    userId: user.id,
                    file: avatarFile,
                  });
                  nextAvatarUrl = uploadedAvatar.publicUrl;
                }
              } catch (error) {
                setProfileLoading(false);
                setProfileMessage(
                  error instanceof Error ? error.message : "Gagal mengunggah foto profil."
                );
                return;
              }

              const result = await updateProfile({
                name: profileName,
                phone: profilePhone,
                city: profileCity,
                website: profileWebsite,
                bio: profileBio,
                avatarUrl: nextAvatarUrl,
              });
              setProfileLoading(false);
              if (!result.error) {
                setAvatarFile(null);
                setAvatarFileName("");
              }
              setProfileMessage(result.error || "Profil berhasil diperbarui.");
            }}
            disabled={profileLoading}
          >
            {profileLoading ? "Menyimpan..." : "Simpan Profil"}
          </Button>
          {profileMessage ? <div className="text-sm text-muted">{profileMessage}</div> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Mail size={16} className="text-brand-2" />
            Ganti Email
          </div>
          <div className="mt-2 text-sm text-muted">
            Supabase biasanya akan meminta konfirmasi perubahan email lewat inbox.
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-ink">Email baru</span>
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="emailbaru@contoh.com"
                disabled={emailLoading}
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={async () => {
                  setEmailLoading(true);
                  setEmailMessage("");
                  const result = await updateEmail({ email: emailInput });
                  setEmailLoading(false);
                  setEmailMessage(result.error || result.message || "Permintaan ganti email berhasil dikirim.");
                }}
                disabled={emailLoading}
              >
                {emailLoading ? "Mengirim..." : "Simpan Email Baru"}
              </Button>
              {emailMessage ? <div className="text-sm text-muted">{emailMessage}</div> : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <KeyRound size={16} className="text-brand-2" />
            Ganti Password
          </div>
          <div className="mt-2 text-sm text-muted">
            Gunakan password baru minimal 6 karakter dan simpan langsung dari halaman akun.
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-ink">Password baru</span>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                disabled={passwordLoading}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-ink">Konfirmasi password baru</span>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                disabled={passwordLoading}
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={async () => {
                  setPasswordLoading(true);
                  setPasswordMessage("");
                  const result = await updatePassword({
                    password: newPassword,
                    confirmPassword,
                  });
                  setPasswordLoading(false);
                  if (!result.error) {
                    setNewPassword("");
                    setConfirmPassword("");
                  }
                  setPasswordMessage(result.error || "Password berhasil diperbarui.");
                }}
                disabled={passwordLoading}
              >
                {passwordLoading ? "Menyimpan..." : "Simpan Password Baru"}
              </Button>
              {passwordMessage ? <div className="text-sm text-muted">{passwordMessage}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="text-sm font-semibold text-ink">Peran akun</div>
        <div className="mt-2 text-sm text-muted">
          Portal penulis sekarang mengaktifkan peran <span className="font-semibold text-ink">Penulis</span>{" "}
          secara otomatis saat pertama kali dibuka. Kamu tidak perlu lagi memilih manual dari halaman akun.
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          Status saat ini: <span className="font-semibold text-ink">{roleLabel}</span>.
          {user.role === "ADMIN"
            ? " Role admin tetap dikelola manual dan tidak berubah otomatis."
            : " Saat kamu masuk ke portal penulis, sistem akan menyimpan peran Penulis ke akun secara otomatis."}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="text-sm font-semibold text-ink">Aksi akun</div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link to="/langganan">
            <Button variant="secondary">Kelola Paket</Button>
          </Link>
          <Link to="/perpustakaan">
            <Button variant="secondary">
              <UserRound size={16} />
              Perpustakaan Saya
            </Button>
          </Link>
          <Link to="/bookmark">
            <Button variant="secondary">
              <Bookmark size={16} />
              Bookmark Saya
            </Button>
          </Link>
          <Link to="/wishlist">
            <Button variant="secondary">
              <Heart size={16} />
              Wishlist Saya
            </Button>
          </Link>
          <Link to="/penulis">
            <Button variant="secondary">
              <PenSquare size={16} />
              Portal Penulis
            </Button>
          </Link>
          <a href={`mailto:${user.email}`}>
            <Button variant="secondary">
              <Mail size={16} />
              Email Saya
            </Button>
          </a>
          <Button
            variant="danger"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            <LogOut size={16} />
            Keluar
          </Button>
        </div>
      </div>
    </div>
  );
}
