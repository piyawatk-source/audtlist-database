# 📚 Audtlist Database — Full Schema Explained

> เอกสารฉบับเต็มอธิบายทุก Collection พร้อมเหตุผลของ Design Decisions  
> สำหรับ: ทบทวนความเข้าใจของตัวเอง + ส่งทีม review

---

## สารบัญ

**Part A: ความรู้พื้นฐาน**
- A1. ทำไมเลือก MongoDB
- A2. คำศัพท์ MongoDB ที่ต้องรู้
- A3. ObjectId คืออะไร ทำไมสำคัญ
- A4. Embed vs Reference — การตัดสินใจที่สำคัญที่สุด
- A5. Index ทำงานยังไง

**Part B: 8 Collections อธิบายทีละตัว**
- B1. users
- B2. genres
- B3. artists
- B4. products (หัวใจของระบบ)
- B5. tracks
- B6. albums (Many-to-Many)
- B7. merch
- B8. orders (Marketplace logic)

**Part C: Design Patterns ที่ใช้**
- C1. Sellable Product Layer
- C2. Many-to-Many ใน MongoDB
- C3. Order Snapshot (Immutability)
- C4. Soft Delete
- C5. Atomic Update + Race Condition
- C6. Marketplace Logic

---

# Part A: ความรู้พื้นฐาน

## A1. ทำไมเลือก MongoDB ไม่ใช่ SQL?

ในโลก database มี 2 ตระกูลหลัก:

| | SQL (Relational) | MongoDB (Document) |
|---|------------------|--------------------|
| ตัวอย่าง | MySQL, PostgreSQL | MongoDB, DynamoDB |
| โครงสร้าง | Table + Row + Column | Collection + Document + Field |
| Schema | เข้มงวด ต้องประกาศก่อน | ยืดหยุ่น เปลี่ยนได้ |
| Relationship | JOIN ระหว่าง tables | Embed หรือ ObjectId reference |
| ภาษา | SQL | JavaScript-like |

### โปรเจคนี้เลือก MongoDB เพราะ:

1. **ทีมตัดสินใจแล้วใน MOM** — ใน Resources ของ MOM มีลิงก์ MongoDB ACID compliance
2. **Schema flexibility** — ตอนแรกไม่รู้ว่า merch จะมี variants กี่แบบ MongoDB เพิ่ม field ภายหลังได้
3. **Embedded data ดี** — order มี items หลายตัว ใส่ฝังในก้อนเดียวได้ ไม่ต้อง JOIN
4. **JSON-native** — ตอนส่งให้ frontend ไม่ต้องแปลง format

> **Trade-off:** MongoDB ไม่เก่งเรื่อง complex JOIN เท่า SQL ถ้าระบบมี relationship ซับซ้อนมาก SQL อาจดีกว่า แต่สำหรับ Bandcamp clone — MongoDB เหมาะสุดเลย

---

## A2. คำศัพท์ MongoDB ที่ต้องรู้

| คำใน SQL | คำใน MongoDB | ตัวอย่าง |
|----------|--------------|---------|
| Database | Database | `audtlist_clone` |
| **Table** | **Collection** | `users`, `products` |
| **Row / Record** | **Document** | user 1 คน |
| **Column** | **Field** | `username`, `email` |
| **Primary Key** | **_id** (auto) | `ObjectId('...')` |
| **Foreign Key** | **ObjectId reference** | `user_id: ObjectId('...')` |

### กฎข้อสำคัญ:

- ทุก document **มี `_id` อัตโนมัติ** ไม่ต้องสร้างเอง
- `_id` ปกติเป็น **ObjectId** (24 ตัวอักษร hex)
- Collection **ไม่บังคับ schema** ถ้าไม่ใส่ validator → ใส่อะไรก็ได้
- Field ไม่ต้องมีครบทุก document — บางตัวมีบางตัวไม่มีก็ได้

---

## A3. ObjectId คืออะไร ทำไมสำคัญ?

ObjectId คือ **เลขประจำตัวที่ MongoDB สร้างให้** — รับประกันไม่ซ้ำในทั้งโลก

หน้าตา: `ObjectId('65a1b2c3d4e5f6a7b8c9d0e1')`

### ทำไมไม่ซ้ำในจักรวาล?

ObjectId ประกอบด้วย:
- 4 bytes แรก = timestamp (วินาทีตั้งแต่ 1970)
- 5 bytes ถัดมา = random ของ machine (เครื่อง+process)
- 3 bytes สุดท้าย = counter ที่เพิ่มทุกครั้ง

