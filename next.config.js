/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 blocks cross-origin requests to dev-only assets and the HMR
  // websocket by default. The dev server binds 0.0.0.0 and is opened via
  // the LAN IP, so it must be whitelisted or the browser never hydrates
  // (blank dropdowns, dead buttons, endless skeletons). Dev-only —
  // ignored by `next start`/`next build`.
  allowedDevOrigins: ["172.16.1.25"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
