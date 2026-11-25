"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import Logo from "@/components/Logo";

export default function Index() {
  const { phone, ready } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (ready) router.replace(phone ? "/home" : "/login");
  }, [ready, phone, router]);
  return (
    <div className="grid min-h-dvh place-items-center">
      <Logo size={72} />
    </div>
  );
}
