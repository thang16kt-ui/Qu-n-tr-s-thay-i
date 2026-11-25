"use client";
import { useEffect } from "react";
import { IClose } from "./Icons";

/** Bảng trượt từ dưới lên (bottom sheet) */
export default function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade absolute inset-0 bg-bean-dark/40" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-paper">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="text-lg font-bold text-bean-dark">{title}</div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-cream-2 text-bean" aria-label="Đóng">
            <IClose size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-safe"><div className="pb-3">{footer}</div></div>}
      </div>
    </div>
  );
}
