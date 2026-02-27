import path from "path";

/** @type {import('next').NextConfig} */
const isVercel = process.env.VERCEL === "1";

const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: isVercel ? process.cwd() : path.join(process.cwd(), "../.."),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.cdn.filesafe.space"
      }
    ]
  }
};

export default nextConfig;
