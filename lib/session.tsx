"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { sb, supabaseConfigured } from "./supabase";
import { api } from "./api";
import type { Member } from "./types";

type Session = {
  phone: string | null;
  member: Member | null;
  ready: boolean;
  login: (phone: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);
const KEY = "moc.phone";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPhone(localStorage.getItem(KEY));
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!phone || !supabaseConfigured) return;
    const { data } = await sb().from("members").select("*").eq("phone", phone).maybeSingle();
    if (data) setMember(data as Member);
  }, [phone]);

  // Tải + theo dõi realtime điểm/hạng
  useEffect(() => {
    if (!phone || !supabaseConfigured) return;
    refresh();
    const ch = sb()
      .channel(`member-${phone}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "members", filter: `phone=eq.${phone}` },
        (p) => setMember(p.new as Member))
      .subscribe();
    return () => { sb().removeChannel(ch); };
  }, [phone, refresh]);

  const login = useCallback(async (p: string) => {
    const m = await api.login(p);
    localStorage.setItem(KEY, m.phone);
    setMember(m);
    setPhone(m.phone);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    localStorage.removeItem("moc.cart");
    setPhone(null);
    setMember(null);
  }, []);

  return <Ctx.Provider value={{ phone, member, ready, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession ngoài SessionProvider");
  return c;
}
