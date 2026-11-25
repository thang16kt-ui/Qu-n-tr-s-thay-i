"use client";
import { useEffect, useState } from "react";
import { sb } from "./supabase";
import type { MenuItem } from "./types";

/** Thực đơn từ database, cập nhật realtime (giá, hết hàng…) */
export function useMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    sb().from("menu_items").select("*").order("sort").then(({ data }) => {
      if (alive) { setItems((data ?? []) as MenuItem[]); setLoading(false); }
    });
    const ch = sb()
      .channel("menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, (p) => {
        setItems((prev) => {
          if (p.eventType === "DELETE") return prev.filter((i) => i.id !== (p.old as MenuItem).id);
          const n = p.new as MenuItem;
          const rest = prev.filter((i) => i.id !== n.id);
          return [...rest, n].sort((a, b) => a.sort - b.sort);
        });
      })
      .subscribe();
    return () => { alive = false; sb().removeChannel(ch); };
  }, []);

  return { items, loading };
}
