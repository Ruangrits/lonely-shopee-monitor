# UI Redesign — หน้า "รอจัดส่ง" (To Ship)

## Context

หน้าเว็บปัจจุบันแสดงข้อมูลแบบรวมๆ ไม่ focus การจัดสินค้า ต้อง redesign ให้เน้น orders ที่ต้องจัดส่ง โดยเฉพาะ "ยังไม่ดำเนินการ" เพื่อให้ user หยิบสินค้าจัดส่งได้ถูกต้องและรวดเร็ว

## Design (Approved v7)

### Theme
- **Light** พื้นขาว (#FAFAFA / #FFFFFF)
- **สีหลัก** จาก lonely-web-lib: primary-50 (#FFF1F9) ถึง primary-500 (#D01C58)
- ใช้สีจาก theme.css ของ lonely-web-lib ทั้งหมด

### Layout

#### Header
- ชื่อ "คำสั่งซื้อที่รอจัดส่ง" (H2, grey-400)
- เวลาอัปเดตล่าสุด (เล็ก, grey-300)
- ปุ่ม Refresh (primary-400 bg, white text)

#### Tab Summary (3 tabs กดเปลี่ยนได้)
- **ที่ต้องจัดส่ง** — จำนวน order ทั้งหมดใน tab "ที่ต้องจัดส่ง"
- **ยังไม่ดำเนินการ** — default active (พื้น primary-50, underline primary-400, ตัวเลข primary-500)
- **ดำเนินการแล้ว** — inactive (สีเทา)

กดแต่ละ tab จะ filter แสดง orders ของสถานะนั้น

#### Order Card (แนวนอน 1 คอลัมน์ เลื่อนลง)

**Header ของการ์ด:**
- Order ID (primary-400, font-weight 600)
- • ชื่อผู้ซื้อ (grey-300)
- Status badge ขวา (pill, primary-50 bg + primary-500 text / success สำหรับดำเนินการแล้ว)

**Items (แต่ละ item เป็น row):**
- รูปสินค้า 64x64 (จาก Shopee CDN, rounded, border primary-100)
- ชื่อสินค้าเต็ม (grey-400, 14px, font-weight 500)
- ตัวเลือกสินค้า: สี/ไซส์ (grey-300 label + primary-300 value)
- จำนวน ขวาสุด (primary-400, 30px, font-weight 800) + "ชิ้น" เล็กๆ

**Footer ของการ์ด:**
- ซ้าย: 🕐 เวลาคำสั่งซื้อ (grey-200, 11px)
- ขวา: รวม X ชิ้น (primary-300, 12px, font-weight 600)

#### การเรียงลำดับ
- เรียงจาก **เก่าสุดอยู่บน** (order ที่รอนานที่สุดเห็นก่อน)

### Data ที่ต้องเพิ่มจาก API

ข้อมูลที่ต้อง scrape เพิ่ม:
- **ชื่อผู้ซื้อ** (buyer username) — มีอยู่ใน `card_header.buyer_info.username`
- **เวลาคำสั่งซื้อ** (order create time) — ต้องดูว่า API มี field นี้หรือไม่
- **สถานะย่อย** (ยังไม่ดำเนินการ / ดำเนินการแล้ว) — ต้องดูจาก API response

### Components ที่ต้องแก้ไข/สร้าง

| Component | Action |
|-----------|--------|
| `Dashboard.svelte` | Rewrite — เปลี่ยนเป็น layout ใหม่ตาม design |
| `OrderSummary.svelte` | Rewrite → `TabFilter.svelte` — เป็น 3 tabs กดได้ |
| `OrderCard.svelte` | Rewrite — layout ใหม่ + footer เวลา/รวมชิ้น |
| `RefreshControls.svelte` | ลดขนาด — เหลือแค่ปุ่ม Refresh ใน header |
| `LoginStatus.svelte` | คงไว้ |
| `data.ts` | เพิ่ม `buyerName`, `orderTime` ใน Order interface |

### Backend เพิ่ม

- parser.ts: เพิ่ม `buyerName`, `orderTime` ใน `ScrapedOrder`
- shopee-scraper.ts: ดึง `buyer_info.username` จาก API response (มีอยู่แล้ว แค่ยังไม่ได้เก็บ)
- ดึง order time จาก API response (ถ้ามี)

## Verification

1. เปิดหน้าเว็บ → เห็น tab "ยังไม่ดำเนินการ" active เป็น default
2. กด tab "ที่ต้องจัดส่ง" → แสดง orders ทั้งหมด
3. กด tab "ดำเนินการแล้ว" → แสดง orders ที่ดำเนินการแล้ว
4. แต่ละ order card แสดง: รูป, ชื่อเต็ม, ตัวเลือก, จำนวนเด่น, order ID, ผู้ซื้อ, เวลา, รวมชิ้น
5. เรียงจากเก่าสุดอยู่บน
6. กด Refresh → ดึงข้อมูลใหม่
