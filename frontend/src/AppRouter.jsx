// ==============================================================
// App Router
// --------------------------------------------------------------
// All routes live here. Lazy-loaded route chunks for everything
// behind login keep the public bundle tiny.
// ==============================================================

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import PublicLayout from "./layouts/PublicLayout";
import StartupLayout from "./layouts/StartupLayout";
import AdminLayout from "./layouts/AdminLayout";
import { GuestRoute, AdminRoute, StartupRoute } from "./components/RouteGuards";
import { LoadingScreen } from "./components/Loading";

// Public pages — eager
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

// Startup pages — lazy
const SDashboard = lazy(() => import("./pages/startup/Dashboard"));
const SVendors = lazy(() => import("./pages/startup/Vendors"));
const SApply = lazy(() => import("./pages/startup/Apply"));
const SRequests = lazy(() => import("./pages/startup/Requests"));
const SRequestDetail = lazy(() => import("./pages/startup/RequestDetail"));
const SContracts = lazy(() => import("./pages/startup/Contracts"));
const SContractDetail = lazy(() => import("./pages/startup/ContractDetail"));
const SSchedule = lazy(() => import("./pages/startup/Schedule"));
const SMakePayment = lazy(() => import("./pages/startup/MakePayment"));
const SPayments = lazy(() => import("./pages/startup/Payments"));
const SPaymentDetail = lazy(() => import("./pages/startup/PaymentDetail"));
const SNotifications = lazy(() => import("./pages/startup/Notifications"));
const STickets = lazy(() => import("./pages/startup/Tickets"));
const SNewTicket = lazy(() => import("./pages/startup/NewTicket"));
const STicketDetail = lazy(() => import("./pages/startup/TicketDetail"));
const SProfile = lazy(() => import("./pages/startup/Profile"));

// Admin pages — lazy
const ADashboard = lazy(() => import("./pages/admin/Dashboard"));
const AKycReview = lazy(() => import("./pages/admin/KycReview"));
const ARequestQueue = lazy(() => import("./pages/admin/RequestQueue"));
const AContracts = lazy(() => import("./pages/admin/Contracts"));
const AVendors = lazy(() => import("./pages/admin/Vendors"));
const AUsers = lazy(() => import("./pages/admin/Users"));
const AStartups = lazy(() => import("./pages/admin/Startups"));
const ATickets = lazy(() => import("./pages/admin/Tickets"));
const ATicketDetail = lazy(() => import("./pages/admin/TicketDetail"));
const AAuditLog = lazy(() => import("./pages/admin/AuditLog"));
const AReports = lazy(() => import("./pages/admin/Reports"));

const Lazy = ({ children }) => (
  <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
);

export default function AppRouter() {
  return (
    <Routes>
      {/* Public + auth */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="verify-email/:token" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />
      </Route>

      {/* Authenticated startup */}
      <Route element={<StartupRoute><StartupLayout /></StartupRoute>}>
        <Route path="dashboard" element={<Lazy><SDashboard /></Lazy>} />
        <Route path="vendors" element={<Lazy><SVendors /></Lazy>} />
        <Route path="apply" element={<Lazy><SApply /></Lazy>} />
        <Route path="requests" element={<Lazy><SRequests /></Lazy>} />
        <Route path="requests/:id" element={<Lazy><SRequestDetail /></Lazy>} />
        <Route path="contracts" element={<Lazy><SContracts /></Lazy>} />
        <Route path="contracts/:id" element={<Lazy><SContractDetail /></Lazy>} />
        <Route path="contracts/:id/schedule" element={<Lazy><SSchedule /></Lazy>} />
        <Route path="payments" element={<Lazy><SPayments /></Lazy>} />
        <Route path="payments/pay/:scheduleId" element={<Lazy><SMakePayment /></Lazy>} />
        <Route path="payments/:id" element={<Lazy><SPaymentDetail /></Lazy>} />
        <Route path="notifications" element={<Lazy><SNotifications /></Lazy>} />
        <Route path="tickets" element={<Lazy><STickets /></Lazy>} />
        <Route path="tickets/new" element={<Lazy><SNewTicket /></Lazy>} />
        <Route path="tickets/:id" element={<Lazy><STicketDetail /></Lazy>} />
        <Route path="profile" element={<Lazy><SProfile /></Lazy>} />
      </Route>

      {/* Authenticated admin */}
      <Route path="admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Lazy><ADashboard /></Lazy>} />
        <Route path="kyc" element={<Lazy><AKycReview /></Lazy>} />
        <Route path="requests" element={<Lazy><ARequestQueue /></Lazy>} />
        <Route path="contracts" element={<Lazy><AContracts /></Lazy>} />
        <Route path="vendors" element={<Lazy><AVendors /></Lazy>} />
        <Route path="users" element={<Lazy><AUsers /></Lazy>} />
        <Route path="startups" element={<Lazy><AStartups /></Lazy>} />
        <Route path="tickets" element={<Lazy><ATickets /></Lazy>} />
        <Route path="tickets/:id" element={<Lazy><ATicketDetail /></Lazy>} />
        <Route path="audit" element={<Lazy><AAuditLog /></Lazy>} />
        <Route path="reports" element={<Lazy><AReports /></Lazy>} />
        {/* Notifications use the same component — endpoint filters by userId server-side */}
        <Route path="notifications" element={<Lazy><SNotifications /></Lazy>} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
