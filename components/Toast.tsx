"use client";
import { createContext, useCallback, useContext, useState } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout((window as unknown as { __mt?: number }).__mt);
    (window as unknown as { __mt?: number }).__mt = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-6 pt-safe">
          <div className="animate-pop rounded-full bg-bean-dark/95 px-5 py-3 text-center text-sm font-medium text-cream shadow-lg">
            {msg}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
