import type { Metadata } from "next";
import { AcademicNotice } from "@/components/academic-notice";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "เงื่อนไขการใช้งาน" };

/**
 * เงื่อนไขการใช้งาน — terms of use.
 *
 * Placeholder copy: the platform is a prototype and these terms have not been
 * reviewed by counsel. The structure is here so the real document has a home
 * rather than living in a footer link that 404s.
 */
export default function TermsPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <h1 className="text-3xl font-bold text-ink">
          เงื่อนไขการใช้งาน
          <span className="block text-base font-normal text-ink-muted">
            Terms of Use
          </span>
        </h1>

        <div className="mt-6">
          <AcademicNotice kind="terms" />
        </div>

        <Card className="mt-6 space-y-5 p-6 text-sm leading-relaxed text-ink-secondary">
          <section>
            <h2 className="text-lg font-semibold text-ink">1. บทบาทของผู้ใช้</h2>
            <p className="mt-1">
              KasetHub เป็นตลาดกลางเพื่อให้เกษตรกรและผู้ซื้อเจรจาซื้อขายผลผลิต
              เราเป็นผู้ประกอบการแพลตฟอร์ม ไม่ใช่คู่สัญญาในการขายสินค้าแต่ละรายการ
              ความรับผิดต่อคู่สัญญาเกิดขึ้นระหว่างเกษตรกรกับผู้ซื้อโดยตรง
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">2. บทบาทที่เลือกได้</h2>
            <p className="mt-1">
              บัญชีแต่ละประเภทมีสิทธิ์ต่างกัน: เกษตรกร (FARMER) ลงขายผลผลิตได้
              ผู้รับซื้อ/โบรกเกอร์ (BROKER) และผู้ซื้อ (BUYER) ยื่นข้อเสนอได้
              การเลือกบทบาทผิดอาจทำให้ถูกจำกัดสิทธิ์จนกว่าจะแก้ไขโปรไฟล์
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">3. เงินค้ำประกัน (Escrow)</h2>
            <p className="mt-1">
              เมื่อเกษตรกรยืนยันข้อเสนอ ระบบจะเปิดคำสั่งซื้อในสถานะ
              &quot;วางเงินประกัน&quot; พร้อมบันทึกขั้นตอน (วางเงิน → ตรวจสอบคุณภาพ →
              ขนส่ง → ปล่อยเงิน) ไว้เป็นหลักฐาน ขั้นตอนเดินหน้าทีละขั้นเท่านั้น
              และผู้ที่ไม่ใช่คู่สัญญาเข้าถึงข้อมูลนี้ไม่ได้
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">4. ความรับผิดชอบต่อข้อมูล</h2>
            <p className="mt-1">
              ผู้ลงขายรับผิดชอบความถูกต้องของรายละเอียดผลผลิต ภาพถ่าย และน้ำหนัก
              การระบุมาตรฐาน GAP หรือออร์แกนิกต้องอ้างอิงเอกสารที่ตรวจสอบได้
              ห้ามลงรายการที่ผิดความจริง — ระบบอาจระงับบัญชีทันที
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">5. การยกเลิกและข้อโต้แย้ง</h2>
            <p className="mt-1">
              คำสั่งซื้อที่ยังไม่ปิดสามารถยกเลิกได้จนกว่าจะถึงขั้นตอนปิดสำเร็จ
              หากมีข้อโต้แย้ง ให้ตั้งสถานะเป็น &quot;มีข้อโต้แย้ง&quot; เพื่อหยุด
              การปล่อยเงินจนกว่าทั้งสองฝ่ายจะตกลงหรือเจ้าหน้าที่จะเข้ามาช่วยตรวจสอบ
            </p>
          </section>

          <p className="rounded-lg bg-surface-2 p-3 text-xs text-ink-muted">
            ข้อความนี้เป็นร่างเบื้องต้นสำหรับต้นแบบระบบ ยังไม่ผ่านการตรวจทานด้านกฎหมาย
            โปรดอย่าใช้แพลตฟอร์มนี้เพื่อออกใบสัญญาซื้อขายจริงจนกว่าจะมีเอกสารฉบับสมบูรณ์
          </p>
        </Card>
      </main>

      <SiteFooter />
    </>
  );
}
