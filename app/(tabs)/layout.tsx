"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { MyOrdersProvider, useMyOrders } from "@/lib/my-orders";
import { ACTIVE, viewStatus } from "@/lib/orders";
import TabBar from "@/components/TabBar";

function Shell({ children }: { children: React.ReactNode }) {
  const { orders } = useMyOrders();
  const latest = orders[0];
  const active = !!latest && ACTIVE.includes(latest.status) && viewStatus(latest) !== "expired";
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-md pb-28">{children}</main>
      <TabBar hasActiveOrder={active} />
    </>
  );
}

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const { phone, ready } = useSession();
  const router = useRouter();
  useEffect(() => { if (ready && !phone) router.replace("/login"); }, [ready, phone, router]);
  if (!ready || !phone) return null;
  return (
    <MyOrdersProvider>
      <Shell>{children}</Shell>
    </MyOrdersProvider>
  );
}