> **ผลลัพธ์:** แม้จะมี 1 ล้านเครื่องสร้าง ObjectId พร้อมกัน — โอกาสซ้ำกันแทบจะ 0%

### ใน Schema เราใช้ ObjectId 2 แบบ:

**1. เป็น Primary Key (`_id`)** — ทุก document มี อัตโนมัติ

**2. เป็น Foreign Key (reference)** — เก็บ ObjectId ของ document อื่น

```javascript
// ใน artists collection
{
  _id: ObjectId('aaaa1111...'),         // ของตัวเอง
  user_id: ObjectId('user_xyz...'),     // ชี้ไป users
  genre_ids: [                          // array of ObjectId — ชี้ไป genres หลายตัว
    ObjectId('genre1...'),
    ObjectId('genre2...')
  ]
}
```

---

## A4. Embed vs Reference — การตัดสินใจที่สำคัญที่สุด

นี่คือเรื่องที่ **ต้องคิดทุกครั้งที่ออกแบบ collection**

### Embed = ฝังข้อมูลลงไปเลย

```javascript
// order document — items ฝังในก้อนเดียวกัน
{
  _id: ObjectId('...'),
  user_id: ObjectId('...'),
  items: [
    { product_id: ObjectId('...'), quantity: 2, price: 30 },
    { product_id: ObjectId('...'), quantity: 1, price: 250 }
  ]
}
```

**ข้อดี:**
- ✅ ดึงครั้งเดียวได้ครบ — เร็วที่สุด
- ✅ ไม่ต้อง JOIN
- ✅ Atomic update ได้ (อัพเดต order + items พร้อมกัน)

**ข้อเสีย:**
- ❌ Document ใหญ่ขึ้น (limit MongoDB คือ 16MB)
- ❌ ถ้าข้อมูลฝังเปลี่ยน ต้องอัพเดตทุกที่ที่ฝัง

### Reference = ชี้ไปด้วย ObjectId

```javascript
// artist document — ชี้ไป user collection
{
  _id: ObjectId('...'),
  user_id: ObjectId('user_xyz...'),    // ← reference
  name: 'Old World Vultures'
}

// users collection แยกอยู่
{
  _id: ObjectId('user_xyz...'),
  username: 'owv_band',
  email: 'owv@mail.com'
}
```

**ข้อดี:**
- ✅ Document เล็ก
- ✅ อัพเดตที่เดียว — ทุกคนเห็นเหมือนกัน
- ✅ ใช้ข้ามระบบได้

**ข้อเสีย:**
- ❌ ต้อง query 2 ครั้ง หรือใช้ `$lookup` (เทียบ JOIN)
- ❌ ช้ากว่า embed

### 🎯 กฎที่ใช้ตัดสินใจ

| สถานการณ์ | เลือก |
|----------|-------|
| ข้อมูลใช้คู่กันเสมอ | **Embed** |
| ข้อมูลฝังเล็ก (< 100 items) | **Embed** |
| ข้อมูลฝังเปลี่ยนน้อย | **Embed** |
| ข้อมูลใหญ่ มีหลายร้อย/พัน items | **Reference** |
| ข้อมูล master ที่หลายที่ใช้ | **Reference** |
| Many-to-Many | **Reference array** |

### ใน Schema ของเรา:

| ตัวอย่าง | เลือก | เหตุผล |
|---------|-------|--------|
| user ↔ artist | **Reference** | 1-to-1, แยกเพื่อความสะอาด |
| artist ↔ genres | **Reference array** | Many-to-Many, master data |
| product ↔ tracks/albums/merch | **Reference** | Layer แยกชัดเจน |
| album ↔ tracks | **Reference array** | Many-to-Many ตาม MOM |
| **merch ↔ variants** | **Embed** | ใช้คู่กันเสมอ ขนาดเล็ก |
| **order ↔ items** | **Embed** | snapshot data, ใช้คู่กัน |

---

## A5. Index ทำงานยังไง?

### 🎯 Metaphor: หนังสือพจนานุกรม

ลองนึกภาพหนังสือพจนานุกรม 3,000 หน้า:
- **ไม่มี index** = อ่านทีละหน้าจาก 1 ถึง 3000 หาคำที่ต้องการ
- **มี index** = เปิดสารบัญ → กระโดดไปหน้าที่ต้องการเลย

Database ก็เหมือนกัน ถ้ามีข้อมูล 1 ล้านแถว ไม่มี index → ต้องอ่านทุกแถว = **ช้ามาก**

