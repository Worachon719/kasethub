# เช็กลิสต์ Deploy KasetHub (GitHub + Supabase + Vercel)

ไฟล์นี้เป็นลำดับการ deploy ที่ลองรันจริงแล้ว รายละเอียดเชิงเหตุผลอยู่ใน `README.md`

## A. เตรียมในเครื่อง

- [ ] Node.js 20+ (`node -v`) และ Git (`git --version`)
- [ ] `npm install`
- [ ] `npm run typecheck` ผ่าน
- [ ] `npm run lint` ผ่าน
- [ ] `npm run build` ผ่าน

## B. Supabase

- [ ] New project — **region ต้องตรงกับ `regions` ใน `vercel.json`**
      (โปรเจกต์นี้ใช้ `ap-south-1` = Mumbai = `bom1`)
- [ ] Project Settings → Database → **Connection string**
- [ ] `DIRECT_URL` = Session pooler (พอร์ต **5432**) — ใช้กับ `prisma migrate deploy` และ `prisma generate`
- [ ] `DATABASE_URL` = Transaction pooler (พอร์ต **6543**) + `?pgbouncer=true&connection_limit=1` — ใช้ตอนรันแอปบน Vercel
- [ ] Storage → New bucket ชื่อ `chat-attachments`
- [ ] Project Settings → API → Project URL และ `service_role` key

> ห้ามสับสนสองพอร์ตนี้: Transaction pooler (6543) ไม่รองรับ advisory lock ที่ Prisma ใช้ตอน migrate
> ถ้าชี้ `DIRECT_URL` ไปที่ 6543 `prisma migrate deploy` จะล้มเหลว

## C. ตั้งค่าไฟล์ env ในเครื่อง (ห้าม commit)

- [ ] `cp .env.example .env` และ `cp .env.example .env.local`
- [ ] ใส่ค่าจริงทั้ง 8 ตัว
- [ ] สร้าง `NEXTAUTH_SECRET` ที่เป็น **ค่าสุ่มจริง**:
      `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
      ห้ามใส่ข้อความคำสั่งลงไปตรง ๆ — Next.js รับได้ แต่คนอื่นก็อ่านได้จาก repo เหมือนกัน
- [ ] เช็คว่าไฟล์ถูก ignore แล้ว: `git check-ignore .env .env.local`

## D. สร้างตาราง

- [ ] `npx prisma migrate status` → ควรขึ้น "Database schema is up to date"
- [ ] `npx prisma migrate deploy` ( idempotent )
- [ ] รัน SQL เปิด RLS (ครั้งเดียวต่อ environment):
      `npx prisma db execute --file prisma/sql/20261001_enable_rls.sql --schema prisma/schema.prisma`
      ตรวจสอบ: `select relname from pg_class where relnamespace='public'::regnamespace and relrowsecurity;`
- [ ] (เฉพาะฐานข้อมูลทดสอบ) `npm run db:seed`
- [ ] `npm run dev` แล้วทดสอบ สมัคร → ล็อกอิน → ลงสินค้า → ประมูล → แชต
- [ ] เปิด `/api/health` ต้องได้ `{"status":"ok","database":"reachable"}`

## E. GitHub

- [ ] สร้าง repo (Private ไม่ต้องสร้าง README)
- [ ] `git add .` → `git status` (ต้องไม่เห็น `.env` / `.env.local` / `node_modules` / `.next`)
- [ ] ยืนยันว่าไม่มีรหัสผ่านหลุด: `git grep --cached 'รหัสผ่านของ DB'`
- [ ] `git commit -m "Initial commit"` → `git branch -M main`
- [ ] `git remote add origin <URL>` → `git push -u origin main`

## F. Vercel

- [ ] Import repo จาก GitHub
- [ ] ใส่ Environment Variables 8 ตัว **ก่อน deploy ครั้งแรก**
- [ ] Deploy
- [ ] แก้ `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` เป็นโดเมนจริง → Redeploy
      (ค่า `localhost:3000` คือสาเหตุที่พบบ่อยที่สุดของลูปล็อกอินที่ไม่จบ)
- [ ] ทดสอบ `/api/health`, สมัคร, ล็อกอิน, ลงสินค้า, ประมูล, แชต
- [ ] ตรวจว่า region ใน `vercel.json` ตรงกับ Supabase

## G. ความปลอดภัย

- [ ] **Reset รหัสผ่าน database ใน Supabase** เพราะรหัสเดิมถูกส่งต่อผ่านแชต/ไฟล์แล้ว
      แล้วอัปเดต `DATABASE_URL` + `DIRECT_URL` ทุกที่ (ทั้งเครื่องและ Vercel)
- [ ] ตรวจว่า `NEXTAUTH_SECRET` เป็นค่าสุ่มจริง ไม่ใช่ข้อความ placeholder
- [ ] ยืนยันว่า RLS เปิดทุกตารางใน `public` (ดูข้อ D)
- [ ] ใส่เนื้อหาจริงใน `/terms` และ `/privacy` ก่อนเปิดให้คนทั่วไปใช้
