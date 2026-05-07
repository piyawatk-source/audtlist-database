# 📋 Audtlist Database — Team Review Summary

> เอกสารสรุปสำหรับทีม review schema  
> ขนาด: ~6 หน้า อ่าน 10-15 นาที  
> Reference: MOM 29/4/2026

---

## 🎯 Executive Summary

**สิ่งที่ทำเสร็จ:**
- ✅ MongoDB schema 8 collections พร้อม validators และ indexes
- ✅ Sample data สำหรับ test
- ✅ ทดสอบ scenario จริง (มาลีซื้อ 3 รายการ)
- ✅ ครอบคลุมทุก requirement ของ MOM

**สิ่งที่ขอให้ทีม review:**
1. Marketplace logic ที่เพิ่มเข้ามา (เกินจาก MOM)
2. คำถาม 9 ข้อ ที่ต้องการตัดสินใจ
3. Future Work — สิ่งที่ยังไม่ได้ทำในรอบนี้

---

## 📦 Deliverables

| ไฟล์ | จุดประสงค์ |
|------|-----------|
| `schema.js` | คำสั่ง MongoDB สร้าง 8 collections + validators + indexes |
| `sample_data.js` | ข้อมูลตัวอย่างสำหรับ test |
| `README.md` | ภาพรวม + วิธีใช้ |
| `design_notes.md` | ข้อสังเกต + คำถาม |
| `01_full_schema_explained_*.md` | เอกสารอธิบายลึกของแต่ละ collection |

---

## 🗺️ ER Diagram (สรุป)

```
┌─────────┐
│ users   │
└────┬────┘
     │
     │ 1-to-1
     ↓
┌─────────┐         ┌──────────┐
│ artists │ ◄─M:N──►│  genres  │ (master data)
└────┬────┘         └──────────┘
     │
     │ 1-to-N
     ↓
┌─────────────────────────────────┐
│   products (Sellable Layer)     │
│   type: single | album | merch  │
└────┬────────────┬────────────┬──┘
     │ 1:1        │ 1:1        │ 1:1
     ↓            ↓            ↓
┌────────┐  ┌────────┐  ┌────────┐
│ tracks │◄─│ albums │  │ merch  │
└────────┘ M:N└──────┘  │+variants│
                        └────────┘
                            
┌─────────┐                 
│ orders  │                 
│  items: │                 
│  [...]  │ embed           
└─────────┘                 
```

---

## 🔑 Design Decisions ที่สำคัญ

### 1. Sellable Product Layer ✅ (ตาม MOM)

**ปัญหา:** Pagination ข้าม type (single/album/merch) ทำไม่ได้  
**Solution:** สร้าง `products` collection เป็น layer กลาง  
**ผลลัพธ์:** `db.products.find({status: "published"}).limit(20)` ทำงานทุก type

### 2. Album-Track Many-to-Many ✅ (ตาม MOM)

**ใน MongoDB:** ใช้ `array of ObjectId` แทน junction table  
```javascript
{ track_ids: [ObjectId, ObjectId, ObjectId] }
```
**เพลงเดียวอยู่หลาย album ได้** — เหมือน Bandcamp จริง

### 3. User Type Enum ✅ (ตาม MOM)

```javascript
user_type: enum ["ADMIN", "USER", "ARTIST"]
```
- รวมทุก role ใน users collection เดียว
- Admin มี username/password ของตัวเอง login ได้

### 4. Genre Master Data ✅ (ตาม MOM)

- Collection แยก
- Admin CRUD ได้
- Artist เลือกหลาย genre ได้ผ่าน `genre_ids` array

### 5. ⚠️ Marketplace Logic (เพิ่มจาก MOM — ขอให้ทีมยืนยัน)

ระหว่าง implement พบว่า business model = marketplace
- ศิลปินจัดส่งเอง
- ศิลปินจัดการ stock เอง
- ศิลปินรับเงินผ่าน payout

**Schema changes ที่เพิ่ม:**

