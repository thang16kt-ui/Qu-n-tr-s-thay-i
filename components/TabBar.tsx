"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IHome, ICup, IQR, IGift, IUser } from "./Icons";

const tabs = [
  { href: "/home", label: "Trang chủ", Icon: IHome },
  { href: "/order", label: "Đặt món", Icon: ICup, badge: "MỚI" },
  { href: "/qr", label: "QR", Icon: IQR, center: true },
  { href: "/offers", label: "Ưu đãi", Icon: IGift },
  { href: "/me", label: "Cá nhân", Icon: IUser },
];

export default function TabBar({ hasActiveOrder }: { hasActiveOrder?: boolean }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="w-full max-w-md border-t border-line bg-paper/95 backdrop-blur pb-safe">
        <ul className="grid grid-cols-5 items-end px-1 pt-1.5 pb-1.5">
          {tabs.map(({ href, label, Icon, badge, center }) => {
            const active = path.startsWith(href);
            if (center) {
              return (
                <li key={href} className="flex justify-center">
                  <Link href={href} className="-mt-7 flex flex-col items-center gap-1" aria-label="Mã QR">
                    <span className={`relative grid h-15 w-15 place-items-center rounded-full border-4 border-cream shadow-lg ${active ? "bg-bean-dark" : "bg-bean"} text-cream`}>
                      <Icon size={28} />
                      {hasActiveOrder && <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-bean bg-caramel" />}
                    </span>
                    <span className={`text-[0.68rem] font-semibold ${active ? "text-bean-dark" : "text-muted"}`}>{label}</span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={href}>
                <Link href={href} className={`relative flex flex-col items-center gap-1 py-1 ${active ? "text-bean-dark" : "text-muted"}`}>
                  <Icon size={24} />
                  <span className={`text-[0.68rem] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
                  {badge && (
                    <span className="absolute -top-1 left-1/2 ml-2 rounded-full bg-caramel px-1.5 py-px text-[0.55rem] font-bold leading-tight text-white">{badge}</span>
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
