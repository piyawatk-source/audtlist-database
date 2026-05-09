// =============================================================================
// AUDTLIST - SAMPLE DATA
// =============================================================================
// Description: ข้อมูลตัวอย่างสำหรับ test ระบบ
// Prerequisite: ต้องรัน schema.js สำเร็จก่อน
//
// วิธีใช้:
// 1. ตรวจสอบว่ารัน schema.js เสร็จแล้ว (มี 8 collections)
// 2. Copy ไฟล์นี้ทั้งหมด → วางใน mongosh → Enter
// 3. ระบบจะใส่ข้อมูล:
//    - 10 genres
//    - 1 admin + 1 artist user + 1 customer user
//    - 1 artist (Old World Vultures)
//    - 3 products (single + album + merch)
//    - 4 tracks
//    - 1 album (Midnight Echoes)
//    - 1 merch (Cadaver Shirt)
//    - 1 order (มาลีซื้อทั้ง 3 รายการ)
// =============================================================================

// -----------------------------------------------------------------------------
// 1. GENRES — 10 master data
// -----------------------------------------------------------------------------
db.genres.insertMany([
  { name: "Rock", slug: "rock", created_at: new Date() },
  { name: "Pop", slug: "pop", created_at: new Date() },
  { name: "Hip Hop", slug: "hip-hop", created_at: new Date() },
  { name: "Electronic", slug: "electronic", created_at: new Date() },
  { name: "Jazz", slug: "jazz", created_at: new Date() },
  { name: "Folk", slug: "folk", created_at: new Date() },
  { name: "Metal", slug: "metal", created_at: new Date() },
  { name: "Indie", slug: "indie", created_at: new Date() },
  { name: "R&B", slug: "rnb", created_at: new Date() },
  { name: "Classical", slug: "classical", created_at: new Date() },
]);
print("✅ Inserted 10 genres");

// -----------------------------------------------------------------------------
// 2. USERS — admin + artist + customer
// -----------------------------------------------------------------------------
db.users.insertMany([
  {
    username: "admin01",
    email: "admin@audtlist.com",
    password_hash: "$2b$10$adminhashplaceholder",
    user_type: "ADMIN",
    display_name: "System Admin",
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    username: "owv_band",
    email: "owv@mail.com",
    password_hash: "$2b$10$artisthashplaceholder",
    user_type: "ARTIST",
    display_name: "Old World Vultures",
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    username: "malee_fan",
    email: "malee@mail.com",
    password_hash: "$2b$10$customerhashplaceholder",
    user_type: "USER",
    display_name: "มาลี",
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  },
]);
print("✅ Inserted 3 users (admin + artist + customer)");

// -----------------------------------------------------------------------------
// 3. ARTISTS — Old World Vultures (พร้อม marketplace fields)
// -----------------------------------------------------------------------------
const owvUser = db.users.findOne({ username: "owv_band" });
const rockGenre = db.genres.findOne({ slug: "rock" });
const indieGenre = db.genres.findOne({ slug: "indie" });

db.artists.insertOne({
  user_id: owvUser._id,
  slug: "old-world-vultures",
  name: "Old World Vultures",
  bio: "วงดนตรี indie rock จากกรุงเทพ",
  location: "Bangkok, Thailand",
  banner_url: "https://example.com/banners/owv.jpg",
  genre_ids: [rockGenre._id, indieGenre._id],
  status: "active",
  shipping_address: {
    line1: "123 ซ.ลาดพร้าว 71",
    line2: "แขวงลาดพร้าว",
    city: "กรุงเทพ",
    postal_code: "10230",
    country: "TH",
  },
  payout_method: {
    type: "promptpay",
    account_info: {
      phone_number: "0812345678",
      account_name: "Old World Vultures",
    },
  },
  payout_balance: 0,
  created_at: new Date(),
  updated_at: new Date(),
});
print("✅ Inserted artist: Old World Vultures");

// -----------------------------------------------------------------------------
// 4. PRODUCTS — 3 ตัว (single + album + merch)
// -----------------------------------------------------------------------------
const owvArtist = db.artists.findOne({ slug: "old-world-vultures" });

