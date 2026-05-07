# 📚 Audtlist Database — Full Schema Explained (Part 2)

> ต่อจาก Part 1 — Collections 4-8 (หัวใจของระบบ)

---

## B4. Collection: `products` (หัวใจของระบบ! ⭐)

### 🎯 ทำไมต้องมี — แก้ปัญหาจาก MOM

จาก MOM 29/4/2026:
> "การแยก Track, Album และ Merchandise ออกเป็นคนละ Table ทำให้ไม่สามารถทำ Pagination ในหน้า Product ได้"

### Sellable Product Layer คืออะไร?

แทนที่จะแยก collection เป็น tracks, albums, merch ตั้งแต่ระดับบนสุด → **เพิ่ม layer กลางชื่อ products** ที่เก็บข้อมูลร่วมของทุกประเภท

```
                products
                /  |  \
              /    |    \
           single  album  merch
           (track)        (merch detail)
```

### Schema เต็ม

```javascript
{
  _id: ObjectId('...'),
  artist_id: ObjectId('artist_xyz...'),     // เจ้าของ product
  type: "album",                              // ⭐ enum: single | album | merch
  title: "Midnight Echoes",
  slug: "midnight-echoes",                   // URL-friendly
  description: "อัลบั้มเต็มชุดแรก",
  price: 250,                                // เก็บเป็น int (บาท)
  min_price: 250,                            // สำหรับ name_your_price
  name_your_price: false,                    // ลูกค้าเลือกราคาเองได้ไหม
  cover_url: "https://...",
  status: "published",                       // draft | published | private | unavailable | deleted
  deleted_at: null,                          // สำหรับ soft delete
  created_at: ISODate('...'),
  updated_at: ISODate('...')
}
```

### 🔑 Field สำคัญ

**`type` enum** — กำหนดว่า product นี้คืออะไร
- `single` → เพลงเดี่ยว 1 เพลง (มี detail ที่ tracks)
- `album` → ชุดเพลง (มี detail ที่ albums + tracks หลายตัว)
- `merch` → สินค้ากายภาพ (มี detail ที่ merch + variants)

**`price` เก็บเป็น int (บาท)** — ทำไม?

❌ ถ้าใช้ float: `0.1 + 0.2 = 0.30000000000000004` (floating-point bug)  
✅ ถ้าใช้ int (เป็นสตางค์): `10 + 20 = 30` ตรงเป๊ะ

> โปรเจคนี้เก็บเป็นบาทเต็ม ไม่มีสตางค์ ถ้าจะเก็บสตางค์ → คูณ 100 (3000 = 30.00 บาท)

**`name_your_price`** — feature ของ Bandcamp
- ถ้า `true` → ลูกค้าเลือกจ่ายเท่าไหร่ก็ได้ (ขั้นต่ำ = `min_price`)
- ใช้กับ artist indie ที่อยากให้แฟนสนับสนุนตามใจ

**`status` enum 5 ค่า**
- `draft` → ยังไม่เผยแพร่ artist กำลังทำ
- `published` → ขายได้
- `private` → ซ่อน แต่ถ้ารู้ link เข้าได้
- `unavailable` → ระงับชั่วคราว (ของหมด/ปัญหา)
- `deleted` → soft deleted (ลูกค้าเก่ายังเข้าถึงได้)

### Index — สำคัญที่สุดในระบบ

```javascript
// 1. หา products ของ artist
db.products.createIndex({ artist_id: 1 })

// 2. Filter ตาม type + status
db.products.createIndex({ type: 1, status: 1 })

// 3. หน้า shop — pagination ⭐
db.products.createIndex({ status: 1, created_at: -1 })

// 4. URL routing
db.products.createIndex({ slug: 1 }, { unique: true })
```

### 🎯 Pagination — สิ่งที่ MOM อยากแก้

```javascript
// หน้าที่ 1
db.products.find({ status: "published" })
  .sort({ created_at: -1 })
  .limit(10)
  .skip(0)

// หน้าที่ 2
db.products.find({ status: "published" })
  .sort({ created_at: -1 })
  .limit(10)
  .skip(10)
```

