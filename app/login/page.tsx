"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { normalizePhone } from "@/lib/format";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const { login, phone, ready } = useSession();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && phone) router.replace("/home"); }, [ready, phone, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = normalizePhone(value);
    if (!p) return setError("Số điện thoại chưa đúng (10 số, bắt đầu bằng 0)");
    setBusy(true);
    setError("");
    try {
      await login(p);
      router.replace("/home");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-6 pt-safe">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cream-2" />
      <div className="pointer-events-none absolute -left-16 top-56 h-40 w-40 rounded-full bg-[#d6e9d4]/70" />

      <div className="relative mt-20">
        <Logo size={64} withText />
        <h1 className="mt-10 text-[1.9rem] font-bold leading-tight text-bean-dark">
          Chào bạn,<br />ghé Mộc một chút nhé.
        </h1>
        <p className="mt-3 text-muted">Nhập số điện thoại để tích điểm, đặt món trước và nhận ưu đãi.</p>
      </div>

      <form onSubmit={submit} className="relative mt-10">
        <label className="text-sm font-semibold text-bean">Số điện thoại</label>
        <div className="mt-2 flex items-center rounded-2xl border-2 border-line bg-paper px-4 focus-within:border-caramel">
          <span className="pr-3 text-muted">🇻🇳</span>
          <input
            inputMode="tel" autoComplete="tel" placeholder="0901 234 567"
            value={value} onChange={(e) => setValue(e.target.value)}
            className="h-14 w-full bg-transparent text-lg font-semibold tracking-wide outline-none placeholder:font-normal placeholder:text-muted/60"
          />
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn-primary mt-6 h-14 w-full text-base">
          {busy ? "Đang vào…" : "Tiếp tục"}
        </button>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          Số điện thoại chính là <b>mã thành viên</b> của bạn — không cần mật khẩu.
          <br />Lần đầu? Mộc tặng bạn voucher giảm 10% 🎁
        </p>
      </form>
    </main>
  );
}