| Collection | Field ใหม่ | จุดประสงค์ |
|-----------|-----------|----------|
| `orders.items[]` | `artist_id` | ระบุว่า item เป็นของศิลปินคนไหน |
| `orders.items[]` | `fulfillment_status` | status แยกต่อ item (digital_delivered, pending, shipped, ...) |
| `orders.items[]` | `tracking_number` | เลขพัสดุ |
| `orders` | `platform_fee` | ค่าธรรมเนียม platform |
| `orders.status` | เพิ่ม `partially_shipped`, `fully_shipped` | รองรับ multi-artist order |
| `artists` | `shipping_address` | ที่อยู่ที่ artist ส่งของ |
| `artists` | `payout_method` | bank_transfer, paypal, promptpay |
| `artists` | `payout_balance` | ยอดเงินรอถอน |

---

## 💰 Money Flow ใน Marketplace (ตัวอย่าง)

มาลีซื้อ:
- Single 30 + Album 250 + Shirt 980 = 1,260 บาท
- ค่าส่ง 100 บาท
- รวม **1,360 บาท**

**การกระจายเงิน:**
```
Platform รับ: 1,360 บาท
  ↓
  ค่าส่ง 100 → Artist (เพราะส่งเอง)
  Platform fee 189 (15% ของ subtotal) → Platform
  Artist payout 1,071 → เพิ่มเข้า payout_balance ของ artist
```

---

## ❓ คำถาม 9 ข้อให้ทีมตัดสินใจ

### 1. Platform Fee
**ตอนนี้:** 15% ของ subtotal  
**คำถาม:** ตัวเลขเหมาะสมไหม? เก็บ flat rate หรือ %?

### 2. Payout Methods
**ตอนนี้รองรับ:** bank_transfer, paypal, promptpay  
**คำถาม:** เพิ่ม/ลดอย่างอื่นไหม? (true wallet, crypto, etc.)

### 3. Payouts Collection แยก
**ตอนนี้:** เก็บแค่ `payout_balance` ใน artists  
**ข้อเสนอ:** สร้าง `payouts` collection แยกเพื่อเก็บประวัติการถอนเงิน  
**คำถาม:** ทำในรอบนี้ หรือรอบหน้า?

### 4. Soft Delete Policy
**ตอนนี้:** ใช้ `deleted_at` + status enum  
**คำถาม:** Purge data จริงหลังกี่วัน? (กฎหมาย GDPR ไทย)

### 5. Stock Reservation
**ตอนนี้:** ลด stock ตอนจ่ายเงินสำเร็จ  
**คำถาม:** ทำ reservation ตอนใส่ตะกร้าไหม? (lock 15 นาที)

### 6. MongoDB Transactions
**ตอนนี้:** ยังไม่ใช้ — เพราะใช้ atomic operations แทน  
**คำถาม:** ใช้ transaction ตอนไหน? (multi-collection update)

### 7. Refund Logic
**ตอนนี้:** ยังไม่ design  
**ทางเลือก:**
- A) เพิ่ม `refund_status` ในแต่ละ item
- B) สร้าง `refunds` collection แยก (แนะนำ)

**คำถาม:** เลือก option ไหน?

### 8. Track Number ใน Album
**ตอนนี้:** ใช้ลำดับใน array (track_ids[0] = เพลง 1)  
**คำถาม:** ต้องการ field `track_number` แยกไหม?

### 9. Future Work Priority

ลำดับการทำ collection ที่เหลือ:
- [ ] `refunds` — ประวัติการคืนเงิน
- [ ] `payouts` — ประวัติการจ่ายเงินศิลปิน
- [ ] `follows` — user ติดตาม artist
- [ ] `wishlist` — รายการของที่อยาก
- [ ] `comments` — รีวิวบน album
- [ ] `downloads` — token ดาวน์โหลด + tracking
- [ ] `play_history` — ประวัติการฟัง
- [ ] `notifications` — แจ้งเตือน

**คำถาม:** ทำอันไหนก่อน?

---

## 🎯 Use Cases ที่ Schema รองรับแล้ว

