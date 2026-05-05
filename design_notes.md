# Design Notes — สำหรับทีม Review

เอกสารนี้รวบรวม **ข้อสังเกต** และ **คำถามที่ขอให้ทีมตัดสินใจ** ระหว่างทำ schema

---

## 1. Marketplace Logic ที่เพิ่มเข้ามา

### ปัญหาที่พบ

หลังประชุม MOM 29/4/2026 ระหว่าง implement schema พบว่า business model ของระบบเป็น **marketplace** (ศิลปินขายของให้ลูกค้าโดยตรง — ศิลปินจัดส่งเอง อัพเดต status เอง รวมถึง stock เอง) ซึ่ง schema ตามที่ตกลงใน MOM ยังไม่รองรับ logic นี้

### Fields ที่เพิ่ม (ขอให้ทีมยืนยัน)

**ใน `orders.items[]`:**
- `artist_id` — ระบุว่า item เป็นของศิลปินคนไหน
- `fulfillment_status` — status ของแต่ละ item (แยกจาก order status)
- `tracking_number` — เลขพัสดุ (สำหรับ merch)
- `shipped_at`, `delivered_at` — timestamps ของการส่ง

**ใน `orders`:**
- `platform_fee` — ค่าธรรมเนียมที่ platform หัก
- เพิ่ม `partially_shipped`, `fully_shipped` ใน status enum

**ใน `artists`:**
- `shipping_address` — ที่อยู่ที่ศิลปินส่งของจาก
- `payout_method` — วิธีรับเงิน
- `payout_balance` — เงินรอถอน

### คำถามให้ทีม

1. **Platform fee เก็บกี่ %?** — ตอนนี้ใส่ 15% ใน sample data ต้องการให้เปลี่ยนไหม
2. **Payout method ครอบคลุมพอไหม?** — ตอนนี้รองรับ bank_transfer, paypal, promptpay — มีอย่างอื่นที่อยากรองรับไหม
3. **ต้องการ `payouts` collection แยกไหม?** — เพื่อเก็บประวัติการจ่ายเงิน

---

## 2. Soft Delete

### เหตุผล

หากศิลปินลบเพลงออกจาก album หลังจากมีคนซื้อไปแล้ว — ลูกค้ายังต้องเข้าถึงเพลงนั้นได้ (digital ownership) จึงไม่ควรลบจริง

### วิธีที่ใช้

- `products.status` มีค่า `"deleted"` + `deleted_at` field
- `tracks.is_active: bool`
- `users.status` และ `artists.status` มี `"deleted"` ใน enum

### คำถาม

1. **ระบบจะ purge soft-deleted data หลังกี่วัน?** (กฎหมาย GDPR ไทยอาจเกี่ยวข้อง)
2. **ลูกค้าที่ซื้อเพลงไป — ต้องเข้าถึงได้ตลอดไป หรือ expire หลังกี่ปี?**

---

## 3. Stock Management

### Atomic Update

ใช้ pattern atomic update เพื่อป้องกัน **race condition**:

```javascript
db.merch.updateOne(
  {
    product_id: shirtId,
    variants: {
      $elemMatch: {
        sku: "EC-SHIRT-M-BLK",
        stock_quantity: { $gte: 1 }   // เช็ค stock ในเงื่อนไขเดียวกับ update
      }
    }
  },
  { $inc: { "variants.$.stock_quantity": -1 } }
)
```

### คำถาม

1. **ต้องการ stock reservation ไหม?** (จองของ 15 นาทีตอนใส่ตะกร้า)
2. **ถ้า stock = 0 ตอนลูกค้าจ่ายเงิน — แสดงข้อความยังไง?** (รบกวน UX team กำหนด)
3. **ใช้ MongoDB Transaction ไหม?** สำหรับ multi-step operation (ลด stock + สร้าง order + ตัดเงิน)

---

## 4. Variants ของ Merch

### Embed vs Separate Collection

ออกแบบให้ใช้ **embedded array** ใน merch document แทนการแยก collection

