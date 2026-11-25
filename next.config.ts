import type { NextConfig } from "next";

// Chạy trên Vercel (có máy chủ cho route /api/notify gửi Web Push).
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
