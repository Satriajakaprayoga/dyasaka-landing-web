/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 blocks cross-origin requests to dev-only assets and the HMR
  // websocket by default. When the dev server is opened via a LAN IP it
  // must be whitelisted or the browser never hydrates (blank dropdowns,
  // dead buttons, endless skeletons). Configure per machine instead of
  // committing someone's IP:
  //   ALLOWED_DEV_ORIGINS=172.16.1.25,192.168.1.10 npm run dev
  // Dev-only — ignored by `next start`/`next build`.
  ...(process.env.ALLOWED_DEV_ORIGINS
    ? {
        allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      }
    : {}),
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