### Index ทำให้เร็ว 1,000x

**ตัวอย่าง:** หา user ตาม email

```javascript
db.users.find({ email: "somchai@mail.com" })
```

- **ไม่มี index บน email** → อ่าน 1 ล้าน records → 5 วินาที
- **มี index บน email** → กระโดดตรงไป → 0.005 วินาที

### Index มี trade-off

**ข้อดี:**
- ✅ Query เร็วมาก
- ✅ Sort เร็ว

**ข้อเสีย:**
- ❌ Insert ช้าลงนิดหน่อย (เพราะต้องอัพเดต index ด้วย)
- ❌ ใช้พื้นที่เพิ่ม (ประมาณ 10-30% ของ data)

**กฎ:** สร้าง index เฉพาะ field ที่ใช้ใน WHERE/SORT บ่อย ไม่ใช่ทุก field

### Index แบบ Unique

```javascript
db.users.createIndex({ email: 1 }, { unique: true })
```

นอกจากเร็วแล้ว ยัง **บังคับห้ามซ้ำ** — ถ้ามีคนใส่ email ซ้ำ → MongoDB ปฏิเสธ

ใช้กับ field ที่ห้ามซ้ำในความเป็นจริง: email, username, slug

### Compound Index

```javascript
db.products.createIndex({ status: 1, created_at: -1 })
```

Index ที่รวมหลาย field — เร็วเฉพาะ query ที่ใช้ field เหล่านี้พร้อมกัน:

```javascript
db.products.find({ status: "published" }).sort({ created_at: -1 })
// ↑ ใช้ index ตัวนี้ได้เต็ม
```

> **กฎ ESR:** Equality, Sort, Range — เรียง field ใน compound index ตามลำดับนี้

---

# Part B: 8 Collections อธิบายทีละตัว

## B1. Collection: `users`

### 🎯 ทำไมต้องมี

เก็บข้อมูล **ทุกคนที่เข้าระบบ** ไม่ว่าจะเป็น:
- **ADMIN** — admin ของระบบ
- **USER** — ลูกค้าทั่วไปที่ซื้อของ
- **ARTIST** — ศิลปินที่ขายของ

### Schema เต็ม

```javascript
{
  _id: ObjectId('...'),                          // auto
  username: "owv_band",                          // ห้ามซ้ำ 3-30 ตัว
  email: "owv@mail.com",                         // ห้ามซ้ำ format email
  password_hash: "$2b$10$...",                   // bcrypt hash, ไม่ใช่ plain text
  user_type: "ARTIST",                           // ADMIN | USER | ARTIST
  display_name: "Old World Vultures",
  avatar_url: "https://...",
  status: "active",                              // active | inactive | banned | deleted
  created_at: ISODate('2026-05-04'),
  updated_at: ISODate('2026-05-04')
}
```

### Field ทุกตัวอธิบาย

| Field | Required | ทำไมต้องมี |
|-------|----------|-----------|
| `username` | ✅ | สำหรับ login + แสดงชื่อใน URL — unique |
| `email` | ✅ | ติดต่อ + login — unique |
| `password_hash` | ✅ | **ห้ามเก็บ plain text** ต้องผ่าน bcrypt ก่อนเสมอ |
| `user_type` | ✅ | enum 3 ค่าตาม MOM — กำหนดสิทธิ์ |
| `display_name` | ❌ | ชื่อที่แสดงให้คนอื่นเห็น (เปลี่ยนได้) |
| `avatar_url` | ❌ | URL รูปโปรไฟล์ |
| `status` | ❌ | สำหรับ ban / soft delete |
| `created_at` | ✅ | ตอนสมัคร |
| `updated_at` | ❌ | ตอนแก้โปรไฟล์ |

### 🔑 ทำไมเก็บ password_hash ไม่ใช่ password?

ถ้า database โดน hack → คนเห็น password ของลูกค้าทั้งหมด → เสียหายมาก

วิธีปกป้อง: ใช้ **bcrypt** แปลง password ให้เป็น hash:
- `"mypassword123"` → `"$2b$10$abcd..."`
- ตอน login → ใส่ password → bcrypt เปรียบเทียบ → ผ่าน/ไม่ผ่าน

**Hash ไม่สามารถแปลงกลับเป็น password ต้นทางได้** — แม้แต่เจ้าของ database ก็ไม่รู้

### Index ที่สำคัญ

