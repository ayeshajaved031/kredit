// ==============================================================
// StartupLayout
// --------------------------------------------------------------
// Composes AppLayout with the navigation items relevant to a
// startup user. Admin layout (Phase 9c) does the same with
// admin nav items.
// ==============================================================

import {
  Home, ShoppingBag, FileText, FileSignature, Wallet,
  Bell, MessageSquare, Building2,
} from "lucide-react";
import AppLayout from "./AppLayout";

const NAV_ITEMS = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: Home, end: true },
    ],
  },
  {
    label: "Financing",
    items: [
      { to: "/vendors", label: "Vendors", icon: ShoppingBag },
      { to: "/apply", label: "Apply for financing", icon: FileText },
      { to: "/requests", label: "My requests", icon: FileText },
      { to: "/contracts", label: "My contracts", icon: FileSignature },
      { to: "/payments", label: "Payments", icon: Wallet },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/tickets", label: "Support", icon: MessageSquare },
      { to: "/profile", label: "Company profile", icon: Building2 },
    ],
  },
];

export default function StartupLayout() {
  return <AppLayout navItems={NAV_ITEMS} />;
}
