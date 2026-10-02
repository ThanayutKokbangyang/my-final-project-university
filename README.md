# Eclat Perfume Store

โปรเจกต์จบร้านขายน้ำหอม มีหน้าร้าน ตะกร้า ชำระเงินด้วย Stripe ประวัติคำสั่งซื้อ และระบบผู้ดูแลสำหรับสินค้า สต็อก โปรโมชั่น และสมาชิก

ใช้ Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, NextAuth, Prisma และ MySQL

![Eclat Hero studio concept](docs/images/eclat-studio-hero.webp)
![สินค้า](https://github.com/user-attachments/assets/481e5658-f668-43f5-8f90-5de7eea18330)
![ระบบจัดการ](https://github.com/user-attachments/assets/291ebe5f-183b-40fe-a1a0-404e668e97b6)

## Hero studio concept

ภาพ Hero ด้านบนเป็นภาพประกอบ README เท่านั้น ส่วนเว็บไซต์ยังโหลดภาพ Hero จาก API และใช้ slider เดิม

[ดาวน์โหลดภาพเปล่า ไม่มีข้อความหรือปุ่ม](docs/images/eclat-studio-clean.webp)

ภาพเป็นคอนเซปต์แฟนเมดสำหรับโปรเจกต์ส่วนบุคคล ไม่ใช่การรับรองสินค้าจริงจากศิลปิน

## ติดตั้งและเริ่มใช้งาน

ต้องมี Node.js 22, npm และ MySQL 8 พร้อมฐานข้อมูลว่างสำหรับโปรเจกต์

```bash
git clone https://github.com/ThanayutKokbangyang/my-final-project-university.git
cd my-final-project-university
cp .env.example .env
npm ci
```

กรอกค่าจริงใน `.env` โดยไม่ commit ไฟล์นี้:

| ตัวแปร                                                                             | ใช้สำหรับ                                                  |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`                                                                     | MySQL connection string                                    |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`                                              | URL ของเว็บ เช่น `http://localhost:3000`                   |
| `NEXTAUTH_SECRET`                                                                  | secret สำหรับ session; สร้างด้วย `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                         | เข้าสู่ระบบ Google OAuth                                   |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`                                     | เข้าสู่ระบบ Facebook OAuth                                 |
| `GMAIL_USER`, `GMAIL_PASS`                                                         | Gmail และ App Password สำหรับยืนยันอีเมล/รีเซ็ตรหัสผ่าน    |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | รูปภาพสินค้า                                               |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                                       | Stripe API และการตรวจลายเซ็น webhook                       |

เริ่มด้วย Stripe **test mode** และตั้ง OAuth redirect URL ของแต่ละ provider เป็น `/api/auth/callback/google` หรือ `/api/auth/callback/facebook` บน URL ของเว็บ

```bash
npm run db:migrate
npm run dev
```

เปิด <http://localhost:3000> สมัครสมาชิกและยืนยันอีเมลก่อนเข้าสู่ระบบด้วยรหัสผ่าน หากต้องการบัญชีผู้ดูแล ให้เปลี่ยน `User.role` เป็น `ADMIN` ในฐานข้อมูลสำหรับบัญชีที่คุณควบคุม:

```bash
npx prisma studio
```

## Stripe webhook และคำสั่งซื้อ

ตั้ง endpoint เป็น `https://your-domain/api/webhook` และเปิด event ต่อไปนี้:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`

สำหรับเครื่อง local ใช้ Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

นำ signing secret `whsec_...` ที่ CLI แสดงมาใส่ `STRIPE_WEBHOOK_SECRET` แล้ว restart dev server ห้ามใช้ API secret แทน webhook secret

ระบบคำนวณราคาและส่วนลดจากฐานข้อมูล ตรวจเจ้าของตะกร้า/ที่อยู่ และจองสต็อกใน transaction การชำระซ้ำใช้งาน Checkout Session เดิม รายการในตะกร้าจะถูกหักเฉพาะจำนวนที่ซื้อเมื่อยืนยันการจ่ายเงินแล้ว

Checkout ใช้เวลา expiry ตามค่าเริ่มต้นของ Stripe (24 ชั่วโมง) ลูกค้าสามารถกลับไปจ่ายหรือยกเลิกรายการค้างจ่ายได้จากหน้าประวัติคำสั่งซื้อ เมื่อได้รับ webhook หมดอายุ/ล้มเหลว หรือยกเลิกสำเร็จ ระบบคืนสต็อกและสิทธิ์ใช้โปรโมชั่น การกลับจาก Stripe ด้วยปุ่ม Back เพียงอย่างเดียวยังคงจองสต็อกไว้จนกว่าจะยกเลิกหรือหมดอายุ

Webhook ต้องเข้าถึงได้จริงเพื่ออัปเดตคำสั่งซื้อและคืนสต็อก หาก Stripe ตอบกลับไม่สำเร็จ ระบบเก็บคำสั่งซื้อไว้เพื่อให้ลองจ่ายหรือยกเลิกภายหลัง

## การอัปเดตฐานข้อมูลเดิม

สำรองฐานข้อมูลก่อนใช้ `npm run db:migrate` ในระบบที่มีข้อมูลอยู่แล้ว migration เพิ่มสถานะการจองสต็อกและเชื่อมการใช้โปรโมชั่นกับคำสั่งซื้อ พร้อมป้องกันการลบสินค้าหรือ inventory ที่มีประวัติการซื้อ

คำสั่งซื้อเก่าที่ยังไม่จ่ายถูกระบุว่าเป็นการจองสต็อก เพราะโค้ดเดิมตัดสต็อกตั้งแต่เริ่ม checkout โดยไม่มี snapshot ตะกร้า รายการเก่าที่ใช้ส่วนลดอาจเก็บราคาต่อหน่วยไม่ตรงกับยอดรวม และการใช้โปรโมชั่นเก่าไม่ได้ผูกกับ order ต้องตรวจสอบรายการค้างจ่ายเหล่านี้ก่อนเปิดใช้จริง ห้ามเปลี่ยนยอดคำสั่งซื้อที่จ่ายแล้วเพื่อให้ผ่านการตรวจสอบ

การแก้ inventory จะคง ID ของขนาดเดิมไว้ หากขนาดมีรายการในตะกร้าหรือประวัติคำสั่งซื้อ จะไม่สามารถลบขนาดนั้นได้ ให้ตั้งสต็อกเป็น 0 แทน

## ตรวจโค้ดและรัน production

```bash
npm run format:check
npm run lint
npm run test
npm run build
npm run typecheck
npm start
```

ใช้ `npm run format` เพื่อจัดรูปแบบทั้งโปรเจกต์ด้วย Prettier มี regression tests สำหรับราคา สิทธิ์ API checkout สต็อก การชำระเงิน และการแก้ inventory

Integration tests ต้องใช้ฐานข้อมูล **สำหรับทดสอบเท่านั้น** ที่รัน migration แล้ว โดยกำหนด `TEST_DATABASE_URL` ให้เท่ากับ `DATABASE_URL` หากไม่กำหนดจะข้าม 5 เคส MySQL ส่วน GitHub Actions ตั้ง MySQL แยกและรันทั้ง migration, tests, lint, format และ production build ทุกครั้งที่ push หรือเปิด PR

ยังต้องทดสอบ OAuth, Gmail, Cloudinary และการชำระผ่าน Stripe test mode ด้วยบัญชี/secret ของผู้ใช้งานก่อนนำไปเปิดร้านจริง

## โครงสร้างที่สำคัญ

- `src/app/api/`: API ที่ตรวจ session และสิทธิ์ผู้ใช้
- `src/lib/payments.ts`: จอง/คืนสต็อก การสร้าง Checkout Session และยืนยันการจ่าย
- `src/lib/money.ts`: การปัดเศษหน่วยสตางค์ให้ยอดฐานข้อมูลตรงกับ Stripe
- `src/lib/inventories.ts`: แก้สต็อกโดยรักษารายการอ้างอิงเดิม
- `src/lib/json.ts`: กรองข้อมูลลับและ HTML ก่อนส่ง response
- `src/app/components/admin/TaxonomyManagement.tsx`: หน้าจัดการข้อมูลอ้างอิงที่ใช้ร่วมกัน
- `prisma/`: schema และ migrations
- `tests/`: unit, route regression และ MySQL integration tests

พัฒนาต่อจาก [Eclat-Perfume-Store](https://github.com/taemotherlode01/Eclat-Perfume-Store)
