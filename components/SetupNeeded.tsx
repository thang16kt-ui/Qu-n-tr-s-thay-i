import Logo from "./Logo";

export default function SetupNeeded() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Logo size={64} />
      <h1 className="mt-6 text-2xl font-bold text-bean-dark">Chưa kết nối database</h1>
      <p className="mt-3 text-muted">
        App cần Supabase để chạy. Hãy tạo file <b>.env.local</b> (sao chép từ <b>.env.example</b>) và điền
        NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY — rồi khởi động lại app (trên Vercel: Settings → Environment Variables → Redeploy).
      </p>
      <p className="mt-3 text-muted">Xem hướng dẫn chi tiết trong file README.md.</p>
    </main>
  );
}
