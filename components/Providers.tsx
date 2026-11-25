"use client";
import { useEffect } from "react";
import { SessionProvider } from "@/lib/session";
import { CartProvider } from "@/lib/cart";
import { registerSW } from "@/lib/push";
import { unlockAudio } from "@/lib/sound";
import { supabaseConfigured } from "@/lib/supabase";
import { ToastProvider } from "./Toast";
import SetupNeeded from "./SetupNeeded";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerSW();
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  if (!supabaseConfigured) return <SetupNeeded />;

  return (
    <ToastProvider>
      <SessionProvider>
        <CartProvider>{children}</CartProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
