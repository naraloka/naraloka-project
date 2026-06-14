import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CreditCard, Home, Library, LogIn, LogOut, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import Input from "@/components/Input";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { supportEmail, supportEmailUrl, supportWhatsAppDisplay, supportWhatsAppUrl } from "@/constants/contact";
import { useSessionStore } from "@/stores/sessionStore";

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const authError = useSessionStore((s) => s.authError);
  const logout = useSessionStore((s) => s.logout);

  const [query, setQuery] = useState("");
  const showBottomNav = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/baca/")) return false;
    if (path.startsWith("/admin")) return false;
    return true;
  }, [location.pathname]);

  const membershipPlan = user?.membershipPlan ?? "FREE";
  const isLoggedIn = Boolean(user);
  const userInitial = user?.name?.slice(0, 1).toUpperCase() ?? "N";
  const avatarUrl = user?.avatarUrl ?? "";
  const membershipLabel =
    membershipPlan === "PREMIUM" ? "Premium" : membershipPlan === "EDU" ? "Edukasi" : "Gratis";
  const roleLabel =
    user?.role === "ADMIN"
      ? "Admin"
      : user?.role === "AUTHOR"
        ? "Penulis"
        : "Pembaca";
  const navItems = useMemo(
    () => [
      { to: "/", label: "Beranda", icon: Home },
      { to: "/katalog", label: "Katalog", icon: Search },
      { to: "/perpustakaan", label: "Perpustakaan", icon: Library },
      { to: isLoggedIn ? "/akun" : "/login", label: isLoggedIn ? "Akun" : "Masuk", icon: User },
    ],
    [isLoggedIn]
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="group flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white shadow-soft">
              <img src="/naraloka-mark.svg" alt="Naraloka" className="h-full w-full object-cover" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-ink group-hover:text-brand">
                Naraloka
              </div>
              <div className="text-[11px] text-muted">Baca. Tulis. Terkoneksi.</div>
            </div>
          </Link>

          <form
            className="hidden flex-1 md:block"
            onSubmit={(e) => {
              e.preventDefault();
              const q = query.trim();
              navigate(q ? `/katalog?q=${encodeURIComponent(q)}` : "/katalog");
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul, penulis, atau kategori…"
              className="h-11 rounded-2xl"
            />
          </form>

          <div className="ml-auto md:hidden">
            {isLoggedIn ? (
              <Link to="/akun">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-white text-sm font-semibold text-ink"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user?.name || "Profil"} className="h-full w-full object-cover" />
                  ) : (
                    userInitial
                  )}
                </button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/daftar">
                  <Button size="sm" variant="ghost">Daftar</Button>
                </Link>
                <Link to="/login">
                  <Button size="sm" variant="secondary">
                    <LogIn size={16} />
                    Masuk
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            {isLoggedIn ? (
              <>
                {user?.role === "ADMIN" ? (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 transition hover:bg-surface"
                  >
                    <span>
                      <span className="block text-[11px] text-muted">Akses cepat</span>
                      <span className="block text-sm font-semibold text-ink">Dashboard Admin</span>
                    </span>
                  </Link>
                ) : null}

                <Link
                  to="/akun"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2 transition hover:bg-surface"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand-2/10 text-sm font-semibold text-brand-2">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={user?.name || "Profil"} className="h-full w-full object-cover" />
                    ) : (
                      userInitial
                    )}
                  </span>
                  <span>
                    <span className="block text-[11px] text-muted">Masuk sebagai</span>
                    <span className="block text-sm font-semibold text-ink">
                      {user?.name} • {roleLabel}
                    </span>
                  </span>
                </Link>

                <Link
                  to="/langganan"
                  className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 transition hover:bg-surface"
                >
                  <CreditCard size={16} className="text-brand-2" />
                  <span>
                    <span className="block text-[11px] text-muted">Paket aktif</span>
                    <span className="block text-sm font-semibold text-ink">{membershipLabel}</span>
                  </span>
                </Link>

                <Button
                  variant="secondary"
                  onClick={async () => {
                    await logout();
                    navigate("/login");
                  }}
                >
                  <LogOut size={16} />
                  Keluar
                </Button>
              </>
            ) : (
              <>
                <Badge tone={authError ? "warning" : "neutral"}>{authError ? "Auth belum siap" : "Tamu"}</Badge>
                <Link to="/daftar">
                  <Button variant="ghost">Daftar</Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary">
                    <LogIn size={16} />
                    Masuk
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-10">
        <Outlet />
      </main>

      {showBottomNav ? (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/90 backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-6xl grid-cols-4 px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-muted transition",
                      isActive && "bg-brand-2/10 text-brand-2"
                    )
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      ) : null}

      <footer className="border-t border-border/60 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">Naraloka</div>
            <div className="text-xs text-muted">
              Naraloka menghubungkan pembaca, penulis, katalog, dan membership dalam satu ruang
              baca digital.
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <a href={supportWhatsAppUrl} className="hover:text-brand">
              WhatsApp CS ({supportWhatsAppDisplay})
            </a>
            <span className="h-1 w-1 rounded-full bg-border" />
            <a href={supportEmailUrl} className="hover:text-brand">
              {supportEmail}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
