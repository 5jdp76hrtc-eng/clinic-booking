const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "clinic.db"));
db.pragma("journal_mode = WAL");

// ---------- إنشاء الجداول ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    price REAL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_id INTEGER NOT NULL,
    date TEXT NOT NULL,       -- YYYY-MM-DD
    time TEXT NOT NULL,       -- HH:MM
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled | done
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (service_id) REFERENCES services(id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_unique
    ON bookings(date, time)
    WHERE status != 'cancelled';
`);

// ---------- بيانات أولية للخدمات إن لم تكن موجودة ----------
const serviceCount = db.prepare("SELECT COUNT(*) AS c FROM services").get().c;
if (serviceCount === 0) {
  const insert = db.prepare(`
    INSERT INTO services (name, description, duration_minutes, price)
    VALUES (@name, @description, @duration_minutes, @price)
  `);
  const defaults = [
    { name: "كشف وتنظيف أسنان", description: "فحص شامل وتنظيف وإزالة الجير", duration_minutes: 30, price: 100 },
    { name: "حشوة أسنان", description: "حشوة تجميلية بلون الأسنان الطبيعي", duration_minutes: 30, price: 150 },
    { name: "خلع سن", description: "خلع بسيط أو جراحي حسب الحالة", duration_minutes: 20, price: 120 },
    { name: "علاج عصب", description: "علاج قناة الجذر وتسكين الألم", duration_minutes: 60, price: 400 },
    { name: "تركيب تاج (كراون)", description: "تركيبات ثابتة لحماية السن وتقويته", duration_minutes: 45, price: 600 },
    { name: "تبييض أسنان", description: "جلسة تبييض احترافية بالعيادة", duration_minutes: 45, price: 350 },
    { name: "تقويم أسنان — استشارة", description: "تقييم الحالة ووضع خطة التقويم", duration_minutes: 30, price: 200 },
    { name: "ابتسامة هوليوود / فينير", description: "تصميم ابتسامة تجميلية متكاملة", duration_minutes: 60, price: 800 },
    { name: "زراعة أسنان — استشارة", description: "تقييم أولي لحالة الزراعة", duration_minutes: 30, price: 250 },
  ];
  const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  insertMany(defaults);
}
// ---------- إضافة خدمات التجميل الجديدة (بدون التأثير على الخدمات الموجودة) ----------
  const checkExists = db.prepare("SELECT id FROM services WHERE name = ?");
  const insertOne = db.prepare(`
    INSERT INTO services (name, description, duration_minutes, price)
    VALUES (@name, @description, @duration_minutes, @price)
  `);

  const newServices = [
    { name: "فلر الشفة", description: "حقن فلر لملء وتحديد الشفاه", duration_minutes: 30, price: 0 },
    { name: "فلر الأصداغ", description: "حقن فلر لملء منطقة الأصداغ", duration_minutes: 30, price: 0 },
    { name: "فلر الوجنات", description: "حقن فلر لإبراز عظام الوجنتين", duration_minutes: 30, price: 0 },
    { name: "فلر تكساس", description: "حقن فلر تكساس لنحت خط الفك", duration_minutes: 30, price: 0 },
    { name: "فلر الذقن", description: "حقن فلر لتحديد وإبراز الذقن", duration_minutes: 30, price: 0 },
    { name: "فلر تغيير شامل", description: "جلسة فلر شاملة لكل ملامح الوجه", duration_minutes: 30, price: 0 },
    { name: "بوتوكس حول العين", description: "بوتوكس لتنعيم خطوط ما حول العين", duration_minutes: 30, price: 0 },
    { name: "بوتوكس الجبين", description: "بوتوكس لتنعيم خطوط الجبين", duration_minutes: 30, price: 0 },
    { name: "بوتوكس الأنف", description: "بوتوكس لتحسين شكل الأنف", duration_minutes: 30, price: 0 },
    { name: "بوتوكس تحديد الوجه", description: "بوتوكس لتحديد ونحت ملامح الوجه", duration_minutes: 30, price: 0 },
    { name: "ميزو نضارة", description: "جلسة ميزوثيرابي لنضارة البشرة", duration_minutes: 30, price: 0 },
    { name: "ميزو تبييض", description: "جلسة ميزوثيرابي لتفتيح لون البشرة", duration_minutes: 30, price: 0 },
    { name: "ميزو إزالة تصبغات", description: "جلسة ميزوثيرابي لإزالة التصبغات", duration_minutes: 30, price: 0 },
    { name: "ميزو شد", description: "جلسة ميزوثيرابي لشد البشرة", duration_minutes: 30, price: 0 },
    { name: "إبرة الشد والنضارة", description: "إبرة لشد ونضارة البشرة بأنواعها", duration_minutes: 30, price: 0 },
    { name: "إبرة تحفيز الكولاجين", description: "إبرة لتحفيز إنتاج الكولاجين بالبشرة", duration_minutes: 30, price: 0 },
  ];

  newServices.forEach((s) => {
    const exists = checkExists.get(s.name);
    if (!exists) insertOne.run(s);
  });

module.exports = db;
