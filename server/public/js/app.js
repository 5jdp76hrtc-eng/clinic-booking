const API = "/api";
let services = [];
let selectedTime = null;

const dayNames = { 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة", 6: "السبت" };

async function loadClinicInfo() {
  try {
    const res = await fetch(`${API}/clinic`);
    const data = await res.json();
    document.getElementById("clinicNameLabel").textContent = data.name;
    document.getElementById("footerClinicName").textContent = data.name;
    document.getElementById("clinicHoursLabel").textContent = `${data.dayStart} – ${data.dayEnd}`;
    const days = data.workDays.map((d) => dayNames[d]);
    document.getElementById("clinicDaysLabel").textContent = `${days[0]} – ${days[days.length - 1]}`;
    document.title = `${data.name} — احجز موعدك أونلاين`;
  } catch (e) {
    console.error("تعذر تحميل بيانات العيادة", e);
  }
}

async function loadServices() {
  const res = await fetch(`${API}/services`);
  services = await res.json();

  const grid = document.getElementById("servicesGrid");
  grid.innerHTML = services
    .map(
      (s) => `
    <div class="service-card">
      <h3>${s.name}</h3>
      <p>${s.description || ""}</p>
      <div class="service-meta">
        <span>⏱ ${s.duration_minutes} دقيقة</span>
        
      </div>
    </div>`
    )
    .join("");

  const select = document.getElementById("serviceSelect");
  services.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} — ${s.duration_minutes} د`;
    select.appendChild(opt);
  });
}

function setMinDateToday() {
  const input = document.getElementById("dateInput");
  const today = new Date().toISOString().split("T")[0];
  input.min = today;
  input.value = today;
}

async function loadAvailability(date) {
  const grid = document.getElementById("slotsGrid");
  grid.innerHTML = `<div class="slots-empty">جارِ تحميل المواعيد...</div>`;
  selectedTime = null;

  const res = await fetch(`${API}/availability?date=${date}`);
  const data = await res.json();

  if (!data.open) {
    grid.innerHTML = `<div class="slots-empty">العيادة مغلقة في هذا اليوم، الرجاء اختيار يوم آخر.</div>`;
    return;
  }

  if (!data.slots.length) {
    grid.innerHTML = `<div class="slots-empty">لا توجد مواعيد متاحة</div>`;
    return;
  }

  grid.innerHTML = data.slots
    .map(
      (s) => `<button type="button" class="slot-btn" data-time="${s.time}" ${s.available ? "" : "disabled"}>${s.time}</button>`
    )
    .join("");

  grid.querySelectorAll(".slot-btn:not(:disabled)").forEach((btn) => {
    btn.addEventListener("click", () => {
      grid.querySelectorAll(".slot-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedTime = btn.dataset.time;
    });
  });
}

function showMsg(text, type) {
  const el = document.getElementById("formMsg");
  el.textContent = text;
  el.className = `form-msg ${type}`;
}

function openConfirm({ ticket, booking, service }) {
  document.getElementById("confirmTicketNum").textContent = ticket;
  document.getElementById("confirmName").textContent = booking.patient_name;
  document.getElementById("confirmService").textContent = service.name;
  document.getElementById("confirmDate").textContent = booking.date;
  document.getElementById("confirmTime").textContent = booking.time;
  document.getElementById("confirmOverlay").classList.add("open");
}

async function handleSubmit(e) {
  e.preventDefault();
  showMsg("", "");
  document.getElementById("formMsg").className = "form-msg";

  const date = document.getElementById("dateInput").value;
  const service_id = document.getElementById("serviceSelect").value;
  const patient_name = document.getElementById("nameInput").value.trim();
  const phone = document.getElementById("phoneInput").value.trim();
  const notes = document.getElementById("notesInput").value.trim();

  if (!date || !selectedTime) return showMsg("الرجاء اختيار التاريخ والوقت", "error");
  if (!service_id) return showMsg("الرجاء اختيار الخدمة", "error");
  if (!patient_name || !phone) return showMsg("الرجاء تعبئة الاسم ورقم الهاتف", "error");

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "جارِ الحجز...";

  try {
    const res = await fetch(`${API}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_name, phone, service_id, date, time: selectedTime, notes }),
    });
    const data = await res.json();

    if (!res.ok) {
      showMsg(data.error || "حدث خطأ، حاول مرة أخرى", "error");
      if (res.status === 409) loadAvailability(date); // تحديث القائمة إذا صار تعارض
      return;
    }

    showMsg("تم تأكيد حجزك بنجاح ✅", "success");
    openConfirm(data);
    document.getElementById("bookingForm").reset();
    setMinDateToday();
    loadAvailability(date);
  } catch (err) {
    showMsg("تعذر الاتصال بالخادم", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "تأكيد الحجز";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadClinicInfo();
  loadServices();
  setMinDateToday();
  loadAvailability(document.getElementById("dateInput").value);

  document.getElementById("dateInput").addEventListener("change", (e) => loadAvailability(e.target.value));
  document.getElementById("bookingForm").addEventListener("submit", handleSubmit);
  document.getElementById("confirmClose").addEventListener("click", () => {
    document.getElementById("confirmOverlay").classList.remove("open");
  });
});
