# 📒 MongoDB Cheat Sheet — สำหรับ Audtlist

> สรุป syntax ที่ใช้บ่อย เปิดดูเวลาเขียน query  
> ใช้กับ mongosh / MongoDB Compass / driver ภาษา JS

---

## 🎯 Mental Model

```javascript
db.<collection_name>.<method>(<arguments>)
```

| ส่วน | ตัวอย่าง |
|------|---------|
| `db` | database ปัจจุบัน |
| `<collection_name>` | users, products, orders |
| `<method>` | insertOne, find, updateOne, ... |

---

## 📥 INSERT — เพิ่มข้อมูล

```javascript
// เพิ่ม 1 document
db.users.insertOne({
  username: "somchai",
  email: "somchai@mail.com"
})

// เพิ่มหลาย documents
db.genres.insertMany([
  { name: "Rock", slug: "rock" },
  { name: "Pop", slug: "pop" }
])
```

**ผลลัพธ์:** `{ acknowledged: true, insertedId: ObjectId('...') }`

> หมายเหตุ: ไม่ต้องใส่ `_id` เอง MongoDB สร้างให้

---

## 🔍 FIND — หาข้อมูล

```javascript
// หาทั้งหมด
db.users.find()

// หาตัวแรก
db.users.findOne()

// หาด้วยเงื่อนไข
db.users.find({ user_type: "ARTIST" })
db.users.findOne({ email: "somchai@mail.com" })

// เลือกเฉพาะบาง field (projection)
db.users.find({}, { username: 1, email: 1 })           // แสดง
db.users.find({}, { password_hash: 0 })                // ซ่อน
db.users.find({}, { username: 1, email: 1, _id: 0 })   // ไม่เอา _id

// นับจำนวน
db.users.countDocuments()
db.users.countDocuments({ user_type: "USER" })

// ค่าที่ unique
db.products.distinct("type")
// → ["single", "album", "merch"]
```

---

## 🎯 Comparison Operators

| Operator | ความหมาย | ตัวอย่าง |
|----------|---------|---------|
| (default) | เท่ากับ | `{ price: 100 }` |
| `$eq` | เท่ากับ (explicit) | `{ price: { $eq: 100 } }` |
| `$ne` | ไม่เท่ากับ | `{ status: { $ne: "deleted" } }` |
| `$gt` | มากกว่า | `{ price: { $gt: 100 } }` |
| `$gte` | มากกว่าหรือเท่ากับ | `{ price: { $gte: 100 } }` |
| `$lt` | น้อยกว่า | `{ stock: { $lt: 5 } }` |
| `$lte` | น้อยกว่าหรือเท่ากับ | `{ stock: { $lte: 0 } }` |
| `$in` | อยู่ในรายการ | `{ status: { $in: ["paid", "shipped"] } }` |
| `$nin` | ไม่อยู่ในรายการ | `{ status: { $nin: ["cancelled"] } }` |

### ตัวอย่างจริง:

```javascript
// products ราคา 100-500
db.products.find({ price: { $gte: 100, $lte: 500 } })

// orders ที่ paid หรือ shipped
db.orders.find({ status: { $in: ["paid", "shipped"] } })

// products ที่ไม่ถูกลบ
db.products.find({ status: { $ne: "deleted" } })
```

---

## 🔗 Logical Operators

```javascript
// AND (ใส่หลาย field ใน object เดียว — implicit AND)
db.products.find({ 
  type: "album", 
  status: "published",
  price: { $lt: 500 }
})

// OR
db.products.find({
  $or: [
    { type: "single" },
    { type: "merch" }
  ]
})

// AND + OR ผสม
db.products.find({
  status: "published",
  $or: [
    { type: "album" },
    { price: { $lt: 50 } }
  ]
})

// NOT
db.users.find({ user_type: { $not: { $eq: "ADMIN" } } })

// $exists - field มีอยู่/ไม่มี
db.users.find({ avatar_url: { $exists: true } })
db.users.find({ avatar_url: { $exists: false } })
```

---

## 🎨 Sort, Limit, Skip

