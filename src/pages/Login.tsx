import { useEffect, useState } from "react";
import { Chrome } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useSessionStore } from "@/stores/sessionStore";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSessionStore((s) => s.user);
  const authError = useSessionStore((s) => s.authError);
  const signInWithPassword = useSessionStore((s) => s.signInWithPassword);
  const signInWithGoogle = useSessionStore((s) => s.signInWithGoogle);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const adminLoginHint =
    from?.pathname === "/admin"
      ? "Halaman ini membutuhkan akun admin. Masuk dengan akun admin untuk membuka dashboard admin."
      : "";
  const redirectTo = from?.pathname
    ? `${from.pathname}${from.search ?? ""}`
    : user?.role === "ADMIN"
      ? "/admin"
      : "/";

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo, user]);

  async function handleLogin() {
    setLoading(true);
    const result = await signInWithPassword({ email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setError("");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-soft md:p-8">
        <div className="text-2xl font-semibold tracking-tight text-ink">Masuk</div>
        <div className="mt-2 text-sm text-muted">
          Masuk dengan email dan password, atau lanjutkan dengan Google. Akses penulis akan aktif
          otomatis saat kamu membuka portal penulis dari akun yang sudah login.
        </div>
        {redirectTo !== "/" ? (
          <div className="mt-4">
            <Badge tone={redirectTo === "/admin" ? "brand" : "warning"}>
              Lanjutkan ke {redirectTo === "/admin" ? "dashboard admin" : redirectTo}
            </Badge>
          </div>
        ) : null}
        {adminLoginHint ? (
          <div className="mt-4 rounded-2xl border border-brand-2/20 bg-brand-2/5 p-3 text-sm text-brand-2">
            {adminLoginHint}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
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

          <Button onClick={handleLogin} disabled={loading}>
            {loading ? "Memproses..." : "Masuk"}
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
            const result = await signInWithGoogle();
            setLoading(false);
            if (result.error) setError(result.error);
          }}
          className="w-full"
          variant="secondary"
          disabled={loading}
        >
          <Chrome size={16} />
          Masuk dengan Google
        </Button>

        <div className="mt-6 text-center text-sm text-muted">
          Belum punya akun?{" "}
          <Link to="/daftar" className="font-semibold text-brand hover:underline">
            Daftar
          </Link>
        </div>

        <div className="mt-2 text-center text-sm text-muted">
          Kembali ke{" "}
          <Link to="/" className="font-semibold text-brand hover:underline">
            beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
