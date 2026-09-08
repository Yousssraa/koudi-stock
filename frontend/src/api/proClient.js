import axios from "axios";
import { clearProToken, getProToken } from "../authPro.js";

// Same server, but authenticated against the pro portal (uses the pro token).
const DEFAULT_API = import.meta.env.PROD ? "/api" : "http://127.0.0.1:8001/api";

const proApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || DEFAULT_API,
  headers: { "Content-Type": "application/json" },
});

proApi.interceptors.request.use((config) => {
  const token = getProToken();
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

proApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.startsWith("/pro/auth/login")
    ) {
      clearProToken();
      if (window.location.pathname !== "/pro/login")
        window.location.href = "/pro/login";
    }
    return Promise.reject(error);
  }
);

export default proApi;
