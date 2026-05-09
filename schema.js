// =============================================================================
// AUDTLIST - DATABASE SCHEMA
// =============================================================================
// Description: MongoDB schema สำหรับเว็บขายเพลง album และ merch (Bandcamp clone)
// Database: bandcamp_clone (หรือ audtlist_clone)
// Created: 2026-05-04
//
// วิธีใช้:
// 1. เปิด MongoDB Compass หรือ mongosh
// 2. เชื่อมต่อ MongoDB Atlas
// 3. รัน: use audtlist_clone
// 4. Copy ไฟล์นี้ทั้งหมด → วางใน mongosh → Enter
// 5. รัน sample_data.js เพื่อใส่ข้อมูลตัวอย่าง (optional)
// =============================================================================

// -----------------------------------------------------------------------------
// 1. USERS — ผู้ใช้ทั้งหมด (ADMIN, USER, ARTIST)
// -----------------------------------------------------------------------------
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "username",
        "email",
        "password_hash",
        "user_type",
        "created_at",
      ],
      properties: {
        username: { bsonType: "string", minLength: 3, maxLength: 30 },
        email: { bsonType: "string", pattern: "^.+@.+\\..+$" },
        password_hash: { bsonType: "string" },
        user_type: { enum: ["ADMIN", "USER", "ARTIST"] },
        display_name: { bsonType: "string" },
        avatar_url: { bsonType: "string" },
        status: { enum: ["active", "inactive", "banned", "deleted"] },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },
});
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
print("✅ users collection created");

// -----------------------------------------------------------------------------
// 2. GENRES — Master Data (admin จัดการได้)
// -----------------------------------------------------------------------------
db.createCollection("genres", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "slug"],
      properties: {
        name: { bsonType: "string", minLength: 1, maxLength: 50 },
        slug: { bsonType: "string", pattern: "^[a-z0-9-]+$" },
        description: { bsonType: "string" },
        created_at: { bsonType: "date" },
      },
    },
  },
});
db.genres.createIndex({ slug: 1 }, { unique: true });
db.genres.createIndex({ name: 1 }, { unique: true });
print("✅ genres collection created");

// -----------------------------------------------------------------------------
// 3. ARTISTS — โปรไฟล์ศิลปิน (รองรับ marketplace)
// -----------------------------------------------------------------------------
db.createCollection("artists", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user_id", "slug", "name", "created_at"],
      properties: {
        user_id: { bsonType: "objectId" },
        slug: { bsonType: "string", pattern: "^[a-z0-9-]+$" },
        name: { bsonType: "string", minLength: 1, maxLength: 100 },
        bio: { bsonType: "string" },
        location: { bsonType: "string" },
        banner_url: { bsonType: "string" },
        genre_ids: {
          bsonType: "array",
          items: { bsonType: "objectId" },
        },
        // Marketplace fields
        shipping_address: {
          bsonType: "object",
          properties: {
            line1: { bsonType: "string" },
            line2: { bsonType: "string" },
            city: { bsonType: "string" },
            postal_code: { bsonType: "string" },
            country: { bsonType: "string" },
          },
        },
        payout_method: {
          bsonType: "object",
          properties: {
            type: { enum: ["bank_transfer", "paypal", "promptpay"] },
            account_info: { bsonType: "object" },
          },
        },
        payout_balance: { bsonType: "int", minimum: 0 },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },
});
db.artists.createIndex({ slug: 1 }, { unique: true });
db.artists.createIndex({ user_id: 1 }, { unique: true });
db.artists.createIndex({ genre_ids: 1 });
print("✅ artists collection created");

// -----------------------------------------------------------------------------
// 4. PRODUCTS — Sellable Product Layer (หัวใจของระบบ)
// แก้ปัญหา pagination ข้าม type ตามที่ทีมตกลงใน MOM
// -----------------------------------------------------------------------------
db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["artist_id", "type", "title", "price", "status", "created_at"],
      properties: {
        artist_id: { bsonType: "objectId" },
        type: { enum: ["single", "album", "merch"] },
        title: { bsonType: "string", minLength: 1, maxLength: 200 },
        slug: { bsonType: "string", pattern: "^[a-z0-9-]+$" },
        description: { bsonType: "string" },
        price: { bsonType: "int", minimum: 0 },
        min_price: { bsonType: "int", minimum: 0 },
        name_your_price: { bsonType: "bool" },
        cover_url: { bsonType: "string" },
        release_date: { bsonType: "date" },
        status: {
          enum: ["draft", "published", "private", "unavailable", "deleted"],
        },
        deleted_at: { bsonType: ["date", "null"] },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },
});
db.products.createIndex({ artist_id: 1 });
db.products.createIndex({ type: 1, status: 1 });
db.products.createIndex({ status: 1, created_at: -1 });
db.products.createIndex({ slug: 1 }, { unique: true });
print("✅ products collection created");

