"use client";
import { useEffect, useState } from "react";
import QR from "qrcode";

export default function QRCode({ value, size = 240, dark = "#182A20" }: { value: string; size?: number; dark?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QR.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark, light: "#FFFFFF" } })
      .then(setSvg).catch(() => setSvg(""));
  }, [value, dark]);
  return (
    <div style={{ width: size, height: size }} className="[&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }} aria-label="Mã QR thành viên" role="img" />
  );
}
