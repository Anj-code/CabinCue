(function () {
  Auth.requireRole("faculty");

  document.getElementById("nav-user-name").textContent = Auth.getName() || "Faculty";
  document.getElementById("logout-btn").addEventListener("click", () => Auth.logout());

  initNotificationBell();

  const greetingEl = document.getElementById("greeting");
  const deptLineEl = document.getElementById("dept-line");

  const availabilityToggle = document.getElementById("availability-toggle");
  const availabilityDot = document.getElementById("availability-dot");
  const availabilityLabel = document.getElementById("availability-label");

  const locBuildingEl = document.getElementById("loc-building");
  const locCabinEl = document.getElementById("loc-cabin");
  const editLocationBtn = document.getElementById("edit-location-btn");
  const locationForm = document.getElementById("location-form");
  const editBuildingInput = document.getElementById("edit-building");
  const editCabinInput = document.getElementById("edit-cabin");
  const cancelLocationBtn = document.getElementById("cancel-location-btn");
  const saveLocationBtn = document.getElementById("save-location-btn");

  const pendingEl = document.getElementById("pending-appointments");
  const upcomingEl = document.getElementById("upcoming-appointments");

  const rescheduleOverlay = document.getElementById("reschedule-modal-overlay");
  const rescheduleForm = document.getElementById("reschedule-form");
  const rescheduleStudentNameEl = document.getElementById("reschedule-student-name");
  const rescheduleDateInput = document.getElementById("reschedule-date");
  const rescheduleTimeInput = document.getElementById("reschedule-time");
  const rescheduleCancelBtn = document.getElementById("reschedule-cancel-btn");
  const rescheduleSubmitBtn = document.getElementById("reschedule-submit-btn");

  rescheduleDateInput.min = todayISODate();

  let rescheduleApptId = null;

  function greetingPhrase() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function setAvailabilityUI(isAvailable) {
    availabilityToggle.checked = isAvailable;
    availabilityDot.classList.toggle("on", isAvailable);
    availabilityLabel.classList.toggle("on", isAvailable);
    availabilityLabel.classList.toggle("off", !isAvailable);
    availabilityLabel.textContent = isAvailable ? "🟢 AVAILABLE" : "🔴 NOT AVAILABLE";
  }

  async function loadProfile() {
    try {
      const profile = await apiRequest("/api/faculty/me");
      greetingEl.textContent = `${greetingPhrase()}, ${profile.name}`;
      deptLineEl.textContent = `${profile.department} · Faculty ID: ${profile.faculty_id}`;
      locBuildingEl.textContent = profile.building;
      locCabinEl.textContent = profile.cabin;
      editBuildingInput.value = profile.building;
      editCabinInput.value = profile.cabin;
      setAvailabilityUI(profile.is_available);
    } catch (err) {
      showToast("Could not load your profile.", "error");
    }
  }

  availabilityToggle.addEventListener("change", async () => {
    const newValue = availabilityToggle.checked;
    availabilityToggle.disabled = true;
    try {
      const profile = await apiRequest("/api/faculty/availability", {
        method: "PUT",
        body: { is_available: newValue },
      });
      setAvailabilityUI(profile.is_available);
      showToast(
        profile.is_available
          ? "You're now marked as AVAILABLE for walk-ins."
          : "You're now marked as NOT AVAILABLE.",
        "success"
      );
    } catch (err) {
      // revert the visual toggle on failure
      setAvailabilityUI(!newValue);
      showToast(err.message || "Could not update availability.", "error");
    } finally {
      availabilityToggle.disabled = false;
    }
  });

  editLocationBtn.addEventListener("click", () => {
    locationForm.classList.remove("hidden");
  });
  cancelLocationBtn.addEventListener("click", () => {
    locationForm.classList.add("hidden");
  });

  locationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveLocationBtn.disabled = true;
    saveLocationBtn.textContent = "Saving…";
    try {
      const profile = await apiRequest("/api/faculty/location", {
        method: "PUT",
        body: {
          building: editBuildingInput.value.trim(),
          cabin: editCabinInput.value.trim(),
        },
      });
      locBuildingEl.textContent = profile.building;
      locCabinEl.textContent = profile.cabin;
      locationForm.classList.add("hidden");
      showToast("Location updated.", "success");
    } catch (err) {
      showToast(err.message || "Could not update location.", "error");
    } finally {
      saveLocationBtn.disabled = false;
      saveLocationBtn.textContent = "Save Changes";
    }
  });

  async function loadAppointments() {
    pendingEl.innerHTML = `<div class="spinner"></div>`;
    upcomingEl.innerHTML = `<div class="spinner"></div>`;
    try {
      const appts = await apiRequest("/api/faculty/appointments");
      renderPending(appts.filter((a) => a.status === "PENDING"));
      renderUpcoming(
        appts.filter((a) => a.status === "CONFIRMED" || a.status === "RESCHEDULED")
      );
    } catch (err) {
      pendingEl.innerHTML = `<div class="empty-state">Could not load appointment requests.</div>`;
      upcomingEl.innerHTML = "";
    }
  }

  function renderPending(appts) {
    if (!appts.length) {
      pendingEl.innerHTML = `<div class="empty-state">No pending appointment requests.</div>`;
      return;
    }
    pendingEl.innerHTML = appts
      .map(
        (a) => `
        <div class="appt-card">
          <div class="appt-main">
            <div class="who">${escapeHtml(a.student_name)}</div>
            <div class="meta">📅 ${formatDate(a.date)} &nbsp; 🕐 ${formatTime(a.time)}</div>
            <div class="reason">"${escapeHtml(a.reason)}"</div>
          </div>
          <div class="appt-actions">
            <button class="btn btn-success btn-sm accept-btn" data-id="${a.id}">Accept</button>
            <button class="btn btn-danger btn-sm reject-btn" data-id="${a.id}">Reject</button>
          </div>
        </div>
      `
      )
      .join("");

    pendingEl.querySelectorAll(".accept-btn").forEach((btn) =>
      btn.addEventListener("click", () => handleAccept(btn.getAttribute("data-id")))
    );
    pendingEl.querySelectorAll(".reject-btn").forEach((btn) =>
      btn.addEventListener("click", () => handleReject(btn.getAttribute("data-id")))
    );
  }

  function renderUpcoming(appts) {
    if (!appts.length) {
      upcomingEl.innerHTML = `<div class="empty-state">No upcoming confirmed appointments.</div>`;
      return;
    }
    appts.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    upcomingEl.innerHTML = appts
      .map((a) => {
        let rescheduleNote = "";
        if (a.status === "RESCHEDULED" && a.previous_date && a.previous_time) {
          rescheduleNote = `<div class="reschedule-note">🔵 Moved from ${formatDate(a.previous_date)}, ${formatTime(a.previous_time)}</div>`;
        }
        return `
        <div class="appt-card">
          <div class="appt-main">
            <div class="who">${escapeHtml(a.student_name)}</div>
            <div class="meta">📅 ${formatDate(a.date)} &nbsp; 🕐 ${formatTime(a.time)}</div>
            <div class="reason">"${escapeHtml(a.reason)}"</div>
            ${rescheduleNote}
          </div>
          <div class="appt-actions">
            <span class="badge ${statusBadgeClass(a.status)}">${statusEmoji(a.status)} ${a.status}</span>
            <button class="btn btn-outline btn-sm reschedule-btn" data-id="${a.id}" data-name="${escapeHtml(a.student_name)}" data-date="${a.date}" data-time="${a.time}">
              Reschedule
            </button>
            <button class="btn btn-danger btn-sm reject-btn" data-id="${a.id}">Cancel</button>
          </div>
        </div>
      `;
      })
      .join("");

    upcomingEl.querySelectorAll(".reschedule-btn").forEach((btn) =>
      btn.addEventListener("click", () => openRescheduleModal(btn))
    );
    upcomingEl.querySelectorAll(".reject-btn").forEach((btn) =>
      btn.addEventListener("click", () => handleReject(btn.getAttribute("data-id")))
    );
  }

  async function handleAccept(id) {
    try {
      await apiRequest(`/api/faculty/appointments/${id}/accept`, { method: "PUT" });
      showToast("Appointment accepted.", "success");
      loadAppointments();
    } catch (err) {
      showToast(err.message || "Could not accept appointment.", "error");
    }
  }

  async function handleReject(id) {
    try {
      await apiRequest(`/api/faculty/appointments/${id}/reject`, { method: "PUT" });
      showToast("Appointment rejected.", "success");
      loadAppointments();
    } catch (err) {
      showToast(err.message || "Could not reject appointment.", "error");
    }
  }

  function openRescheduleModal(btn) {
    rescheduleApptId = btn.getAttribute("data-id");
    rescheduleStudentNameEl.textContent = `With ${btn.getAttribute("data-name")}`;
    rescheduleDateInput.value = btn.getAttribute("data-date");
    rescheduleTimeInput.value = btn.getAttribute("data-time");
    rescheduleDateInput.min = todayISODate();
    rescheduleOverlay.classList.add("show");
  }

  rescheduleCancelBtn.addEventListener("click", () => rescheduleOverlay.classList.remove("show"));
  rescheduleOverlay.addEventListener("click", (e) => {
    if (e.target === rescheduleOverlay) rescheduleOverlay.classList.remove("show");
  });

  rescheduleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!rescheduleApptId) return;

    rescheduleSubmitBtn.disabled = true;
    rescheduleSubmitBtn.textContent = "Saving…";

    try {
      await apiRequest(`/api/faculty/appointments/${rescheduleApptId}/reschedule`, {
        method: "PUT",
        body: { date: rescheduleDateInput.value, time: rescheduleTimeInput.value },
      });
      showToast("Appointment rescheduled.", "success");
      rescheduleOverlay.classList.remove("show");
      loadAppointments();
    } catch (err) {
      showToast(err.message || "Could not reschedule appointment.", "error");
    } finally {
      rescheduleSubmitBtn.disabled = false;
      rescheduleSubmitBtn.textContent = "Save New Time";
    }
  });

  // Initial load
  loadProfile();
  loadAppointments();
})();
