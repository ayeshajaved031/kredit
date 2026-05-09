// ==============================================================
// Route Guards
// --------------------------------------------------------------
// ProtectedRoute  — requires authenticated user, else → /login
// StartupRoute    — requires role=startup
// AdminRoute      — requires role=admin
//
// All three respect the loading state — they show a centered
// spinner while AuthContext hydrates so we don't flash content
// or redirect a logged-in user prematurely.
// ==============================================================

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingScreen } from "../components/Loading";

export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    // Preserve the requested URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export function StartupRoute({ children }) {
  const { isAuthenticated, isLoading, isStartup } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isStartup) return <Navigate to="/admin" replace />;
  return children;
}

export function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

// Inverse — if already logged in, redirect AWAY from login/register
export function GuestRoute({ children }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }
  return children;
}
