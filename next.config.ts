import type { NextConfig } from "next";

// Xuất ra trang tĩnh (thư mục out/) — toàn bộ logic nằm ở Supabase.
// Deploy dưới thư mục con (GitHub Pages: /moc-coffee) thì đặt NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
