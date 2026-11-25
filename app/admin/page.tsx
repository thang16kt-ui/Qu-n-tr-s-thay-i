"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StaffGate, { useStaff } from "@/components/staff/StaffGate";
import { LineText, Modal } from "@/components/staff/parts";
import QRCode from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import { asset } from "@/lib/api";
import { vnd } from "@/lib/format";
import { useMenu } from "@/lib/menu";
import { buildQR } from "@/lib/qr";
import { CATEGORIES, type Category, type MenuItem, type MenuOptions, type Order } from "@/lib/types";
import { IEdit, IPlus } from "@/components/Icons";

export default function AdminPage() {
  return (
    <StaffGate page="admin" title="Quản lý">
      <Admin />
    </StaffGate>
  );
}

type Tab = "menu" | "demo" | "push";

function Admin() {
  const [tab, setTab] = useState<Tab>("menu");
  return (
    <div className="flex flex-col lg:h-full lg:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-paper p-2 lg:block lg:w-56 lg:space-y-1 lg:overflow-visible lg:border-b-0 lg:border-r lg:p-3">
        {([["menu", "Thực đơn", "Thêm, sửa, giá, ảnh, hết hàng"], ["demo", "Chế độ demo", "Đơn giả lập, dữ liệu mẫu"], ["push", "Thông báo đẩy", "Kiểm tra VAPID / Web Push"]] as const).map(([k, t, d]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`shrink-0 rounded-2xl px-4 py-2 text-left lg:w-full lg:py-3 ${tab === k ? "bg-bean text-cream" : "text-bean-dark hover:bg-cream-2"}`}>
            <div className="font-bold">{t}</div>
            <div className={`hidden text-xs lg:block ${tab === k ? "text-cream/70" : "text-muted"}`}>{d}</div>
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 p-3 lg:overflow-y-auto lg:p-6">
        {tab === "menu" && <MenuAdmin />}
        {tab === "demo" && <DemoAdmin />}
        {tab === "push" && <PushAdmin />}
      </div>
    </div>
  );
}

// ===========================================================================
// THỰC ĐƠN
// ===========================================================================
const DEFAULT_SIZES = [{ name: "S", price: 0 }, { name: "M", price: 6000 }, { name: "L", price: 10000 }];
const DEFAULT_SUGAR = ["Không đường", "Ít đường", "Vừa", "Nhiều đường"];
const DEFAULT_ICE = ["Không đá", "Ít đá", "Vừa", "Nhiều đá"];

type Form = {
  id?: string; name: string; category: Category; price: string; description: string; image: string; available: boolean;
  sizes: boolean; sugar: boolean; ice: boolean; toppings: string; orig: MenuOptions;
};

function toForm(it?: MenuItem, cat: Category = "Cà phê"): Form {
  const o = it?.options || {};
  const drink = (it?.category ?? cat) !== "Bánh";
  return {
    id: it?.id, name: it?.name ?? "", category: it?.category ?? cat, price: it ? String(it.price) : "",
    description: it?.description ?? "", image: it?.image ?? "", available: it?.available ?? true,
    sizes: it ? !!o.sizes?.length : drink, sugar: it ? !!o.sugar?.length : drink, ice: it ? !!o.ice?.length : drink,
    toppings: (o.toppings ?? []).map((t) => `${t.name} | ${t.price}`).join("\n"), orig: o,
  };
}

/** "Trân châu trắng | 8000" hoặc "Trân châu trắng 8.000" hoặc "Hâm nóng" (miễn phí) */
function parseToppings(text: string) {
  return text.split("\n").map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.match(/^(.*?)[\s|:–-]*([\d.,]+)\s*(đ|k)?$/i);
    if (!m || !m[1].trim()) return { name: s.replace(/\|/g, "").trim().slice(0, 40), price: 0 };
    let price = Number(m[2].replace(/[.,]/g, "")) || 0;
    if (m[3]?.toLowerCase() === "k") price *= 1000;
    return { name: m[1].trim().slice(0, 40), price };
  });
}

