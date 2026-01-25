const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // IMPORTANT: send cookie
    headers: {
      "Content-Type": "application/json",
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
