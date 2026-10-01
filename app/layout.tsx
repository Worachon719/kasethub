import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Prompt } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const prompt = Prompt({
  subsets: ["thai", "latin"],
  variable: "--font-prompt",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "KasetHub | ตลาดสินค้าเกษตรล้นสวน",
    template: "%s | KasetHub",
  },
  description:
    "KasetHub ระบบระบายสต็อกผัก-ผลไม้ก่อนเน่าเสีย เชื่อมเกษตรกรกับโบรกเกอร์และผู้ซื้อส่งออกด้วยการประมูลและเงินประกัน (Escrow)",
  openGraph: {
    title: "KasetHub | ตลาดสินค้าเกษตรล้นสวน",
    description:
      "ระบบระบายสต็อกผัก-ผลไม้ก่อนเน่าเสีย พร้อมการประมูลและเงินประกัน",
    type: "website",
    locale: "th_TH",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${jakarta.variable} ${prompt.variable}`}>
      <body className="bg-canvas text-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