```javascript
// Sort (1 = ascending, -1 = descending)
db.products.find().sort({ price: 1 })          // ราคาน้อย → มาก
db.products.find().sort({ created_at: -1 })   // ใหม่สุด → เก่าสุด

// Multi-field sort
db.products.find().sort({ type: 1, price: -1 })

// Limit
db.products.find().limit(10)

// Skip + Limit (Pagination)
db.products.find()
  .sort({ created_at: -1 })
  .skip(20)        // หน้าที่ 3 (ถ้าหน้าละ 10)
  .limit(10)
```

---

## ✏️ UPDATE — แก้ไขข้อมูล

```javascript
// แก้ 1 document
db.users.updateOne(
  { email: "somchai@mail.com" },        // เงื่อนไข
  { $set: { display_name: "Somchai New" } }
)

// แก้หลาย documents
db.users.updateMany(
  { user_type: "USER" },
  { $set: { updated_at: new Date() } }
)

// Upsert — ถ้าไม่มี ให้สร้างใหม่
db.users.updateOne(
  { email: "new@mail.com" },
  { $set: { username: "newuser", user_type: "USER" } },
  { upsert: true }
)
```

⚠️ **ห้ามลืม `$set`** ไม่งั้น document จะถูกแทนที่ทั้งก้อน!

---

## 🛠️ Update Operators

| Operator | ทำอะไร | ตัวอย่าง |
|----------|--------|---------|
| `$set` | ตั้งค่า | `{ $set: { name: "New" } }` |
| `$unset` | ลบ field | `{ $unset: { bio: "" } }` |
| `$inc` | เพิ่ม/ลดตัวเลข | `{ $inc: { stock: -1 } }` |
| `$mul` | คูณ | `{ $mul: { price: 1.1 } }` |
| `$rename` | เปลี่ยนชื่อ field | `{ $rename: { "name": "title" } }` |
| `$push` | เพิ่มเข้า array | `{ $push: { genre_ids: ObjectId } }` |
| `$pull` | ลบจาก array | `{ $pull: { genre_ids: ObjectId } }` |
| `$addToSet` | เพิ่มเข้า array (ห้ามซ้ำ) | `{ $addToSet: { genre_ids: ObjectId } }` |

### ตัวอย่างจริง:

```javascript
// ลด stock 1 ตัว
db.merch.updateOne(
  { product_id: shirtId },
  { $inc: { "variants.$[v].stock_quantity": -1 } },
  { arrayFilters: [{ "v.sku": "EC-SHIRT-M-BLK" }] }
)

// เพิ่ม payout balance
db.artists.updateOne(
  { _id: artistId },
  { $inc: { payout_balance: 1071 } }
)

// เพิ่ม genre ให้ artist
db.artists.updateOne(
  { _id: artistId },
  { $addToSet: { genre_ids: ObjectId('...') } }
)

// ลบ genre
db.artists.updateOne(
  { _id: artistId },
  { $pull: { genre_ids: ObjectId('...') } }
)
```

---

## 🎯 Array Operators (Query)

```javascript
// $elemMatch — ตัวใน array ตรงเงื่อนไข
db.merch.find({
  variants: {
    $elemMatch: {
      size: "M",
      stock_quantity: { $gte: 1 }
    }
  }
})

// $size — ขนาด array
db.albums.find({ track_ids: { $size: 1 } })   // album ที่มี track เดียว = single

// $all — array มีค่าเหล่านี้ครบทุกตัว
db.artists.find({
  genre_ids: { $all: [rockId, indieId] }
})
```

---

## 🎯 Position Operators (Update)

```javascript
// $ — อัพเดต element แรกที่ตรงเงื่อนไข
db.orders.updateOne(
  { 
    _id: orderId,
    "items.product_id": shirtId       // เงื่อนไข
  },
  {
    $set: {
      "items.$.fulfillment_status": "shipped"   // อัพเดต item ที่ตรง
    }
  }
)

// $[] — อัพเดตทุก element ใน array
db.orders.updateOne(
  { _id: orderId },
  { $set: { "items.$[].fulfillment_status": "delivered" } }
)

// $[<identifier>] — อัพเดต element ที่ตรง arrayFilters
db.merch.updateOne(
  { product_id: shirtId },
  { $inc: { "variants.$[v].stock_quantity": -1 } },
  { arrayFilters: [{ "v.sku": "EC-SHIRT-M-BLK" }] }
)
```

---

## 🗑️ DELETE — ลบ

