// =============================================================================
// AUDTLIST - MOCK DATA: VELVET CROWS
// =============================================================================
// Description: Mock data ของศิลปิน "Velvet Crows" สำหรับทดสอบระบบ
// Includes:
//   - 1 artist (Velvet Crows)
//   - 10 tracks (ทุกเพลงขายเป็น single ได้)
//   - 5 albums (บางเพลงอยู่หลาย album = Many-to-Many)
//   - 5 merch (เสื้อ, vinyl, cd, poster, cassette)
//   - Total products: 10 single + 5 album + 5 merch = 20
//
// Prerequisite:
//   - ต้องรัน schema.js สำเร็จก่อน (มี 8 collections พร้อม validators)
//   - genres ต้องมีข้อมูลแล้ว (จาก sample_data.js หรือสร้างเอง)
//
// วิธีใช้:
//   1. เปิด mongosh เชื่อม MongoDB Atlas
//   2. use audtlist_clone
//   3. Copy ไฟล์นี้ทั้งหมด → วางใน mongosh → Enter
//   4. ตรวจ: db.products.countDocuments({}) ควรเห็นเพิ่มขึ้น 20 รายการ
// =============================================================================

print("🎵 เริ่มใส่ mock data ของ Velvet Crows...");
print("");

// -----------------------------------------------------------------------------
// 1. สร้าง USER สำหรับ Velvet Crows
// -----------------------------------------------------------------------------
db.users.insertOne({
  username: "velvet_crows",
  email: "velvetcrows@mail.com",
  password_hash: "$2b$10$velvetcrowshash",
  user_type: "ARTIST",
  display_name: "Velvet Crows",
  status: "active",
  created_at: new Date(),
  updated_at: new Date(),
});
print("✅ Created user: velvet_crows");

// -----------------------------------------------------------------------------
// 2. สร้าง ARTIST (Velvet Crows)
// -----------------------------------------------------------------------------
const vcUser = db.users.findOne({ username: "velvet_crows" });

// หา genres ที่มีอยู่ (Indie + Rock — ถ้าไม่มีจะ skip)
const indieGenre = db.genres.findOne({ slug: "indie" });
const rockGenre = db.genres.findOne({ slug: "rock" });
const genreIds = [indieGenre, rockGenre]
  .filter((g) => g !== null)
  .map((g) => g._id);

db.artists.insertOne({
  user_id: vcUser._id,
  slug: "velvet-crows",
  name: "Velvet Crows",
  bio: "Dreamy indie rock from a rainy night. Music for late-night drives and morning regrets.",
  location: "Chiang Mai, Thailand",
  banner_url: "https://example.com/banners/velvet-crows.jpg",
  genre_ids: genreIds,
  shipping_address: {
    line1: "88/5 ถ.นิมมานเหมินทร์ ซอย 7",
    line2: "ต.สุเทพ อ.เมือง",
    city: "เชียงใหม่",
    postal_code: "50200",
    country: "TH",
  },
  payout_method: {
    type: "promptpay",
    account_info: {
      phone_number: "0898765432",
      account_name: "Velvet Crows",
    },
  },
  payout_balance: 0,
  created_at: new Date(),
  updated_at: new Date(),
});
print("✅ Created artist: Velvet Crows");

// เก็บ artist ไว้ใช้
const vcArtist = db.artists.findOne({ slug: "velvet-crows" });

// -----------------------------------------------------------------------------
// 3. สร้าง 10 PRODUCTS (type: single) — สำหรับทุกเพลง
// -----------------------------------------------------------------------------
// Pattern: ทุกเพลงขายแยก single ได้ → มี product type "single"
// แล้วเพลงเหล่านี้จะไปอยู่ใน albums ด้วย (Many-to-Many)