function toItem(f: Form): Partial<MenuItem> {
  return {
    id: f.id, name: f.name, category: f.category, price: Number(f.price.replace(/\D/g, "")) || 0,
    description: f.description, image: f.image || null, available: f.available,
    options: {
      sizes: f.sizes ? (f.orig.sizes?.length ? f.orig.sizes : DEFAULT_SIZES) : [],
      sugar: f.sugar ? (f.orig.sugar?.length ? f.orig.sugar : DEFAULT_SUGAR) : [],
      ice: f.ice ? (f.orig.ice?.length ? f.orig.ice : DEFAULT_ICE) : [],
      toppings: parseToppings(f.toppings),
    },
  };
}

/** Thu nhỏ ảnh (tối đa 480px, JPEG) để lưu thẳng vào database — không cần dịch vụ lưu ảnh riêng */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh")); };
    img.src = url;
  });
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? "bg-done" : "bg-line"}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
    </button>
  );
}

function MenuAdmin() {
  const { items, loading } = useMenu();
  const { api } = useStaff();
  const toast = useToast();
  const [cat, setCat] = useState<Category | "all">("all");
  const [edit, setEdit] = useState<Form | null>(null);
  const list = useMemo(() => (cat === "all" ? items : items.filter((i) => i.category === cat)), [items, cat]);
  const soldOut = items.filter((i) => !i.available).length;

  async function toggle(it: MenuItem) {
    try {
      await api.setAvailable(it.id, !it.available);
      toast(`${it.name}: ${it.available ? "đã báo hết hàng" : "còn hàng"} — app khách cập nhật ngay`);
    } catch (e) { toast((e as Error).message); }
  }
  async function remove(it: MenuItem) {
    if (!window.confirm(`Xoá món “${it.name}” khỏi thực đơn?`)) return;
    try { await api.deleteMenuItem(it.id); toast(`Đã xoá ${it.name}`); } catch (e) { toast((e as Error).message); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-bean-dark">Thực đơn</h1>
        <span className="text-sm text-muted">{items.length} món · {soldOut} hết hàng</span>
        <button onClick={() => setEdit(toForm(undefined, cat === "all" ? "Cà phê" : cat))} className="btn-primary ml-auto flex h-12 shrink-0 items-center gap-2 px-4 lg:px-5">
          <IPlus size={20} /> Thêm món
        </button>
      </div>
      <div className="-mx-3 mt-4 flex gap-2 overflow-x-auto px-3 lg:mx-0 lg:px-0">
        {(["all", ...CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4 font-semibold ${cat === c ? "bg-bean text-cream" : "bg-paper text-bean-dark"}`}>
            {c === "all" ? "Tất cả" : c}
          </button>
        ))}
      </div>
      <ul className="card mt-4 divide-y divide-line">
        {list.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 lg:flex-nowrap lg:gap-4 lg:px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(it.image)} alt="" className={`h-16 w-16 rounded-2xl bg-cream-2 object-cover ${it.available ? "" : "opacity-50 grayscale"}`} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-bean-dark">{it.name}</div>
              <div className="truncate text-sm text-muted">{it.category} · {it.description}</div>
            </div>
            <div className="text-right text-lg font-bold tabular-nums text-bean lg:w-24">{vnd(it.price)}</div>
            <div className="ml-[76px] flex items-center gap-2 lg:ml-0 lg:w-32 lg:justify-end">
              <span className={`text-xs font-bold ${it.available ? "text-done" : "text-caramel"}`}>{it.available ? "Còn hàng" : "Hết hàng"}</span>
              <Toggle on={it.available} onClick={() => toggle(it)} label="Còn hàng" />
            </div>
            <button onClick={() => setEdit(toForm(it))} className="ml-auto grid h-11 w-11 lg:ml-0 place-items-center rounded-full bg-cream-2 text-bean" aria-label="Sửa"><IEdit size={20} /></button>
            <button onClick={() => remove(it)} className="h-11 rounded-full px-3 text-sm font-semibold text-danger">Xoá</button>
          </li>
        ))}
        {!list.length && <li className="p-8 text-center text-muted">{loading ? "Đang tải…" : "Chưa có món"}</li>}
      </ul>
      {edit && <MenuForm form={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MenuForm({ form, onClose }: { form: Form; onClose: () => void }) {
  const { api } = useStaff();
  const toast = useToast();
  const [f, setF] = useState(form);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const input = "h-12 w-full rounded-2xl border-2 border-line bg-paper px-4 outline-none focus:border-caramel";

  async function pickImage(file?: File) {
    if (!file) return;
    try { set("image", await shrinkImage(file)); } catch (e) { toast((e as Error).message); }
  }
  async function save() {
    setBusy(true);
    try {
      const it = await api.saveMenuItem(toItem(f));
      toast(`Đã lưu ${it.name}`);
      onClose();
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }

  return (
    <Modal open wide onClose={onClose} title={f.id ? "Sửa món" : "Thêm món"}
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="h-14 rounded-2xl border-2 border-line px-6 font-bold text-muted">Huỷ</button>
          <button disabled={busy || !f.name.trim() || !f.price} onClick={save} className="btn-primary h-14 flex-1 text-lg">Lưu món</button>
        </div>
      }>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr] sm:gap-6">
        <div className="flex items-center gap-3 sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(f.image || null)} alt="" className="aspect-square w-24 shrink-0 rounded-2xl bg-cream-2 object-cover sm:w-full sm:rounded-3xl" />
          <label className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-2xl bg-cream-2 text-sm font-bold text-bean sm:mt-3">
            Đổi ảnh…
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
          </label>
          <input value={f.image.startsWith("data:") ? "" : f.image} onChange={(e) => set("image", e.target.value)} placeholder="hoặc dán link ảnh"
            className="mt-2 hidden h-10 w-full rounded-xl border-2 border-line bg-paper px-3 text-xs outline-none focus:border-caramel sm:block" />
        </div>
        <div className="space-y-3">
          <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Tên món" />
          <div className="grid grid-cols-2 gap-3">
            <select className={input} value={f.category} onChange={(e) => set("category", e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="relative">
              <input className={`${input} pr-10 text-right font-bold`} inputMode="numeric"
                value={f.price ? Number(f.price.replace(/\D/g, "")).toLocaleString("vi-VN") : ""}
                onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} placeholder="Giá" />
              <span className="absolute right-4 top-3 text-muted">đ</span>
            </div>
          </div>
          <input className={input} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Mô tả ngắn" />
          <div className="flex items-center justify-between rounded-2xl bg-cream-2 px-4 py-3">
            <span className="font-semibold">{f.available ? "Còn hàng" : "Hết hàng"}</span>
            <Toggle on={f.available} onClick={() => set("available", !f.available)} />
          </div>
          <div className="rounded-2xl border-2 border-line p-4">
            <div className="font-semibold text-bean-dark">Tuỳ chọn khi đặt</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {([["sizes", "Size S / M (+6k) / L (+10k)"], ["sugar", "Chọn đường"], ["ice", "Chọn đá"]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => set(k, !f[k])}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${f[k] ? "border-bean bg-bean text-cream" : "border-line text-muted"}`}>
                  {f[k] ? "✓ " : ""}{label}
                </button>
              ))}
            </div>
            <div className="mt-3 text-sm font-semibold text-bean-dark">Topping <span className="font-normal text-muted">— mỗi dòng: Tên | giá</span></div>
            <textarea rows={3} value={f.toppings} onChange={(e) => set("toppings", e.target.value)} placeholder={"Trân châu trắng | 8000\nKem muối | 8000"}
              className="mt-1 w-full resize-none rounded-2xl border-2 border-line bg-paper px-4 py-2 font-mono text-sm outline-none focus:border-caramel" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ===========================================================================
// CHẾ ĐỘ DEMO
// ===========================================================================
const SAMPLE = [
  ["0900000000", "Khách Mộc"], ["0901234567", "Lan Anh"], ["0912345678", "Minh Khoa"],
  ["0987654321", "Thu Hà"], ["0934567890", "Quốc Bảo"], ["0978123456", "Gia Huy"],
];

function DemoAdmin() {
  const { api } = useStaff();
  const toast = useToast();
  const router = useRouter();
  const [sim, setSim] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const qr = sim ? buildQR(sim.member_phone ?? "", sim.ref) : "";

  async function simulate() {
    setBusy(true);
    try { setSim(await api.simulateOrder()); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }
  async function reset() {
    if (!window.confirm("Đặt lại dữ liệu mẫu?\n\nToàn bộ đơn hàng, lịch sử điểm và ưu đãi đã đổi sẽ bị xoá; điểm mọi thành viên về 0; thực đơn về 15 món mặc định; tạo lại đơn mẫu cho hôm nay.")) return;
    setBusy(true);
    try {
      const r = await api.resetDemo();
      setSim(null);
      toast(`Đã đặt lại · ${r.orders} đơn mẫu · ${r.members} thành viên`);
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
      <section className="card p-4 lg:col-span-2 lg:p-6 xl:col-span-1">
        <h2 className="text-xl font-bold text-bean-dark">Giả lập khách đặt đơn</h2>
        <p className="mt-1 text-sm text-muted">Tạo 1 đơn ngẫu nhiên (1–3 món) như khách vừa đặt trên app, cho một SĐT mẫu đang không có đơn. Đơn ở trạng thái “Chờ đến quầy”.</p>
        <button disabled={busy} onClick={simulate} className="btn-primary mt-4 h-14 w-full text-lg">🎲 Giả lập khách đặt đơn</button>
        {sim && (
          <div className="animate-pop mt-5 flex flex-col gap-4 rounded-3xl bg-cream p-4 sm:flex-row sm:gap-5">
            <div className="mx-auto shrink-0 rounded-2xl bg-white p-2 sm:mx-0"><QRCode value={qr} size={170} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-muted">Mã tạm · SĐT •••• {sim.member_phone?.slice(-4)}</div>
              <div className="text-3xl font-bold text-bean-dark">{sim.ref}</div>
              <ul className="mt-2 space-y-1">{sim.items.map((l, i) => <li key={i}><LineText line={l} /></li>)}</ul>
              <div className="mt-2 font-bold">{vnd(sim.total)}</div>
              <code className="mt-2 block break-all rounded-lg bg-paper px-2 py-1 text-xs">{qr}</code>
              <div className="mt-3 flex gap-2">
                <button onClick={() => router.push(`/pos/?scan=${encodeURIComponent(qr)}`)} className="h-11 flex-1 rounded-xl bg-done font-bold text-white">Mở ở quầy (POS) →</button>
                <button onClick={() => navigator.clipboard?.writeText(qr).then(() => toast("Đã chép chuỗi mã"))} className="h-11 rounded-xl bg-paper px-3 text-sm font-bold">Chép mã</button>
              </div>
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">Mẹo: quét mã QR trên màn hình này bằng máy quét hoặc camera của máy POS khác để thử đúng quy trình.</p>
      </section>

      <section className="card p-4 lg:col-span-2 lg:p-6 xl:col-span-1">
        <h2 className="text-xl font-bold text-bean-dark">Đặt lại dữ liệu mẫu</h2>
        <p className="mt-1 text-sm text-muted">Đưa cửa hàng về trạng thái demo: thực đơn mặc định, 6 thành viên mẫu có điểm/hạng khác nhau và 7 đơn hôm nay ở đủ trạng thái (chờ quầy, chờ pha, đang pha, xong, huỷ).</p>
        <button disabled={busy} onClick={reset} className="mt-4 h-14 w-full rounded-full border-2 border-caramel text-lg font-bold text-caramel">↺ Đặt lại dữ liệu mẫu</button>
        <div className="mt-6 text-sm font-semibold text-bean-dark">SĐT mẫu (đăng nhập app khách hoặc nhập tay ở POS)</div>
        <ul className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {SAMPLE.map(([p, n]) => (
            <li key={p} className="rounded-xl bg-cream px-3 py-2"><b className="tabular-nums">{p}</b> · {n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ===========================================================================
// THÔNG BÁO ĐẨY
// ===========================================================================
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function PushAdmin() {
  const toast = useToast();
  const [status, setStatus] = useState<{ configured: boolean; paired: boolean; publicKey: string | null } | null>(null);
  const [err, setErr] = useState("");
  const [keys, setKeys] = useState<{ pub: string; priv: string } | null>(null);
  const appKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/notify/`).then((r) => r.json()).then(setStatus)
      .catch(() => setErr("Không gọi được /api/notify — trang này cần chạy trên Vercel (hoặc npm run dev), không phải trang tĩnh."));
  }, []);

  async function generate() {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = await crypto.subtle.exportKey("raw", kp.publicKey);
    const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    setKeys({ pub: b64url(raw), priv: jwk.d! });
  }
  const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => toast("Đã chép"));

  const https = typeof window !== "undefined" && (location.protocol === "https:" || location.hostname === "localhost");
  const rows: [boolean | null, string, string][] = [
    [https, "Trang chạy HTTPS", "Camera và Web Push chỉ chạy trên HTTPS (Vercel có sẵn)."],
    [!!appKey, "App có khoá công khai", "Biến NEXT_PUBLIC_VAPID_PUBLIC_KEY"],
    [status ? status.configured : null, "Máy chủ có khoá bí mật", "Biến VAPID_PRIVATE_KEY trên Vercel"],
    [status ? status.configured && status.paired : null, "Hai khoá là một cặp", "Khoá bí mật khớp với khoá công khai (nếu sai, khách không nhận được thông báo)"],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="card p-4 lg:p-6">
        <h2 className="text-xl font-bold text-bean-dark">Kiểm tra thông báo “Đơn đã xong”</h2>
        <p className="mt-1 text-sm text-muted">Khi bếp bấm “Xác nhận xong”, route <code>/api/notify</code> gửi Web Push tới điện thoại khách (khách phải bật thông báo trong app).</p>
        {err && <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger">{err}</p>}
        <ul className="mt-4 divide-y divide-line">
          {rows.map(([ok, t, d]) => (
            <li key={t} className="flex items-center gap-3 py-3">
              <span className={`grid h-8 w-8 place-items-center rounded-full font-bold ${ok === null ? "bg-line text-muted" : ok ? "bg-done text-white" : "bg-caramel text-white"}`}>{ok === null ? "…" : ok ? "✓" : "!"}</span>
              <div><div className="font-semibold">{t}</div><div className="text-xs text-muted">{d}</div></div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-4 lg:p-6">
        <h2 className="text-xl font-bold text-bean-dark">Tạo cặp khoá VAPID mới</h2>
        <p className="mt-1 text-sm text-muted">
          Chỉ cần nếu bạn CHƯA có khoá. Khoá được tạo ngay trên máy này, không gửi đi đâu. Dán 2 giá trị vào Vercel → Settings → Environment Variables rồi Redeploy.
          Đổi khoá thì khách đã bật thông báo phải bật lại.
        </p>
        <button onClick={generate} className="btn-primary mt-4 h-12 px-6">Tạo khoá</button>
        {keys && (
          <div className="mt-4 space-y-3">
            {([["NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.pub], ["VAPID_PRIVATE_KEY", keys.priv]] as const).map(([k, v]) => (
              <div key={k}>
                <div className="text-xs font-bold text-muted">{k}</div>
                <div className="mt-1 flex gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-xl bg-cream px-3 py-2 text-xs">{v}</code>
                  <button onClick={() => copy(v)} className="h-10 shrink-0 rounded-xl bg-cream-2 px-3 text-sm font-bold">Chép</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
