const API = "http://localhost:3000";

let rooms = [];
let bookings = [];

let modal;
let toast;

document.addEventListener("DOMContentLoaded", () => {
  modal = new bootstrap.Modal(document.getElementById("bookingModal"));
  toast = bootstrap.Toast.getOrCreateInstance(document.getElementById("appToast"), { delay: 2000 });

  document.getElementById("btnAdd").addEventListener("click", openAddModal);
  document.getElementById("bookingForm").addEventListener("submit", saveBooking);

  document.getElementById("filterType").addEventListener("change", renderWithFilters);
  document.getElementById("searchInput").addEventListener("input", renderWithFilters);
  document.getElementById("btnReset").addEventListener("click", () => {
    document.getElementById("filterType").value = "all";
    document.getElementById("searchInput").value = "";
    renderWithFilters();
  });

  // Load everything
  init();
});

async function init() {
  await loadRooms();      // must be first
  await loadBookings();
  renderWithFilters();
}

function showToast(msg) {
  document.getElementById("toastMsg").textContent = msg;
  toast.show();
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error("API GET failed: " + path);
  return res.json();
}

async function apiPost(path, data) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("API POST failed: " + path);
  return res.json();
}

async function apiPut(path, data) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("API PUT failed: " + path);
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error("API DELETE failed: " + path);
}

async function loadRooms() {
  rooms = await apiGet("/rooms");

  const roomSelect = document.getElementById("roomId");
  roomSelect.innerHTML = "";

  // Default option (so user must select)
  roomSelect.innerHTML = `<option value="" selected>Select room</option>`;

  rooms.forEach(r => {
    roomSelect.innerHTML += `<option value="${r.id}">${r.roomNumber} (${r.type})</option>`;
  });

  if (rooms.length === 0) {
    showToast("Rooms list is empty in db.json");
  }
}

async function loadBookings() {
  bookings = await apiGet("/bookings");
}

function getRoom(roomId) {
  return rooms.find(r => String(r.id) === String(roomId));
}

function renderWithFilters() {
  const type = document.getElementById("filterType").value;
  const q = document.getElementById("searchInput").value.trim().toLowerCase();

  const filtered = bookings.filter(b => {
    const room = getRoom(b.roomId);
    const matchType = type === "all" ? true : room?.type === type;
    const matchSearch =
      !q ||
      b.studentName.toLowerCase().includes(q) ||
      b.rollNo.toLowerCase().includes(q);

    return matchType && matchSearch;
  });

  renderTable(filtered);
}

function renderTable(list) {
  const tbody = document.getElementById("bookingTable");
  const emptyState = document.getElementById("emptyState");

  if (!list.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("d-none");
    return;
  }
  emptyState.classList.add("d-none");

  tbody.innerHTML = list.map((b, idx) => {
    const room = getRoom(b.roomId);
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(b.studentName)}</td>
        <td>${escapeHtml(b.rollNo)}</td>
        <td>${room ? escapeHtml(room.roomNumber) : "-"}</td>
        <td>${room ? escapeHtml(room.type) : "-"}</td>
        <td>${b.checkIn}</td>
        <td>${b.checkOut}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" data-edit="${b.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-del="${b.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("Delete this booking?")) return;
      await apiDelete(`/bookings/${id}`);
      await loadBookings();
      renderWithFilters();
      showToast("Booking deleted");
    });
  });

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(btn.getAttribute("data-edit")));
  });
}

async function openAddModal() {
  // Refresh rooms every time modal opens (fix for empty dropdown)
  try {
    await loadRooms();
  } catch (e) {
    showToast("JSON Server not running (rooms not loaded)");
    return;
  }

  document.getElementById("modalTitle").textContent = "Add Booking";
  document.getElementById("bookingId").value = "";
  document.getElementById("bookingForm").reset();

  modal.show();
}

function openEditModal(id) {
  const b = bookings.find(x => String(x.id) === String(id));
  if (!b) return;

  document.getElementById("modalTitle").textContent = "Edit Booking";
  document.getElementById("bookingId").value = b.id;

  document.getElementById("studentName").value = b.studentName;
  document.getElementById("rollNo").value = b.rollNo;
  document.getElementById("roomId").value = String(b.roomId);
  document.getElementById("checkIn").value = b.checkIn;
  document.getElementById("checkOut").value = b.checkOut;

  modal.show();
}

async function saveBooking(e) {
  e.preventDefault();

  const id = document.getElementById("bookingId").value.trim();
  const studentName = document.getElementById("studentName").value.trim();
  const rollNo = document.getElementById("rollNo").value.trim();
  const roomId = document.getElementById("roomId").value; // keep as string first
  const checkIn = document.getElementById("checkIn").value;
  const checkOut = document.getElementById("checkOut").value;

  if (!roomId) {
    showToast("Please select a room");
    return;
  }

  // Constraint: checkout after checkin
  if (new Date(checkOut) <= new Date(checkIn)) {
    showToast("Error: Check-out must be after Check-in");
    return;
  }

  const payload = { studentName, rollNo, roomId: Number(roomId), checkIn, checkOut };

  if (!id) {
    await apiPost("/bookings", payload);
    showToast("Booking added");
  } else {
    await apiPut(`/bookings/${id}`, { ...payload, id: Number(id) });
    showToast("Booking updated");
  }

  modal.hide();
  await loadBookings();
  renderWithFilters();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
