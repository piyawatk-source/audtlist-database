# 📚 Audtlist Database — Full Schema Explained (Part 3)

> ต่อจาก Part 2 — Design Patterns ที่ใช้ในระบบ

---

# Part C: Design Patterns ที่ใช้

Pattern คือ **วิธีแก้ปัญหาที่นักพัฒนาใช้กันแพร่หลาย** — ไม่ใช่กฎตายตัว แต่เป็น "ทางที่ทดสอบแล้วว่าใช้ได้"

---

## C1. Sellable Product Layer

### ปัญหาที่เจอ

ในระบบ Bandcamp มีของขาย 3 ประเภท: single, album, merch

ถ้าออกแบบ collection แยกตั้งแต่บนสุด:

```
- singles
- albums
- merch
```

**ปัญหา:** หน้า shop ต้องดึงข้อมูลจาก 3 collections พร้อมกัน → pagination ทำไม่ได้

### Solution: Layer กลาง

สร้าง `products` collection ที่เป็น "ฉลากสินค้า" — เก็บข้อมูลร่วม (title, price, status)  
ส่วนรายละเอียดเฉพาะแต่ละประเภท → แยกเป็น `tracks`, `albums`, `merch`

```
                products (layer กลาง)
              /     |        \
           tracks  albums   merch
       (single)   (multi-track) (variants)
```

### Pattern ที่ใช้

| ระดับ | Collection | ฟิลด์ที่เก็บ |
|------|-----------|-------------|
| **Layer 1** | products | title, price, type, status — สิ่งที่ต้องใช้ตอน list |
| **Layer 2** | tracks/albums/merch | duration, track_ids, variants — เฉพาะ type |

### ทำไมเรียก "Sellable Product"?

เพราะ products = "ของที่ขายได้" — ไม่ใช่ทุก track ต้องเป็น product (track ที่อยู่ใน album แต่ไม่ขาย single → ไม่จำเป็นต้องมี product)

### Trade-off

**ข้อดี:**
- ✅ Pagination ข้าม type ในที่เดียว
- ✅ Filter ตาม type ง่าย
- ✅ เพิ่ม type ใหม่ในอนาคตได้ (เช่น "ticket" สำหรับขายตั๋วคอนเสิร์ต)

**ข้อเสีย:**
- ❌ ดูข้อมูลครบต้อง 2 query (products + detail)
- ❌ ต้อง maintain data ใน 2 collections (ระวัง orphan)

---

## C2. Many-to-Many ใน MongoDB

### ปัญหาที่เจอ

จาก MOM: Album-Track เป็น Many-to-Many
- 1 เพลงอยู่ได้หลาย album
- 1 album มีหลายเพลง

### Solution ใน SQL — Junction Table

```sql
CREATE TABLE album_tracks (
  album_id INT,
  track_id INT,
  track_number INT,
  PRIMARY KEY (album_id, track_id)
);
```

### Solution ใน MongoDB — Reference Array

ฝัง array ของ ObjectId ใน document หลัก:

```javascript
// album document
{
  _id: ObjectId('album1'),
  product_id: ObjectId('...'),
  track_ids: [
    ObjectId('track1'),
    ObjectId('track2'),
    ObjectId('track3')
  ]
}
```

### เลือกข้างไหนของความสัมพันธ์?

ใน Many-to-Many ต้องเลือกว่าเก็บ array ฝั่งไหน:

**Option A:** เก็บใน album → `album.track_ids: [...]`  
**Option B:** เก็บใน track → `track.album_ids: [...]`  
**Option C:** เก็บทั้งสองฝั่ง → ซ้ำซ้อน

### กฎเลือก: เก็บฝั่งที่ "ถูก query บ่อยกว่า"

ในระบบเรา:
- **Query บ่อย:** "อัลบั้มนี้มีเพลงอะไรบ้าง" → ดึงจาก album
- **Query ไม่บ่อย:** "เพลงนี้อยู่ใน album ไหนบ้าง" → search album.track_ids

→ **เก็บใน album** เป็นหลัก

### ดึงข้อมูลกลับ