**ก่อน Sellable Product Layer** ต้องดึงจาก 3 collection แล้วรวม → pagination ลำบาก  
**ตอนนี้** — ดึงจาก collection เดียว pagination ตรงๆ

### Query ที่ใช้บ่อย

```javascript
// หน้า shop — ใหม่สุดก่อน
db.products.find({ status: "published" })
  .sort({ created_at: -1 })
  .limit(20)

// Filter ตาม type
db.products.find({ type: "album", status: "published" })

// ดู merch ราคาน้อยกว่า 1000
db.products.find({ 
  type: "merch", 
  price: { $lt: 1000 },
  status: "published" 
})

// products ของ artist คนหนึ่ง
const artist = db.artists.findOne({ slug: "old-world-vultures" })
db.products.find({ artist_id: artist._id })

// ดู product พร้อม artist info
db.products.aggregate([
  { $match: { slug: "midnight-echoes" } },
  { $lookup: {
      from: "artists",
      localField: "artist_id",
      foreignField: "_id",
      as: "artist"
  }}
])
```

---

## B5. Collection: `tracks`

### 🎯 ทำไมต้องมี

เก็บข้อมูล **ไฟล์เพลง** ที่สามารถ stream + ดาวน์โหลดได้ ไม่ว่าจะเป็น:
- เพลงเดี่ยว (ผูกกับ product type: single)
- เพลงในอัลบั้ม (เป็น track ใน album)

### Schema

```javascript
{
  _id: ObjectId('...'),
  product_id: ObjectId('...'),               // ผูกกับ products (1-to-1)
  duration_sec: 245,                          // ความยาวเป็นวินาที
  audio_file_url: "https://cdn/full.flac",   // ไฟล์เต็มสำหรับคนซื้อ
  preview_url: "https://cdn/preview.mp3",    // ตัวอย่าง 30-90 วินาที
  is_streamable: true,                        // stream ได้ไหม (preview)
  is_active: true,                            // soft delete
  created_at: ISODate('...')
}
```

### 🔑 Field อธิบาย

**`audio_file_url` vs `preview_url`** — เก็บแยกเพราะใช้ต่างกัน

| Field | สำหรับ | คุณภาพ |
|-------|--------|--------|
| `audio_file_url` | คนที่ซื้อแล้ว ดาวน์โหลด | FLAC / WAV (high quality) |
| `preview_url` | คนทั่วไป ฟัง preview | MP3 128kbps (low quality, ประหยัด bandwidth) |

**`is_streamable`** — บางเพลงไม่อยากให้ stream
- ศิลปินตั้งค่าได้
- ถ้า false → ปิดปุ่ม preview บนหน้าเว็บ

### Index

```javascript
db.tracks.createIndex({ product_id: 1 }, { unique: true })
```

### ทำไม product_id เป็น unique?

1 product ที่เป็น track มีไฟล์เพลงแค่ไฟล์เดียว — ไม่ควรมี 2 tracks ผูกกับ product เดียวกัน

> ถ้าจะมีหลาย version (acoustic, remix, ...) → สร้าง products หลายตัวแยกแทน

### Query ที่ใช้บ่อย

```javascript
// หา track ของ product (single)
const product = db.products.findOne({ slug: "crimson-dawn" })
db.tracks.findOne({ product_id: product._id })

// หา product + track พร้อมกัน
db.products.aggregate([
  { $match: { slug: "crimson-dawn" } },
  { $lookup: {
      from: "tracks",
      localField: "_id",
      foreignField: "product_id",
      as: "track"
  }}
])

// ดู total duration ของเพลงทั้งหมด
db.tracks.aggregate([
  { $group: { _id: null, total_sec: { $sum: "$duration_sec" } } }
])
```

---

## B6. Collection: `albums` (Many-to-Many ⭐)

### 🎯 ทำไมต้องมี — ตาม MOM

