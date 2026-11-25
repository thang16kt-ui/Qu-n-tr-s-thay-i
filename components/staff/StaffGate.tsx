"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { staffApi, type StaffApi } from "@/lib/api";
import { unlockAudio } from "@/lib/sound";
import { LogoMark } from "@/components/Logo";

/** Màn hình nhân viên dùng chung 1 mã PIN (lưu trong private.settings, mặc định 1234) */
const PIN_KEY = "moc.staffPin";

type Staff = { pin: string; api: StaffApi; lock: () => void };
const Ctx = createContext<Staff | null>(null);

export function useStaff(): Staff {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStaff ngoài StaffGate");
  return c;
}

const PAGES = [
  { key: "pos", href: "/pos", label: "Quầy" },
  { key: "kitchen", href: "/kitchen", label: "Bếp" },
  { key: "admin", href: "/admin", label: "Quản lý" },
  { key: "scanner", href: "/scanner", label: "Máy quét" },
] as const;

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return <span className="tabular-nums">{now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>;
}

function PinPad({ title, onOk }: { title: string; onOk: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(p = pin) {
    if (!p || busy) return;
    setBusy(true);
    try {
      await staffApi(p).check();
      onOk(p);
    } catch {
      setErr("Sai mã PIN");
      setPin("");
    }
    setBusy(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p + e.key).slice(0, 8));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter") document.getElementById("pin-ok")?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const key = "h-16 rounded-2xl bg-paper text-2xl font-bold text-bean-dark shadow-sm active:scale-95 transition";
  return (
    <main className="grid min-h-dvh place-items-center bg-cream-2 p-6" onPointerDown={unlockAudio}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3">
          <LogoMark size={48} />
          <div>
            <div className="text-xl font-bold text-bean-dark">Mộc Coffee</div>
            <div className="text-sm text-muted">{title}</div>
          </div>
        </div>
        <div className="mt-8 flex justify-center gap-3">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-bean" : "bg-line"}`} />
          ))}
        </div>
        <p className={`mt-3 h-5 text-center text-sm ${err ? "text-caramel" : "text-muted"}`}>{err || "Nhập mã PIN nhân viên"}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} className={key} onClick={() => { setErr(""); setPin((p) => (p + d).slice(0, 8)); }}>{d}</button>
          ))}
          <button className={`${key} text-base`} onClick={() => setPin((p) => p.slice(0, -1))}>Xoá</button>
          <button className={key} onClick={() => { setErr(""); setPin((p) => (p + "0").slice(0, 8)); }}>0</button>
          <button id="pin-ok" disabled={busy || !pin} className={`${key} bg-bean! text-base text-cream! disabled:opacity-50`} onClick={() => submit()}>Vào</button>
        </div>
        <p className="mt-6 text-center text-xs text-muted">Bản demo · PIN mặc định 1234</p>
        <Link href="/home" className="mt-2 block text-center text-xs text-muted underline">← App khách</Link>
      </div>
    </main>
  );
}

export default function StaffGate({ page, title, right, children }: {
  page: (typeof PAGES)[number]["key"]; title: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  const [pin, setPin] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPin(sessionStorage.getItem(PIN_KEY));
    setReady(true);
  }, []);

  const value = useMemo<Staff | null>(() => (pin ? {
    pin,
    api: staffApi(pin),
    lock: () => { sessionStorage.removeItem(PIN_KEY); setPin(null); },
  } : null), [pin]);

  if (!ready) return null;
  if (!value) {
    return <PinPad title={title} onOk={(p) => { sessionStorage.setItem(PIN_KEY, p); setPin(p); }} />;
  }

  return (
    <Ctx.Provider value={value}>
      <div className="flex min-h-dvh flex-col bg-cream-2 print:hidden lg:h-dvh lg:overflow-hidden">
        <header className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper px-3 py-2 lg:static lg:h-14 lg:flex-nowrap lg:px-4 lg:py-0">
          <div className="flex items-center gap-2">
            <LogoMark size={30} />
            <span className="hidden font-bold text-bean-dark sm:inline">Mộc</span>
            <span className="rounded-full bg-bean px-2.5 py-0.5 text-xs font-bold text-cream">{title}</span>
          </div>
          <nav className="order-last flex w-full rounded-full bg-cream-2 p-1 lg:order-none lg:w-auto">
            {PAGES.map((p) => (
              <Link key={p.key} href={p.href}
                className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-center text-sm font-semibold sm:px-4 lg:flex-none ${p.key === page ? "bg-bean text-cream" : "text-muted"}`}>
                {p.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm font-semibold text-bean-dark">
            {right}
            <span className="hidden lg:inline"><Clock /></span>
            <button onClick={value.lock} className="rounded-full border-2 border-line px-3 py-1 text-xs font-bold text-muted">Khoá</button>
          </div>
        </header>
        <div className="flex-1 lg:min-h-0">{children}</div>
      </div>
    </Ctx.Provider>
  );
}
