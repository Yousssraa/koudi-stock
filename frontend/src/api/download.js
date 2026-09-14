import { clearToken, getToken } from "../auth.js";

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://127.0.0.1:8001/api");

function buildUrl(url, params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${BASE_URL}${url}${query ? `?${query}` : ""}`;
}

export async function downloadPdf(url, filename, params = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(buildUrl(url, params), { headers });

  if (!res.ok) {
    const err = new Error(`La requête a échoué avec le statut ${res.status}`);
    err.response = { status: res.status, data: await res.json().catch(() => ({})) };
    if (res.status === 401 && !url.startsWith("/auth/login")) {
      clearToken();
      if (window.location.pathname !== "/app/login") window.location.href = "/app/login";
    }
    throw err;
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}