จาก MOM:
> "Album กับ Track นั้น ความสัมพันธ์ที่แท้จริงคือ Many-to-Many เพราะ 1 เพลงสามารถอยู่ได้หลาย Album และ 1 Album ก็มีได้หลายเพลง"

### Schema

```javascript
{
  _id: ObjectId('...'),
  product_id: ObjectId('...'),               // 1-to-1 กับ products
  release_date: ISODate('2026-01-15'),
  track_ids: [                                // ⭐ Many-to-Many array
    ObjectId('track1...'),
    ObjectId('track2...'),
    ObjectId('track3...'),
    ObjectId('track4...')
  ],
  created_at: ISODate('...')
}
```

### 🔑 Many-to-Many ใน MongoDB

ใน SQL จะมี **junction table** แยก:

```
albums_tracks
| album_id | track_id | track_number |
|----------|----------|--------------|
| 1        | 5        | 1            |
| 1        | 8        | 2            |
| 1        | 12       | 3            |
```

ใน MongoDB ใช้ **array of ObjectId** ในตัว album เลย:

```javascript
{
  _id: ObjectId('album_id'),
  track_ids: [
    ObjectId('5'),    // ลำดับ 0 = track 1
    ObjectId('8'),    // ลำดับ 1 = track 2
    ObjectId('12')    // ลำดับ 2 = track 3
  ]
}
```

**ลำดับใน array = ลำดับใน album** (ไม่ต้องเก็บ track_number แยก)

### 🎯 ทำไม MOM พูดเรื่อง Many-to-Many?

ใน Bandcamp จริง:
- เพลง "Crimson Dawn" อยู่ใน:
  - Single product (ขายเดี่ยว 30 บาท)
  - Album "Midnight Echoes" (รวมในชุด 250 บาท)
  - "Best of 2026" compilation (อนาคต)

→ **track 1 ตัว อยู่ได้หลาย album** → Many-to-Many

### "Album ที่มี track เดียวก็ถือเป็น single"

จาก MOM:
> "Album ที่มี Track เดียวก็ถือเป็น Single ได้โดยนับจำนวน Track จาก Join"

ทำได้ด้วย:

```javascript
db.albums.aggregate([
  { $project: {
      product_id: 1,
      track_count: { $size: "$track_ids" },     // นับจำนวนใน array
      is_single: { $eq: [{ $size: "$track_ids" }, 1] }
  }}
])
```

### Index

```javascript
db.albums.createIndex({ product_id: 1 }, { unique: true })   // 1-to-1 กับ product
db.albums.createIndex({ track_ids: 1 })                      // หา album ที่มี track นี้
```

### ทำไม track_ids ไม่ unique?

เพราะ track เดียวกันอยู่ได้หลาย album — index แค่ทำให้ค้นหาเร็วเฉยๆ

### Query ที่ใช้บ่อย

```javascript
// หา album จาก product
const product = db.products.findOne({ slug: "midnight-echoes" })
const album = db.albums.findOne({ product_id: product._id })

// ดู tracks ทั้งหมดในอัลบั้ม
db.tracks.find({ _id: { $in: album.track_ids } })

// หา album ที่มีเพลง "Crimson Dawn"
const crimsonTrack = db.tracks.findOne({...})
db.albums.find({ track_ids: crimsonTrack._id })

// ⭐ ดู album พร้อม tracks ครบ (JOIN-like)
db.albums.aggregate([
  { $match: { product_id: product._id } },
  { $lookup: {
      from: "tracks",
      localField: "track_ids",
      foreignField: "_id",
      as: "tracks_detail"
  }}
])
```

---

## B7. Collection: `merch`

### 🎯 ทำไมต้องมี

เก็บรายละเอียด **สินค้ากายภาพ** ที่ต้องส่งของจริง:
- เสื้อยืด, hoodie
- Vinyl record, CD, cassette
- โปสเตอร์, สติกเกอร์
- ของอื่นๆ

### Schema