```javascript
// อัลบั้มนี้มีเพลงอะไรบ้าง
const album = db.albums.findOne({ ... })
const tracks = db.tracks.find({ _id: { $in: album.track_ids } })

// หรือใช้ $lookup ในคำสั่งเดียว
db.albums.aggregate([
  { $match: {...} },
  { $lookup: {
      from: "tracks",
      localField: "track_ids",
      foreignField: "_id",
      as: "tracks_detail"
  }}
])

// เพลงนี้อยู่ใน album ไหนบ้าง (reverse lookup)
db.albums.find({ track_ids: trackId })
```

### กรณีไหนไม่ควรใช้ array?

ถ้า array ใหญ่มาก (> 1000 items) → แตก document ใหญ่เกิน → ใช้ junction collection แยก:

```javascript
// album_tracks collection
{ album_id: ObjectId(...), track_id: ObjectId(...), track_number: 5 }
```

แต่สำหรับ Bandcamp — album ปกติมี 5-15 เพลง → array ดีพอ

---

## C3. Order Snapshot (Immutability)

### ปัญหาที่เจอ

ลูกค้ามาลีซื้อ "Cadaver Shirt" ราคา 980 บาทในเดือน พฤษภาคม 2026

3 เดือนต่อมา ศิลปินเปลี่ยน:
- ขึ้นราคาเป็น 1,200 บาท
- เปลี่ยนชื่อเป็น "New Cadaver Shirt"
- ลบ product ทิ้ง (soft delete)

**คำถาม:** order ของมาลีต้องแสดงอะไร?

### ตัวเลือกที่ผิด: ดึงข้อมูลปัจจุบัน

```javascript
// order
{ items: [{ product_id: ObjectId('shirt') }] }

// ตอน render
const product = db.products.findOne({ _id: orderItem.product_id })
showOrderItem(product.title, product.price)   // ❌ แสดงราคาใหม่!
```

**ปัญหา:**
- ลูกค้าเห็นราคา 1,200 (ไม่ใช่ 980 ที่จ่ายจริง)
- ถ้า product ถูกลบ → render ไม่ได้
- ใบเสร็จไม่ตรงกับการจ่ายเงิน

### ตัวเลือกที่ถูก: Snapshot ตอนซื้อ

เก็บข้อมูลที่จำเป็น **ในตัว order item** ตอนสร้าง order:

```javascript
items: [
  {
    product_id: ObjectId('shirt'),    // reference (ใช้ตอน trace)
    title_snapshot: "Cadaver Shirt",  // ⭐ snapshot ตอนซื้อ
    unit_price: 980                   // ⭐ snapshot ตอนซื้อ
  }
]
```

### ทำไมเรียก Immutability?

= "ไม่เปลี่ยนแปลง"

**Order ที่จ่ายเงินแล้ว = หลักฐานที่ไม่ควรเปลี่ยน**  
- เปลี่ยนได้แค่ status (paid → shipped → delivered)
- เนื้อหา (items, ราคา, ที่อยู่) **ห้ามแก้**

→ เรียกว่า "immutable order data"

### Pattern นี้ใช้ที่ไหนอีก?

- **ใบเสร็จ** ของ e-commerce ทุกที่
- **Invoice** ของระบบบัญชี
- **Payment record** ของธนาคาร
- **Audit log** ทั่วไป

→ ทุกครั้งที่ต้อง "บันทึกประวัติ" ที่เปลี่ยนไม่ได้ — ใช้ snapshot pattern

### Trade-off

**ข้อดี:**
- ✅ ข้อมูล historical ถูกต้องเสมอ
- ✅ ลบ product ได้ ไม่ทำลาย order เก่า

**ข้อเสีย:**
- ❌ Document ใหญ่ขึ้น
- ❌ ต้อง update snapshot ทุกครั้งที่สร้าง order

→ Trade-off คุ้มค่ามาก — ทุกระบบ e-commerce ใช้

---

## C4. Soft Delete

### ปัญหาที่เจอ

มาลีซื้อ "Crimson Dawn" (single) ในเดือน พ.ค.

3 เดือนต่อมา ศิลปินอยาก "ลบเพลงนี้ออกจากระบบ"

