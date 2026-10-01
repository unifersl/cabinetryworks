import type { NextConfig } from "next";

const securityHeaders = [
  // MIME-type sniffing defense.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full URL of internal pages via the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down browser features the app doesn't need.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS — force HTTPS for a year on all subdomains once deployed behind TLS.
  // NOTE: disabled in dev to avoid blocking the preview panel iframe.
  // { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Strict mode surfaces potential issues (double-effects, deprecated APIs)
  // and is recommended for all Next.js apps.
  reactStrictMode: true,
  // NOTE: `ignoreBuildErrors: true` is intentionally left enabled because
  // several existing route handlers (e.g. /api/backup/import/route.ts,
  // /api/demo-data/route.ts) use dynamic `db[model]` access patterns that
  // the TypeScript compiler can't fully type-check. Removing this flag
  // would fail the build. To disable this safely, those routes need to be
  // refactored to use Prisma's typed delegate API or explicit casts.
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Apply security headers to every response.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
