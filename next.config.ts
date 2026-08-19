import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Origin of NEXT_PUBLIC_API_URL, when it points at a different host than the
 * app itself. Relative values ("/api") and unparseable ones fall back to
 * 'self' and contribute nothing.
 */
function apiOrigin(): string[] {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw || raw.startsWith("/")) return [];
  try {
    return [new URL(raw).origin];
  } catch {
    return [];
  }
}

/**
 * Content-Security-Policy for pages served by Next.js.
 *
 * 'unsafe-inline' is required in both script-src and style-src:
 *   - script-src: the App Router emits inline bootstrap and RSC flight-data
 *     scripts (self.__next_f.push(...)) whose contents vary per response, so
 *     they cannot be covered by static hashes. Nonces would work but opt every
 *     page out of static rendering.
 *   - style-src: React style={{...}} attributes are style *attributes*, which
 *     nonces and hashes never cover.
 *
 * Google sign-in is a top-level redirect to accounts.google.com, so it needs no
 * script-src/frame-src allowance here.
 */
function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      // next dev's HMR runtime evaluates code at runtime; production does not.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // data: covers the inline SVG background patterns used across the pages.
    // Google account avatars are served from lh3.googleusercontent.com.
    "img-src": ["'self'", "data:", "blob:", "https://lh3.googleusercontent.com"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...apiOrigin(), ...(isDev ? ["ws:"] : [])],
    "frame-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  const policy = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");

  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
