// ==============================================================
// Public Layout
// --------------------------------------------------------------
// Used by the landing and auth pages. Top nav with logo + sign-in
// link. The pages themselves provide their own backgrounds (the
// landing has the radial glows; auth pages are simpler).
// ==============================================================

import { Outlet, Link, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import Button from "../components/Button";

export default function PublicLayout({ minimal = false }) {
  const { pathname } = useLocation();
  const onAuthPage = /^\/(login|register|verify-email|forgot-password|reset-password)/.test(pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 sm:px-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <Logo size="md" />
          </Link>
          {!minimal && (
            <nav className="flex items-center gap-3 sm:gap-5 text-sm">
              {!onAuthPage && (
                <>
                  <Link
                    to="/login"
                    className="hidden sm:inline text-ink-muted hover:text-ink transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link to="/register">
                    <Button size="sm">Get started</Button>
                  </Link>
                </>
              )}
              {onAuthPage && (
                <Link
                  to={pathname.startsWith("/login") ? "/register" : "/login"}
                  className="text-ink-muted hover:text-ink transition-colors"
                >
                  {pathname.startsWith("/login")
                    ? "Create account"
                    : "Have an account? Sign in"}
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      <footer className="px-6 py-6 border-t border-divider mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-faint">
          <p>© {new Date().getFullYear()} Kredit. Built for Pakistani startups.</p>
          <div className="flex gap-5">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
