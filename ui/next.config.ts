import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://logpose-backend:8324";
const CREW_URL = process.env.CREW_URL || "http://logpose-crew:8325";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/game/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/api/crew/:path*", destination: `${CREW_URL}/api/crew/:path*` },
      { source: "/media/:path*", destination: `${BACKEND_URL}/media/:path*` },
    ];
  },
};

export default nextConfig;
