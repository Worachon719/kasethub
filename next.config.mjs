/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Keep @prisma/client and its query engine out of the serverless bundle.
  // Vercel traces the package and installs the engine natively per build.
  // Renamed from `experimental.serverComponentsExternalPackages` in Next 15; the
  // old key still worked but warned on every build.
  serverExternalPackages: ["@prisma/client", "prisma"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // Pinned rather than left to the default. The 14.x default happens to be
    // webp only, but AVIF is opt-in, and enabling it re-opens
    // GHSA-2xp9-vwfh-vxw4 (unauthenticated RCE in the image optimisation API
    // when AVIF is served). Naming the allowlist explicitly means a future
    // upgrade cannot widen it by changing a default.
    // See the audit triage in README.md.
    formats: ["image/webp"],
  },
};

export default nextConfig;
