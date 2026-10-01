import type { Metadata } from "next";
import { AcademicNotice } from "@/components/academic-notice";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "ความเป็นส่วนตัว" };

/**
 * ความเป็นส่วนตัว — privacy notice.
 *
 * Describes what the app actually stores (see prisma/schema.prisma) rather than
 * a generic template, so the data the schema holds and the data this page
 * claims to hold stay in agreement.
 */
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <h1 className="text-3xl font-bold text-ink">
          ความเป็นส่วนตัว
          <span className="block text-base font-normal text-ink-muted">
            Privacy Notice
          </span>
        </h1>

        <div className="mt-6">
          <AcademicNotice kind="privacy" />
        </div>

        <Card className="mt-6 space-y-5 p-6 text-sm leading-relaxed text-ink-secondary">
          <section>
            <h2 className="text-lg font-semibold text-ink">ข้อมูลที่เก็บ</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>บัญชี: อีเมล เบอร์โทร ชื่อ-นามสกุล และรหัสผ่านที่เก็บแบบ hashed</li>
              <li>
                ข้อมูลการค้า: ล็อตผลผลิต ข้อเสนอราคา คำสั่งซื้อ และประวัติการ
                ชำระเงิน
              </li>
              <li>
                การสื่อสาร: ข้อความในห้องเจรจา รวมถึงรูปภาพที่แนบไว้ในดีลนั้น
              </li>
              <li>
                เซสชัน: คุกกี้ที่ลงชื่อและเข้ารหัส มีอายุ 30 วัน ใช้ยืนยันตัวตนหลัง
                เข้าสู่ระบบเท่านั้น
              </li>
            </ul>
            <p className="mt-2">
              เราไม่เก็บข้อมูลการชำระเงินของผู้ใช้ เพราะการชำระเงินผ่าน escrow
              เป็นกระบวนการภายนอกที่ยังไม่ได้เชื่อมต่อในระบบนี้
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">รูปภาพที่แนบ</h2>
            <p className="mt-1">
              หากตั้งค่า Supabase Storage ไว้ รูปจะถูกอัปโหลดไปยังถัง
              chat-attachments และเก็บ URL ไว้กับข้อความ หากไม่ได้ตั้งค่า
              ระบบจะเก็บรูปแบบย่อขนาดไว้ในฐานข้อมูลโดยตรง — ข้อความในห้องเจรจา
              จึงควรถือเป็นข้อมูลที่เห็นได้เฉพาะคู่สัญญา
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">การเข้าถึงข้อมูล</h2>
            <p className="mt-1">
              ห้องเจรจาและคำสั่งซื้อเปิดเผยต่อเฉพาะเกษตรกรเจ้าของล็อตกับผู้ซื้อ
              เท่านั้น คำขอที่ไม่เกี่ยวข้องจะได้รับผลลัพธ์เดียวกับกรณีไม่พบข้อมูล
              เพื่อไม่ให้ตรวจสอบการมีอยู่ของรายการซื้อขายได้
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">การเก็บรักษาและลบบัญชี</h2>
            <p className="mt-1">
              ขอให้ติดต่อผู้ดูแลระบบเพื่อขอส่งออกหรือลบข้อมูลของคุณ
              การลบบัญชีจะลบข้อมูลส่วนตัว แต่รายการซื้อขายที่ปิดสำเร็จแล้วจะถูกเก็บไว้
              เพื่อรักษาบันทึกการค้า
            </p>
          </section>

          <p className="rounded-lg bg-surface-2 p-3 text-xs text-ink-muted">
            เอกสารนี้เป็นร่างเบื้องต้นสำหรับต้นแบบระบบ และยังไม่ผ่านการตรวจทานด้าน
            กฎหมาย PDPA
          </p>
        </Card>
      </main>

      <SiteFooter />
    </>
  );
}
