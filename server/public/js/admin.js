const API = "/api";

function getPass() { return sessionStorage.getItem("admin_pass"); }
function setPass(p) { sessionStorage.setItem("admin_pass", p); }
function clearPass() { sessionStorage.removeItem("admin_pass"); }

function showDash() {
  document.getElementById("loginView").style.display = "none";
  document.getElementById("dashView").style.display = "block";
  loadBookings();
}
function showLogin(msg) {
  document.getElementById("loginView").style.display = "block";
  document.getElementById("dashView").style.display = "none";
  document.getElementById("loginMsg").textContent = msg || "";
}

async function login() {
  const password = document.getElementById("adminPass").value;
  const res = await fetch(`${API}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) return showLogin("كلمة المرور غير صحيحة");
  setPass(password);
  showDash();
}

async function loadBookings() {
  const res = await fetch(`${API}/admin/bookings`, {
    headers: { "x-admin-password": getPass() },
  });
  if (res.status === 401) { clearPass(); return showLogin("انتهت الجلسة، سجّل الدخول مجددًا"); }

  const rows = await res.json();
  const body = document.getElementById("bookingsBody");
  body.innerHTML = rows
    .map(
      (b) => `
    <tr>
      <td>#${String(b.id).padStart(4, "0")}</td>
      <td>${b.patient_name}</td>
      <td>${b.phone}</td>
      <td>${b.service_name}</td>
      <td>${b.date}</td>
      <td>${b.time}</td>
      <td>
        <select class="status status-${b.status}" data-id="${b.id}">
          <option value="confirmed" ${b.status === "confirmed" ? "selected" : ""}>مؤكد</option>
          <option value="done" ${b.status === "done" ? "selected" : ""}>مكتمل</option>
          <option value="cancelled" ${b.status === "cancelled" ? "selected" : ""}>ملغى</option>
        </select>
      </td>
    </tr>`
    )
    .join("");

  body.querySelectorAll("select.status").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      await fetch(`${API}/admin/bookings/${e.target.dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": getPass() },
        body: JSON.stringify({ status: e.target.value }),
      });
      e.target.className = `status status-${e.target.value}`;
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("adminPass").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
  document.getElementById("logoutBtn").addEventListener("click", () => { clearPass(); showLogin(); });

  if (getPass()) showDash();
  else showLogin();
});
