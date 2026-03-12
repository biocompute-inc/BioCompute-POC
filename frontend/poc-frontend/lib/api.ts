const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

/**
 * Reads the csrf_token cookie that the backend sets on every GET response.
 * The cookie is intentionally NOT HttpOnly so we can echo it back as a header
 * (double-submit cookie CSRF pattern).
 * Exported so multipart/form-data uploads (which bypass apiFetch) can use it.
 */
export function getCsrfToken(): string {
  if (typeof document === "undefined") return ""; // SSR guard
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Maps known backend error payloads to friendly UI messages, while logging
 * the raw technical detail to the browser console for debugging.
 *
 * Backend errors can arrive as:
 *   • JSON  { "detail": "..." }
 *   • Plain text  "Some error"
 *   • HTTP status with no body
 */
export function parseError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Always log the full detail for developers
  console.error("[BioCompute error]", raw);

  // Try to parse a JSON body that looks like { "detail": "..." }
  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.detail) detail = String(parsed.detail);
  } catch {
    // raw was plain text — use as-is
  }

  // Map known technical phrases to human-friendly messages
  const lower = detail.toLowerCase();
  if (lower.includes("csrf token missing") || lower.includes("csrf token mismatch"))
    return "Your session token expired. Please refresh the page and try again.";
  if (lower.includes("not logged in") || lower.includes("invalid session") || lower.includes("session expired"))
    return "You are not logged in. Please sign in and try again.";
  if (lower.includes("invalid credentials"))
    return "Incorrect email or password. Please try again.";
  if (lower.includes("email already registered") || lower.includes("email already exists"))
    return "An account with that email already exists.";
  if (lower.includes("password must be at least"))
    return "Password is too short — must be at least 6 characters.";
  if (lower.includes("password too long"))
    return "Password is too long — maximum 24 characters.";
  if (lower.includes("invalid email"))
    return "Please enter a valid email address.";
  if (lower.includes("forbidden") || lower.includes("not allowed") || lower.includes("not assigned"))
    return "You don't have permission to do that.";
  if (lower.includes("too many") || lower.includes("rate limit"))
    return "Too many attempts. Please wait a moment and try again.";
  if (lower.includes("not found"))
    return "The requested item could not be found.";
  if (lower.includes("job cannot be deleted"))
    return "This job can't be deleted in its current state.";
  if (lower.includes("protocol file not found"))
    return "Protocol file not found. Please generate a protocol first.";
  if (lower.includes("network") || lower.includes("failed to fetch"))
    return "Network error. Please check your connection and try again.";

  // Fall back to the detail string if nothing matched (still human-readable)
  return detail.length > 120 ? "An unexpected error occurred. Please try again." : detail;
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