```javascript
{
  _id: ObjectId('...'),
  product_id: ObjectId('...'),               // 1-to-1 กับ products
  merch_type: "tshirt",                       // enum
  weight_grams: 200,                          // คำนวณค่าส่ง
  ships_internationally: true,
  
  // ⭐ Embedded variants (size/color)
  variants: [
    {
      variant_id: ObjectId('...'),
      size: "M",
      color: "black",
      stock_quantity: 25,
      sku: "EC-SHIRT-M-BLK"
    },
    {
      variant_id: ObjectId('...'),
      size: "L",
      color: "black",
      stock_quantity: 18,
      sku: "EC-SHIRT-L-BLK"
    }
  ],
  
  created_at: ISODate('...')
}
```

### 🔑 ทำไม variants ใช้ Embed?

| | Embed (เลือก) | Reference |
|---|---------------|-----------|
| ดึงข้อมูล | 1 query → ครบ | 2 queries |
| Atomic update | ลด stock + อัพเดต merch ในคำสั่งเดียว | ต้อง 2 คำสั่ง |
| ขนาด | variants 1 merch ปกติ < 50 | ไม่ใช่ปัญหา |
| ใช้คู่กัน | ✅ ใช่ | - |

→ **Embed ดีกว่าทุกแง่** สำหรับ variants

### `merch_type` enum 6 ค่า

```javascript
enum: ["tshirt", "vinyl", "cd", "cassette", "poster", "other"]
```

ใช้สำหรับ:
- Filter หน้า shop ("ดูเฉพาะ vinyl")
- คำนวณค่าส่ง (vinyl หนัก แพง)
- การจัดเก็บคลัง (vinyl ห้ามพับ)
- สถิติยอดขาย

### `variants` structure

แต่ละ variant มี:
- **`variant_id`** — ObjectId unique สำหรับใช้ตอนสั่งซื้อ
- **`size`** — S/M/L/XL หรือ 7"/12" สำหรับ vinyl
- **`color`** — สีของ
- **`stock_quantity`** — จำนวนคงเหลือ
- **`sku`** — Stock Keeping Unit (รหัสสินค้า)

### SKU pattern

`EC-SHIRT-M-BLK` แปลว่า:
- **EC** = Exquisite Cadaver
- **SHIRT** = ประเภทสินค้า
- **M** = size M
- **BLK** = สี black

ทำไมต้องมี SKU?
- Admin scan ที่หลังเสื้อ → หาเจอเร็ว
- พิมพ์ใบส่งสินค้า
- จัดเรียงในคลัง

### Index

```javascript
db.merch.createIndex({ product_id: 1 }, { unique: true })
db.merch.createIndex({ "variants.sku": 1 })          // ⭐ index บนฟิลด์ใน embedded
```

### 🔑 Atomic Stock Update — ป้องกัน Race Condition

ถ้าลูกค้า 2 คนซื้อพร้อมกัน ตอน stock = 1:

❌ **Bad approach** (มี race condition):
```javascript
// 1. อ่าน stock
const merch = db.merch.findOne(...)
const stock = merch.variants[0].stock_quantity   // = 1

// 2. ตรวจ + ลด (อันตราย — มี gap)
if (stock >= 1) {
  db.merch.updateOne(..., { $set: { stock_quantity: stock - 1 } })
}
```

✅ **Good approach** (atomic):
```javascript
db.merch.updateOne(
  {
    product_id: merchId,
    variants: {
      $elemMatch: {
        sku: "EC-SHIRT-M-BLK",
        stock_quantity: { $gte: 1 }    // ⭐ เช็ค stock ในเงื่อนไขเดียวกัน
      }
    }
  },
  { $inc: { "variants.$.stock_quantity": -1 } }
)
```

อ่าน: "หา merch ที่ stock >= 1 และลดทันทีในครั้งเดียว"  
→ MongoDB รับประกันว่าจะมีคนเดียวที่สำเร็จ

### Query ที่ใช้บ่อย

