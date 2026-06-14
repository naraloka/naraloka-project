import { useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "@/components/AppShell";
import Account from "@/pages/Account";
import AdminDashboard from "@/pages/AdminDashboard";
import ArticleDetail from "@/pages/ArticleDetail";
import Articles from "@/pages/Articles";
import AuthorPortal from "@/pages/AuthorPortal";
import BookmarksPage from "@/pages/Bookmarks";
import Catalog from "@/pages/Catalog";
import Checkout from "@/pages/Checkout";
import EbookDetail from "@/pages/EbookDetail";
import Home from "@/pages/Home";
import LibraryPage from "@/pages/Library";
import Login from "@/pages/Login";
import Reader from "@/pages/Reader";
import Register from "@/pages/Register";
import Subscription from "@/pages/Subscription";
import Wishlist from "@/pages/Wishlist";
import { useSessionStore } from "@/stores/sessionStore";
import type { UserRole } from "@/types/domain";

function AuthBootstrap() {
  const initializeAuth = useSessionStore((s) => s.initializeAuth);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  return null;
}

function ProtectedRoute({
  allowedRoles,
  fallbackPath = "/",
}: {
  allowedRoles?: UserRole[];
  fallbackPath?: string;
}) {
  const location = useLocation();
  const user = useSessionStore((s) => s.user);
  const authReady = useSessionStore((s) => s.authReady);

  if (!authReady) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-center text-sm text-muted">
        Memuat sesi akun...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={fallbackPath}
        replace
        state={{
          deniedFrom: location.pathname,
          requiredRoles: allowedRoles,
        }}
      />
    );
  }

  return <Outlet />;
}

function AuthorRoute() {
  const location = useLocation();
  const user = useSessionStore((s) => s.user);
  const authReady = useSessionStore((s) => s.authReady);
  const setUserRole = useSessionStore((s) => s.setUserRole);
  const triedAutoUpgradeRef = useRef(false);
  const [upgradeError, setUpgradeError] = useState("");

  useEffect(() => {
    if (!authReady || !user || user.role !== "READER" || triedAutoUpgradeRef.current) {
      return;
    }

    triedAutoUpgradeRef.current = true;
    void (async () => {
      const result = await setUserRole("AUTHOR");
      if (result.error) {
        setUpgradeError(result.error);
      }
    })();
  }, [authReady, setUserRole, user]);

  if (!authReady) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-center text-sm text-muted">
        Memuat sesi akun...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role === "ADMIN" || user.role === "AUTHOR") {
    return <Outlet />;
  }

  if (upgradeError) {
    return (
      <Navigate
        to="/akun"
        replace
        state={{
          deniedFrom: location.pathname,
          autoUpgradeError: upgradeError,
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6 text-center text-sm text-muted">
      Mengaktifkan akses portal penulis untuk akun kamu...
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthBootstrap />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/daftar" element={<Register />} />
          <Route path="/artikel" element={<Articles />} />
          <Route path="/artikel/:articleId" element={<ArticleDetail />} />
          <Route path="/katalog" element={<Catalog />} />
          <Route path="/ebook/:ebookId" element={<EbookDetail />} />
          <Route path="/baca/:ebookId" element={<Reader />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/akun" element={<Account />} />
            <Route path="/bookmark" element={<BookmarksPage />} />
            <Route path="/perpustakaan" element={<LibraryPage />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/checkout" element={<Checkout />} />
          </Route>
          <Route element={<AuthorRoute />}>
            <Route path="/penulis" element={<AuthorPortal />} />
          </Route>
          <Route path="/langganan" element={<Subscription />} />
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} fallbackPath="/akun" />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route
            path="*"
            element={
              <div className="rounded-2xl border border-border bg-white p-6 text-center">
                <div className="text-sm font-semibold text-ink">Halaman tidak ditemukan</div>
                <div className="mt-1 text-sm text-muted">
                  Coba kembali ke <a className="font-semibold text-brand hover:underline" href="/">beranda</a>.
                </div>
              </div>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}