### ตัวเลือกที่ผิด: Hard Delete

```javascript
db.tracks.deleteOne({ _id: trackId })
```

**ปัญหา:**
- มาลีเปิด library → เพลงหาย
- มาลี download → 404
- order มี product_id ที่ชี้ไป track ที่หายไป → broken reference

### ตัวเลือกที่ถูก: Soft Delete

ไม่ลบจริง แต่ **ซ่อนจากระบบ** ด้วยการเปลี่ยน status

```javascript
db.tracks.updateOne(
  { _id: trackId },
  { $set: { is_active: false } }
)
```

หรือใส่ `deleted_at`:

```javascript
db.products.updateOne(
  { _id: productId },
  { $set: { 
      status: "deleted",
      deleted_at: new Date() 
  }}
)
```

### Logic ที่ต้องเปลี่ยน

**หน้า shop (กรอง deleted):**
```javascript
db.products.find({ 
  status: "published",
  deleted_at: null    // ⭐ กรอง deleted ออก
})
```

**หน้า library ของลูกค้า (ไม่กรอง):**
```javascript
// ลูกค้าซื้อแล้ว ต้องเข้าถึงได้
db.orders.find({ user_id: maleeId })
// ❌ ห้ามใส่ filter deleted_at — ลูกค้าต้องเห็นของที่เคยซื้อ
```

**Download endpoint (ไม่กรอง):**
```javascript
// ตรวจว่าเคยซื้อจริง — ไม่สนใจว่าตอนนี้ deleted หรือยัง
const order = db.orders.findOne({
  user_id: userId,
  "items.product_id": productId,
  status: { $in: ["paid", "completed"] }
})

if (order) {
  return getDownloadUrl(...)   // ส่งให้ลูกค้า แม้ product ถูก soft delete
}
```

### Hard Delete ใช้ตอนไหน?

- ข้อมูลไม่มีคนพึ่ง (เช่น draft ที่ไม่เคย publish)
- ตามกฎหมาย (GDPR — ลูกค้าขอลบข้อมูล)
- Cleanup expired data

### Pattern Variation

**1. is_active boolean** (ง่ายสุด)
```javascript
{ is_active: true }   // active
{ is_active: false }  // soft deleted
```

**2. deleted_at timestamp** (มีประวัติ)
```javascript
{ deleted_at: null }                  // active
{ deleted_at: ISODate('2026-05-04') } // ลบเมื่อ
```

**3. Status enum** (หลายสถานะ)
```javascript
{ status: "active" }     // ใช้งานปกติ
{ status: "inactive" }   // ระงับชั่วคราว  
{ status: "deleted" }    // soft deleted
{ status: "banned" }     // ถูก ban
```

→ เลือกตามความซับซ้อนของ business

---

## C5. Atomic Update + Race Condition

### ปัญหาที่เจอ

stock ของเสื้อเหลือ 1 ตัว — ลูกค้า A กับ B กดซื้อพร้อมกัน

**Timeline ที่เกิด race condition:**
```
12:00:00.001  คน A อ่าน stock = 1
12:00:00.002  คน B อ่าน stock = 1
12:00:00.003  คน A ลด stock = 0  ✓
12:00:00.004  คน B ลด stock = -1 ❌
```

→ stock ติดลบ + ขายของให้ 2 คน ทั้งที่มี 1 ตัว

### ตัวเลือกที่ผิด: Read-Then-Write

```javascript
// 1. อ่าน
const merch = db.merch.findOne({...})
const stock = merch.variants[0].stock_quantity

// 2. คิด (ตรงนี้ race condition!)
if (stock < 1) return error("ของหมด")

// 3. เขียน
db.merch.updateOne(..., { $inc: { stock: -1 } })
```

**ช่องโหว่:** ระหว่างอ่าน-เขียน มี gap → คนอื่นแทรกได้

### ตัวเลือกที่ถูก: Atomic Operation

ใช้ MongoDB **`updateOne` ที่รวมเงื่อนไขและ update ในคำสั่งเดียว**:

