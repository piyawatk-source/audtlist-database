# Audtlist — Database Schema

MongoDB schema design สำหรับเว็บขายเพลง (Bandcamp clone)

---

## ภาพรวม

โปรเจคนี้คือ database schema สำหรับเว็บไซต์ขายเพลง album และ merchandise ในรูปแบบ marketplace ที่ศิลปินขายของให้แฟนเพลงโดยตรง

**Database:** MongoDB Atlas (cloud)
**Connection:** ดู `connection_info.md` (ส่งแยก ไม่ commit ใน Git)

---

## โครงสร้างโปรเจค

```
audtlist/
├── schema.js              # คำสั่งสร้าง collections + validators + indexes
├── sample_data.js         # ข้อมูลตัวอย่างสำหรับ test
├── README.md              # เอกสารนี้
└── design_notes.md        # ข้อสังเกต + คำถามให้ทีม review
```

---

## วิธีใช้

### 1. รัน Schema (ครั้งแรก)

1. เปิด MongoDB Compass หรือ mongosh
2. เชื่อมต่อ MongoDB Atlas
3. สลับไป database ของโปรเจค:
   ```javascript
   use audtlist_clone
   ```
4. Copy ไฟล์ `schema.js` ทั้งหมด → วางใน mongosh → กด Enter
5. ผลลัพธ์: เห็น 8 collections พร้อมใช้งาน

### 2. ใส่ข้อมูลตัวอย่าง (optional แต่แนะนำ)

1. Copy ไฟล์ `sample_data.js` ทั้งหมด → วางใน mongosh → Enter
2. ผลลัพธ์: มีข้อมูลตัวอย่างพร้อมทดสอบ query

### 3. ทดสอบ

```javascript
// ดู products ทั้งหมด
db.products.find({ status: "published" }).sort({ created_at: -1 });

// ดู orders ของ artist (Marketplace)
const owv = db.artists.findOne({ slug: "old-world-vultures" });
db.orders.find({ "items.artist_id": owv._id });

// ดู album พร้อม tracks (Many-to-Many)
db.albums.aggregate([
  {
    $lookup: {
      from: "tracks",
      localField: "track_ids",
      foreignField: "_id",
      as: "tracks_detail",
    },
  },
]);
```

---

## Collections (8 ตัว)

| Collection | จำนวน     | ความสำคัญ                                 |
| ---------- | --------- | ----------------------------------------- |
| `users`    | unlimited | ผู้ใช้ทุก type (ADMIN/USER/ARTIST)        |
| `genres`   | ~10       | Master data ที่ admin จัดการ              |
| `artists`  | unlimited | โปรไฟล์ศิลปิน + marketplace fields        |
| `products` | unlimited | **Sellable Product Layer** (หัวใจของ MOM) |
| `tracks`   | unlimited | ไฟล์เพลง                                  |
| `albums`   | unlimited | รวมเพลงเป็น album (M:N กับ tracks)        |
| `merch`    | unlimited | สินค้ากายภาพ + variants embed             |
| `orders`   | unlimited | คำสั่งซื้อ + marketplace logic            |

---

## Design Decisions (ตาม MOM)

### 1. Products เป็น Layer กลาง

ตามที่ทีมตกลงใน MOM 29/4/2026 — เพื่อแก้ปัญหา pagination ข้าม type (single/album/merch)

```javascript
// Pagination ข้ามทุก type ในที่เดียว
db.products
  .find({ status: "published" })
  .sort({ created_at: -1 })
  .skip(20)
  .limit(10);
```

ฟิลด์ที่ทุก product มีร่วมกัน (title, price, cover_url, status) อยู่ที่ products
ฟิลด์เฉพาะของแต่ละประเภทอยู่ที่ tracks/albums/merch

### 2. Album-Track เป็น Many-to-Many

ตามที่ MOM ระบุ — 1 เพลงอยู่ได้หลาย album, 1 album มีได้หลายเพลง

