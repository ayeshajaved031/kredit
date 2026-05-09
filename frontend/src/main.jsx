// ==============================================================
// App Entry
// ==============================================================

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./AppRouter";

import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4500,
            style: {
              background: "#171A21",
              color: "#F5F7FA",
              border: "1px solid #2A2F3A",
              borderRadius: "10px",
              fontFamily: "'Inter Tight Variable', 'Inter Tight', sans-serif",
              fontSize: "14px",
              padding: "12px 14px",
            },
            success: {
              iconTheme: { primary: "#C6FF3B", secondary: "#0F1115" },
            },
            error: {
              iconTheme: { primary: "#B91C1C", secondary: "#F5F7FA" },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