```javascript
db.merch.updateOne(
  { 
    product_id: shirtId,
    variants: {
      $elemMatch: {
        sku: "EC-SHIRT-M-BLK",
        stock_quantity: { $gte: 1 }    // ⭐ เช็ค stock ในเงื่อนไข
      }
    }
  },
  { $inc: { "variants.$.stock_quantity": -1 } }
)
```

อ่าน: "**หา merch ที่ stock >= 1 และลด 1 ทันที** ในคำสั่งเดียว"

### ทำไม Atomic ถึงแก้ปัญหา?

MongoDB รับประกันว่าคำสั่งเดียวจะ "ไม่มีใครแทรก" — เป็นหน่วย atomic

→ คน A กับ B ส่งคำสั่งพร้อมกัน:
- คนแรกที่ MongoDB ประมวลผล → สำเร็จ (stock 1 → 0)
- คนที่สอง → เงื่อนไข `$gte: 1` ไม่ผ่าน → `modifiedCount: 0` → reject

### ตรวจ result — ป้องกัน 0 update

```javascript
const result = db.merch.updateOne(...)

if (result.modifiedCount === 0) {
  return error("สินค้าหมดพอดี กรุณาเลือกของอื่น")
}
```

### Pattern อื่นๆ ที่ใช้

**1. `findOneAndUpdate`** — atomic update + return ค่าใหม่
```javascript
const updated = db.merch.findOneAndUpdate(
  { ..., stock: { $gte: 1 } },
  { $inc: { stock: -1 } },
  { returnDocument: "after" }
)
```

**2. MongoDB Transaction** — สำหรับ multi-collection update
```javascript
session.startTransaction()
try {
  await db.merch.updateOne(..., { session })       // ลด stock
  await db.orders.insertOne(..., { session })      // สร้าง order
  await db.artists.updateOne(..., { session })     // เพิ่ม payout
  await session.commitTransaction()
} catch (e) {
  await session.abortTransaction()  // rollback ทั้งหมด
}
```

### กฎที่ต้องจำ

> **ทุกครั้งที่เปลี่ยน state ที่ critical (stock, money, count) — ใช้ atomic operation เสมอ**

---

## C6. Marketplace Logic

### ปัญหาที่เจอ

ระหว่าง implement schema พบว่า business model จริงคือ **marketplace**:
- ทีมขอแค่ schema พื้นฐาน
- แต่ business logic ซับซ้อนกว่า — ศิลปินเป็นผู้ขายจริง

### Marketplace vs Inventory Model

| | Marketplace (ของเรา) | Inventory |
|---|----------------------|-----------|
| ตัวอย่าง | Bandcamp, Etsy, eBay | Amazon (1P), Lazada FBL |
| ใครมีของ | ศิลปิน (seller) | Platform |
| ใครส่ง | ศิลปินเอง | Platform |
| ใครจัดการ stock | ศิลปินเอง | Platform |
| ใครได้เงิน | ศิลปิน (หัก fee) | Platform |
| ความซับซ้อน | สูง | ต่ำ |

### Schema Changes ที่ต้องทำ

**1. ทุก order item ต้องระบุ artist**

```javascript
items: [{
  product_id: ObjectId('...'),
  artist_id: ObjectId('...'),    // ⭐ ใหม่
  ...
}]
```

→ ทำให้ artist เห็นเฉพาะ orders ที่มี item ของตัวเอง

**2. Status แยกต่อ item**

```javascript
items: [{
  fulfillment_status: "pending",   // ⭐ ใหม่ — แยกจาก order status
  tracking_number: "TH123...",
  shipped_at: ISODate('...'),
  delivered_at: null
}]
```

→ 1 order มี items จาก 2 ศิลปิน — ส่งแยก ติดตามแยก

**3. Artist profile ต้องมี shipping/payout**

```javascript
// artists collection
{
  ...,
  shipping_address: {...},   // ⭐ ใหม่
  payout_method: {...},      // ⭐ ใหม่
  payout_balance: 1071       // ⭐ ใหม่
}
```

**4. Order ต้องแยก platform fee**

