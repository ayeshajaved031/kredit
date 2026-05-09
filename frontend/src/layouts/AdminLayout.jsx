// ==============================================================
// AdminLayout
// --------------------------------------------------------------
// Wraps AppLayout with the admin navigation tree.
// ==============================================================

import {
  Home, Users, FileText, FileSignature, ShoppingBag,
  MessageSquare, ScrollText, BarChart3, Building2, ShieldCheck,
} from "lucide-react";
import AppLayout from "./AppLayout";

const NAV = [
  {
    items: [
      { to: "/admin", label: "Dashboard", icon: Home, end: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/kyc", label: "KYC review", icon: ShieldCheck },
      { to: "/admin/requests", label: "Financing queue", icon: FileText },
      { to: "/admin/contracts", label: "Contracts", icon: FileSignature },
      { to: "/admin/tickets", label: "Support tickets", icon: MessageSquare },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/admin/vendors", label: "Vendors", icon: ShoppingBag },
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/startups", label: "Startups", icon: Building2 },
    ],
  },
  {
    label: "Compliance",
    items: [
      { to: "/admin/reports", label: "Reports", icon: BarChart3 },
      { to: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export default function AdminLayout() {
  return <AppLayout navItems={NAV} />;
}
