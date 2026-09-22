/**
 * Shared notification bell widget.
 * Expects a container element with id="notif-bell-container" to exist in the page.
 */

async function initNotificationBell() {
  const container = document.getElementById("notif-bell-container");
  if (!container) return;

  container.innerHTML = `
    <div class="bell-wrap">
      <button class="bell-btn" id="bell-btn" aria-label="Notifications">
        🔔
        <span class="bell-count hidden" id="bell-count">0</span>
      </button>
      <div class="bell-dropdown" id="bell-dropdown">
        <div class="notif-empty" id="notif-loading">Loading…</div>
      </div>
    </div>
  `;

  const bellBtn = document.getElementById("bell-btn");
  const dropdown = document.getElementById("bell-dropdown");

  bellBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isShown = dropdown.classList.toggle("show");
    if (isShown) {
      await loadNotifications();
    }
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove("show");
    }
  });

  await refreshNotificationCount();
  // Poll periodically so badges stay fresh without a full page reload.
  setInterval(refreshNotificationCount, 20000);
}

async function refreshNotificationCount() {
  try {
    const notifications = await apiRequest("/api/notifications");
    const unread = notifications.filter((n) => !n.is_read).length;
    const countEl = document.getElementById("bell-count");
    if (!countEl) return;
    if (unread > 0) {
      countEl.textContent = unread > 9 ? "9+" : String(unread);
      countEl.classList.remove("hidden");
    } else {
      countEl.classList.add("hidden");
    }
  } catch {
    // Silently ignore — notification badge is non-critical.
  }
}

async function loadNotifications() {
  const dropdown = document.getElementById("bell-dropdown");
  dropdown.innerHTML = `<div class="notif-empty">Loading…</div>`;

  try {
    const notifications = await apiRequest("/api/notifications");

    if (!notifications.length) {
      dropdown.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
      return;
    }

    dropdown.innerHTML = notifications
      .map(
        (n) => `
        <div class="notif-item ${n.is_read ? "" : "unread"}" data-id="${n.id}">
          <div>${escapeHtml(n.message)}</div>
          <div class="time">${timeAgo(n.created_at)}</div>
        </div>
      `
      )
      .join("");

    dropdown.querySelectorAll(".notif-item.unread").forEach((el) => {
      el.addEventListener("click", async () => {
        const id = el.getAttribute("data-id");
        try {
          await apiRequest(`/api/notifications/${id}/read`, { method: "PUT" });
          el.classList.remove("unread");
          refreshNotificationCount();
        } catch {
          // ignore
        }
      });
    });
  } catch {
    dropdown.innerHTML = `<div class="notif-empty">Couldn't load notifications.</div>`;
  }
}
