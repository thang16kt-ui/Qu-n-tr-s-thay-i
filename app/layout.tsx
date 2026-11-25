import type { Metadata, Viewport } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";
import Providers from "@/components/Providers";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Mộc Coffee",
  description: "Tích điểm, đặt món trước và nhận ưu đãi tại Mộc Coffee",
  applicationName: "Mộc Coffee",
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Mộc Coffee", statusBarStyle: "default" },
  icons: {
    icon: [{ url: `${BASE}/icons/favicon-48.png`, sizes: "48x48" }, { url: `${BASE}/icons/icon-192.png`, sizes: "192x192" }],
    apple: `${BASE}/icons/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fff7ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