```javascript
db.users.createIndex({ email: 1 }, { unique: true })      // login เร็ว + ห้ามสมัครซ้ำ
db.users.createIndex({ username: 1 }, { unique: true })   // หา profile เร็ว
```

### ทำไม email + username ต้องมี unique?

- **email** — ลูกค้าหลายคนใช้ email เดียวกัน → reset password งง
- **username** — แสดงใน URL `/artists/owv_band` ห้ามซ้ำ

### 🎯 Decisions ที่เลือก

**1. รวม ADMIN/USER/ARTIST ไว้ใน collection เดียว**

แทนที่จะแยกเป็น `admins`, `users`, `artists` collection
- ✅ Login flow เดียว
- ✅ field ส่วนใหญ่เหมือนกัน (email, password, etc.)
- ✅ เปลี่ยน user_type ได้ง่าย (เช่น user → artist)

**2. ข้อมูลศิลปินเฉพาะ (bio, banner) ไม่อยู่ใน users**

ไปอยู่ใน `artists` collection แยก
- เพราะ user ทั่วไปไม่ต้องมี
- 1 user → 0 หรือ 1 artist (1-to-1 optional)

### Query ที่ใช้บ่อย

```javascript
// ตอน login
db.users.findOne({ email: "owv@mail.com" })

// ดู admin ทั้งหมด
db.users.find({ user_type: "ADMIN" })

// หา user ที่ active เท่านั้น
db.users.find({ status: "active" })

// นับ user ตาม type
db.users.countDocuments({ user_type: "USER" })
```

---

## B2. Collection: `genres`

### 🎯 ทำไมต้องมี

ตาม MOM กำหนด:
> "ให้เก็บเป็น Master Data โดยตอนที่ศิลปินสมัครเข้าระบบจะต้องเลือก Genre ของตัวเองด้วย"

Genre = แนวเพลง เช่น Rock, Pop, Jazz, Hip Hop

### Schema

```javascript
{
  _id: ObjectId('...'),
  name: "Rock",                          // ชื่อแสดงให้ user
  slug: "rock",                          // ใช้ใน URL
  description: "Rock music genre",       // optional
  created_at: ISODate('...')
}
```

### 🔑 ทำไมต้องมี slug แยกจาก name?

| name (ของจริง) | slug (สำหรับ URL) |
|---------------|-------------------|
| "Hip Hop" | "hip-hop" |
| "R&B" | "rnb" |
| "K-Pop" | "k-pop" |

URL ห้ามมีช่องว่างหรืออักษรพิเศษ — slug แก้ปัญหานี้:

```
/genre/hip-hop    ← ใช้ slug
/genre/Hip%20Hop  ← น่าเกลียด
```

### Index

```javascript
db.genres.createIndex({ slug: 1 }, { unique: true })
db.genres.createIndex({ name: 1 }, { unique: true })
```

### Master Data — admin จัดการ

ตอนเริ่ม seed 10 genres:
```javascript
db.genres.insertMany([
  { name: "Rock", slug: "rock", created_at: new Date() },
  { name: "Pop", slug: "pop", created_at: new Date() },
  // ...
])
```

Admin สามารถ CRUD genres ได้:
- เพิ่ม genre ใหม่ (เช่น "Mor Lam" — หมอลำ)
- แก้ไขชื่อ
- ลบ (soft delete แนะนำ ป้องกัน reference จาก artists หาย)

### Query ที่ใช้บ่อย