ใน MongoDB ใช้ **array of ObjectId** ใน album document แทน junction table:

```javascript
{
  product_id: ObjectId("..."),
  track_ids: [
    ObjectId("track1..."),
    ObjectId("track2..."),
    ...
  ]
}
```

### 3. User Type Enum

ตาม MOM: `ADMIN | USER | ARTIST`

ทุก user type อยู่ใน collection เดียว แยกบทบาทผ่าน `user_type` field
admin มี username + password ของตัวเอง login ได้ตรงๆ

### 4. Genre เป็น Master Data

Collection แยก, admin จัดการได้ (CRUD)
artist เลือกหลาย genre ได้ผ่าน `genre_ids` array

### 5. ราคาเก็บเป็น Integer

ใช้ `int` (จำนวนเต็ม) แทน `decimal/float` เพื่อหลีกเลี่ยงปัญหา floating-point precision
หน่วย: บาท (THB)

---

## Marketplace Logic (เกินจาก MOM — ขอ review)

### ปัญหาที่พบระหว่างทำ

เนื่องจาก business model คือ **marketplace** (ศิลปินขายของให้ลูกค้าโดยตรง — platform เป็นเพียง intermediate) จึงต้องเพิ่ม fields เพื่อรองรับ:

1. **`orders.items[].artist_id`** — ระบุว่า item แต่ละตัวเป็นของศิลปินคนไหน (รองรับ 1 order มีหลายศิลปิน)
2. **`orders.items[].fulfillment_status`** — สถานะของแต่ละ item (digital_delivered สำหรับ digital, pending/preparing/shipped/delivered สำหรับ merch)
3. **`orders.platform_fee`** — ค่าธรรมเนียมที่ platform หัก
4. **`artists.shipping_address`** — ที่อยู่ที่ศิลปินใช้ส่งของ
5. **`artists.payout_method`** — วิธีรับเงิน (bank/paypal/promptpay)
6. **`artists.payout_balance`** — เงินรอถอน

ดู `design_notes.md` สำหรับรายละเอียด + คำถามให้ทีม review

---

## Indexes ที่สำคัญ

| Collection | Index                                       | จุดประสงค์               |
| ---------- | ------------------------------------------- | ------------------------ |
| users      | `email` (unique), `username` (unique)       | login + ป้องกันสมัครซ้ำ  |
| products   | `status, created_at`                        | หน้า shop pagination     |
| products   | `type, status`                              | filter ตาม type          |
| albums     | `track_ids`                                 | หา album ที่มี track นี้ |
| merch      | `variants.sku`                              | scan SKU ที่หลังเสื้อ    |
| orders     | `user_id, created_at`                       | ดูประวัติของ user        |
| orders     | `items.artist_id, items.fulfillment_status` | **artist dashboard**     |

---

## Schema Validation

ทุก collection มี **JSON Schema validator** ที่บังคับ:

- Required fields
- Data types ที่ถูกต้อง
- Enum values (เช่น user_type, product_type)
- Pattern (เช่น slug, email)
- Length (เช่น username 3-30 ตัว)

ถ้า frontend หรือ backend ส่งข้อมูลผิด format → MongoDB ปฏิเสธทันที (defense-in-depth)

---

## ส่วนที่ยังไม่ได้ทำ (Future Phases)

- `payouts` — ประวัติการจ่ายเงินศิลปิน
- `refunds` — การคืนเงิน
- `follows` — user ติดตาม artist
- `wishlist` — รายการของที่อยาก
- `comments` — รีวิวบน album
- `downloads` — token ดาวน์โหลด
- `play_history` — ประวัติการฟัง

---

## ติดต่อ

ผู้รับผิดชอบ: Piyawat.K
รอบประชุมที่อ้างอิง: 29/4/2026
ดูเอกสารเพิ่มเติม: `design_notes.md`
