const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * يرسل رسالة نصية إلى تيليجرام. لا يرمي خطأ إلى الخارج حتى لا يفشل الحجز
 * بسبب مشكلة في الإشعار — فقط يسجل الخطأ في الكونسول.
 */
async function sendTelegramMessage(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("⚠️  TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID غير مضبوطين في .env — تم تخطي الإشعار.");
    return { ok: false, skipped: true };
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("فشل إرسال إشعار تيليجرام:", data.description);
    }
    return data;
  } catch (err) {
    console.error("خطأ في الاتصال بتيليجرام:", err.message);
    return { ok: false, error: err.message };
  }
}

function formatBookingMessage({ booking, service, clinicName }) {
  const ticket = `#${String(booking.id).padStart(4, "0")}`;
  return [
    `🔔 <b>حجز موعد جديد — ${clinicName}</b>`,
    ``,
    `🎫 رقم الحجز: <b>${ticket}</b>`,
    `👤 المريض: ${booking.patient_name}`,
    `📞 الهاتف: ${booking.phone}`,
    `🩺 الخدمة: ${service.name}`,
    `📅 التاريخ: ${booking.date}`,
    `⏰ الوقت: ${booking.time}`,
    booking.notes ? `📝 ملاحظات: ${booking.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

module.exports = { sendTelegramMessage, formatBookingMessage };
