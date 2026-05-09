import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api → backend so dev cookies/CORS aren't an issue.
// In production the frontend talks to the backend's full URL via VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