```javascript
// ลบ 1 document
db.users.deleteOne({ email: "test@mail.com" })

// ลบหลาย documents
db.users.deleteMany({ user_type: "USER" })

// ลบทั้งหมด (ระวัง!)
db.users.deleteMany({})    // ลบทุกคน!
```

⚠️ **ลบไม่ได้คืน — ใช้ Soft Delete แทน**

---

## 🏛️ Index — ทำให้ Query เร็ว

```javascript
// สร้าง index
db.users.createIndex({ email: 1 })                      // ascending
db.products.createIndex({ created_at: -1 })             // descending

// Unique index
db.users.createIndex({ email: 1 }, { unique: true })

// Compound index (หลาย field)
db.products.createIndex({ status: 1, created_at: -1 })

// Index บน embedded field
db.merch.createIndex({ "variants.sku": 1 })

// ดู indexes ทั้งหมด
db.users.getIndexes()

// ลบ index
db.users.dropIndex("email_1")
```

---

## 🔬 Aggregate Pipeline — Query ขั้นสูง

ทำงานเป็น pipeline หลาย stage:

```javascript
db.collection.aggregate([
  { $match: {...} },        // filter (เหมือน WHERE)
  { $group: {...} },        // group (เหมือน GROUP BY)
  { $sort: {...} },         // sort
  { $project: {...} },      // เลือก field
  { $lookup: {...} }        // JOIN
])
```

### Stages ที่ใช้บ่อย:

```javascript
// $match — filter
{ $match: { status: "published" } }

// $project — เลือก/แปลง field
{ $project: {
    title: 1,
    price: 1,
    discount_price: { $multiply: ["$price", 0.9] }
}}

// $sort — เรียง
{ $sort: { created_at: -1 } }

// $limit + $skip
{ $limit: 10 }
{ $skip: 20 }

// $group — group + aggregate
{ $group: {
    _id: "$type",                          // group ตาม type
    count: { $sum: 1 },                    // นับ
    total_revenue: { $sum: "$price" },     // รวม
    avg_price: { $avg: "$price" }          // เฉลี่ย
}}

// $unwind — แตก array เป็นหลาย document
{ $unwind: "$items" }

// $lookup — JOIN
{ $lookup: {
    from: "tracks",                  // collection อีกตัว
    localField: "track_ids",         // field ของเรา
    foreignField: "_id",             // field ของอีก collection
    as: "tracks_detail"              // ผลที่ได้ใส่ field นี้
}}
```

### ตัวอย่างจริง:

```javascript
// Top 10 selling products
db.orders.aggregate([
  { $match: { status: { $in: ["paid", "completed"] } } },
  { $unwind: "$items" },
  { $group: {
      _id: "$items.product_id",
      total_sold: { $sum: "$items.quantity" },
      revenue: { $sum: { $multiply: ["$items.unit_price", "$items.quantity"] } }
  }},
  { $sort: { total_sold: -1 } },
  { $limit: 10 }
])

// Album พร้อม tracks ครบ
db.albums.aggregate([
  { $match: { product_id: productId } },
  { $lookup: {
      from: "tracks",
      localField: "track_ids",
      foreignField: "_id",
      as: "tracks"
  }}
])

// Artist Dashboard
db.orders.aggregate([
  { $match: { "items.artist_id": myArtistId } },
  { $unwind: "$items" },
  { $match: {
      "items.artist_id": myArtistId,
      "items.fulfillment_status": "pending"
  }}
])
```

---

## 🏗️ Schema Validator (สร้าง/แก้)

```javascript
// สร้าง collection พร้อม validator
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "email"],
      properties: {
        username: { 
          bsonType: "string",
          minLength: 3,
          maxLength: 30
        },
        email: { 
          bsonType: "string",
          pattern: "^.+@.+\\..+$"
        },
        user_type: { 
          enum: ["ADMIN", "USER", "ARTIST"]
        }
      }
    }
  }
})

// แก้ validator ของ collection ที่มีอยู่
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: { ... }
  }
})

// ดู validator ปัจจุบัน
db.getCollectionInfos({ name: "users" })
```

### bsonType ที่ใช้บ่อย:

| Type | คำอธิบาย |
|------|---------|
| `"string"` | ข้อความ |
| `"int"` | จำนวนเต็ม |
| `"double"` | จุดทศนิยม (ระวัง precision) |
| `"bool"` | true/false |
| `"date"` | วันที่ |
| `"objectId"` | ObjectId |
| `"array"` | array |
| `"object"` | nested object |
| `["string", "null"]` | string หรือ null |