```javascript
// orders
{
  subtotal: 1260,
  shipping_cost: 100,
  platform_fee: 189,    // ⭐ ใหม่ — แยกจาก artist
  total: 1360
}
```

### Money Flow ใน Marketplace

```
ลูกค้าจ่าย 1,360 บาท
    ↓
Platform รับเงินทั้งหมด
    ↓
แบ่ง:
  - 100 บาท   → ค่าส่ง (ให้ artist เพราะส่งเอง)
  - 189 บาท   → Platform fee (ของ platform)
  - 1,071 บาท → Artist payout balance
```

→ Artist กดถอนเงินทีหลัง

### Query Patterns ของ Marketplace

**Artist Dashboard (สำคัญที่สุด)**
```javascript
db.orders.aggregate([
  { $match: { "items.artist_id": myArtistId } },
  { $unwind: "$items" },
  { $match: {
      "items.artist_id": myArtistId,
      "items.fulfillment_status": "pending"
  }},
  { $project: {
      order_id: "$_id",
      title: "$items.title_snapshot",
      shipping_address: 1
  }}
])
```

**Platform Revenue Report**
```javascript
db.orders.aggregate([
  { $match: { 
      created_at: { $gte: startOfMonth },
      status: { $in: ["paid", "completed"] }
  }},
  { $group: {
      _id: null,
      total_gmv: { $sum: "$total" },
      total_platform_fee: { $sum: "$platform_fee" }
  }}
])
```

**Artist Payout Total**
```javascript
db.artists.aggregate([
  { $project: {
      name: 1,
      payout_balance: 1
  }},
  { $sort: { payout_balance: -1 } }
])
```

### ความซับซ้อนที่ต้อง handle

1. **Platform fee calculation** — % ของ subtotal? หรือ flat rate?
2. **Multi-artist order** — ลูกค้าซื้อจาก 2 ศิลปิน → ค่าส่งคิดยังไง?
3. **Refund** — ใครเป็นคนคืนเงิน? Platform หรือ artist?
4. **Dispute** — ลูกค้าไม่ได้ของ → escalate ไปที่ platform?
5. **Tax** — VAT, withholding tax — ใครเป็นคนแจ้ง?

→ เรื่องเหล่านี้ต้องคุยกับทีม + business เพิ่มในรอบถัดไป

---

# 🎓 สรุป Patterns ที่ใช้

| Pattern | ใช้เพื่อ | Collection ที่ใช้ |
|---------|---------|-----------------|
| **Sellable Product Layer** | แก้ pagination ข้าม type | products → tracks/albums/merch |
| **Many-to-Many (Reference Array)** | ความสัมพันธ์ M:N | albums.track_ids, artists.genre_ids |
| **Order Snapshot** | ป้องกันข้อมูล historical เปลี่ยน | orders.items (title_snapshot, unit_price) |
| **Soft Delete** | รักษาสิทธิ์ลูกค้า + audit trail | products.deleted_at, status enums |
| **Atomic Update** | ป้องกัน race condition | merch.variants stock |
| **Marketplace** | รองรับ multi-seller business | orders.items.artist_id, fulfillment_status |
| **Embed for Variants** | ดึงพร้อมกัน, ขนาดเล็ก | merch.variants[] |

---

# 📚 อ่านเพิ่มเติม

ถ้าอยากเก่งขึ้น แนะนำหัวข้อต่อไป:

1. **MongoDB Aggregate Pipeline** — เทียบ JOIN + GROUP BY ของ SQL
2. **MongoDB Transactions** — multi-document atomicity
3. **Schema Design Patterns** — https://www.mongodb.com/blog/post/building-with-patterns-a-summary
4. **CAP Theorem** — Consistency vs Availability vs Partition tolerance
5. **Database Indexing Deep Dive** — B-tree, Compound, Sparse, TTL indexes

---

> เอกสารนี้เขียนจาก session ที่เริ่มจาก "ไม่เคยเขียนโค้ดเลย" จนสร้าง schema 8 collections พร้อม marketplace logic ใน 1 วัน  
> เก็บไว้อ่านทบทวนได้ตลอด — ทุก decision มีเหตุผล ทุก pattern มีที่มา 💪
