import type { MetadataRoute } from "next";

export const dynamic = "force-static";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mộc Coffee",
    short_name: "Mộc",
    description: "Tích điểm, đặt món trước và nhận ưu đãi tại Mộc Coffee",
    start_url: `${BASE}/home/`,
    scope: `${BASE}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5efe7",
    theme_color: "#f5efe7",
    lang: "vi",
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
