"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Client cho trình duyệt (chỉ đọc + realtime) */
export function sb(): SupabaseClient {
  if (!client) {
    if (!url || !key) throw new Error("Chưa cấu hình Supabase");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