```javascript
// ดู genres ทั้งหมด เรียง alphabet
db.genres.find().sort({ name: 1 })

// หา genre จาก slug (URL routing)
db.genres.findOne({ slug: "rock" })

// admin หา genre ที่มี artist เยอะที่สุด (advanced)
db.artists.aggregate([
  { $unwind: "$genre_ids" },
  { $group: { _id: "$genre_ids", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

---

## B3. Collection: `artists`

### 🎯 ทำไมต้องมี

แยกข้อมูลศิลปินออกจาก users เพราะ:
1. ไม่ใช่ user ทุกคนเป็นศิลปิน
2. ข้อมูลศิลปินเยอะกว่า user ปกติมาก
3. URL routing ต่างกัน (`/artists/owv-band`)

### Schema เต็ม (รวม Marketplace fields)

```javascript
{
  _id: ObjectId('...'),
  user_id: ObjectId('user_xyz...'),          // 1-to-1 กับ users
  slug: "old-world-vultures",                // URL-friendly, unique
  name: "Old World Vultures",
  bio: "วงดนตรี indie rock...",
  location: "Bangkok, Thailand",
  banner_url: "https://...",
  genre_ids: [                                // Many-to-Many → genres
    ObjectId('rock_id'),
    ObjectId('indie_id')
  ],
  status: "active",                          // active | inactive | deleted | banned
  
  // 🆕 Marketplace fields (เพิ่มใน phase 2)
  shipping_address: {                        // ที่อยู่ที่ artist ใช้ส่งของ
    line1: "123 ซ.ลาดพร้าว 71",
    line2: "แขวงลาดพร้าว",
    city: "กรุงเทพ",
    postal_code: "10230",
    country: "TH"
  },
  payout_method: {                           // วิธีรับเงิน
    type: "promptpay",                       // bank_transfer | paypal | promptpay
    account_info: {
      phone_number: "0812345678",
      account_name: "Old World Vultures"
    }
  },
  payout_balance: 1071,                      // เงินรอถอน (บาท)
  
  created_at: ISODate('...'),
  updated_at: ISODate('...')
}
```

### 🔑 Field marketplace อธิบาย

**shipping_address** — ที่อยู่ที่ใช้ส่งของออกจาก
- ทำไมต้องมี? ระบบต้องรู้ที่อยู่ต้นทางเพื่อ:
  - คำนวณค่าส่ง (จาก กทม ไปต่างจังหวัด ราคาต่าง)
  - ออก label จัดส่ง
  - ลูกค้าเห็นว่าของส่งจากไหน

**payout_method** — วิธีรับเงิน
- รองรับ 3 แบบ: bank_transfer, paypal, promptpay
- `account_info` เป็น object ยืดหยุ่น เพราะแต่ละ type ต้องการข้อมูลต่างกัน:
  - bank → bank_name, account_number, account_name
  - paypal → email
  - promptpay → phone_number

**payout_balance** — ยอดเงินรอถอน
- ทุกครั้งที่ลูกค้าซื้อ → balance เพิ่ม (หลังหัก platform fee)
- Artist กดถอนเงิน → balance ลดเป็น 0
- เก็บเป็น **int** (บาท) ไม่ใช่ decimal — ป้องกัน floating-point bug

### Index ที่สำคัญ

```javascript
db.artists.createIndex({ slug: 1 }, { unique: true })       // URL routing
db.artists.createIndex({ user_id: 1 }, { unique: true })    // 1 user = 1 artist
db.artists.createIndex({ genre_ids: 1 })                    // filter ตาม genre
db.artists.createIndex({ status: 1 })                       // กรอง active เท่านั้น
```

### 🎯 Decisions ที่เลือก

**1. ทำไม user_id เป็น unique index?**

เพื่อบังคับว่า **1 user account = 1 artist profile** เท่านั้น

ถ้าจะให้ user 1 คนมีหลายวง → ลบ unique ออก แต่ schema ปัจจุบันคิดเป็น 1-to-1

**2. ทำไม genre_ids ใช้ array of ObjectId แทน junction table?**

ใน SQL ต้องสร้าง `artist_genres` table แยก:
```
| artist_id | genre_id |
|-----------|----------|
| 1         | 5        |
| 1         | 8        |
```

ใน MongoDB ฝัง array ใน artist เลย:
```javascript
{
  _id: ObjectId('artist_id'),
  genre_ids: [ObjectId('5'), ObjectId('8')]
}
```

**ข้อดี:**
- ดึงครั้งเดียวได้ครบ
- ไม่ต้อง JOIN
- เก็บง่ายกว่า

**ข้อเสีย:**
- ถ้า artist มี genre เยอะ (>1000) — เริ่มไม่เหมาะ → แยกเป็น collection ดีกว่า
- แต่ในความจริง artist 1 คนมี genre 1-3 อันสุด → ใช้ embed ดีกว่า

### Query ที่ใช้บ่อย

```javascript
// ดู artist จาก URL slug
db.artists.findOne({ slug: "old-world-vultures" })

// หา artist ที่เล่น Rock
const rock = db.genres.findOne({ slug: "rock" })
db.artists.find({ genre_ids: rock._id })

// ดู artist ทั้งหมดที่ active
db.artists.find({ status: "active" }).sort({ name: 1 })

// ดู artist พร้อมข้อมูล user (JOIN-like)
db.artists.aggregate([
  { $match: { slug: "old-world-vultures" } },
  { $lookup: {
      from: "users",
      localField: "user_id",
      foreignField: "_id",
      as: "user_info"
  }}
])
```

---

(continue ในไฟล์ Part 2...)
