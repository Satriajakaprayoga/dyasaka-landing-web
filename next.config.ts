import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  logging: {
    // browserToTerminal: true,
    incomingRequests: false,
  },
  allowedDevOrigins: ["172.16.1.72"],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
