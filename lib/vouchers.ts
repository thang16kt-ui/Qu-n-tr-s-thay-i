"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "./supabase";
import type { MemberVoucher } from "./types";

export function useMyVouchers(phone: string | null) {
  const [list, setList] = useState<MemberVoucher[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!phone) return;
    const { data } = await sb().from("member_vouchers").select("*, vouchers(*)")
      .eq("member_phone", phone).eq("used", false).gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setList((data ?? []) as MemberVoucher[]);
    setLoaded(true);
  }, [phone]);
  useEffect(() => { load(); }, [load]);
  return { list, loaded, reload: load };
}
