"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IHome, ICup, IReceipt, IGift, IUser } from "./Icons";

const tabs = [
  { href: "/home", label: "Trang chủ", Icon: IHome },
  { href: "/order", label: "Đặt món", Icon: ICup, badge: "MỚI" },
  { href: "/orders", label: "Đơn hàng", Icon: IReceipt, dot: true },
  { href: "/offers", label: "Ưu đãi", Icon: IGift },
  { href: "/me", label: "Cá nhân", Icon: IUser },
];

export default function TabBar({ hasActiveOrder }: { hasActiveOrder?: boolean }) {
  const path = usePathname().replace(/\/$/, "");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="w-full max-w-md border-t border-line bg-paper/95 backdrop-blur pb-safe">
        <ul className="grid grid-cols-5 px-1 pt-2 pb-1.5">
          {tabs.map(({ href, label, Icon, badge, dot }) => {
            const active = path === href || path.endsWith(href);
            return (
              <li key={href}>
                <Link href={`${href}/`} className={`relative flex flex-col items-center gap-1 py-1 ${active ? "text-bean-dark" : "text-muted"}`}>
                  <span className={`grid h-8 w-12 place-items-center rounded-full transition ${active ? "bg-accent-soft" : ""}`}>
                    <Icon size={22} />
                  </span>
                  <span className={`text-[0.68rem] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
                  {badge && (
                    <span className="absolute -top-1 left-1/2 ml-1.5 rounded-full bg-caramel px-1.5 py-px text-[0.55rem] font-bold leading-tight text-white">{badge}</span>
                  )}
                  {dot && hasActiveOrder && (
                    <span className="absolute left-1/2 top-0.5 ml-3 h-2.5 w-2.5 rounded-full border-2 border-paper bg-caramel" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