```javascript
// หา merch ของ product
const product = db.products.findOne({ slug: "exquisite-cadaver-shirt" })
db.merch.findOne({ product_id: product._id })

// หา variant จาก SKU
db.merch.findOne({ "variants.sku": "EC-SHIRT-M-BLK" })

// ดูเฉพาะ variant ที่มี stock
db.merch.aggregate([
  { $match: { product_id: product._id } },
  { $project: {
      variants: {
        $filter: {
          input: "$variants",
          cond: { $gt: ["$$this.stock_quantity", 0] }
        }
      }
  }}
])

// คำนวณ total stock ของทุก variant
db.merch.aggregate([
  { $unwind: "$variants" },
  { $group: { 
      _id: "$_id", 
      total_stock: { $sum: "$variants.stock_quantity" }
  }}
])
```

---

## B8. Collection: `orders` (Marketplace ⭐)

### 🎯 ทำไมต้องมี

เก็บ **คำสั่งซื้อ** ของลูกค้า — เป็น collection ที่ซับซ้อนที่สุด เพราะต้องรองรับ:
- 1 order มีหลาย items
- 1 order อาจมี items จาก หลายศิลปิน (marketplace)
- บาง items เป็น digital, บางตัวเป็น physical
- Status ต้องแยกต่อ item (digital ส่งทันที, merch รอ artist ส่ง)

### Schema เต็ม

```javascript
{
  _id: ObjectId('...'),
  user_id: ObjectId('user_xyz...'),         // ลูกค้า
  
  // ⭐ Items แบบ marketplace (embed)
  items: [
    {
      product_id: ObjectId('...'),
      product_type: "single",                 // enum
      artist_id: ObjectId('artist...'),       // ⭐ ใครต้องส่ง/ได้เงิน
      title_snapshot: "Crimson Dawn",        // ⭐ snapshot ป้องกันข้อมูลเปลี่ยน
      unit_price: 30,                         // ⭐ snapshot ราคา
      quantity: 1,
      variant_id: null,                       // null สำหรับ digital
      fulfillment_status: "digital_delivered", // ⭐ status ของ item
      tracking_number: null,
      shipped_at: null,
      delivered_at: ISODate('...')
    },
    {
      product_id: ObjectId('shirt...'),
      product_type: "merch",
      artist_id: ObjectId('artist...'),
      title_snapshot: "Cadaver Shirt",
      unit_price: 980,
      quantity: 1,
      variant_id: ObjectId('M_black...'),
      fulfillment_status: "pending",          // รอ artist จัดส่ง
      tracking_number: null,
      shipped_at: null,
      delivered_at: null
    }
  ],
  
  // ราคา (เก็บ int = บาท)
  subtotal: 1260,
  shipping_cost: 100,
  platform_fee: 189,                          // ⭐ ค่าธรรมเนียม platform
  total: 1360,
  currency: "THB",
  
  // Status ระดับ order
  status: "paid",                              // pending_payment | paid | partially_shipped | fully_shipped | completed | cancelled | refunded
  
  // ที่อยู่ลูกค้า
  shipping_address: {
    recipient_name: "มาลี ใจดี",
    line1: "...",
    city: "กรุงเทพ",
    postal_code: "10400",
    country: "TH"
  },
  
  created_at: ISODate('...'),
  updated_at: ISODate('...')
}
```

### 🔑 Marketplace Logic ที่เพิ่ม

**1. `items[].artist_id` — ใครต้องส่ง**

ทำให้ artist เห็นเฉพาะ orders ของตัวเอง:

```javascript
db.orders.find({ "items.artist_id": myArtistId })
```

**2. `items[].fulfillment_status` — status แต่ละ item**

```javascript
enum: [
  "digital_delivered",   // single/album → ส่งทันที
  "pending",             // merch → รอ artist
  "preparing",           // artist กำลังแพ็ค
  "shipped",             // ส่งแล้ว
  "delivered",           // ลูกค้าได้รับ
  "cancelled"            // ยกเลิก
]
```

**3. `status` ระดับ order — รองรับ partial**

```javascript
enum: [
  "pending_payment",      // รอจ่ายเงิน
  "paid",                  // จ่ายแล้ว ของกำลังจัดการ
  "partially_shipped",     // ⭐ artist บางคนส่งแล้ว
  "fully_shipped",         // ส่งครบ
  "completed",             // ลูกค้าได้รับครบ
  "cancelled",
  "refunded"
]
```

