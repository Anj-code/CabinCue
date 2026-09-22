(function () {
  Auth.requireRole("student");

  document.getElementById("nav-user-name").textContent = Auth.getName() || "Student";
  document.getElementById("logout-btn").addEventListener("click", () => Auth.logout());

  initNotificationBell();

  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const resultsEl = document.getElementById("faculty-results");
  const myApptsEl = document.getElementById("my-appointments");

  const modalOverlay = document.getElementById("appt-modal-overlay");
  const apptForm = document.getElementById("appt-form");
  const apptFacultyNameEl = document.getElementById("appt-modal-faculty-name");
  const apptDateInput = document.getElementById("appt-date");
  const apptTimeInput = document.getElementById("appt-time");
  const apptReasonInput = document.getElementById("appt-reason");
  const apptSubmitBtn = document.getElementById("appt-submit-btn");
  const apptCancelBtn = document.getElementById("appt-cancel-btn");

  let selectedFacultyId = null;
  apptDateInput.min = todayISODate();

  async function searchFaculty(query) {
    resultsEl.innerHTML = `<div class="spinner"></div>`;
    try {
      const params = query ? `?name=${encodeURIComponent(query)}` : "";
      const faculty = await apiRequest(`/api/students/search${params}`);
      renderFacultyResults(faculty);
    } catch (err) {
      resultsEl.innerHTML = `<div class="empty-state">Could not load results: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderFacultyResults(faculty) {
    if (!faculty.length) {
      resultsEl.innerHTML = `<div class="empty-state">No faculty members found. Try a different name.</div>`;
      return;
    }

    resultsEl.innerHTML = faculty
      .map((f) => {
        const badgeClass = f.is_available ? "badge-available" : "badge-unavailable";
        const badgeText = f.is_available ? "🟢 AVAILABLE" : "🔴 NOT AVAILABLE";
        return `
        <div class="faculty-card">
          <h3>${escapeHtml(f.name)}</h3>
          <div class="dept">${escapeHtml(f.department)}</div>
          <span class="badge ${badgeClass}">${badgeText}</span>
          <div class="faculty-location">
            <div>📍 ${escapeHtml(f.building)}</div>
            <div>🏢 Cabin ${escapeHtml(f.cabin)}</div>
          </div>
          <div class="actions">
            <button class="btn btn-secondary btn-block request-btn" data-faculty-id="${f.user_id}" data-faculty-name="${escapeHtml(f.name)}">
              Request Appointment
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    resultsEl.querySelectorAll(".request-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedFacultyId = btn.getAttribute("data-faculty-id");
        apptFacultyNameEl.textContent = `With ${btn.getAttribute("data-faculty-name")}`;
        apptForm.reset();
        apptDateInput.min = todayISODate();
        modalOverlay.classList.add("show");
      });
    });
  }

  searchBtn.addEventListener("click", () => searchFaculty(searchInput.value.trim()));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchFaculty(searchInput.value.trim());
  });

  apptCancelBtn.addEventListener("click", () => modalOverlay.classList.remove("show"));
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove("show");
  });

  apptForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) return;

    apptSubmitBtn.disabled = true;
    apptSubmitBtn.textContent = "Sending…";

    try {
      await apiRequest("/api/students/appointments", {
        method: "POST",
        body: {
          faculty_id: Number(selectedFacultyId),
          date: apptDateInput.value,
          time: apptTimeInput.value,
          reason: apptReasonInput.value.trim(),
        },
      });
      showToast("Appointment request sent!", "success");
      modalOverlay.classList.remove("show");
      loadMyAppointments();
    } catch (err) {
      showToast(err.message || "Could not send request.", "error");
    } finally {
      apptSubmitBtn.disabled = false;
      apptSubmitBtn.textContent = "Send Request";
    }
  });

  async function loadMyAppointments() {
    myApptsEl.innerHTML = `<div class="spinner"></div>`;
    try {
      const appts = await apiRequest("/api/students/me/appointments");
      renderMyAppointments(appts);
    } catch (err) {
      myApptsEl.innerHTML = `<div class="empty-state">Could not load appointments.</div>`;
    }
  }

  function renderMyAppointments(appts) {
    if (!appts.length) {
      myApptsEl.innerHTML = `<div class="empty-state">You have no appointments yet. Search for a faculty member above to request one.</div>`;
      return;
    }

    // Most recently updated first
    appts.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    myApptsEl.innerHTML = appts
      .map((a) => {
        let rescheduleNote = "";
        if (a.status === "RESCHEDULED" && a.previous_date && a.previous_time) {
          rescheduleNote = `<div class="reschedule-note">🔵 Rescheduled from ${formatDate(a.previous_date)}, ${formatTime(a.previous_time)}</div>`;
        }
        return `
        <div class="appt-card">
          <div class="appt-main">
            <div class="who">${escapeHtml(a.faculty_name)}</div>
            <div class="meta">${escapeHtml(a.department || "")} · ${escapeHtml(a.building || "")}, Cabin ${escapeHtml(a.cabin || "")}</div>
            <div class="meta">📅 ${formatDate(a.date)} &nbsp; 🕐 ${formatTime(a.time)}</div>
            <div class="reason">"${escapeHtml(a.reason)}"</div>
            ${rescheduleNote}
          </div>
          <span class="badge ${statusBadgeClass(a.status)}">${statusEmoji(a.status)} ${a.status}</span>
        </div>
      `;
      })
      .join("");
  }

  // Initial load
  searchFaculty("");
  loadMyAppointments();
})();