const trackData = [
  { title: "Hollow Bones", duration: 180, price: 25 },
  { title: "Cigarette Burns", duration: 210, price: 30 },
  { title: "Static Lights", duration: 245, price: 30 },
  { title: "Rust on Velvet", duration: 195, price: 25 },
  { title: "Slow Dance Goodbye", duration: 220, price: 35 },
  { title: "Feather and Glass", duration: 260, price: 30 },
  { title: "Honey, Don't Stay", duration: 175, price: 25 },
  { title: "Coal Eyes", duration: 290, price: 40 },
  { title: "Ghost Years", duration: 205, price: 30 },
  { title: "Salt and Memory", duration: 230, price: 30 },
];

const singleProducts = trackData.map((t) => ({
  artist_id: vcArtist._id,
  type: "single",
  title: t.title,
  slug: t.title
    .toLowerCase()
    .replace(/[,'.]/g, "") // ลบ punctuation
    .replace(/\s+/g, "-") // space → dash
    .replace(/-+/g, "-"), // dash ซ้ำ → ตัวเดียว
  description: `Single track from Velvet Crows`,
  price: t.price,
  name_your_price: false,
  cover_url: `https://example.com/covers/vc-${t.title.toLowerCase().replace(/\s+/g, "-")}.jpg`,
  status: "published",
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
}));

db.products.insertMany(singleProducts);
print("✅ Created 10 single products");

// -----------------------------------------------------------------------------
// 4. สร้าง 10 TRACKS — ผูกกับ single products
// -----------------------------------------------------------------------------
const allSingleProducts = db.products
  .find({
    artist_id: vcArtist._id,
    type: "single",
  })
  .toArray();

// Map title → product
const titleToProduct = {};
allSingleProducts.forEach((p) => {
  titleToProduct[p.title] = p;
});

const trackDocs = trackData.map((t) => {
  const product = titleToProduct[t.title];
  const safeName = t.title
    .toLowerCase()
    .replace(/[,'.]/g, "")
    .replace(/\s+/g, "-");
  return {
    product_id: product._id,
    duration_sec: t.duration,
    audio_file_url: `https://example.com/audio/vc-${safeName}-full.flac`,
    preview_url: `https://example.com/audio/vc-${safeName}-preview.mp3`,
    is_streamable: true,
    created_at: new Date(),
  };
});

db.tracks.insertMany(trackDocs);
print("✅ Created 10 tracks");

// เก็บ tracks ไว้ใช้
const allTracks = db.tracks
  .find({
    product_id: { $in: allSingleProducts.map((p) => p._id) },
  })
  .toArray();

// Map title → track (ผ่าน product)
const titleToTrack = {};
allSingleProducts.forEach((p) => {
  const t = allTracks.find((t) => String(t.product_id) === String(p._id));
  titleToTrack[p.title] = t;
});

// -----------------------------------------------------------------------------
// 5. สร้าง 5 ALBUM PRODUCTS
// -----------------------------------------------------------------------------
// แต่ละ album มี products + albums entry ที่ link ไปยัง tracks

const albumData = [
  {
    title: "Dark Romantics",
    slug: "dark-romantics",
    price: 150,
    description: "Debut album. Late-night confessions in 4 parts.",
    release_date: new Date("2025-08-12"),
    track_titles: [
      "Hollow Bones",
      "Cigarette Burns",
      "Static Lights",
      "Rust on Velvet",
    ],
  },
  {
    title: "Under the Streetlight",
    slug: "under-the-streetlight",
    price: 120,
    description: "An EP about finding warmth in cold cities.",
    release_date: new Date("2025-12-03"),
    track_titles: [
      "Slow Dance Goodbye",
      "Feather and Glass",
      "Honey, Don't Stay",
    ],
  },
  {
    title: "B-Sides Vol. 1",
    slug: "b-sides-vol-1",
    price: 100,
    description: "Rare cuts and reimagined versions.",
    release_date: new Date("2026-02-14"),
    // ⭐ ซ้ำกับ albums อื่น — Many-to-Many ทำงานจริง
    track_titles: ["Hollow Bones", "Slow Dance Goodbye", "Ghost Years"],
  },
  {
    title: "Live at Sunset",
    slug: "live-at-sunset",
    price: 180,
    description: "Live recording at Sunset Cafe, Chiang Mai.",
    release_date: new Date("2026-04-20"),
    track_titles: ["Cigarette Burns", "Coal Eyes", "Salt and Memory"],
  },
  {
    title: "Dust",
    slug: "dust",
    price: 50,
    description: "Single album — extended cut of Ghost Years.",
    release_date: new Date("2026-05-01"),
    track_titles: ["Ghost Years"], // album with 1 track = "single album"
  },
];

const albumProducts = albumData.map((a) => ({
  artist_id: vcArtist._id,
  type: "album",
  title: a.title,
  slug: a.slug,
  description: a.description,
  price: a.price,
  name_your_price: false,
  cover_url: `https://example.com/covers/vc-${a.slug}.jpg`,
  status: "published",
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
}));

db.products.insertMany(albumProducts);
print("✅ Created 5 album products");

// -----------------------------------------------------------------------------
// 6. สร้าง 5 ALBUMS — ผูก product + tracks (Many-to-Many)
// -----------------------------------------------------------------------------
const allAlbumProducts = db.products
  .find({
    artist_id: vcArtist._id,
    type: "album",
  })
  .toArray();

const slugToAlbumProduct = {};
allAlbumProducts.forEach((p) => {
  slugToAlbumProduct[p.slug] = p;
});

const albumDocs = albumData.map((a) => {
  const product = slugToAlbumProduct[a.slug];
  const trackIds = a.track_titles.map((title) => titleToTrack[title]._id);
  return {
    product_id: product._id,
    release_date: a.release_date,
    track_ids: trackIds,
    created_at: new Date(),
  };
});

db.albums.insertMany(albumDocs);
print("✅ Created 5 albums (with Many-to-Many tracks)");

// -----------------------------------------------------------------------------
// 7. สร้าง 5 MERCH PRODUCTS
// -----------------------------------------------------------------------------
const merchData = [
  {
    title: "Velvet Crows Logo Tshirt",
    slug: "velvet-crows-logo-tshirt",
    price: 750,
    description: "Black 100% cotton tshirt with embroidered logo",
    merch_type: "tshirt",
    weight_grams: 220,
    variants: [
      { size: "M", color: "black", stock_quantity: 30, sku: "VC-TSHIRT-M-BLK" },
      { size: "L", color: "black", stock_quantity: 25, sku: "VC-TSHIRT-L-BLK" },
      {
        size: "XL",
        color: "black",
        stock_quantity: 15,
        sku: "VC-TSHIRT-XL-BLK",
      },
    ],
  },
  {
    title: "Dark Romantics — Vinyl LP",
    slug: "dark-romantics-vinyl",
    price: 1200,
    description: "Limited 12-inch vinyl pressing, 180g audiophile quality",
    merch_type: "vinyl",
    weight_grams: 280,
    variants: [
      {
        size: "12in",
        color: "black",
        stock_quantity: 50,
        sku: "VC-VINYL-DR-BLK",
      },
      {
        size: "12in",
        color: "red",
        stock_quantity: 20,
        sku: "VC-VINYL-DR-RED",
      },
    ],
  },
  {
    title: "Live at Sunset — CD",
    slug: "live-at-sunset-cd",
    price: 350,
    description: "Limited CD with bonus tracks and lyric booklet",
    merch_type: "cd",
    weight_grams: 100,
    variants: [
      { size: null, color: null, stock_quantity: 100, sku: "VC-CD-LIVE-001" },
    ],
  },
  {
    title: "Velvet Crows Concert Poster",
    slug: "velvet-crows-concert-poster",
    price: 250,
    description: "Hand-screen-printed concert poster, signed",
    merch_type: "poster",
    weight_grams: 80,
    variants: [
      { size: "A3", color: null, stock_quantity: 40, sku: "VC-POSTER-A3" },
      { size: "A2", color: null, stock_quantity: 25, sku: "VC-POSTER-A2" },
    ],
  },
  {
    title: "Velvet Crows Logo Cassette",
    slug: "velvet-crows-cassette",
    price: 290,
    description: "Limited cassette release with handmade artwork",
    merch_type: "cassette",
    weight_grams: 90,
    variants: [
      { size: null, color: "clear", stock_quantity: 30, sku: "VC-CASS-CLR" },
      { size: null, color: "black", stock_quantity: 20, sku: "VC-CASS-BLK" },
    ],
  },
];

const merchProducts = merchData.map((m) => ({
  artist_id: vcArtist._id,
  type: "merch",
  title: m.title,
  slug: m.slug,
  description: m.description,
  price: m.price,
  name_your_price: false,
  cover_url: `https://example.com/covers/vc-${m.slug}.jpg`,
  status: "published",
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
}));

db.products.insertMany(merchProducts);
print("✅ Created 5 merch products");

// -----------------------------------------------------------------------------
// 8. สร้าง 5 MERCH ENTRIES — ผูก variants
// -----------------------------------------------------------------------------
const allMerchProducts = db.products
  .find({
    artist_id: vcArtist._id,
    type: "merch",
  })
  .toArray();

const slugToMerchProduct = {};
allMerchProducts.forEach((p) => {
  slugToMerchProduct[p.slug] = p;
});

const merchDocs = merchData.map((m) => {
  const product = slugToMerchProduct[m.slug];
  // ทำความสะอาด variants — ลบ size/color ที่เป็น null
  const cleanVariants = m.variants.map((v) => {
    const variant = {
      variant_id: new ObjectId(),
      stock_quantity: v.stock_quantity,
      sku: v.sku,
    };
    if (v.size !== null && v.size !== undefined) variant.size = v.size;
    if (v.color !== null && v.color !== undefined) variant.color = v.color;
    return variant;
  });
  return {
    product_id: product._id,
    merch_type: m.merch_type,
    weight_grams: m.weight_grams,
    ships_internationally: true,
    variants: cleanVariants,
    created_at: new Date(),
  };
});

db.merch.insertMany(merchDocs);
print("✅ Created 5 merch entries with variants");

// =============================================================================
// SUMMARY
// =============================================================================
print("");
print("=".repeat(60));
print("🎉 MOCK DATA INSERTED FOR VELVET CROWS");
print("=".repeat(60));
print("");
print("📊 Summary:");
print("  - 1 artist:   Velvet Crows (Chiang Mai)");
print("  - 10 tracks:  ทุกเพลงขายเป็น single ได้");
print("  - 5 albums:   Dark Romantics, Under the Streetlight,");
print("                B-Sides Vol.1, Live at Sunset, Dust");
print("  - 5 merch:    Tshirt, Vinyl, CD, Poster, Cassette");
print("");
print("📦 Total products created: 20");
print("    (10 single + 5 album + 5 merch)");
print("");
print("🔁 Many-to-Many demo:");
print('   "Hollow Bones" → อยู่ใน Dark Romantics + B-Sides Vol.1');
print('   "Slow Dance Goodbye" → อยู่ใน Under the Streetlight + B-Sides');
print('   "Ghost Years" → อยู่ใน B-Sides + Dust');
print('   "Cigarette Burns" → อยู่ใน Dark Romantics + Live at Sunset');
print("");
print("🧪 Try these queries:");
print("");
print("  // ดู products ของ Velvet Crows ทั้งหมด");
print(
  '  db.products.find({ artist_id: db.artists.findOne({slug:"velvet-crows"})._id })',
);
print("");
print("  // ดู tracks ของอัลบั้ม Dark Romantics พร้อม detail");
print(
  '  const album = db.albums.findOne({ product_id: db.products.findOne({slug:"dark-romantics"})._id })',
);
print("  db.tracks.find({ _id: { $in: album.track_ids } })");
print("");
print('  // หา albums ที่มีเพลง "Hollow Bones"');
print("  const track = db.tracks.findOne({...})  // หา track นี้ก่อน");
print("  db.albums.find({ track_ids: track._id })");
print("");
print("  // ดู merch + variants พร้อม stock");
print(
  '  db.merch.find({ product_id: { $in: db.products.find({type:"merch", artist_id: vcArtist._id}).map(p=>p._id).toArray() } })',
);
