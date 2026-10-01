/**
 * Academic-project notice, shared by /terms and /privacy.
 *
 * The build is deployed to a public URL and reads like a working marketplace —
 * real listings, bids, escrow states, KYC tiers. A reader who has not been told
 * otherwise could reasonably assume a trading service is running behind it, and
 * that misreading is worth more than the copy it replaces: this project is a
 * university module, the goods are sample data, and nothing settles, ships or
 * pays out. Putting that in one component keeps the two documents saying the
 * same thing, which is the whole point of a notice.
 *
 * `kind` picks the emphasis rather than duplicating the body, so each page
 * leads with what is relevant to it.
 */
export function AcademicNotice({ kind }: { kind: "terms" | "privacy" }) {
  return (
    <section className="rounded-xl border border-emerald/30 bg-emerald-dark/5 p-5">
      <p className="text-base font-bold text-ink">
        เกี่ยวกับโครงการนี้{" "}
        <span className="font-normal text-ink-muted">About this project</span>
      </p>

      <p className="mt-2 font-semibold text-ink">
        KasetHub เป็นโมเดูลต้นแบบสำหรับงานมหาลัย ไม่ใช่ตลาดค้าขายจริง
      </p>
      <p className="mt-1 text-sm text-ink-secondary">
        KasetHub is a university project built as a working prototype. It is not
        a commercial trading service.
      </p>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-secondary">
        <li>
          ข้อมูลเกษตรกร ล็อตสินค้า ข้อเสนอราคา และบัญชีทั้งหมด
          เป็นข้อมูลตัวอย่างที่สร้างขึ้นเพื่อสาธิตการทำงานของระบบ
        </li>
        <li>
          ระบบ escrow เป็น{" "}
          <strong className="font-semibold text-ink">การจำลอง</strong>{" "}
          เพื่อแสดงขั้นตอนการค้าขาย ไม่มีการเก็บเงินจริง
          ไม่มีการส่งมอบสินค้า และไม่มีธุรกรรมการเงินใด ๆ
        </li>
        <li>
          ไม่มีการเชื่อมต่อกับระบบชำระเงิน ธนาคาร กรมส่งเสริมการเกษตร
          หรือหน่วยงานรัฐใด ๆ
        </li>
        {kind === "privacy" ? (
          <li>
            ข้อมูลที่ผู้ใช้กรอกเป็นข้อมูลสมมติสำหรับการสาธิต
            ไม่มีการนำไปใช้เพื่อการตลาดหรือประมวลผลเชิงพาณิชย์
          </li>
        ) : (
          <li>
            การเข้าใช้งานเพื่อการศึกษาและการสาธิตเท่านั้น
            ไม่มีการดำเนินการซื้อขายสินค้าจริงผ่านระบบนี้
          </li>
        )}
      </ul>

      <p className="mt-3 text-xs text-ink-muted">
        หากพบข้อผิดพลาดในข้อมูลตัวอย่าง หรือต้องการรายงานปัญหาการใช้งาน
        สามารถแจ้งผู้จัดทำโครงการได้ทางช่องทางติดต่อภายในมหาวิทยาลัย
      </p>
    </section>
  );
}