**เหตุผล:** variants ใช้คู่กับ merch เสมอ ไม่มีคนถามถึง variant แยกๆ + ขนาดเล็ก

### คำถาม

1. **enum ของ `merch_type` พอไหม?** — ตอนนี้ `tshirt | vinyl | cd | cassette | poster | other`
2. **ต้องการแยก hoodie จาก tshirt ไหม?** — ตอนนี้รวมไว้ใน tshirt
3. **variants มี attribute อื่นไหม?** — ตอนนี้มีแค่ size, color, stock_quantity, sku

---

## 5. Order Immutability

### Snapshot ใน items

เก็บ `title_snapshot` และ `unit_price` ใน `orders.items[]` เพื่อป้องกันข้อมูลเปลี่ยน:

- ถ้าศิลปินเปลี่ยนชื่อ product / ขึ้นราคาในอนาคต — order เก่าต้องแสดงข้อมูล ณ เวลาซื้อ

### คำถาม

1. **ต้องการ snapshot อะไรเพิ่ม?** เช่น cover_url, artist_name

---

## 6. Refund Logic (ยังไม่ได้ทำ)

### Scenario ที่พบ

ลูกค้าอาจ **refund บาง item** (เช่น คืนเสื้อ แต่เก็บเพลง) — schema ปัจจุบันยังไม่รองรับชัดเจน

### ตัวเลือก

**A) เพิ่ม `refund_status` ในแต่ละ item**
**B) สร้าง `refunds` collection แยก**

ผมแนะนำ B เพราะ:
- เก็บประวัติได้ดีกว่า (1 order อาจ refund หลายรอบ)
- คำนวณยอดที่ refund ทั้งหมดง่ายกว่า

---

## 7. Many-to-Many ของ Album-Track — รายละเอียด

### โครงสร้าง

```javascript
// album document
{
  product_id: ObjectId,
  track_ids: [ObjectId, ObjectId, ObjectId, ...]
}
```

ลำดับใน array = ลำดับใน album (track_ids[0] = เพลงที่ 1)

### คำถาม

1. **ต้องการเก็บ track_number เป็น field แยกไหม?** — ตอนนี้ใช้ index ของ array เป็น order
2. **ต้องการ `disc_number` ไหม?** สำหรับ album หลายแผ่น

---

## 8. ส่วนที่ยังไม่ได้ทำ (Future Work)

ขอเสนอให้ทีมพิจารณาในรอบ meeting ถัดไป:

- `payouts` — ประวัติการจ่ายเงินศิลปิน
- `refunds` — ประวัติการคืนเงิน
- `follows` — user ติดตาม artist
- `wishlist` — รายการของที่อยาก
- `comments` / `reviews` — รีวิวบน album
- `downloads` — token ดาวน์โหลด + tracking
- `play_history` — ประวัติการฟัง (อาจใช้ time-series collection)
- `notifications` — แจ้งเตือนต่างๆ

---

## 9. คำถามรวมสำหรับ Meeting รอบหน้า

1. ✅ Marketplace logic ที่เพิ่มเข้ามา — ทีม approve ไหม
2. ✅ Platform fee % — ตั้งเท่าไหร่
3. ✅ Payout method — เพิ่ม/ลดอะไรไหม
4. ✅ ต้องการ payouts collection แยกไหม
5. ✅ Soft delete — ระบบ purge data หลังกี่วัน
6. ✅ Stock reservation — ทำไหม
7. ✅ MongoDB Transaction — ใช้ตอนไหน
8. ✅ Refund logic — ใช้ option A หรือ B
9. ✅ ลำดับการทำ Future Work

---

## Note ส่วนตัว (ผู้ทำ)

- ใช้ MongoDB Atlas (M0 free tier) — ขนาดพอสำหรับ dev/staging
- ทดสอบ schema ด้วย scenario จริง: มาลีซื้อ 3 รายการ (single + album + merch)
- ทุก validator ผ่าน test (ลองใส่ข้อมูลผิดแล้วถูก reject)
- รอ feedback จากทีมเพื่อปรับ schema ในรอบถัดไป