### หน้า Shop (Public)
```javascript
// แสดง products ทั้งหมด (pagination)
db.products.find({ status: "published" })
  .sort({ created_at: -1 })
  .limit(20)

// Filter ตาม type
db.products.find({ type: "album", status: "published" })

// หา products ของ artist คนหนึ่ง
db.products.find({ artist_id: artistId })
```

### หน้า Album (รายละเอียด)
```javascript
// album + tracks ครบ
db.albums.aggregate([
  { $match: { product_id: productId } },
  { $lookup: {
      from: "tracks",
      localField: "track_ids",
      foreignField: "_id",
      as: "tracks_detail"
  }}
])
```

### Cart + Checkout
```javascript
// ตรวจ stock ก่อนซื้อ (atomic)
db.merch.updateOne(
  { product_id: ..., variants: { $elemMatch: { sku: ..., stock_quantity: { $gte: 1 } } } },
  { $inc: { "variants.$.stock_quantity": -1 } }
)

// สร้าง order
db.orders.insertOne({...})

// อัพเดต payout
db.artists.updateOne({...}, { $inc: { payout_balance: amount } })
```

### Customer Library
```javascript
// ลูกค้าดู orders ของตัวเอง
db.orders.find({ user_id: maleeId }).sort({ created_at: -1 })
```

### Artist Dashboard ⭐
```javascript
// orders ที่ artist ต้องจัดส่ง
db.orders.aggregate([
  { $match: { "items.artist_id": myArtistId } },
  { $unwind: "$items" },
  { $match: {
      "items.artist_id": myArtistId,
      "items.fulfillment_status": "pending"
  }},
  { $project: {
      title: "$items.title_snapshot",
      shipping_address: 1
  }}
])
```

### Admin Reports
```javascript
// ยอดขายเดือนนี้
db.orders.aggregate([
  { $match: { 
      created_at: { $gte: startOfMonth },
      status: { $in: ["paid", "completed"] }
  }},
  { $group: { 
      _id: null, 
      total_gmv: { $sum: "$total" },
      platform_revenue: { $sum: "$platform_fee" }
  }}
])

// Top artists
db.orders.aggregate([
  { $unwind: "$items" },
  { $group: { 
      _id: "$items.artist_id",
      total_revenue: { $sum: { $multiply: ["$items.unit_price", "$items.quantity"] } }
  }},
  { $sort: { total_revenue: -1 } },
  { $limit: 10 }
])
```

---

## 🛡️ Data Integrity ที่บังคับ

ทุก collection มี **JSON Schema validator** ที่บังคับ:
- ✅ Required fields ต้องมี
- ✅ Data types ต้องถูกต้อง
- ✅ Enum values ต้องอยู่ในรายการ
- ✅ String length, pattern (email, slug)
- ✅ Number minimum (price >= 0, stock >= 0)

→ ถ้า frontend หรือ backend ส่งข้อมูลผิด format → MongoDB ปฏิเสธทันที (defense-in-depth)

---

## 🚀 วิธี setup database

### Quick Start

```bash
# 1. สร้าง database
mongosh "your-connection-string"
use audtlist_clone

# 2. รัน schema
load("schema.js")

# 3. ใส่ sample data (optional)
load("sample_data.js")

# 4. ตรวจ
show collections    // ต้องเห็น 8 collections
db.products.countDocuments()    // ต้องเห็น 3
```

หรือ copy-paste content ของไฟล์ใน mongosh ก็ได้

---

## 📝 Recommendations สำหรับรอบ Meeting หน้า

1. **Approve marketplace logic** ที่เพิ่มเข้ามา หรือเสนอแก้
2. **ตอบคำถาม 9 ข้อ** ใน design_notes
3. **ลำดับ Future Work** — ทำอันไหนก่อน
4. **Naming convention** — เห็นด้วยกับการตั้งชื่อ collection/field ไหม
5. **Test cluster** — ใช้ cluster เดียวกันหรือทีมแยก

---

## 🤝 ติดต่อ

**ผู้ทำ:** [คุณ]  
**Reference:** MOM 29/4/2026  
**Date:** 4 พ.ค. 2026  
**Status:** Ready for review