**4. `platform_fee` — ค่าธรรมเนียม**

ระบบหัก % ของ subtotal ก่อนเข้า artist:

```
subtotal       = 1,260
platform_fee   = 1,260 × 15% = 189
artist payout  = 1,260 - 189 = 1,071
```

### 🔑 Order Snapshot — Immutability

ใน items เก็บ **snapshot ของ title และ price** ณ เวลาซื้อ:

```javascript
items: [
  {
    product_id: ObjectId('...'),
    title_snapshot: "Crimson Dawn",    // ⭐ snapshot
    unit_price: 30                      // ⭐ snapshot
  }
]
```

**ทำไมต้อง snapshot?**

ถ้าศิลปินขึ้นราคาในอนาคต (30 → 50 บาท):
- ❌ Reference อย่างเดียว → order เก่าแสดงราคาใหม่ (ผิด)
- ✅ Snapshot → order เก่าแสดงราคา 30 (ถูก เพราะลูกค้าจ่าย 30)

### Index

```javascript
// 1. ลูกค้าดูประวัติ
db.orders.createIndex({ user_id: 1, created_at: -1 })

// 2. Admin filter
db.orders.createIndex({ status: 1 })

// 3. Analytics
db.orders.createIndex({ created_at: -1 })

// 4. ⭐ Artist Dashboard (สำคัญที่สุด!)
db.orders.createIndex({ "items.artist_id": 1, "items.fulfillment_status": 1 })
```

### 🎯 Query ที่สำคัญที่สุด — Artist Dashboard

```javascript
// ⭐ Artist เปิด dashboard "orders ของฉันที่รอจัดส่ง"
db.orders.aggregate([
  { $match: { "items.artist_id": myArtistId } },
  { $unwind: "$items" },
  { $match: { 
      "items.artist_id": myArtistId,
      "items.fulfillment_status": "pending"
  }},
  { $project: {
      order_id: "$_id",
      product_type: "$items.product_type",
      title: "$items.title_snapshot",
      quantity: "$items.quantity",
      variant_id: "$items.variant_id",
      shipping_address: 1,
      created_at: 1
  }}
])
```

ผลลัพธ์: เฉพาะ items ของ artist ที่รอส่ง — ไม่ใช่ items ของศิลปินคนอื่น

### 🎯 Update tracking number

```javascript
// Artist อัพเดต tracking ของ item ตัวเอง
db.orders.updateOne(
  { 
    user_id: customerOrderId,
    "items.product_id": myMerchId
  },
  {
    $set: {
      "items.$.fulfillment_status": "shipped",
      "items.$.tracking_number": "TH1234567890",
      "items.$.shipped_at": new Date(),
      status: "partially_shipped",     // ถ้ายังมี items อื่นรอ
      updated_at: new Date()
    }
  }
)
```

`items.$` = position operator — "อัพเดตตัวที่ตรงเงื่อนไข items.product_id"

### Query ที่ใช้บ่อย

```javascript
// ลูกค้าดู My Orders
db.orders.find({ user_id: maleeId }).sort({ created_at: -1 })

// Admin ดู orders ทั้งหมด
db.orders.find({ status: "paid" })

// ดูยอดขายเดือนนี้
db.orders.aggregate([
  { $match: { 
      status: { $in: ["paid", "shipped", "completed"] },
      created_at: { $gte: new Date("2026-05-01") }
  }},
  { $group: { _id: null, total: { $sum: "$total" } } }
])

// Top selling products
db.orders.aggregate([
  { $unwind: "$items" },
  { $group: { 
      _id: "$items.product_id",
      total_sold: { $sum: "$items.quantity" },
      revenue: { $sum: { $multiply: ["$items.unit_price", "$items.quantity"] } }
  }},
  { $sort: { total_sold: -1 } },
  { $limit: 10 }
])
```

---

(ต่อ Part 3 — Design Patterns)
