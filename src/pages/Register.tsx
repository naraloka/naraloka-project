import { useEffect, useState } from "react";
import { Chrome } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useSessionStore } from "@/stores/sessionStore";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSessionStore((s) => s.user);
  const authError = useSessionStore((s) => s.authError);
  const signUpWithPassword = useSessionStore((s) => s.signUpWithPassword);
  const signInWithGoogle = useSessionStore((s) => s.signInWithGoogle);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const redirectTo = from?.pathname ? `${from.pathname}${from.search ?? ""}` : "/";

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo, user]);

  async function handleRegister() {
    if (!name.trim() || !email.trim()) {
      setError("Nama dan email wajib diisi.");
      return;
    }
    if (!email.includes("@")) {
      setError("Format email belum valid.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    const result = await signUpWithPassword({ name, email, password, role: "READER" });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.requiresEmailConfirmation) {
      setSuccess("Akun dibuat. Cek email untuk verifikasi lalu masuk kembali.");
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-8">
        <div className="text-2xl font-semibold tracking-tight text-ink">Daftar</div>
        <div className="mt-2 text-sm text-muted">
          Buat akun baru untuk mulai membaca, menyimpan wishlist, dan berlangganan. Jika nanti ingin
          menulis, portal penulis akan mengaktifkan akses penulis secara otomatis.
        </div>

        {redirectTo !== "/" ? (
          <div className="mt-4">
            <Badge tone="warning">Setelah daftar akan lanjut ke {redirectTo}</Badge>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl border border-border bg-surface p-3">
            <div className="text-sm font-semibold text-ink">Akun langsung siap dipakai</div>
            <div className="mt-2 text-xs leading-6 text-muted">
              Semua akun baru mulai dari mode pembaca. Saat kamu membuka <span className="font-semibold text-ink">Portal Penulis</span>,
              sistem akan mengaktifkan peran penulis otomatis tanpa perlu memilih manual di sini.
            </div>
          </div>

          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email aktif"
            type="email"
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
          />

          {error || authError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error || authError}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <Button onClick={handleRegister} disabled={loading}>
            {loading ? "Membuat akun..." : "Buat Akun"}
          </Button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="text-xs text-muted">atau</div>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          onClick={async () => {
            setLoading(true);
            const result = await signInWithGoogle({ role: "READER" });
            setLoading(false);
            if (result.error) setError(result.error);
          }}
          className="w-full"
          variant="secondary"
          disabled={loading}
        >
          <Chrome size={16} />
          Daftar dengan Google
        </Button>

        <div className="mt-6 text-center text-sm text-muted">
          Sudah punya akun?{" "}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
