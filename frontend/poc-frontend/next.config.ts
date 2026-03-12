import type { NextConfig } from "next";

// Applied to all routes served by Next.js
const securityHeaders = [
  // Disallow embedding in iframes (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy XSS filter (IE / older browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Limit referrer leakage to same-origin on cross-origin navigations
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser feature/permission APIs
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // HSTS — tells browsers to use HTTPS for 1 year once they've seen it once.
  // Safe to pre-set because the deployment is behind Cloudflare Tunnel (HTTPS).
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Content Security Policy
  // 'unsafe-inline' on script/style is needed by Next.js (inline chunks & styles).
  // Tighten further once nonces/hashes are wired up.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-eval in dev mode (removed automatically in prod
      // builds but easiest to keep consistent here for the POC).
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      // Only talk back to the same origin (API is proxied via nginx on same host)
      "connect-src 'self'",
      // Prevent framing from any other origin
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        // Apply security headers to every page and API route
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
