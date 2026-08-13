require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./db");
const { sendTelegramMessage, formatBookingMessage } = require("./telegram");

const app = express();
const PORT = process.env.PORT || 3000;
const CLINIC_NAME = process.env.CLINIC_NAME || "العيادة";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ---------------- إعدادات دوام العيادة ----------------
// أيام العمل: 0=الأحد 1=الاثنين 2=الثلاثاء 3=الأربعاء 4=الخميس 5=الجمعة 6=السبت
const WORK_DAYS = [0, 1, 2, 3, 4]; // الأحد - الخميس
const DAY_START = "15:00";
const DAY_END = "22:00";
const BREAK_START = "22:00"; // لا توجد استراحة — نفس وقت النهاية فتُلغى تلقائيًا
const BREAK_END = "22:00";
const SLOT_MINUTES = 30;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function buildDaySlots() {
  const slots = [];
  for (let t = toMinutes(DAY_START); t < toMinutes(DAY_END); t += SLOT_MINUTES) {
    if (t >= toMinutes(BREAK_START) && t < toMinutes(BREAK_END)) continue;
    slots.push(toHHMM(t));
  }
  return slots;
}

function isPastDateTime(dateStr, timeStr) {
  const now = new Date();
  const slot = new Date(`${dateStr}T${timeStr}:00`);
  return slot.getTime() < now.getTime();
}

// ---------------- Middleware للإدارة ----------------
function requireAdmin(req, res, next) {
  const pass = req.header("x-admin-password");
  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "غير مصرح" });
  }
  next();
}

// ================== واجهات API العامة ==================

app.get("/api/clinic", (req, res) => {
  res.json({ name: CLINIC_NAME, workDays: WORK_DAYS, dayStart: DAY_START, dayEnd: DAY_END });
});

app.get("/api/services", (req, res) => {
  const services = db.prepare("SELECT * FROM services WHERE active = 1 ORDER BY id").all();
  res.json(services);
});

// المواعيد المتاحة ليوم معين
app.get("/api/availability", (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "التاريخ مطلوب بصيغة YYYY-MM-DD" });
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  if (!WORK_DAYS.includes(dayOfWeek)) {
    return res.json({ date, open: false, slots: [] });
  }

  const taken = new Set(
    db
      .prepare("SELECT time FROM bookings WHERE date = ? AND status != 'cancelled'")
      .all(date)
      .map((r) => r.time)
  );

  const slots = buildDaySlots().map((time) => ({
    time,
    available: !taken.has(time) && !isPastDateTime(date, time),
  }));

  res.json({ date, open: true, slots });
});

// إنشاء حجز جديد
app.post("/api/bookings", async (req, res) => {
  const { patient_name, phone, service_id, date, time, notes } = req.body || {};

  if (!patient_name || !phone || !service_id || !date || !time) {
    return res.status(400).json({ error: "الرجاء تعبئة جميع الحقول المطلوبة" });
  }

  const service = db.prepare("SELECT * FROM services WHERE id = ? AND active = 1").get(service_id);
  if (!service) {
    return res.status(404).json({ error: "الخدمة غير موجودة" });
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  if (!WORK_DAYS.includes(dayOfWeek)) {
    return res.status(400).json({ error: "العيادة مغلقة في هذا اليوم" });
  }
  if (isPastDateTime(date, time)) {
    return res.status(400).json({ error: "لا يمكن الحجز في وقت مضى" });
  }

  const clash = db
    .prepare("SELECT id FROM bookings WHERE date = ? AND time = ? AND status != 'cancelled'")
    .get(date, time);
  if (clash) {
    return res.status(409).json({ error: "هذا الموعد محجوز بالفعل، الرجاء اختيار موعد آخر" });
  }

  const insert = db.prepare(`
    INSERT INTO bookings (patient_name, phone, service_id, date, time, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = insert.run(patient_name.trim(), phone.trim(), service_id, date, time, (notes || "").trim());
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(info.lastInsertRowid);

  // إشعار تيليجرام — لا يعطل الاستجابة إن فشل
  sendTelegramMessage(formatBookingMessage({ booking, service, clinicName: CLINIC_NAME })).catch(() => {});

  res.status(201).json({
    booking,
    service,
    ticket: `#${String(booking.id).padStart(4, "0")}`,
  });
});

// ================== واجهات الإدارة ==================

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
  }
  res.json({ ok: true });
});

app.get("/api/admin/bookings", requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT b.*, s.name AS service_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       ORDER BY b.date DESC, b.time DESC`
    )
    .all();
  res.json(rows);
});

app.patch("/api/admin/bookings/:id", requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!["confirmed", "cancelled", "done"].includes(status)) {
    return res.status(400).json({ error: "حالة غير صالحة" });
  }
  db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ ${CLINIC_NAME} — الخادم يعمل على http://localhost:${PORT}`);
});