db.products.insertMany([
  {
    artist_id: owvArtist._id,
    type: "single",
    title: "Crimson Dawn (Single)",
    slug: "crimson-dawn",
    description: "เพลงเปิดอัลบั้ม Midnight Echoes",
    price: 30,
    name_your_price: false,
    cover_url: "https://example.com/covers/crimson.jpg",
    status: "published",
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    artist_id: owvArtist._id,
    type: "album",
    title: "Midnight Echoes",
    slug: "midnight-echoes",
    description: "อัลบั้มเต็มชุดแรกของวง",
    price: 250,
    name_your_price: false,
    cover_url: "https://example.com/covers/midnight.jpg",
    status: "published",
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    artist_id: owvArtist._id,
    type: "merch",
    title: "Exquisite Cadaver Shirt",
    slug: "exquisite-cadaver-shirt",
    description: "เสื้อยืดวง Old World Vultures",
    price: 980,
    name_your_price: false,
    cover_url: "https://example.com/covers/shirt.jpg",
    status: "published",
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  },
]);
print("✅ Inserted 3 products (single + album + merch)");

// -----------------------------------------------------------------------------
// 5. TRACKS — 4 เพลง (Crimson Dawn + 3 เพลงในอัลบั้ม)
// -----------------------------------------------------------------------------
const singleProduct = db.products.findOne({ slug: "crimson-dawn" });
const albumProduct = db.products.findOne({ slug: "midnight-echoes" });

// Track ของ single (Crimson Dawn) — ใช้ product_id ของ single
db.tracks.insertOne({
  product_id: singleProduct._id,
  duration_sec: 245,
  audio_file_url: "https://example.com/audio/crimson-dawn-full.flac",
  preview_url: "https://example.com/audio/crimson-dawn-preview.mp3",
  is_streamable: true,
  created_at: new Date(),
});

// Tracks ของ album — ใช้ product_id ของ album (3 เพลง)
db.tracks.insertMany([
  {
    product_id: new ObjectId(),
    duration_sec: 312,
    audio_file_url: "https://example.com/audio/midnight-full.flac",
    preview_url: "https://example.com/audio/midnight-preview.mp3",
    is_streamable: true,
    created_at: new Date(),
  },
  {
    product_id: new ObjectId(),
    duration_sec: 285,
    audio_file_url: "https://example.com/audio/shadow-full.flac",
    preview_url: "https://example.com/audio/shadow-preview.mp3",
    is_streamable: true,
    created_at: new Date(),
  },
  {
    product_id: new ObjectId(),
    duration_sec: 401,
    audio_file_url: "https://example.com/audio/whisper-full.flac",
    preview_url: "https://example.com/audio/whisper-preview.mp3",
    is_streamable: true,
    created_at: new Date(),
  },
]);
print("✅ Inserted 4 tracks");

// -----------------------------------------------------------------------------
// 6. ALBUMS — Midnight Echoes (Many-to-Many กับ tracks)
// -----------------------------------------------------------------------------
const allTracks = db.tracks.find().toArray();
const trackIds = allTracks.map((t) => t._id);

db.albums.insertOne({
  product_id: albumProduct._id,
  release_date: new Date("2026-01-15"),
  track_ids: trackIds,
  created_at: new Date(),
});
print(
  "✅ Inserted album: Midnight Echoes (with " + trackIds.length + " tracks)",
);

// -----------------------------------------------------------------------------
// 7. MERCH — Exquisite Cadaver Shirt (พร้อม variants 2 ขนาด)
// -----------------------------------------------------------------------------
const shirtProduct = db.products.findOne({ slug: "exquisite-cadaver-shirt" });

db.merch.insertOne({
  product_id: shirtProduct._id,
  merch_type: "tshirt",
  weight_grams: 200,
  ships_internationally: true,
  variants: [
    {
      variant_id: new ObjectId(),
      size: "M",
      color: "black",
      stock_quantity: 25,
      sku: "EC-SHIRT-M-BLK",
    },
    {
      variant_id: new ObjectId(),
      size: "L",
      color: "black",
      stock_quantity: 18,
      sku: "EC-SHIRT-L-BLK",
    },
  ],
  created_at: new Date(),
});
print("✅ Inserted merch: Cadaver Shirt (M, L sizes)");

