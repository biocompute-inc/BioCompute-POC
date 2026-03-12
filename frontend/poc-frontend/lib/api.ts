const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

/**
 * Reads the csrf_token cookie that the backend sets on every GET response.
 * The cookie is intentionally NOT HttpOnly so we can echo it back as a header
 * (double-submit cookie CSRF pattern).
 */
function getCsrfToken(): string {
  if (typeof document === "undefined") return ""; // SSR guard
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const method = (options.method ?? "GET").toUpperCase();

  // For every state-changing request, read the csrf_token cookie and send it
  // back as the X-CSRF-Token header.  The backend CSRFMiddleware validates
  // that the header and cookie values match before processing the request.
  const csrfHeaders: Record<string, string> = {};
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      csrfHeaders["X-CSRF-Token"] = csrf;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // IMPORTANT: send session + csrf cookies
    headers: {
      "Content-Type": "application/json",
      ...csrfHeaders,
      ...(options.headers || {}),
    },
  });

  // ✅ 204 No Content: nothing to parse
  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  const ct = res.headers.get("content-type") || "";

  // ✅ if JSON, still guard against empty body
  if (ct.includes("application/json")) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  return res.text();
}