### Validator Constraints:

```javascript
// String
{ bsonType: "string", minLength: 3, maxLength: 30, pattern: "^[a-z]+$" }

// Number
{ bsonType: "int", minimum: 0, maximum: 100 }

// Enum
{ enum: ["ADMIN", "USER", "ARTIST"] }

// Array
{ 
  bsonType: "array", 
  items: { bsonType: "objectId" },
  minItems: 1,
  maxItems: 10
}

// Nested object
{
  bsonType: "object",
  required: ["line1", "city"],
  properties: {
    line1: { bsonType: "string" },
    city: { bsonType: "string" }
  }
}
```

---

## 🎯 Patterns ที่ใช้บ่อยใน Audtlist

### 1. หน้า Shop — Pagination

```javascript
const PAGE_SIZE = 20
const page = 2

db.products.find({ status: "published" })
  .sort({ created_at: -1 })
  .skip((page - 1) * PAGE_SIZE)
  .limit(PAGE_SIZE)
```

### 2. ตรวจ Stock + ลด Atomic

```javascript
db.merch.updateOne(
  {
    product_id: merchId,
    variants: {
      $elemMatch: {
        sku: targetSku,
        stock_quantity: { $gte: quantityRequested }
      }
    }
  },
  { $inc: { "variants.$.stock_quantity": -quantityRequested } }
)

// Check result.modifiedCount
```

### 3. Artist Dashboard — Orders ของฉัน

```javascript
db.orders.aggregate([
  { $match: { "items.artist_id": myArtistId } },
  { $unwind: "$items" },
  { $match: {
      "items.artist_id": myArtistId,
      "items.fulfillment_status": "pending"
  }},
  { $sort: { created_at: -1 } }
])
```

### 4. Update Tracking Number

```javascript
db.orders.updateOne(
  {
    _id: orderId,
    "items.product_id": myMerchId
  },
  {
    $set: {
      "items.$.fulfillment_status": "shipped",
      "items.$.tracking_number": trackingNumber,
      "items.$.shipped_at": new Date(),
      status: "partially_shipped",
      updated_at: new Date()
    }
  }
)
```

### 5. นับ Tracks ใน Album

```javascript
db.albums.aggregate([
  { $project: {
      product_id: 1,
      track_count: { $size: "$track_ids" },
      is_single: { $eq: [{ $size: "$track_ids" }, 1] }
  }}
])
```

---

## 🛠️ Useful Commands

```javascript
// ดู collections ทั้งหมด
show collections

// ดู databases
show dbs

// สลับ database
use audtlist_clone

// ดู document ตัวอย่าง
db.users.findOne()

// นับจำนวนทุก collection
print("users:", db.users.countDocuments())
print("products:", db.products.countDocuments())

// ลบ collection (ระวัง!)
db.users.drop()

// Export to JSON (จาก mongosh)
db.users.find().forEach(doc => printjson(doc))
```

---

## 🚀 Performance Tips

1. **ใช้ Index** กับ field ที่ใช้ใน `find` และ `sort` บ่อย
2. **Compound index** ตามลำดับ ESR (Equality, Sort, Range)
3. **ใช้ `findOne`** ถ้ารู้ว่าได้ตัวเดียว — เร็วกว่า `find().limit(1)`
4. **`projection`** เลือกเฉพาะ field ที่ใช้ — ลด bandwidth
5. **`$lookup` หนัก** — ใช้เมื่อจำเป็น
6. **`limit + skip` ช้าเมื่อ skip เยอะ** — ใช้ cursor pagination แทน (sort by _id)
7. **Atomic operations** ดีกว่า read-then-write
8. **Bulk operations** (`insertMany`, `bulkWrite`) เร็วกว่าทำทีละครั้ง

---

## 📚 อ้างอิง

- MongoDB Docs: https://www.mongodb.com/docs/
- Aggregation Reference: https://www.mongodb.com/docs/manual/reference/operator/aggregation/
- Schema Validation: https://www.mongodb.com/docs/manual/core/schema-validation/
- Index Strategies: https://www.mongodb.com/docs/manual/applications/indexes/

---

> เก็บไฟล์นี้ไว้ใกล้มือ เปิดดูเวลาเขียน query 💪
