// ==============================================================
// AppLayout
// --------------------------------------------------------------
// Shell for every authenticated page (both startup and admin).
// Sidebar nav (collapsible on mobile) + top bar with bell + avatar.
//
// nav items are passed in as a prop so the same layout serves
// both startup + admin views with different links.
// ==============================================================

import { useEffect, useState, useRef } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import {
  Bell, Menu, X, LogOut, User, ChevronDown,
} from "lucide-react";

import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function AppLayout({ navItems = [] }) {
  const { user, startup, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef(null);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close user menu on click outside
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Poll unread notifications every 60s. Best-effort — a 401 here would
  // already redirect via the axios interceptor.
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      try {
        const res = await api.get("/notifications/unread-count");
        if (alive) setUnread(res.data?.data?.unreadCount || 0);
      } catch { /* ignore */ }
    };
    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const initials = (user?.fullName || "?")
    .split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  const greetingName = startup?.companyName || user?.fullName || "";

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 lg:z-0
          h-screen w-64 shrink-0
          bg-bg border-r border-divider
          transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col
        `}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-divider">
          <Logo />
          <button
            className="lg:hidden p-1 -m-1 text-ink-muted hover:text-ink"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {greetingName && (
          <div className="px-5 py-4 border-b border-divider">
            <p className="text-xs text-ink-muted mb-0.5 truncate">Signed in as</p>
            <p className="text-sm font-medium truncate">{greetingName}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navItems.map((section, i) => (
            <div key={i} className={i > 0 ? "mt-5" : ""}>
              {section.label && (
                <p className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-md
                        text-sm transition-colors
                        ${isActive
                          ? "bg-surface text-ink"
                          : "text-ink-muted hover:bg-surface/50 hover:text-ink"}
                      `}
                    >
                      <item.icon size={16} strokeWidth={1.75} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="bg-lime text-bg text-[10px] font-mono font-medium px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      ) : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-divider">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-ink-muted hover:bg-surface hover:text-ink transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-bg/80 backdrop-blur border-b border-divider flex items-center px-4 sm:px-6 gap-3">
          <button
            className="lg:hidden p-1 -m-1 text-ink-muted hover:text-ink"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          <Link
            to={user?.role === "admin" ? "/admin/notifications" : "/notifications"}
            className="relative p-2 -m-2 text-ink-muted hover:text-ink transition-colors"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-lime text-bg text-[10px] font-mono font-medium flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-lavender text-lavender-ink flex items-center justify-center text-xs font-medium">
                {initials}
              </div>
              <ChevronDown size={14} className="text-ink-muted hidden sm:block" />
            </button>

            {menuOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-56 bg-surface border border-divider rounded-md shadow-popover py-1 animate-fade-in">
                <div className="px-3 py-2 border-b border-divider">
                  <p className="text-sm font-medium truncate">{user?.fullName}</p>
                  <p className="text-xs text-ink-muted truncate">{user?.email}</p>
                </div>
                {user?.role === "startup" && (
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User size={14} />
                    Profile
                  </Link>
                )}
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
