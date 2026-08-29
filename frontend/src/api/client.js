import axios from "axios";
import { clearToken, getToken } from "../auth.js";

// Production (built bundle, served by Django on the same origin) uses a
// relative /api URL so it works on any domain. Dev mode (Vite on :5173) calls
// the Django dev server directly. Override either way with VITE_API_URL.
const DEFAULT_API = import.meta.env.PROD ? "/api" : "http://127.0.0.1:8001/api";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || DEFAULT_API,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.startsWith("/auth/login")) {
      clearToken();
      if (window.location.pathname !== "/app/login") window.location.href = "/app/login";
    }
    return Promise.reject(error);
  }
);

export default api;
