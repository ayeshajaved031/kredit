// ==============================================================
// API Client
// --------------------------------------------------------------
// Single axios instance used everywhere. Two interceptors:
//
//   request:  attach Bearer token from localStorage
//   response: on 401, clear token + bounce to /login
//
// All errors from the backend already follow the
// { success, message, errors? } envelope, so we surface
// `message` as a friendly default.
// ==============================================================

import axios from "axios";

const TOKEN_KEY = "kredit_token";

// Read a fresh token on each request — covers logins/logouts mid-session
const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); }
  catch { return null; }
};

const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode etc. */ }
};

// Base URL: prefer env, fall back to relative /api which the
// Vite dev proxy handles in development.
const baseURL = (import.meta.env.VITE_API_URL || "") + "/api";

const api = axios.create({
  baseURL,
  // Reasonable timeout — backend operations like contract-sign do
  // hit the simulated payment gateway with ~200ms latency, so 30s
  // is comfortable.
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track whether we've already redirected so concurrent 401s don't
// stack up multiple navigations.
let hasRedirected = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401 && !hasRedirected) {
      // Don't bounce on the login/register endpoints themselves —
      // those legitimately return 401 for bad credentials and we
      // want the page to show the error inline.
      const url = err?.config?.url || "";
      const isAuthEndpoint = /\/auth\/(login|register|forgot-password|reset-password|verify-email)/.test(url);

      if (!isAuthEndpoint) {
        setToken(null);
        hasRedirected = true;
        // Use location to fully reset React state. We do this on a
        // microtask so the in-flight promise rejects first and the
        // calling component can clean up.
        setTimeout(() => {
          window.location.href = "/login?session=expired";
          hasRedirected = false;
        }, 0);
      }
    }

    return Promise.reject(err);
  }
);

// Helper: pull a clean error message from any axios error
export const errorMessage = (err, fallback = "Something went wrong") => {
  return (
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
};

// Helper: pull field-level validation errors when present
export const fieldErrors = (err) => err?.response?.data?.errors || null;

export { setToken, getToken };
export default api;
