import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Client phía server dùng service role key — được ghi dữ liệu */
export function sbAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function staffOk(req: Request): boolean {
  const pin = process.env.STAFF_PIN || "1234";
  return req.headers.get("x-staff-pin") === pin;
}
