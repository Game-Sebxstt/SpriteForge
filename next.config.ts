import type { NextConfig } from "next";

/**
 * Baseline security headers.
 *
 * NOTE: these apply under the production server (`next start`) and are not
 * guaranteed under the Turbopack dev server, so verify them against
 * `next build && next start`.
 *
 * TODO(CSP): add a Content-Security-Policy once all inline scripts are removed.
 * A too-strict CSP before then would break the app, so it is deferred. See
 * SECURITY.md for the tracking note.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
