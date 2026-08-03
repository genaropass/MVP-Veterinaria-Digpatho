import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      }
    ]
  },
  experimental: {
    middlewareClientMaxBodySize: "50gb",
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    serverActions: {
      allowedOrigins: ["app.digpatho.com", "localhost:3000"],
      bodySizeLimit: "50gb",
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Avoid failing production builds due Next.js validator.ts path generation
    // mismatch in this src/app + Linux deploy setup.
    ignoreBuildErrors: true,
  },

  // Bloque para redirigir /tiles al backend
  async rewrites() {
    return [
      {
        source: "/tiles/:path*", 
        destination: "http://localhost:8000/tiles/:path*",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