// -----------------------------------------------------------------------------
// 5. TRACKS — รายละเอียดเพลง
// -----------------------------------------------------------------------------
db.createCollection("tracks", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["product_id", "audio_file_url", "created_at"],
      properties: {
        product_id: { bsonType: "objectId" },
        duration_sec: { bsonType: "int", minimum: 0 },
        audio_file_url: { bsonType: "string" },
        preview_url: { bsonType: "string" },
        is_streamable: { bsonType: "bool" },
        created_at: { bsonType: "date" },
      },
    },
  },
});
db.tracks.createIndex({ product_id: 1 }, { unique: true });
print("✅ tracks collection created");

// -----------------------------------------------------------------------------
// 6. ALBUMS — รายละเอียดอัลบั้ม (Many-to-Many กับ tracks ตาม MOM)
// -----------------------------------------------------------------------------
db.createCollection("albums", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["product_id", "track_ids", "created_at"],
      properties: {
        product_id: { bsonType: "objectId" },
        track_ids: {
          bsonType: "array",
          items: { bsonType: "objectId" },
          minItems: 1,
        },
        created_at: { bsonType: "date" },
      },
    },
  },
});
db.albums.createIndex({ product_id: 1 }, { unique: true });
db.albums.createIndex({ track_ids: 1 });
print("✅ albums collection created");

// -----------------------------------------------------------------------------
// 7. MERCH — สินค้ากายภาพ (เสื้อ, vinyl, cd, ฯลฯ)
// variants ใช้ embed array (ไม่แยก collection)
// -----------------------------------------------------------------------------
db.createCollection("merch", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["product_id", "merch_type", "created_at"],
      properties: {
        product_id: { bsonType: "objectId" },
        merch_type: {
          enum: ["tshirt", "vinyl", "cd", "cassette", "poster", "other"],
        },
        weight_grams: { bsonType: "int" },
        ships_internationally: { bsonType: "bool" },
        variants: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["variant_id", "stock_quantity"],
            properties: {
              variant_id: { bsonType: "objectId" },
              size: { bsonType: "string" },
              color: { bsonType: "string" },
              stock_quantity: { bsonType: "int", minimum: 0 },
              sku: { bsonType: "string" },
            },
          },
        },
        created_at: { bsonType: "date" },
      },
    },
  },
});
db.merch.createIndex({ product_id: 1 }, { unique: true });
db.merch.createIndex({ "variants.sku": 1 });
print("✅ merch collection created");

// -----------------------------------------------------------------------------
// 8. ORDERS — คำสั่งซื้อ (รองรับ marketplace logic)
// แต่ละ item มี artist_id + fulfillment_status ของตัวเอง
// เพื่อรองรับ partial shipping (1 order มี items จากหลายศิลปิน)
// -----------------------------------------------------------------------------
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user_id", "items", "total", "status", "created_at"],
      properties: {
        user_id: { bsonType: "objectId" },
        items: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["product_id", "artist_id", "unit_price", "quantity"],
            properties: {
              product_id: { bsonType: "objectId" },
              artist_id: { bsonType: "objectId" },
              title_snapshot: { bsonType: "string" },
              unit_price: { bsonType: "int", minimum: 0 },
              quantity: { bsonType: "int", minimum: 1 },
              variant_id: { bsonType: ["objectId", "null"] },
              fulfillment_status: {
                enum: [
                  "digital_delivered",
                  "pending",
                  "preparing",
                  "shipped",
                  "delivered",
                  "cancelled",
                ],
              },
              tracking_number: { bsonType: ["string", "null"] },
              shipped_at: { bsonType: ["date", "null"] },
              delivered_at: { bsonType: ["date", "null"] },
            },
          },
        },
        subtotal: { bsonType: "int" },
        shipping_cost: { bsonType: "int" },
        platform_fee: { bsonType: "int" },
        total: { bsonType: "int" },
        currency: { bsonType: "string" },
        status: {
          enum: [
            "pending_payment",
            "paid",
            "partially_shipped",
            "fully_shipped",
            "completed",
            "cancelled",
            "refunded",
          ],
        },
        shipping_address: { bsonType: "object" },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },
});
db.orders.createIndex({ user_id: 1, created_at: -1 });
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ created_at: -1 });
db.orders.createIndex({ "items.artist_id": 1, "items.fulfillment_status": 1 });
print("✅ orders collection created");

// =============================================================================
// SCHEMA CREATION COMPLETE
// =============================================================================
print("");
print("🎉 ALL 8 COLLECTIONS CREATED SUCCESSFULLY!");
print("");
print("Collections:");
print("  1. users        — ผู้ใช้ทุก type (ADMIN/USER/ARTIST)");
print("  2. genres       — Master data (10 genres)");
print("  3. artists      — โปรไฟล์ศิลปิน + marketplace fields");
print("  4. products     — Sellable Product Layer (single/album/merch)");
print("  5. tracks       — ไฟล์เพลง");
print("  6. albums       — รวมเพลงเป็น album (Many-to-Many)");
print("  7. merch        — สินค้ากายภาพ + variants");
print("  8. orders       — คำสั่งซื้อ + marketplace logic");
print("");
print("Next step: รัน sample_data.js เพื่อใส่ข้อมูลตัวอย่าง");