// -----------------------------------------------------------------------------
// 8. ORDERS — Scenario มาลีซื้อ 3 รายการ
// -----------------------------------------------------------------------------
const malee = db.users.findOne({ username: "malee_fan" });
const shirtMerch = db.merch.findOne({ product_id: shirtProduct._id });
const variantM = shirtMerch.variants.find((v) => v.sku === "EC-SHIRT-M-BLK");

// คำนวณราคา:
// Subtotal = 30 + 250 + 980 = 1,260
// Shipping = 100 (เพราะมี merch)
// Total = 1,360
// Platform fee = 15% ของ subtotal = 189
// Artist payout = 1,260 - 189 = 1,071

db.orders.insertOne({
  user_id: malee._id,
  items: [
    {
      product_id: singleProduct._id,
      product_type: "single",
      artist_id: owvArtist._id,
      title_snapshot: "Crimson Dawn (Single)",
      unit_price: 30,
      quantity: 1,
      variant_id: null,
      fulfillment_status: "digital_delivered",
      tracking_number: null,
      shipped_at: null,
      delivered_at: new Date(),
    },
    {
      product_id: albumProduct._id,
      product_type: "album",
      artist_id: owvArtist._id,
      title_snapshot: "Midnight Echoes",
      unit_price: 250,
      quantity: 1,
      variant_id: null,
      fulfillment_status: "digital_delivered",
      tracking_number: null,
      shipped_at: null,
      delivered_at: new Date(),
    },
    {
      product_id: shirtProduct._id,
      product_type: "merch",
      artist_id: owvArtist._id,
      title_snapshot: "Exquisite Cadaver Shirt",
      unit_price: 980,
      quantity: 1,
      variant_id: variantM.variant_id,
      fulfillment_status: "pending",
      tracking_number: null,
      shipped_at: null,
      delivered_at: null,
    },
  ],
  subtotal: 1260,
  shipping_cost: 100,
  platform_fee: 189,
  total: 1360,
  currency: "THB",
  status: "paid",
  shipping_address: {
    recipient_name: "มาลี ใจดี",
    line1: "456 ถนนพหลโยธิน",
    line2: "เขตจตุจักร",
    city: "กรุงเทพ",
    postal_code: "10400",
    country: "TH",
  },
  created_at: new Date(),
  updated_at: new Date(),
});
print("✅ Inserted order (มาลี: 3 items)");

// -----------------------------------------------------------------------------
// 9. POST-ORDER ACTIONS — ลด stock + เพิ่ม payout balance
// -----------------------------------------------------------------------------

// ลด stock ของเสื้อ M สีดำ
db.merch.updateOne(
  {
    product_id: shirtProduct._id,
    variants: {
      $elemMatch: {
        sku: "EC-SHIRT-M-BLK",
        stock_quantity: { $gte: 1 },
      },
    },
  },
  { $inc: { "variants.$.stock_quantity": -1 } },
);
print("✅ Reduced stock of EC-SHIRT-M-BLK by 1");

// เพิ่ม payout balance ให้ artist
db.artists.updateOne(
  { _id: owvArtist._id },
  {
    $inc: { payout_balance: 1071 },
    $set: { updated_at: new Date() },
  },
);
print("✅ Added 1,071 THB to OWV payout balance");

// =============================================================================
// SAMPLE DATA INSERTION COMPLETE
// =============================================================================
print("");
print("🎉 ALL SAMPLE DATA INSERTED!");
print("");
print("Summary:");
print("  - 10 genres (master data)");
print("  - 3 users (1 admin, 1 artist, 1 customer)");
print("  - 1 artist (Old World Vultures)");
print("  - 3 products (single, album, merch)");
print("  - 4 tracks");
print("  - 1 album (Midnight Echoes)");
print("  - 1 merch (Cadaver Shirt)");
print("  - 1 order (มาลี: 3 items)");
print("");
print("Try these queries:");
print("  db.products.find({ status: 'published' }).sort({ created_at: -1 })");
print("  db.orders.find({ 'items.artist_id': owvArtist._id })");
print("  db.artists.findOne({ slug: 'old-world-vultures' })");
